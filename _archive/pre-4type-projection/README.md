# Архив: pre-4type projection layer

Архивировано в рамках WP-218 Ф6.

## Что здесь

Файлы слоя проекции, который работал ДО перехода на 4-типовую метамодель (IND.1-4):

| Файл | Назначение |
|------|-----------|
| `profile-calculator.js` | Расчёт GAP-профиля по 5 областям развития из старой схемы `indicators.metrics[id]` |
| `mapping.js` | Маппинг IND-кодов к областям и ступеням (STAGE_CODES, MAPPING_VERSION) |
| `twin.json` | Файловый бэкенд (до Neon); использовался как fallback в `readTwinData()` |
| `SPEC-get-profile-by-areas.md` | Спецификация удалённого MCP-инструмента `get_profile_by_areas` |
| `tools-profile-calculator.test.js` | Unit-тесты для `profile-calculator.js` (разделены из `src/tools.test.js`) |

## Почему архивировано

Схема `indicators.metrics` (плоский JSONB с IND-ключами) заменена на 4-типовую структуру:
- `1_declarative/` — пользовательские данные
- `2_collected/` — собранные коллекторами
- `3_derived/` — рассчитанные
- `4_generated/` — генерируемые по запросу

Инструмент `get_profile_by_areas` возвращал `null` для большинства показателей,
потому что новая архитектура пишет в `3_derived.*`, а не в `indicators.metrics`.

## Точка монтирования

В `src/index.js` на месте удалённого handler'а добавлен комментарий:
```js
// WP-222 tailor tool mount point
```
WP-222 (Портной) добавит свой инструмент в эту точку.
