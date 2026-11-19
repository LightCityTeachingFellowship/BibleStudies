"""Add Unicode-equivalent publication paths without replacing existing pages."""
import json
import shutil
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path('_site').resolve()
catalog = json.loads((root / 'study-catalog.json').read_text(encoding='utf8'))
created = 0
for item in catalog['publications']:
    path = unquote(urlsplit(item['url']).path)
    parts = [part for part in path.split('/') if part]
    if not parts or any(part in ('.', '..') or '\\' in part for part in parts):
        raise ValueError(f'Invalid publication path: {path!r}')
    if path.endswith('/') or not Path(parts[-1]).suffix:
        parts.append('index.html')
    destination = root.joinpath(*parts)
    if destination.is_file():
        continue
    cursor = root
    for part in parts:
        direct = cursor / part
        if direct.exists():
            cursor = direct
            continue
        if not cursor.is_dir():
            raise FileNotFoundError(f'Missing publication path: {path!r}')
        equivalent = [candidate for candidate in cursor.iterdir()
                      if unicodedata.normalize('NFC', candidate.name) == unicodedata.normalize('NFC', part)]
        if len(equivalent) != 1:
            raise FileNotFoundError(f'Missing or ambiguous publication path: {path!r}')
        cursor = equivalent[0]
    if not cursor.is_file():
        raise FileNotFoundError(f'Missing publication page: {path!r}')
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cursor, destination)
    created += 1
print(f'Created {created} Unicode-compatible publication aliases.')
