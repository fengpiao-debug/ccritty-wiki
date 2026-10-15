"""Tests use temporary files and mocked dump/SSH processes; no live database."""
import importlib.util
import json
import os
import shutil
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('wiki_backup', Path(__file__).with_name('backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.uploads = self.root / 'uploads'
        (self.uploads / 'audio').mkdir(parents=True)
        (self.uploads / 'images').mkdir()
        (self.uploads / 'audio' / 'song.mp3').write_bytes(b'example-audio')
        self.local = self.root / 'pending'
        self.local.mkdir()
        self.env = self.root / 'app.env'
        self.env.write_text('MYSQL_DATABASE=artist_wiki\nMYSQL_USER=app\nMYSQL_PASSWORD="secret#value"\n', encoding='utf-8')
        self.config = {'app_env': self.env, 'uploads_dir': self.uploads, 'local_dir': self.local,
                       'ssh_key': self.root / 'key', 'known_hosts': self.root / 'hosts',
                       'remote_host': 'example.com', 'remote_port': 22, 'remote_user': 'backup',
                       'remote_dir': '/srv/backups/artist-wiki'}
        self.sql = ('\n'.join('CREATE TABLE `' + table + '` ();' for table in backup.TABLES)
                    + '\n-- Dump completed on 2026-10-07 10:00:00\n').encode()

    def fake_dump(self, args, **kwargs):
        self.assertIn('--single-transaction', args)
        self.assertNotIn('secret#value', ' '.join(args))
        kwargs['stdout'].write(self.sql)

    def make_archive(self):
        with patch.object(backup, 'command', side_effect=self.fake_dump):
            return backup.create_backup(self.config)

    def test_archive_contains_sql_uploads_manifest_and_no_credentials(self):
        archive = self.make_archive()
        with tarfile.open(archive, 'r:gz') as package:
            self.assertEqual(package.extractfile('database.sql').read(), self.sql)
            self.assertEqual(package.extractfile('uploads/audio/song.mp3').read(), b'example-audio')
            manifest = json.load(package.extractfile('manifest.json'))
            self.assertEqual(manifest['upload_files'], 1)
            self.assertEqual(set(manifest['tables']), set(backup.TABLES))
            self.assertIn('uploads/images', package.getnames())
            self.assertFalse(any('mysql.cnf' in name or '.env' in name for name in package.getnames()))
        self.assertEqual(archive.with_name(archive.name + '.sha256').read_text().split()[0], backup.sha256(archive))
        self.assertFalse(list(self.local.glob('.building-*')))

    def test_incomplete_sql_never_publishes_archive(self):
        self.sql = b'CREATE TABLE `site_content` ();\n'
        with self.assertRaisesRegex(RuntimeError, 'incomplete'):
            self.make_archive()
        self.assertEqual(list(self.local.iterdir()), [])

    def test_dump_failure_cleans_credentials_and_staging(self):
        with patch.object(backup, 'command', side_effect=RuntimeError('dump failed')):
            with self.assertRaises(RuntimeError):
                backup.create_backup(self.config)
        self.assertEqual(list(self.local.iterdir()), [])

    def test_failed_transfer_retries_and_preserves_local_copy(self):
        archive = self.make_archive()
        with patch.object(backup, 'upload_once', side_effect=RuntimeError('offline')) as upload, patch.object(backup.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'offline'):
                backup.transfer(self.config, archive)
        self.assertEqual(upload.call_count, 3)
        self.assertTrue(archive.exists())
        self.assertTrue(archive.with_name(archive.name + '.sha256').exists())

    def test_successful_transfer_removes_only_verified_local_archive(self):
        archive = self.make_archive()
        other = self.local / 'keep-me.txt'
        other.write_text('keep')
        with patch.object(backup, 'upload_once', return_value='/remote/' + archive.name):
            result = backup.transfer(self.config, archive)
        self.assertEqual(len(result['sha256']), 64)
        self.assertFalse(archive.exists())
        self.assertTrue(other.exists())

    def test_corrupted_local_archive_is_never_sent_or_deleted(self):
        archive = self.make_archive()
        with archive.open('ab') as stream:
            stream.write(b'corrupt')
        with patch.object(backup, 'upload_once') as upload:
            with self.assertRaisesRegex(RuntimeError, 'checksum mismatch'):
                backup.transfer(self.config, archive)
        upload.assert_not_called()
        self.assertTrue(archive.exists())

    def test_verified_ssh_and_atomic_remote_publish(self):
        archive = self.make_archive()
        with patch.object(backup, 'command') as execute:
            backup.upload_once(self.config, archive, backup.sha256(archive))
        calls = [call.args[0] for call in execute.call_args_list]
        self.assertEqual(len(calls), 3)
        self.assertTrue(all('StrictHostKeyChecking=yes' in args for args in calls))
        self.assertEqual(calls[1][0], 'scp')
        self.assertTrue(calls[1][-1].endswith('.part'))
        finalize = calls[2][-1]
        self.assertLess(finalize.index('sha256sum'), finalize.index('mv --'))
        self.assertNotIn('rm -r', finalize)

    def test_mysql_options_escape_password_syntax(self):
        self.assertEqual(backup.mysql_option('a"b\\c\nd'), '"a\\"b\\\\c\\nd"')
        self.assertEqual(backup.read_env(self.env)['MYSQL_PASSWORD'], 'secret#value')

    @unittest.skipIf(os.name == 'nt', 'Runs the actual receiver shell on Linux')
    def test_corrupt_remote_transfer_is_never_published(self):
        archive = self.make_archive()
        receiver = self.root / 'receiver'
        config = {**self.config, 'remote_dir': str(receiver)}
        real_command = backup.command
        def fake_transport(args, **kwargs):
            if args[0] == 'scp':
                (receiver / ('.' + archive.name + '.part')).write_bytes(b'broken-transfer')
                return
            return real_command(['bash', '-c', args[-1]], **kwargs)
        with patch.object(backup, 'command', side_effect=fake_transport):
            with self.assertRaises(RuntimeError):
                backup.upload_once(config, archive, backup.sha256(archive))
        self.assertFalse((receiver / archive.name).exists())
        self.assertFalse((receiver / (archive.name + '.sha256')).exists())
        self.assertTrue(archive.exists())

    @unittest.skipIf(os.name == 'nt', 'Runs the receiver shell and retention helper on Linux')
    def test_real_publish_and_cleanup_keep_one_verified_backup(self):
        archive = self.make_archive()
        receiver = self.root / 'artist-wiki'
        receiver.mkdir()
        old = receiver / 'artist-wiki-20200101-190000-0123abcd.tar.gz'
        old.write_bytes(b'old-backup')
        old.with_name(old.name + '.sha256').write_text(backup.sha256(old) + '  ' + old.name + '\n')
        config = {**self.config, 'remote_dir': str(receiver)}
        real_command = backup.command
        def fake_transport(args, **kwargs):
            if args[0] == 'scp':
                shutil.copy2(archive, receiver / ('.' + archive.name + '.part'))
                return
            self.assertIn('StrictHostKeyChecking=yes', args)
            return real_command(['bash', '-c', args[-1]], **kwargs)
        with patch.object(backup, 'command', side_effect=fake_transport):
            uploaded = backup.transfer(config, archive)
            retained = backup.prune_remote_history(config)
        self.assertEqual(retained['remote_path'], uploaded['remote_path'])
        self.assertEqual(retained['sha256'], uploaded['sha256'])
        self.assertEqual(retained['removed_archives'], [old.name])
        self.assertEqual(len(list(receiver.glob('*.tar.gz'))), 1)
        self.assertFalse(archive.exists())

    def test_config_rejects_command_injection_and_broad_remote_directory(self):
        config = {key: str(value) if isinstance(value, Path) else value for key, value in self.config.items()}
        path = self.root / 'config.json'
        for key, value in [('remote_host', '-oProxyCommand=bad'), ('remote_user', 'a;bad'),
                           ('remote_dir', '/'), ('remote_dir', '/var/www'),
                           ('remote_dir', '/safe/../other'), ('remote_port', 0),
                           ('local_dir', str(self.uploads / 'nested'))]:
            path.write_text(json.dumps({**config, key: value}), encoding='utf-8')
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                backup.load_config(path)

    @unittest.skipIf(os.name == 'nt', 'Linux flock is tested on the source server')
    def test_concurrent_run_is_skipped(self):
        with backup.exclusive_lock(self.local / '.lock') as first:
            with backup.exclusive_lock(self.local / '.lock') as second:
                self.assertTrue(first)
                self.assertFalse(second)

    @unittest.skipIf(os.name == 'nt', 'Linux runner uses flock')
    def test_snapshot_failure_still_retries_pending_backup_and_reports_failure(self):
        archive = self.make_archive()
        with patch.object(backup, 'create_backup', side_effect=RuntimeError('database unavailable')):
            with patch.object(backup, 'transfer', return_value={'remote_path': '/remote/backup'}) as transfer, \
                    patch.object(backup, 'prune_remote_history', return_value={'remote_path': '/remote/backup'}) as prune:
                result = backup.run_backup(self.config)
        self.assertEqual(result, 1)
        transfer.assert_called_once_with(self.config, archive)
        report = json.loads((self.local / 'last-run.json').read_text())
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(len(report['uploaded']), 1)
        prune.assert_called_once_with(self.config)

    @unittest.skipIf(os.name == 'nt', 'Linux runner uses flock')
    def test_failed_upload_does_not_remove_remote_history(self):
        self.make_archive()
        with patch.object(backup, 'transfer', side_effect=RuntimeError('offline')), \
                patch.object(backup, 'prune_remote_history') as prune:
            self.assertEqual(backup.run_backup(self.config, retry_only=True), 1)
        prune.assert_not_called()
        self.assertEqual(len(list(self.local.glob('*.tar.gz'))), 1)

    @unittest.skipIf(os.name == 'nt', 'Linux runner uses flock')
    def test_successful_transfer_prunes_and_records_latest_backup(self):
        self.make_archive()
        retained = {'remote_path': '/remote/latest', 'removed_archives': ['old']}
        with patch.object(backup, 'transfer', return_value={'remote_path': '/remote/new'}), \
                patch.object(backup, 'prune_remote_history', return_value=retained) as prune:
            self.assertEqual(backup.run_backup(self.config, retry_only=True), 0)
        prune.assert_called_once_with(self.config)
        self.assertEqual(json.loads((self.local / 'last-run.json').read_text())['retained'], retained)

    @unittest.skipIf(os.name == 'nt', 'Linux runner uses flock')
    def test_cleanup_failure_is_reported(self):
        self.make_archive()
        with patch.object(backup, 'transfer', return_value={'remote_path': '/remote/new'}), \
                patch.object(backup, 'prune_remote_history', side_effect=RuntimeError('checksum mismatch')):
            self.assertEqual(backup.run_backup(self.config, retry_only=True), 1)
        report = json.loads((self.local / 'last-run.json').read_text())
        self.assertIn('Remote history cleanup failed', report['errors'][0])


if __name__ == '__main__':
    unittest.main()
