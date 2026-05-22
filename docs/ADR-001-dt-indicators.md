# ADR-001: DTIndicators — генератор типизированных констант из метамодели

**Статус:** принято  
**Дата:** 2026-05-22  
**РП:** WP-221

---

## Контекст

Код (бот, profiler, MCP) обращается к расчётным показателям ЦД через строки вида
`derived.get("3_10_integral")`, `derived.get("3_1_agency")`. Эти строки:
- не проверяются компилятором / линтером;
- могут расходиться с метамоделью молча (4 stale-ключа обнаружены в handlers/twin.py);
- дублируются в нескольких репозиториях без единого источника.

## Решение: Вариант A — генератор в digital-twin-mcp

Метамодель (`metamodel/3_derived/`) и генератор (`scripts/generate-indicators.py`)
живут в одном репо. Изменение метамодели требует немедленной регенерации в том же PR.

**Артефакты:**
- `generated/dt_indicators.py` — Python-константы (`DTGroup`, `DTIndicator`);
- `generated/dt_indicators.ts` — TypeScript-константы для MCP worker;
- `scripts/generate-indicators.py` — генератор (`python3 scripts/generate-indicators.py`);
- `.github/workflows/validate-indicators.yml` — CI: `--check` mode при изменении метамодели.

## Отклонённые варианты

**Вариант B — отдельный репо `dt-constants`.**  
Плюсы: одна точка импорта для всех потребителей.  
Минусы: изменение метамодели в digital-twin-mcp требует отдельного PR в dt-constants + bump зависимости во всех потребителях. Высокая operational overhead при частых итерациях метамодели.

**Вариант C — runtime-загрузка из метамодели.**  
Плюсы: всегда актуально без генерации.  
Минусы: нет compile-time проверок; потребители (бот, TypeScript worker) не могут читать MD-файлы напрямую; latency + сложность.

## Последствия

- Потребители (бот, profiler) копируют `generated/dt_indicators.py` к себе при обновлении зависимости.
- Текущая копия: `DS-IT-systems/aist_bot_newarchitecture/handlers/dt_indicators.py`.
- При добавлении нового показателя в `metamodel/3_derived/` → запустить `generate-indicators.py` → закоммитить оба файла в `generated/`.
- CI блокирует PR если `generated/` не соответствует метамодели.

## Известные stale-ключи (обнаружены при внедрении, WP-221)

В `handlers/twin.py` найдены 4 группы без соответствия в метамодели:
- `"3_9_it_level"` → метамодель содержит `DTGroup.AI_USAGE = "3_9_ai_usage"`;
- `"3_12_delivery_style"`, `"3_13_notification_resp"`, `"3_14_learning_autonomy"` → групп нет (метамодель заканчивается на `3_11_diagnostic`).

Помечены `# TODO: stale key — not in metamodel`. Устранение — отдельная задача (WP-218 Ф7 или следующая итерация метамодели).
