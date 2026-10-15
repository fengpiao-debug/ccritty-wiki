"""Keep the newest verified archive in the dedicated receiving directory."""
import hashlib
import json
from pathlib import Path
import re
import sys


ARCHIVE_NAME = re.compile(r'artist-wiki-[0-9]{8}-[0-9]{6}-[0-9a-f]{8}\.tar\.gz')


def retain_latest(directory):
    directory = Path(directory)
    # Never follow a redirected backup directory or clean its parent.
    if (not directory.is_absolute() or directory.name != 'artist-wiki'
            or directory.is_symlink() or directory.resolve(strict=True) != directory):
        raise ValueError('Expected the dedicated, real artist-wiki backup directory')
    archives = sorted((path for path in directory.iterdir()
                       if ARCHIVE_NAME.fullmatch(path.name)), key=lambda path: path.name)
    if not archives:
        raise RuntimeError('No complete backup to retain')
    # Validate every deletion candidate before changing any files.
    for archive in archives:
        checksum = archive.with_name(archive.name + '.sha256')
        if archive.is_symlink() or not archive.is_file():
            raise RuntimeError('Unexpected archive type')
        if checksum.is_symlink() or (checksum.exists() and not checksum.is_file()):
            raise RuntimeError('Unexpected checksum type')
    newest = archives[-1]
    checksum = newest.with_name(newest.name + '.sha256')
    match = re.fullmatch(r'([0-9a-f]{64})  ' + re.escape(newest.name) + r'\n?',
                         checksum.read_text(encoding='ascii'))
    if not match:
        raise RuntimeError('Latest backup checksum file is invalid')
    digest = hashlib.sha256()
    with newest.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != match[1]:
        raise RuntimeError('Latest backup checksum mismatch; history retained')
    removed = []
    removed_bytes = 0
    for archive in archives[:-1]:
        removed_bytes += archive.stat().st_size
        archive.unlink()
        checksum = archive.with_name(archive.name + '.sha256')
        if checksum.exists():
            checksum.unlink()
        removed.append(archive.name)
    return {'remote_path': str(newest), 'sha256': digest.hexdigest(),
            'removed_archives': removed, 'removed_bytes': removed_bytes,
            'retained_bytes': newest.stat().st_size}


if __name__ == '__main__':
    print(json.dumps(retain_latest(sys.argv[1]), indent=2))
