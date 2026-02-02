#!/usr/bin/env node

/**
 * Генератор MD-документации из JSON-файлов мета-модели
 *
 * Использование: node scripts/generate-docs.js
 *
 * Читает: metamodel/*.json
 * Генерирует: metamodel/docs/
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const METAMODEL = join(ROOT, 'metamodel');
const DOCS = join(METAMODEL, 'docs');

// Загрузка JSON-файлов
function loadJSON(filename) {
  return JSON.parse(readFileSync(join(METAMODEL, filename), 'utf-8'));
}

// Запись файла с созданием директорий
function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`  ✓ ${path.replace(ROOT + '/', '')}`);
}

// Генерация главного README
function generateMainReadme(groups, indicators, degrees, stages) {
  const indicatorsByGroup = {};
  for (const ind of indicators.indicators) {
    if (!indicatorsByGroup[ind.group]) {
      indicatorsByGroup[ind.group] = [];
    }
    indicatorsByGroup[ind.group].push(ind);
  }

  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const indicatorCount = indicators.indicators.length;

  let md = `# Мета-модель цифрового двойника

## Структура данных

**Для ИИ (MCP-сервер):** Все индикаторы собраны в едином файле [\`indicators.json\`](../indicators.json).
На ${today} в мета-модели **${indicatorCount} индикаторов**. Это source of truth — единственный источник правды для программного доступа.

**Для человека:** Эта папка \`docs/\` содержит ту же информацию, но распределённую по папкам групп для удобной навигации:
- Каждая группа (1.PREF, 2.1, 2.2, ...) — отдельная папка
- Каждый индикатор — отдельный MD-файл с описанием

---

## Автогенерация документации

> **Важно:** Эта папка генерируется автоматически. Не редактируйте файлы вручную — изменения будут потеряны при следующей генерации.

### Как запустить

**Через npm (рекомендуется):**
\`\`\`bash
cd /path/to/digital-twin-mcp
npm run docs
\`\`\`

**Напрямую через Node.js:**
\`\`\`bash
node scripts/generate-docs.js
\`\`\`
Этот способ полезен, если npm недоступен или нужно запустить скрипт из другой директории.

**Через GitHub Actions:**
Можно настроить автоматическую генерацию при изменении JSON-файлов. Пример workflow:

\`\`\`yaml
# .github/workflows/generate-docs.yml
name: Generate Metamodel Docs

on:
  push:
    paths:
      - 'metamodel/*.json'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm run docs
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "docs: auto-generate metamodel documentation"
          file_pattern: "metamodel/docs/*"
\`\`\`

---

## Обзор

| Файл | Версия | Описание |
|------|--------|----------|
| [indicators.json](../indicators.json) | ${indicators.version} | ${indicators.indicators.length} показателей |
| [groups.json](../groups.json) | ${groups.version} | ${groups.groups.length} групп |
| [degrees.json](../degrees.json) | ${degrees.version} | ${degrees.degrees.length} степеней |
| [stages.json](../stages.json) | ${stages.version} | ${stages.stages.length} ступеней |

## Степени квалификации

| Код | Название | Описание |
|-----|----------|----------|
`;

  for (const deg of degrees.degrees) {
    const stagesNote = deg.has_stages ? ` ([ступени](stages.md))` : '';
    md += `| \`${deg.code}\` | ${deg.name}${stagesNote} | ${deg.description || ''} |\n`;
  }

  md += `\n## Группы показателей\n\n`;

  for (const group of groups.groups) {
    const count = indicatorsByGroup[group.code]?.length || 0;
    md += `### [${group.code}. ${group.name}](./${group.code}/)\n\n`;
    md += `${group.description || ''}\n\n`;
    md += `- **Категория:** ${group.category}\n`;
    md += `- **Показателей:** ${count}\n`;
    if (group.for_prompts) md += `- Используется в промптах\n`;
    if (group.for_qualification) md += `- Используется для квалификации\n`;
    md += `\n`;
  }

  return md;
}

// Генерация документации по степеням
function generateDegreesDoc(degrees) {
  let md = `# Степени квалификации

> ${degrees.description}

Срок действия степени: **${degrees.validity_years} года**

## Степени

`;

  for (const deg of degrees.degrees) {
    md += `### ${deg.code}\n\n`;
    md += `**${deg.name}** (${deg.name_en})\n\n`;
    md += `${deg.description || ''}\n\n`;
    if (deg.has_stages) {
      md += `> Имеет внутренние ступени — см. [stages.md](stages.md)\n\n`;
    }
  }

  return md;
}

// Генерация документации по ступеням
function generateStagesDoc(stages) {
  let md = `# Ступени: ${stages.degree_ref}

> ${stages.description}

## Ступени

| Порядок | Код | Название | Период (недели) | Описание |
|---------|-----|----------|-----------------|----------|
`;

  for (const stg of stages.stages) {
    md += `| ${stg.order} | \`${stg.code}\` | ${stg.name} | ${stg.period_weeks} | ${stg.description || ''} |\n`;
  }

  return md;
}

// Генерация README для группы
function generateGroupReadme(group, indicators) {
  const groupIndicators = indicators.filter(i => i.group === group.code);

  let md = `# ${group.code}. ${group.name}

> ${group.description || ''}

- **Категория:** ${group.category}
- **Для промптов:** ${group.for_prompts ? 'да' : 'нет'}
- **Для квалификации:** ${group.for_qualification ? 'да' : 'нет'}

## Показатели (${groupIndicators.length})

| Код | Название | Тип | Формат |
|-----|----------|-----|--------|
`;

  for (const ind of groupIndicators) {
    const shortCode = ind.code.replace('IND.', '');
    md += `| [\`${ind.code}\`](${shortCode}.md) | ${ind.name} | ${ind.type} | ${ind.format} |\n`;
  }

  return md;
}

// Генерация документации по индикатору
function generateIndicatorDoc(ind) {
  let md = `# ${ind.code}

**${ind.name}** (${ind.name_en})

## Свойства

| Свойство | Значение |
|----------|----------|
| Группа | ${ind.group} |
| Тип | ${ind.type} |
| Формат | ${ind.format} |
`;

  if (ind.unit) md += `| Единица | ${ind.unit} |\n`;
  if (ind.for_prompts) md += `| Для промптов | да |\n`;
  if (ind.for_qualification) md += `| Для квалификации | да |\n`;
  if (ind.trainee_model) md += `| В trainee model | да |\n`;

  if (ind.description) {
    md += `\n## Описание\n\n${ind.description}\n`;
  }

  if (ind.schema) {
    md += `\n## Схема\n\n\`\`\`json\n${JSON.stringify(ind.schema, null, 2)}\n\`\`\`\n`;
  }

  if (ind.enum_values) {
    md += `\n## Возможные значения\n\n`;
    for (const v of ind.enum_values) {
      md += `- \`${v}\`\n`;
    }
  }

  if (ind.thresholds) {
    md += `\n## Пороговые значения по ступеням\n\n| Ступень | Значение | Период (недели) |\n|---------|----------|----------------|\n`;
    for (const [stage, threshold] of Object.entries(ind.thresholds)) {
      const value = threshold.value ?? threshold.min ?? threshold.max ?? '—';
      const period = threshold.period_weeks || '—';
      md += `| ${stage} | ${value} | ${period} |\n`;
    }
  }

  return md;
}

// Главная функция
function main() {
  console.log('Генерация документации мета-модели...\n');

  // Загрузка данных
  const groups = loadJSON('groups.json');
  const indicators = loadJSON('indicators.json');
  const degrees = loadJSON('degrees.json');
  const stages = loadJSON('stages.json');

  // Очистка и создание папки docs
  if (existsSync(DOCS)) {
    rmSync(DOCS, { recursive: true });
  }
  mkdirSync(DOCS, { recursive: true });

  // Генерация главных файлов
  writeFile(join(DOCS, 'README.md'), generateMainReadme(groups, indicators, degrees, stages));
  writeFile(join(DOCS, 'degrees.md'), generateDegreesDoc(degrees));
  writeFile(join(DOCS, 'stages.md'), generateStagesDoc(stages));

  // Генерация документации по группам и индикаторам
  for (const group of groups.groups) {
    const groupDir = join(DOCS, group.code);
    const groupIndicators = indicators.indicators.filter(i => i.group === group.code);

    // README группы
    writeFile(join(groupDir, 'README.md'), generateGroupReadme(group, indicators.indicators));

    // Индивидуальные индикаторы
    for (const ind of groupIndicators) {
      const filename = ind.code.replace('IND.', '') + '.md';
      writeFile(join(groupDir, filename), generateIndicatorDoc(ind));
    }
  }

  console.log(`\n✓ Документация сгенерирована в ${DOCS.replace(ROOT + '/', '')}/`);
}

main();
