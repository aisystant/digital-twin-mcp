# 1.PREF. Настройки и предпочтения

> Настраиваемые параметры стажёра: цели, роли, расписание, план развития

- **Категория:** primary
- **Для промптов:** да
- **Для квалификации:** нет

## Показатели (20)

| Код | Название | Тип | Формат |
|-----|----------|-----|--------|
| [`IND.1.PREF.objective`](1.PREF.objective.md) | Цели обучения | semantic | structured_text |
| [`IND.1.PREF.role_set`](1.PREF.role_set.md) | Текущие роли | semantic | list[string] |
| [`IND.1.PREF.domain_focus`](1.PREF.domain_focus.md) | Интересующие области | semantic | list[string] |
| [`IND.1.PREF.daily_task_time`](1.PREF.daily_task_time.md) | Время получения задания | structural | time |
| [`IND.1.PREF.daily_report_time`](1.PREF.daily_report_time.md) | Время отчёта за день | structural | time |
| [`IND.1.PREF.weekly_analytics_time`](1.PREF.weekly_analytics_time.md) | Время получения аналитики | structural | day_time |
| [`IND.1.PREF.strategy_request_time`](1.PREF.strategy_request_time.md) | Время запроса стратегирования | structural | day_time |
| [`IND.1.PREF.target_state`](1.PREF.target_state.md) | Целевые показатели состояния | scale | object |
| [`IND.1.PREF.guide_track_set`](1.PREF.guide_track_set.md) | Выбранные руководства | semantic | list[string] |
| [`IND.1.PREF.weekly_section`](1.PREF.weekly_section.md) | Раздел руководства к изучению | semantic | string |
| [`IND.1.PREF.weekly_time_budget`](1.PREF.weekly_time_budget.md) | Недельный бюджет времени | temporal | float |
| [`IND.1.PREF.planned_time_tomorrow`](1.PREF.planned_time_tomorrow.md) | Планируемое время на завтра | temporal | float |
| [`IND.1.PREF.highlighted_methods`](1.PREF.highlighted_methods.md) | Фокусные методы | semantic | list[string] |
| [`IND.1.PREF.stage_end_date`](1.PREF.stage_end_date.md) | Дата окончания ближайшего этапа | temporal | date |
| [`IND.1.PREF.current_problems`](1.PREF.current_problems.md) | Текущие проблемы | semantic | list[string] |
| [`IND.1.PREF.dissatisfactions`](1.PREF.dissatisfactions.md) | Мои неудовлетворенности | semantic | list[string] |
| [`IND.1.PREF.emotions`](1.PREF.emotions.md) | Мои эмоции и чувства | semantic | list[string] |
| [`IND.1.PREF.priority_projects`](1.PREF.priority_projects.md) | Мои приоритетные проекты | semantic | list[string] |
| [`IND.1.PREF.stage_target_result`](1.PREF.stage_target_result.md) | Планируемый результат ближайшего этапа | semantic | structured_text |
| [`IND.1.PREF.weekly_work_products`](1.PREF.weekly_work_products.md) | Рабочие продукты на неделю | semantic | list[string] |
