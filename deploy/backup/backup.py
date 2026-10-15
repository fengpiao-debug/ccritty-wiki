#!/usr/bin/env python3
"""Back up the deployed MySQL database and uploads, then verify an SSH copy.

Runs on the application server with Python 3.9+ and standard library only.
Passwords stay in a temporary mode-0600 MySQL option file, never argv/logs.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import signal
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid
from zoneinfo import ZoneInfo

TABLES = ('site_content', 'admin_users', 'content_versions', 'content_locks', 'audit_logs')


def log(message):
    print(datetime.now(timezone.utc).isoformat(timespec='seconds') + ' ' + message, flush=True)


def read_env(path):
    result = {}
    for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:]
        key, sep, value = line.partition('=')
        if not sep:
            raise ValueError('Invalid application environment file')
        value = value.strip()
        if value.startswith(('"', "'")):
            parts = shlex.split(value, comments=True)
            if len(parts) != 1:
                raise ValueError('Invalid quoted environment value')
            value = parts[0]
        result[key.strip()] = value
    return result


def load_config(path):
    config = json.loads(Path(path).read_text(encoding='utf-8'))
    for key in ('app_env', 'uploads_dir', 'local_dir', 'ssh_key', 'known_hosts'):
        config[key] = Path(config[key])
        if not config[key].is_absolute():
            raise ValueError(key + ' must be an absolute path')
    for key, pattern in (('remote_host', r'[A-Za-z0-9][A-Za-z0-9.-]*'),
                         ('remote_user', r'[A-Za-z_][A-Za-z0-9_-]*')):
        if not re.fullmatch(pattern, config[key]):
            raise ValueError('Invalid ' + key)
    remote_dir = config['remote_dir']
    if (not re.fullmatch(r'/[A-Za-z0-9_./-]+', remote_dir)
            or '..' in PurePosixPath(remote_dir).parts
            or str(PurePosixPath(remote_dir)) in ('/', '/var', '/var/www', '/tmp')):
        raise ValueError('remote_dir must be a dedicated absolute backup directory')
    config['remote_dir'] = str(PurePosixPath(remote_dir))
    config['remote_port'] = int(config.get('remote_port', 22))
    if not 1 <= config['remote_port'] <= 65535:
        raise ValueError('Invalid remote_port')
    uploads, local = config['uploads_dir'].resolve(), config['local_dir'].resolve()
    if local == uploads or uploads in local.parents:
        raise ValueError('local_dir cannot be inside uploads_dir')
    return config


def mysql_option(value):
    value = str(value).replace('\\', '\\\\').replace('"', '\\"')
    value = value.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
    return '"' + value + '"'


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def command(args, **kwargs):
    # Never include command output or arguments in exceptions: MySQL errors can
    # contain connection details. Operators can inspect the protected config.
    result = subprocess.run(args, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        raise RuntimeError(Path(str(args[0])).name + ' failed, exit ' + str(result.returncode))
    return result


def create_backup(config):
    env = read_env(config['app_env'])
    database = env['MYSQL_DATABASE']
    if not re.fullmatch(r'[A-Za-z0-9_]+', database):
        raise ValueError('Invalid MYSQL_DATABASE')
    uploads = config['uploads_dir'].resolve(strict=True)
    if not uploads.is_dir():
        raise ValueError('uploads_dir is not a directory')
    stamp = datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y%m%d-%H%M%S')
    name = 'artist-wiki-' + stamp + '-' + uuid.uuid4().hex[:8] + '.tar.gz'
    archive = config['local_dir'] / name
    with tempfile.TemporaryDirectory(prefix='.building-', dir=config['local_dir']) as directory:
        stage = Path(directory)
        options = stage / 'mysql.cnf'
        client = {'host': env.get('MYSQL_HOST', '127.0.0.1'),
                  'port': env.get('MYSQL_PORT', '3306'),
                  'user': env['MYSQL_USER'], 'password': env['MYSQL_PASSWORD']}
        options.write_text('[client]\n' + ''.join(key + '=' + mysql_option(value) + '\n'
                                                for key, value in client.items()), encoding='utf-8')
        options.chmod(0o600)
        sql = stage / 'database.sql'
        log('Dumping database ' + database)
        with sql.open('wb') as output:
            command(['mysqldump', '--defaults-extra-file=' + str(options),
                     '--single-transaction', '--quick', '--skip-lock-tables',
                     '--no-tablespaces', '--set-gtid-purged=OFF', '--hex-blob',
                     '--default-character-set=utf8mb4', '--databases', database],
                    stdout=output, timeout=1800)
        options.unlink()
        found = set()
        completed = False
        with sql.open('rb') as stream:
            for line in stream:
                match = re.match(rb'CREATE TABLE `([^`]+)`', line)
                if match:
                    found.add(match[1].decode('utf-8'))
                if line.startswith(b'-- Dump completed on '):
                    completed = True
        if not completed or not set(TABLES).issubset(found):
            raise RuntimeError('SQL dump is incomplete or application tables are missing')

        # Uploaded files use UUID names and are never overwritten/deleted by the
        # current application. Dump SQL first, then enumerate files so all media
        # referenced by that SQL snapshot are included. Concurrent new uploads
        # may add unreferenced files, which are harmless when restoring.
        files = []
        for path in sorted(uploads.rglob('*')):
            if path.is_symlink():
                raise RuntimeError('Unexpected symbolic link inside uploads')
            if path.is_file():
                files.append(path)
        manifest = {
            'format_version': 1, 'created_at': datetime.now(timezone.utc).isoformat(),
            'filename_timezone': 'Asia/Shanghai', 'source_host': socket.gethostname(),
            'database': database, 'tables': sorted(found), 'upload_files': len(files),
            'uploads_bytes': sum(path.stat().st_size for path in files),
            'includes': ['database.sql', 'uploads/', 'manifest.json'],
            'excludes': ['application code', 'server credentials and environment'],
        }
        log('Archiving ' + str(len(files)) + ' upload files')
        partial = stage / name
        with tarfile.open(partial, 'w:gz', compresslevel=6) as package:
            package.add(sql, arcname='database.sql')
            package.add(uploads, arcname='uploads', recursive=False)
            for folder in ('audio', 'images'):
                if (uploads / folder).is_dir():
                    package.add(uploads / folder, arcname='uploads/' + folder, recursive=False)
            for path in files:
                package.add(path, arcname='uploads/' + path.relative_to(uploads).as_posix(), recursive=False)
            data = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
            info = tarfile.TarInfo('manifest.json')
            info.size, info.mode = len(data), 0o600
            package.addfile(info, io.BytesIO(data))
        partial.chmod(0o600)
        digest = sha256(partial)
        os.replace(partial, archive)
        checksum = archive.with_name(name + '.sha256')
        checksum.write_text(digest + '  ' + name + '\n', encoding='ascii')
        checksum.chmod(0o600)
    log('Created ' + name + ' (' + str(archive.stat().st_size) + ' bytes)')
    return archive


def ssh_options(config):
    return ['-i', str(config['ssh_key']), '-o', 'BatchMode=yes',
            '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes',
            '-o', 'UserKnownHostsFile=' + str(config['known_hosts']),
            '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15',
            '-o', 'ServerAliveCountMax=3']


def upload_once(config, archive, digest):
    target = config['remote_user'] + '@' + config['remote_host']
    directory = config['remote_dir']
    name = archive.name
    quote = shlex.quote
    remote_file = directory + '/' + name
    partial = directory + '/.' + name + '.part'
    ssh = ['ssh', '-p', str(config['remote_port'])] + ssh_options(config) + [target]
    # Only the dedicated subdirectory is created/chmod'ed, never its parent.
    prepare = ('set -eu; umask 077; test ! -L ' + quote(directory)
               + '; mkdir -p -- ' + quote(directory)
               + '; chmod 700 -- ' + quote(directory))
    command(ssh + [prepare], stdout=subprocess.PIPE, timeout=60)
    command(['scp', '-P', str(config['remote_port'])] + ssh_options(config)
            + [str(archive), target + ':' + partial], stdout=subprocess.PIPE, timeout=3600)
    # Publish the final filename only after the complete copy matches SHA-256.
    # A retry after a lost SSH response may encounter an already published file;
    # accept it only when its bytes match this same backup.
    finalize = '\n'.join([
        'set -eu', 'umask 077', 'cd ' + quote(directory),
        'actual=$(sha256sum -- ' + quote(partial) + ')',
        '[ "${actual%% *}" = ' + quote(digest) + ' ] || { echo "Backup checksum mismatch" >&2; exit 1; }',
        'if [ -e ' + quote(remote_file) + ' ]; then',
        '  existing=$(sha256sum -- ' + quote(remote_file) + ')',
        '  [ "${existing%% *}" = ' + quote(digest) + ' ] || exit 1',
        '  rm -- ' + quote(partial),
        'else', '  chmod 600 -- ' + quote(partial),
        '  mv -- ' + quote(partial) + ' ' + quote(remote_file), 'fi',
        'printf \'%s  %s\\n\' ' + quote(digest) + ' ' + quote(name)
        + ' > ' + quote(name + '.sha256.part'),
        'chmod 600 -- ' + quote(name + '.sha256.part'),
        'mv -- ' + quote(name + '.sha256.part') + ' ' + quote(name + '.sha256'),
    ])
    command(ssh + [finalize], stdout=subprocess.PIPE, timeout=180)
    return remote_file


def transfer(config, archive):
    digest = sha256(archive)
    checksum = archive.with_name(archive.name + '.sha256')
    if checksum.exists() and checksum.read_text(encoding='ascii').split()[0] != digest:
        raise RuntimeError('Local backup checksum mismatch; file retained')
    for attempt in range(1, 4):
        try:
            log('Uploading ' + archive.name + ', attempt ' + str(attempt))
            remote_file = upload_once(config, archive, digest)
            log('Verified remote backup ' + remote_file + ' SHA256=' + digest)
            # Remote history is pruned once, after the transfer batch finishes.
            archive.unlink()
            if checksum.exists():
                checksum.unlink()
            return {'remote_path': remote_file, 'sha256': digest}
        except (OSError, RuntimeError, subprocess.TimeoutExpired):
            if attempt == 3:
                raise
            time.sleep(15)


def prune_remote_history(config):
    script = Path(__file__).with_name('retain_latest.py').read_text(encoding='utf-8')
    remote_command = 'python3 -c ' + shlex.quote(script) + ' ' + shlex.quote(config['remote_dir'])
    target = config['remote_user'] + '@' + config['remote_host']
    result = command(['ssh', '-p', str(config['remote_port'])] + ssh_options(config)
                     + [target, remote_command], stdout=subprocess.PIPE, timeout=180)
    retained = json.loads(result.stdout)
    log('Retained latest backup ' + retained['remote_path']
        + '; removed ' + str(len(retained['removed_archives'])) + ' older archives')
    return retained


@contextmanager
def exclusive_lock(path):
    import fcntl
    with Path(path).open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            yield False
            return
        try:
            yield True
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def run_backup(config, retry_only=False):
    local = config['local_dir']
    local.mkdir(parents=True, exist_ok=True, mode=0o700)
    local.chmod(0o700)
    with exclusive_lock(local / '.lock') as acquired:
        if not acquired:
            log('Another backup is running; skipped')
            return 0
        results, errors = [], []
        try:
            if not retry_only:
                create_backup(config)
        except Exception as error:
            errors.append('Snapshot failed: ' + str(error))
        # Even after a failed new snapshot, retry earlier completed archives.
        # Failed copies stay local; each daily run still creates a fresh backup.
        for archive in sorted(local.glob('artist-wiki-*.tar.gz')):
            try:
                results.append(transfer(config, archive))
            except Exception as error:
                errors.append(archive.name + ': ' + str(error))
        retained = None
        if results:
            try:
                # The receiver selects the newest timestamp, so an old retry
                # cannot replace a newer backup already stored there.
                retained = prune_remote_history(config)
            except Exception as error:
                errors.append('Remote history cleanup failed: ' + str(error))
        status = {'completed_at': datetime.now(timezone.utc).isoformat(),
                  'status': 'failed' if errors else 'success',
                  'uploaded': results, 'retained': retained, 'errors': errors}
        report = local / 'last-run.json.tmp'
        report.write_text(json.dumps(status, indent=2) + '\n', encoding='utf-8')
        os.replace(report, local / 'last-run.json')
        for error in errors:
            log('ERROR ' + error)
        log('Finished: ' + status['status'])
        return 1 if errors else 0


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default='/etc/artist-wiki-backup.json')
    parser.add_argument('--retry-only', action='store_true', help='Send pending archives without creating another snapshot')
    args = parser.parse_args()
    def interrupted(_signum, _frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupted)
    try:
        return run_backup(load_config(args.config), args.retry_only)
    except KeyboardInterrupt:
        log('Interrupted; completed local archives are retained')
        return 130
    except Exception as error:
        log('ERROR ' + str(error))
        return 1


if __name__ == '__main__':
    sys.exit(main())
