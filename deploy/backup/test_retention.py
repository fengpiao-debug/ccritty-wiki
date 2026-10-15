"""Exercise retention against temporary files, never real backup directories."""
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('retention', Path(__file__).with_name('retain_latest.py'))
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)


class RetentionTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.receiver = self.root / 'artist-wiki'
        self.receiver.mkdir()

    def archive(self, date, content=b'complete-backup'):
        path = self.receiver / ('artist-wiki-' + date + '-190000-0123abcd.tar.gz')
        path.write_bytes(content)
        path.with_name(path.name + '.sha256').write_text(
            hashlib.sha256(content).hexdigest() + '  ' + path.name + '\n', encoding='ascii')
        return path

    def test_keeps_latest_and_its_checksum_and_deletes_only_matching_history(self):
        old = self.archive('20261014')
        latest = self.archive('20261015', b'new-backup')
        unrelated = self.receiver / 'other-project.tar.gz'
        partial = self.receiver / '.artist-wiki-20261016-190000-0123abcd.tar.gz.part'
        unrelated.write_bytes(b'keep'); partial.write_bytes(b'incomplete')
        result = retention.retain_latest(self.receiver)
        self.assertEqual(result['remote_path'], str(latest))
        self.assertEqual(result['removed_archives'], [old.name])
        self.assertFalse(old.exists())
        self.assertFalse(old.with_name(old.name + '.sha256').exists())
        self.assertTrue(latest.with_name(latest.name + '.sha256').exists())
        self.assertEqual(latest.read_bytes(), b'new-backup')
        self.assertTrue(unrelated.exists()); self.assertTrue(partial.exists())

    def test_corrupt_newest_keeps_all_old_archives(self):
        old = self.archive('20261014')
        latest = self.archive('20261015')
        latest.write_bytes(b'corrupt')
        with self.assertRaisesRegex(RuntimeError, 'checksum mismatch'):
            retention.retain_latest(self.receiver)
        self.assertTrue(old.exists()); self.assertTrue(latest.exists())

    def test_missing_latest_checksum_keeps_history(self):
        old = self.archive('20261014')
        latest = self.archive('20261015')
        latest.with_name(latest.name + '.sha256').unlink()
        with self.assertRaises(FileNotFoundError):
            retention.retain_latest(self.receiver)
        self.assertTrue(old.exists())

    def test_late_retry_of_an_old_backup_cannot_displace_newer_backup(self):
        latest = self.archive('20261015')
        old = self.archive('20261013', b'retried-old-backup')
        result = retention.retain_latest(self.receiver)
        self.assertEqual(result['remote_path'], str(latest))
        self.assertFalse(old.exists())
        self.assertEqual(retention.retain_latest(self.receiver)['removed_archives'], [])

    def test_rejects_broad_directory_and_non_file_candidates(self):
        with self.assertRaises(ValueError):
            retention.retain_latest(self.root)
        old = self.archive('20261014')
        (self.receiver / 'artist-wiki-20261015-190000-0123abcd.tar.gz').mkdir()
        with self.assertRaisesRegex(RuntimeError, 'archive type'):
            retention.retain_latest(self.receiver)
        self.assertTrue(old.exists())

    @unittest.skipIf(os.name == 'nt', 'Symlink protection is verified on Linux')
    def test_symlink_archive_or_directory_is_rejected_without_deleting_files(self):
        old = self.archive('20261014')
        outside = self.root / 'outside.tar.gz'
        outside.write_bytes(b'keep-outside')
        link = self.receiver / 'artist-wiki-20261015-190000-0123abcd.tar.gz'
        link.symlink_to(outside)
        with self.assertRaisesRegex(RuntimeError, 'archive type'):
            retention.retain_latest(self.receiver)
        self.assertTrue(old.exists())
        self.assertEqual(outside.read_bytes(), b'keep-outside')
        alias_parent = self.root / 'alias'
        alias_parent.mkdir()
        alias = alias_parent / 'artist-wiki'
        alias.symlink_to(self.receiver, target_is_directory=True)
        with self.assertRaises(ValueError):
            retention.retain_latest(alias)


if __name__ == '__main__':
    unittest.main()
