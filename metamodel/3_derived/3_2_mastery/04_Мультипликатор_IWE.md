# IND.3.2.04

**Name:** Мультипликатор IWE
**Name (EN):** IWE Multiplier
**Type:** temporal
**Format:** float

## Flags
- for_prompts: true
- for_qualification: false
- trainee_model: false

## Description

Отношение бюджета закрытых РП к часам кодирования за день (или 7-дневное скользящее среднее).
Измеряет эффективность использования ИИ-инструментов: насколько часов «мышления + управления»
приходится на 1 час ручного кода.

## Formula

```
IND.3.2.04 = Σwp_completed.budget_hours(day) / coding_time.total_hours(day)
rolling_7d: среднее по непустым дням за последние 7 дней
```

## Sources

- `domain_event[event_type=wp_completed].payload.budget_hours` — бюджет закрытых РП (WP-218 Ф8.2)
- `domain_event[event_type=coding_time].payload.total_seconds` — WakaTime кодирование (activity-hub)

## Thresholds

```json
{
  "STG.Student.Random":       {"value": null, "hint": "Не рассчитывается"},
  "STG.Student.Practicing":   {"value": "≥2", "hint": "AI-ускорение начинает работать"},
  "STG.Student.Systematic":   {"value": "≥3", "hint": "Стабильный мультипликатор"},
  "STG.Student.Disciplined":  {"value": "≥5", "hint": "Высокий AI-leverage"},
  "STG.Student.Proactive":    {"value": "≥7", "hint": "Multi-instance, параллельные агенты"}
}
```

## Guard Conditions

- Если `coding_time.total_hours < 0.5` за день — возвращать `null` (нет значимых данных WakaTime)
- Если нет `wp_completed` событий за день — `budget_hours = 0`, мультипликатор = 0.0

## Implementation

`dt_calc.py::calc_IND_3_2_04_daily_multiplier(event_rows, date_str)` — WP-218 Ф3
`recalculate_derived.py` — читает `domain_event` за 7-дневное окно → передаёт как `event_rows`

## Related

- WP-218 Ф8.2: emission `wp_completed` событий в `day-close.sh`
- WP-218 Ф8.3: реализация функции и интеграция в профайлер
- WP-218 Ф8.4: backfill W14-W18
- IND.2.6.01: Время кодирования сегодня (WakaTime source)
- IND.2.7.12: РП выполнено за 7д (count, не budget — используется как fallback)
