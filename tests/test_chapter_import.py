import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/import_chapters.py'
spec = importlib.util.spec_from_file_location('chapter_import', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ChapterImportTests(unittest.TestCase):
    def setUp(self):
        self.book = {'book': 'Autor', 'chapters': [{'number': 1, 'title': 'Original', 'text': 'Texto original intacto.', 'pages': ['Texto original intacto.']}], 'chapterCount': 1}

    def test_import_preserves_original_and_all_characters(self):
        text = ('Texto fornecido pelo autor.\n\n' * 120) + 'Fim.'
        result, added = module.merge_book(self.book, {'chapters': [{'number': 16, 'title': 'Título fornecido', 'text': text}]})
        self.assertEqual(result['chapters'][0], self.book['chapters'][0])
        self.assertEqual(''.join(result['chapters'][1]['pages']), text)
        self.assertEqual(result['chapters'][1]['text'], text)
        self.assertEqual(added, [16])

    def test_existing_and_duplicate_chapters_are_refused(self):
        candidate = {'number': 16, 'title': 'Título', 'text': 'Texto fornecido.'}
        with self.assertRaises(ValueError):
            module.merge_book(self.book, {'chapters': [candidate, candidate]})
        original16 = {'chapters': [candidate]}
        with self.assertRaises(ValueError):
            module.merge_book(original16, {'chapters': [candidate]})
        with self.assertRaises(ValueError):
            module.merge_book(self.book, {'chapters': [self.book['chapters'][0]]})

    def test_exact_chapter_24_title_and_no_missing_text(self):
        with self.assertRaises(ValueError):
            module.validate_chapter({'number': 24, 'title': 'Título errado', 'text': 'Texto.'})
        with self.assertRaises(ValueError):
            module.validate_chapter({'number': 24, 'title': 'Ecos de Aço e Sangue', 'text': ''})
        chapter = module.validate_chapter({'number': 24, 'title': 'Ecos de Aço e Sangue', 'text': 'Texto fornecido.'})
        self.assertEqual(chapter['pages'], ['Texto fornecido.'])

    def test_mismatched_pages_and_unsafe_images_are_refused(self):
        chapter = {'number': 16, 'title': 'Título', 'text': 'Texto fornecido.', 'pages': ['Outro texto']}
        with self.assertRaises(ValueError):
            module.validate_chapter(chapter)
        chapter.pop('pages')
        for src in ['../secret.png', 'https://host/image.png', 'scenes/../../secret.png', 'javascript:alert(1)', 'scenes/image.svg?x=1']:
            chapter['images'] = [{'src': src}]
            with self.subTest(src=src), self.assertRaises(ValueError):
                module.validate_chapter(chapter)

    def test_failed_import_and_dry_run_do_not_write(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            target = path / 'chapters.json'
            original = json.dumps(self.book).encode()
            target.write_bytes(original)
            source = path / 'new.json'
            source.write_text(json.dumps({'chapters': [{'number': 24, 'title': 'Errado', 'text': 'Texto'}]}))
            self.assertEqual(module.main([str(source), '--target', str(target)]), 1)
            self.assertEqual(target.read_bytes(), original)
            source.write_text(json.dumps({'chapters': [{'number': 24, 'title': 'Ecos de Aço e Sangue', 'text': 'Texto fornecido.'}]}))
            self.assertEqual(module.main([str(source), '--target', str(target), '--dry-run']), 0)
            self.assertEqual(target.read_bytes(), original)
            self.assertEqual(module.main([str(source), '--target', str(target)]), 0)
            backups = list(path.glob('*.bak'))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
