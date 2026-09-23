#!/usr/bin/env python3
"""Converte texto extraído do PDF do autor em capítulos paginados para o app."""
import json
import re
import sys
from pathlib import Path

source = Path(sys.argv[1])
output = Path(sys.argv[2])
raw = source.read_text(encoding="utf-8").replace("\f", "\n")

heading = re.compile(
    r"(?im)^(?:\[[^\n]+\]\s*[^:\n]+:\s*)?(?:-\s*\[\s*\]\s*)?"
    r"cap[ií]tulo\s+(\d+)\s*[–—-]\s*([^\n]+)\s*$"
)
matches = list(heading.finditer(raw))
chapters = []

def clean_text(value: str) -> str:
    value = re.sub(r"(?m)^\[[0-9]{1,2}/[0-9]{1,2},[^\]]+\]\s*[^:\n]+:\s*", "", value)
    value = re.sub(r"[ \t]+", " ", value)
    blocks = re.split(r"\n\s*\n+", value)
    cleaned = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if lines:
            cleaned.append(" ".join(lines))
    return "\n\n".join(cleaned).strip()

def paginate(text: str, target: int = 1350):
    paragraphs = text.split("\n\n")
    pages, current = [], []
    size = 0
    for paragraph in paragraphs:
        extra = len(paragraph) + (2 if current else 0)
        if current and size + extra > target:
            pages.append("\n\n".join(current))
            current, size = [], 0
        current.append(paragraph)
        size += extra
    if current:
        pages.append("\n\n".join(current))
    return pages

for index, match in enumerate(matches):
    number = int(match.group(1))
    title = match.group(2).strip()
    end = matches[index + 1].start() if index + 1 < len(matches) else len(raw)
    text = clean_text(raw[match.end():end])
    chapters.append({
        "number": number,
        "title": title,
        "text": text,
        "pages": paginate(text),
    })

chapters.sort(key=lambda chapter: chapter["number"])
if [c["number"] for c in chapters] != list(range(1, 13)):
    raise SystemExit(f"Capítulos inesperados: {[c['number'] for c in chapters]}")

payload = {
    "book": "Sinapse Final",
    "chapterCount": len(chapters),
    "chapters": chapters,
}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Importados {len(chapters)} capítulos, {sum(len(c['pages']) for c in chapters)} páginas de leitura.")
