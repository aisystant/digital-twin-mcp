#!/usr/bin/env python3
# generate-indicators.py — генерирует типизированные константы из метамодели ЦД
#
# Использование:
#   python3 scripts/generate-indicators.py          # генерация
#   python3 scripts/generate-indicators.py --check  # CI: проверить что файл актуален (exit 1 при drift)
#
# Выводит:
#   generated/dt_indicators.py  — Python-константы для бота, profiler и других Python-потребителей
#   generated/dt_indicators.ts  — TypeScript-константы для digital-twin-mcp worker
#
# Архитектурное решение: Вариант A (WP-221 Ф0, ADR-001-dt-indicators)
# Метамодель и генератор в одном репо → изменение метамодели = немедленная регенерация в том же PR.

from __future__ import annotations

import os
import re
import sys
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
METAMODEL_3_DERIVED = ROOT / "metamodel" / "3_derived"
GENERATED_DIR = ROOT / "generated"
PY_OUTPUT = GENERATED_DIR / "dt_indicators.py"
TS_OUTPUT = GENERATED_DIR / "dt_indicators.ts"


def to_const_name(s: str) -> str:
    """'Integral agency index' → 'INTEGRAL_AGENCY_INDEX'"""
    s = re.sub(r'[^a-zA-Z0-9\s]', ' ', s)
    words = re.split(r'\s+', s.strip())
    return '_'.join(w.upper() for w in words if w)


def group_const_name(group_key: str) -> str:
    """'3_10_integral' → 'INTEGRAL'; '3_1_agency' → 'AGENCY'"""
    parts = group_key.split('_')
    word_parts = [p for p in parts if not re.match(r'^\d+$', p)]
    if not word_parts:
        word_parts = parts
    return '_'.join(w.upper() for w in word_parts)


def parse_indicator_md(path: Path) -> dict | None:
    content = path.read_text(encoding='utf-8')
    lines = content.splitlines()

    ind_code = None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('# IND.'):
            ind_code = stripped[2:].strip()
            break
    if not ind_code:
        return None

    name_en = ind_type = ind_format = ind_unit = None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('**Name (EN):**'):
            name_en = stripped.removeprefix('**Name (EN):**').strip()
        elif stripped.startswith('**Type:**'):
            ind_type = stripped.removeprefix('**Type:**').strip()
        elif stripped.startswith('**Format:**'):
            ind_format = stripped.removeprefix('**Format:**').strip()
        elif stripped.startswith('**Unit:**'):
            ind_unit = stripped.removeprefix('**Unit:**').strip()

    if not name_en:
        return None

    return {
        'code': ind_code,
        'name_en': name_en,
        'type': ind_type,
        'format': ind_format,
        'unit': ind_unit,
        'const_name': to_const_name(name_en),
        'source_file': str(path.relative_to(ROOT)),
    }


def collect_groups() -> tuple[list[dict], bool]:
    """Returns (groups, has_duplicates). has_duplicates=True → metamodel quality issue."""
    groups = []
    has_duplicates = False
    for entry in sorted(METAMODEL_3_DERIVED.iterdir()):
        if not entry.is_dir():
            continue
        group_key = entry.name

        indicators = []
        seen_names: set[str] = set()
        seen_codes: dict[str, str] = {}  # code → first file name
        for md_file in sorted(entry.glob('*.md')):
            if md_file.name == '_group.md':
                continue
            ind = parse_indicator_md(md_file)
            if not ind:
                continue

            # Detect duplicate IND codes within a group (metamodel quality issue)
            code = ind['code']
            if code in seen_codes:
                print(
                    f'  ❌ DUPLICATE IND code {code} in {group_key}: '
                    f'{seen_codes[code]} + {md_file.name} — исправить метамодель',
                    file=sys.stderr,
                )
                ind['duplicate_code'] = True
                has_duplicates = True
            else:
                seen_codes[code] = md_file.name

            # Resolve const_name collisions
            orig = ind['const_name']
            final = orig
            counter = 2
            while final in seen_names:
                final = f'{orig}_{counter}'
                counter += 1
            seen_names.add(final)
            ind['const_name'] = final
            indicators.append(ind)

        groups.append({
            'key': group_key,
            'const_name': group_const_name(group_key),
            'indicators': indicators,
        })
    return groups, has_duplicates


def generate_python(groups: list[dict], ts: str) -> str:
    out: list[str] = [
        '# AUTO-GENERATED — do not edit.',
        f'# Generated: {ts}',
        '# Run: python3 scripts/generate-indicators.py',
        '# Source: metamodel/3_derived/',
        '#',
        '# Usage:',
        '#   from generated.dt_indicators import DTGroup, DTIndicator',
        '#   derived.get(DTGroup.AGENCY)           # group key',
        '#   indicators.get(DTIndicator.INTEGRAL_AGENCY_INDEX)  # IND code',
        '',
        'from __future__ import annotations',
        '',
        '',
        'class DTGroup:',
        '    """Ключи групп расчётных показателей — для derived.get(DTGroup.X)."""',
    ]
    for g in groups:
        out.append(f'    {g["const_name"]} = "{g["key"]}"')

    out.extend(['', '', 'class DTIndicator:',
                '    """IND-коды индивидуальных показателей (compile-time константы)."""'])

    for g in groups:
        if not g['indicators']:
            continue
        out.append(f'')
        out.append(f'    # {g["key"]}')
        for ind in g['indicators']:
            comment = f'  # type={ind["type"]}'
            if ind['unit']:
                comment += f', unit={ind["unit"]}'
            out.append(f'    {ind["const_name"]} = "{ind["code"]}"{comment}')

    out.append('')
    return '\n'.join(out)


def generate_typescript(groups: list[dict], ts: str) -> str:
    out: list[str] = [
        '// AUTO-GENERATED — do not edit.',
        f'// Generated: {ts}',
        '// Run: python3 scripts/generate-indicators.py',
        '// Source: metamodel/3_derived/',
        '',
        '/** Ключи групп расчётных показателей — для derived[DTGroup.X] */',
        'export const DTGroup = {',
    ]
    for g in groups:
        out.append(f'    {g["const_name"]}: "{g["key"]}",')
    out.extend(['} as const;', '', 'export type DTGroupKey = typeof DTGroup[keyof typeof DTGroup];',
                '', '', '/** IND-коды индивидуальных показателей */',
                'export const DTIndicator = {'])

    for g in groups:
        if not g['indicators']:
            continue
        out.append(f'    // {g["key"]}')
        for ind in g['indicators']:
            comment = f' // type: {ind["type"]}'
            if ind['unit']:
                comment += f', unit: {ind["unit"]}'
            out.append(f'    {ind["const_name"]}: "{ind["code"]}",{comment}')

    out.extend(['} as const;', '',
                'export type DTIndicatorCode = typeof DTIndicator[keyof typeof DTIndicator];'])
    out.append('')
    return '\n'.join(out)


def file_hash(path: Path) -> str:
    if not path.exists():
        return ''
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    check_mode = '--check' in sys.argv

    if not METAMODEL_3_DERIVED.exists():
        print(f'ERROR: metamodel directory not found: {METAMODEL_3_DERIVED}', file=sys.stderr)
        sys.exit(2)

    groups, has_duplicates = collect_groups()
    total_indicators = sum(len(g['indicators']) for g in groups)
    print(f'Parsed {len(groups)} groups, {total_indicators} indicators from metamodel')

    if has_duplicates:
        print('❌ Метамодель содержит дублирующиеся IND-коды — исправить перед генерацией', file=sys.stderr)
        sys.exit(2)

    ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    py_content = generate_python(groups, ts)
    ts_content = generate_typescript(groups, ts)

    if check_mode:
        # Verify committed generated files match current metamodel (ignoring timestamp line)
        def strip_ts(content: str) -> str:
            return '\n'.join(
                line for line in content.splitlines()
                if not re.match(r'^[#/]+ Generated:', line)
            )

        drift = False
        for path, new_content, label in [
            (PY_OUTPUT, py_content, 'dt_indicators.py'),
            (TS_OUTPUT, ts_content, 'dt_indicators.ts'),
        ]:
            if not path.exists():
                print(f'❌ {label}: файл не найден — запусти generate-indicators.py', file=sys.stderr)
                drift = True
                continue
            existing = strip_ts(path.read_text(encoding='utf-8'))
            generated = strip_ts(new_content)
            if existing != generated:
                print(f'❌ {label}: рассинхрон с метамоделью — запусти generate-indicators.py', file=sys.stderr)
                drift = True
            else:
                print(f'✅ {label}: актуален')

        sys.exit(1 if drift else 0)

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    PY_OUTPUT.write_text(py_content, encoding='utf-8')
    TS_OUTPUT.write_text(ts_content, encoding='utf-8')
    print(f'✅ Generated: {PY_OUTPUT.relative_to(ROOT)}')
    print(f'✅ Generated: {TS_OUTPUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
