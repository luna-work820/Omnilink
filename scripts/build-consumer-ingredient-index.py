"""Build the C-side ingredient lookup from the supplied source archive."""

import csv
import io
import json
import sys
import zipfile
from pathlib import Path


def read_rows(archive, suffix, skip=0):
    name = next(name for name in archive.namelist() if name.endswith(suffix))
    content = archive.read(name).decode('utf-8-sig', errors='replace')
    return csv.DictReader(io.StringIO(content), skipinitialspace=True) if not skip else csv.DictReader(io.StringIO('\n'.join(content.splitlines()[skip:])), skipinitialspace=True)


def clean(value):
    result = (value or '').strip()
    return '' if result in ('-', '–') else result


source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/Users/luna/Downloads/personal-advisor-data-sources-2026-10-15.zip')
target = Path(__file__).resolve().parents[1] / 'lib/consumer-advisor/ingredient-index.json'
with zipfile.ZipFile(source) as archive:
    ingredients = {}
    for row in read_rows(archive, 'beautee-cosmetic-ingredients-dataset/ingredients.csv'):
        name = clean(row['name'])
        if name:
            ingredients[name.casefold()] = {
                'name': name,
                'cosingId': clean(row['substanceId']),
                'cas': clean(row['casNo']),
                'ec': clean(row['ecNo']),
                'pubchemId': clean(row['pubchem_cid']),
            }

    for row in read_rows(archive, 'COSING_Ingredients-Fragrance.Inventory_v2.csv', skip=6):
        name = clean(row.get('INCI name'))
        ingredient = ingredients.get(name.casefold())
        if ingredient:
            function = clean(row.get('Function'))
            if function:
                ingredient['historicalFunction'] = function

    annexes = {}
    for annex in ('II', 'III', 'IV', 'V', 'VI'):
        for row in read_rows(archive, f'COSING_Annex.{annex}_v2.csv'):
            cas = clean(row.get('CAS Number'))
            if cas and cas != '-':
                for token in cas.replace(';', ',').split(','):
                    token = token.strip()
                    if token:
                        annexes.setdefault(token, set()).add(annex)

    for ingredient in ingredients.values():
        if ingredient['cas'] in annexes:
            ingredient['historicalAnnexes'] = sorted(annexes[ingredient['cas']])

target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(list(ingredients.values()), ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Wrote {len(ingredients)} ingredients to {target}')
