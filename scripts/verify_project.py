#!/usr/bin/env python3
"""Check preserved source content and packaged assets without external services."""
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'app/src/main/assets'
failures = []


def check(condition, message):
    if not condition:
        failures.append(message)


manifest = json.loads((ROOT / 'recovery/source-manifest.json').read_text())
protected = [entry for entry in manifest['files'] if entry['path'].startswith(('app/src/main/assets/characters/', 'app/src/main/assets/scenes/'))]
for entry in protected:
    path = ROOT / entry['path']
    check(path.is_file(), 'Original ausente: ' + entry['path'])
    if path.is_file():
        content = path.read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()
        check(actual == entry['sha'], 'Original alterado: ' + entry['path'])

book = json.loads((ASSETS / 'chapters.json').read_text())
check(book['chapterCount'] == len(book['chapters']), 'Contagem de capítulos incorreta')
check([chapter['number'] for chapter in book['chapters']][:12] == list(range(1, 13)), 'Capítulos recuperados incompletos')
for chapter in book['chapters']:
    if str(chapter['number']) in manifest['chapter_object_sha256']:
        digest = hashlib.sha256(json.dumps(chapter, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        check(digest == manifest['chapter_object_sha256'][str(chapter['number'])], f"Original alterado: capítulo {chapter['number']}")
    check(bool(chapter['text'].strip()) and bool(chapter['pages']), 'Texto ausente')
    check(re.sub(r'\s+', '', ''.join(chapter['pages'])) == re.sub(r'\s+', '', chapter['text']), f"Paginação alterou capítulo {chapter['number']}")

index = (ASSETS / 'index.html').read_text()
for ref in re.findall(r'(?:src|href)=[\"\']([^\"\']+)[\"\']', index):
    if ref.startswith(('#', 'https:', 'http:', 'data:', 'blob:')):
        continue
    if re.search(r'\.(?:js|css|png|svg|webp|wav|jpe?g)$', ref):
        check((ASSETS / ref).is_file(), 'Recurso referenciado ausente: ' + ref)

illustrations = list((ASSETS / 'scenes/illustrated').glob('*.svg'))
creatures = list((ASSETS / 'creatures').glob('*.svg'))
check(len(illustrations) >= 36, 'São necessárias 3 ilustrações para cada um dos 12 capítulos recuperados')
check(len(creatures) >= 20, 'São necessárias pelo menos 20 imagens próprias de criaturas')
for path in illustrations + creatures:
    try:
        element = ET.fromstring(path.read_bytes())
        check(element.tag == '{http://www.w3.org/2000/svg}svg', 'SVG inválido: ' + str(path))
        check(not re.search(r'<script\b|onload=|https?://(?!www.w3.org/2000/svg)', path.read_text(), re.IGNORECASE), 'SVG contém recurso ativo/externo: ' + str(path))
    except ET.ParseError:
        failures.append('XML inválido: ' + str(path))
check((ASSETS / 'audio/nerakar-tempestade.wav').is_file(), 'Trilha original não gerada')

if failures:
    print('\n'.join(failures), file=sys.stderr)
    raise SystemExit(1)
print(json.dumps({'originals_verified': len(protected), 'chapters_preserved': len(book['chapters']), 'chapter_illustrations': len(illustrations), 'creature_images': len(creatures)}, ensure_ascii=False))
