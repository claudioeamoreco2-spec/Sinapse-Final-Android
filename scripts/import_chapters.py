#!/usr/bin/env python3
"""Import supplied chapter texts without replacing any recovered chapter."""
import argparse
import copy
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import unicodedata


def normalized(value):
    return ' '.join(unicodedata.normalize('NFC', value).split())


def paginate(text, limit=1800):
    # Slices preserve every character; pagination never rewrites the prose.
    pages = []
    remaining = text
    while len(remaining) > limit:
        boundary = remaining.rfind('\n', 0, limit)
        if boundary < limit // 2:
            boundary = remaining.rfind(' ', 0, limit)
        if boundary < limit // 2:
            boundary = limit
        else:
            boundary += 1
        pages.append(remaining[:boundary])
        remaining = remaining[boundary:]
    if remaining:
        pages.append(remaining)
    return pages


def safe_image(src):
    if not isinstance(src, str) or '\\' in src:
        return False
    path = PurePosixPath(src)
    return (not path.is_absolute() and '..' not in path.parts
            and src.startswith('scenes/') and ':' not in src and '?' not in src
            and path.suffix.lower() in {'.svg', '.png', '.webp', '.jpg', '.jpeg'})


def validate_chapter(chapter):
    if not isinstance(chapter, dict):
        raise ValueError('Cada capítulo deve ser um objeto JSON.')
    number = chapter.get('number')
    if type(number) is not int or not 13 <= number <= 24:
        raise ValueError('A importação aceita somente os capítulos 13 a 24.')
    title = chapter.get('title')
    text = chapter.get('text')
    if not isinstance(title, str) or not title.strip():
        raise ValueError(f'Capítulo {number}: título ausente.')
    if not isinstance(text, str) or not text.strip():
        raise ValueError(f'Capítulo {number}: texto ausente; nada foi inventado.')
    if number == 24 and normalized(title) != 'Ecos de Aço e Sangue':
        raise ValueError('O capítulo 24 deve se chamar Ecos de Aço e Sangue.')
    result = copy.deepcopy(chapter)
    pages = chapter.get('pages')
    if pages is None:
        pages = paginate(text)
    if not isinstance(pages, list) or not pages or any(not isinstance(x, str) or not x.strip() for x in pages):
        raise ValueError(f'Capítulo {number}: páginas inválidas.')
    if normalized(' '.join(pages)) != normalized(text):
        raise ValueError(f'Capítulo {number}: páginas não correspondem ao texto fornecido.')
    result['pages'] = pages
    images = result.get('images', [])
    if not isinstance(images, list):
        raise ValueError(f'Capítulo {number}: imagens devem formar uma lista.')
    for image in images:
        if not isinstance(image, dict) or not safe_image(image.get('src')):
            raise ValueError(f'Capítulo {number}: caminho de imagem local inválido.')
        if 'page' in image and (type(image['page']) is not int or not 0 <= image['page'] < len(pages)):
            raise ValueError(f'Capítulo {number}: página da imagem fora do intervalo.')
    return result


def merge_book(original, supplied):
    if not isinstance(original, dict) or not isinstance(original.get('chapters'), list):
        raise ValueError('Livro de destino inválido.')
    chapters = supplied.get('chapters') if isinstance(supplied, dict) else supplied
    if not isinstance(chapters, list) or not chapters:
        raise ValueError('A fonte deve conter uma lista não vazia de capítulos.')
    existing = {chapter['number']: chapter for chapter in original['chapters']}
    if len(existing) != len(original['chapters']):
        raise ValueError('O livro de destino contém números duplicados.')
    additions = {}
    for raw in chapters:
        chapter = validate_chapter(raw)
        number = chapter['number']
        if number in existing or number in additions:
            raise ValueError(f'Capítulo {number}: substituição ou duplicata recusada; o original foi preservado.')
        additions[number] = chapter
    result = copy.deepcopy(original)
    result['chapters'] += [additions[n] for n in sorted(additions)]
    result['chapters'].sort(key=lambda x: x['number'])
    result['chapterCount'] = len(result['chapters'])
    for number, chapter in existing.items():
        if next(c for c in result['chapters'] if c['number'] == number) != chapter:
            raise AssertionError('Um capítulo original foi alterado.')
    return result, sorted(additions)


def read_source(path):
    if path.suffix.lower() == '.json':
        return json.loads(path.read_text(encoding='utf-8-sig'))
    if path.is_dir():
        chapters = []
        for entry in sorted(path.iterdir()):
            if entry.suffix.lower() not in {'.txt', '.md'}:
                continue
            match = re.fullmatch(r'(?:chapter|capitulo|capítulo)[-_ ]?(\d+)', entry.stem, re.IGNORECASE)
            if not match:
                continue
            body = entry.read_text(encoding='utf-8-sig')
            lines = body.splitlines(keepends=True)
            if len(lines) < 2:
                raise ValueError(f'{entry.name}: primeira linha deve conter título e as demais, o texto.')
            title = lines[0].strip().lstrip('#').strip()
            chapters.append({'number': int(match.group(1)), 'title': title, 'text': ''.join(lines[1:])})
        return {'chapters': chapters}
    raise ValueError('Use JSON ou pasta de arquivos capitulo-16.txt/markdown; não invente textos ausentes.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--target', type=Path, default=Path(__file__).resolve().parents[1] / 'app/src/main/assets/chapters.json')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args(argv)
    try:
        original_bytes = args.target.read_bytes()
        original = json.loads(original_bytes)
        merged, added = merge_book(original, read_source(args.source))
        assets = args.target.parent
        for chapter in merged['chapters']:
            if chapter['number'] not in added:
                continue
            for image in chapter.get('images', []):
                if not (assets / image['src']).is_file():
                    raise ValueError('Imagem fornecida não encontrada: ' + image['src'])
        if args.dry_run:
            print(json.dumps({'mode': 'dry-run', 'chapters_available': len(merged['chapters']), 'would_add': added}, ensure_ascii=False))
            return 0
        digest = hashlib.sha256(original_bytes).hexdigest()
        backup = args.target.with_name(args.target.name + '.before-import-' + digest[:12] + '.bak')
        if backup.exists() and backup.read_bytes() != original_bytes:
            raise ValueError('Backup existente não corresponde ao original.')
        if not backup.exists():
            shutil.copy2(args.target, backup)
        temporary = args.target.with_name(args.target.name + '.tmp')
        temporary.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temporary.replace(args.target)
        print(json.dumps({'added': added, 'backup': str(backup), 'preserved_existing': len(original['chapters']), 'chapters_available': len(merged['chapters'])}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
