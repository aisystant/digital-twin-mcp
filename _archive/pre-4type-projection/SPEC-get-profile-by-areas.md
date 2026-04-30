# Спецификация MCP tool: `get_profile_by_areas`

> **WP:** 175 (Ф3–Ф5) | **Статус:** implemented | **Версия:** 1.1.0
> **Источник архитектуры:** WP-175 context file, АрхГейт 57/70
> **Pack source-of-truth:** PD.FORM.080 §9-10, PD.FORM.081

---

<details open>
<summary><b>§1. Назначение</b></summary>

**Projection Layer** — проецирует показатели ЦД (группы 3_1–3_10, хранение по типам) на 5 областей развития (потребление агентами).

Без этого tool Портной (MIM.SOP.001 Шаг 3) не может автоматически определить приоритетную область и тип разрыва (мировоззрение vs мастерство).

**Принцип:** SOTA.012 Multi-Representation — projection view, не копия данных.

</details>

<details open>
<summary><b>§2. Контракт</b></summary>

### Tool definition

```json
{
  "name": "get_profile_by_areas",
  "description": "Профиль ученика по 5 областям развития: GAP-анализ мировоззрения и мастерства относительно нормативов текущей ступени. Read-only projection из L3 показателей ЦД.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "user_id": {
        "type": "string",
        "description": "ID пользователя. Если не указан — из DT_USER_ID env (single-user mode)"
      },
      "step": {
        "type": "integer",
        "enum": [1, 2, 3, 4, 5],
        "description": "Ступень ученика (1=Случайный, 2=Практикующий, 3=Систематический, 4=Дисциплинированный, 5=Проактивный). Если не указан — берётся из ЦД (IND.3.4.01)"
      }
    },
    "required": []
  }
}
```

### Response schema

```json
{
  "type": "object",
  "properties": {
    "user_id": { "type": "string" },
    "step": { "type": "integer" },
    "step_name": { "type": "string" },
    "mapping_version": { "type": "string", "description": "Версия маппинга Pack→code (для воспроизводимости)" },
    "timestamp": { "type": "string", "format": "date-time" },
    "areas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "area": { "type": "string", "enum": ["knowledge", "tools", "constraints", "environment", "organism"] },
          "area_name": { "type": "string", "description": "Русское название: Знания, Инструменты, Ограничения, Окружение, Организм" },
          "role": { "type": "string", "enum": ["leading", "supporting"], "description": "Роль области на текущей ступени (из FORM.080 §3)" },
          "worldview": {
            "type": "object",
            "properties": {
              "score": { "type": "number", "minimum": 0, "maximum": 1 },
              "norm": { "type": "number", "minimum": 0, "maximum": 1, "description": "Норматив для перехода на следующую ступень" },
              "gap": { "type": "number", "description": "norm - score. >0 = разрыв" },
              "source_indicators": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "string", "description": "IND.3.X.Y" },
                    "name": { "type": "string" },
                    "value": {},
                    "weight": { "type": "number" },
                    "norm": { "description": "Пороговое значение для ступени" }
                  }
                }
              }
            }
          },
          "mastery": {
            "type": "object",
            "description": "Та же структура что worldview"
          }
        }
      }
    },
    "max_gap": {
      "type": "object",
      "properties": {
        "area": { "type": "string" },
        "dimension": { "type": "string", "enum": ["worldview", "mastery"] },
        "gap": { "type": "number" }
      },
      "description": "Область и измерение с максимальным разрывом — подсказка для Портного"
    },
    "transition": {
      "type": "object",
      "properties": {
        "from": { "type": "integer" },
        "to": { "type": "integer" },
        "leading_areas": { "type": "array", "items": { "type": "string" } },
        "key_shift": { "type": "string", "description": "Описание качественного сдвига из FORM.080 §3" }
      }
    }
  }
}
```

### Пример вызова и ответа

**Вызов:**
```json
{ "name": "get_profile_by_areas", "arguments": { "step": 2 } }
```

**Ответ (сокращённый):**
```json
{
  "user_id": "tseren",
  "step": 2,
  "step_name": "Практикующий",
  "mapping_version": "1.0.0",
  "timestamp": "2026-03-28T14:30:00Z",
  "areas": [
    {
      "area": "knowledge",
      "area_name": "Знания",
      "role": "supporting",
      "worldview": {
        "score": 0.35,
        "norm": 0.60,
        "gap": 0.25,
        "source_indicators": [
          { "id": "IND.3.2.04", "name": "Развитие мировоззрения", "value": 0.3, "weight": 0.5, "norm": 0.5 },
          { "id": "IND.3.3.04", "name": "Текущие мемы", "value": 0.4, "weight": 0.5, "norm": 0.7 }
        ]
      },
      "mastery": {
        "score": 0.50,
        "norm": 0.55,
        "gap": 0.05,
        "source_indicators": [
          { "id": "IND.3.2.01", "name": "Интенсивность практики", "value": 0.5, "weight": 1.0, "norm": 0.55 }
        ]
      }
    }
  ],
  "max_gap": {
    "area": "tools",
    "dimension": "mastery",
    "gap": 0.40
  },
  "transition": {
    "from": 2,
    "to": 3,
    "leading_areas": ["tools", "constraints"],
    "key_shift": "«Пробую» → «Делаю каждый день» + конвейер"
  }
}
```

</details>

<details>
<summary><b>§3. Маппинг показателей → области (из Pack)</b></summary>

> **Source-of-truth:** PD.FORM.080 §9, PD.FORM.081. Здесь — реализационная таблица.
> При обновлении Pack → обновить маппинг → инкремент `mapping_version`.

### Таблица маппинга

| Область | Измерение | Показатели ЦД (IND.3.*) | Агрегация |
|---------|-----------|--------------------------|-----------|
| **knowledge** | worldview | 3_2.04 (Развитие мировоззрения), 3_3.04 (Текущие мемы), 3_3.05 (Калибр личности) | weighted_mean |
| **knowledge** | mastery | 3_2.01 (Интенсивность практики), 3_2.05 (Трансформация привычек) | weighted_mean |
| **tools** | worldview | 3_9.01 (Качество взаимодействия с ИИ) | single |
| **tools** | mastery | 3_2.02 (Индекс продуктов), 3_2.03 (Учтённое время), 3_9.02 (Применение рекомендаций ИИ) | weighted_mean |
| **constraints** | worldview | 3_3.03 (Поведенческие паттерны) | single |
| **constraints** | mastery | 3_1.04 (Частота срывов), 3_6.04 (Управление состоянием) | weighted_mean |
| **environment** | worldview | 3_3.05 (Калибр личности), 3_3.02 (Контроль среды) | weighted_mean |
| **environment** | mastery | 3_7.01 (Помощь сообществу), 3_7.02 (Публикации и вклад) | weighted_mean |
| **organism** | worldview | 3_6.01 (Индекс ресурсности) | single |
| **organism** | mastery | 3_6.02 (Ритм работа-отдых), 3_6.03 (Устойчивость), 3_6.05 (Частота методов восстановления) | weighted_mean |

### Правила агрегации

- **weighted_mean:** `score = Σ(value_i × weight_i) / Σ(weight_i)`. Веса по умолчанию = 1.0 (равные)
- **single:** один показатель = score напрямую
- **Нормализация:** каждый показатель нормализуется к [0, 1] по порогам ступени из метамодели (Thresholds)
- **Отсутствующий показатель:** `null` → исключается из расчёта, `source_indicators[]` помечает `"value": null`

### Нормативы по ступеням (из FORM.080)

| Переход | Ведущие области | Норматив ведущей | Норматив поддерживающей |
|---------|----------------|------------------|------------------------|
| 1→2 | knowledge, organism | 0.60 | 0.40 |
| 2→3 | tools, constraints | 0.65 | 0.45 |
| 3→4 | knowledge, constraints, environment | 0.70 | 0.50 |
| 4→5 | environment, knowledge | 0.80 | 0.60 |

> Нормативы = гипотеза (FORM.080 status: draft, epistemic_stage: hypothesis). Калибровка на реальных данных — Ф4.

</details>

<details>
<summary><b>§4. Потребители</b></summary>

| Потребитель | Что берёт | Как использует |
|-------------|-----------|----------------|
| **Портной** (MIM.SOP.001 Шаг 3) | `max_gap` + `transition.leading_areas` | Выбирает область → тип (worldview/mastery) → элемент из каталога (CAT.001/002/003) |
| **Навигатор** (MIM.R.007) | `areas[]` полностью | Карта: «ты здесь, идёшь туда, фокус на этом» |
| **Диагност** (MIM.R.009) | `areas[].source_indicators` | Сравнивает с ЦД → определяет ступень + разрывы |
| **Оркестратор** | `transition` + `areas[].gap` | Gate-проверка: готов к следующей ступени? |

</details>

<details>
<summary><b>§5. Улучшения из АрхГейта (57/70)</b></summary>

### 5.1. Caching (Скорость: 7→9)

- **TTL:** 5 мин per user_id (в рамках MCP session)
- **Инвалидация:** при `write_digital_twin` для того же user_id
- **Реализация:** in-memory Map (не Redis — single-process MCP server)

```javascript
const profileCache = new Map(); // key: `${user_id}:${step}`, value: { data, expires }
const CACHE_TTL_MS = 5 * 60 * 1000;
```

### 5.2. mapping_version (Воспроизводимость)

- Семантическое версионирование: `MAJOR.MINOR.PATCH`
- MAJOR: изменение областей (5→6) или структуры ответа
- MINOR: новый показатель в маппинге или изменение весов
- PATCH: исправление формулы без изменения маппинга
- Хранится в конфиге маппинга, возвращается в каждом ответе

### 5.3. Event profile_gap_calculated (Генеративность: 8→9)

- После расчёта — emit event в stdout log (structured JSON)
- Формат: `{ "event": "profile_gap_calculated", "user_id": "...", "step": N, "max_gap_area": "...", "timestamp": "..." }`
- Потребители: аналитика, drift detection, будущий Event Bus

### 5.4. Latency SLA

- **Требование:** p95 ≤ 1s (file backend), p95 ≤ 2s (Neon cold), p95 ≤ 500ms (Neon warm + cache hit)
- **Measurement:** логировать duration_ms в structured log при каждом вызове

### 5.5. Наблюдаемость (L2.2)

- **Baseline profiles:** эталонный профиль на каждой ступени (FORM.080) → сравнивать распределение реальных GAP
- **Drift detection:** если >30% вызовов за неделю показывают аномальный GAP по одной области → alert в лог
- **Structured log:** каждый вызов → `{ tool, user_id, step, duration_ms, max_gap_area, cache_hit, mapping_version }`

### 5.6. Безопасность: user_id валидация

- `user_id` из аргумента ДОЛЖЕН совпадать с `DT_USER_ID` из env (single-user mode) или с session context (multi-user mode)
- Несовпадение → `{ error: "ACCESS_DENIED", message: "Cannot read another user's profile" }`

### 5.8. Confidence metadata (L1, Ф5)

- Каждый `source_indicator` содержит `confidence` [0, 1] и `last_measured` (ISO date или null)
- Формула: `confidence = count_factor × recency_factor`
  - `count_factor = min(measurement_count / 5, 1.0)` — насыщение при 5 замерах
  - `recency_factor = exp(-days_since / 90)` — полураспад ~62 дня
- `value = null` → `confidence = 0` (нет данных)
- Dimension-level confidence = среднее по non-null индикаторам
- Metadata хранится в `twinData.indicators.metrics_meta[indicatorId]` (обратно совместимо)

### 5.9. Prerequisite filter (L2, Ф5)

- Граф зависимостей (5 узлов): organism → knowledge → tools, organism+knowledge → constraints, knowledge+constraints → environment
- Область `blocked = true` если prerequisite-область имеет `gap > 0.1` при `confidence ≥ 0.3`
- `blocked_by[]` содержит конкретные `"area.dimension"` блокеры
- `max_gap` предпочитает non-blocked области. Если все заблокированы — выбирает наибольший GAP (fallback)
- Портной видит `blocked` и может принять решение действовать (экзоскелет, не запрет)

### 5.7. Override mechanism (Экзоскелет, принцип #21)

- Tool возвращает `source_indicators[]` → прозрачность
- Пользователь может вызвать `write_digital_twin` для корректировки L1 показателей → пересчёт при следующем вызове
- Будущее: поле `user_override` в ответе (пометка «пользователь не согласен с GAP по области X»)

</details>

<details>
<summary><b>§6. Реализация</b></summary>

### Где в коде

| Файл | Что |
|------|-----|
| `src/index.js` | Регистрация tool в `ListToolsRequestSchema` + handler в `CallToolRequestSchema` |
| `src/mapping.js` (новый) | Конфиг маппинга: `AREA_MAPPING`, `NORMS`, `MAPPING_VERSION` |
| `src/profile-calculator.js` (новый) | Логика агрегации: `calculateProfile(twinData, step, mapping)` |
| `src/cache.js` (новый) | In-memory cache с TTL |

### Зависимости от данных

- **Читает:** `readTwinData()` (существующая функция) → показатели из групп 3_*
- **Читает ступень:** `indicators.stage.current` (IND.3.4.01) если `step` не передан
- **НЕ пишет** в ЦД (read-only projection)

### Заглушка для пилота (Spec-first)

До полной реализации маппинга — hardcoded значения для 5 показателей (по одному на область). Позволяет WP-149 начать интеграцию с Портным параллельно.

</details>

<details>
<summary><b>§7. Версионирование и синхронизация Pack ↔ код</b></summary>

### Процесс обновления маппинга

1. **Pack обновлён** (PD.FORM.080/081) → кто-то изменил нормативы или добавил направление
2. **Sync gate:** при `git pull` DS-MCP — проверить `mapping_version` vs Pack version
3. **Обновить** `src/mapping.js` → инкремент version → тесты → deploy
4. **Обратная совместимость:** MINOR/PATCH — старые потребители работают. MAJOR — breaking change, уведомление потребителей

### Тесты

- **Unit:** `calculateProfile()` с фиксированными данными → детерминированный результат
- **Snapshot:** эталонный twin.json → эталонный ответ. При изменении маппинга — обновить snapshot
- **Integration:** вызов через MCP protocol → валидный JSON response schema

</details>

---

*Создан: 2026-03-28 | WP-175 Ф3 | АрхГейт: 57/70 (L1) + L2 пройден*
