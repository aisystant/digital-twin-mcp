# Digital Twin MCP Server — About

## Позиционирование в архитектуре знаний

digital-twin-mcp — это **Downstream-артефакт (уровень 4)** в экосистеме Aisystant.

### Уровни знаний

```
Уровень 1: FPF (First Principles Framework)
│ github.com/ailev/FPF
▼
Уровень 2: SPF (Second Principles Framework)
│ Фреймворк производства Pack'ов
▼
Уровень 3: Pack (Доменный source-of-truth)
│ github.com/aisystant/PACK-personal
▼
Уровень 4: Downstream  ← digital-twin-mcp здесь
  Производные артефакты (MCP-серверы, боты, курсы)
```

| Уровень | Роль | Репозиторий |
|---------|------|-------------|
| 1. FPF | Мета-онтология | [ailev/FPF](https://github.com/ailev/FPF) |
| 2. SPF | Фреймворк производства | [TserenTserenov/SPF](https://github.com/TserenTserenov/SPF) |
| 3. Pack | Source-of-truth области | [aisystant/PACK-personal](https://github.com/aisystant/PACK-personal) |
| **4. Downstream** | **Производные артефакты** | **Этот репозиторий** |

### Связанные репозитории

| Репозиторий | Связь |
|-------------|-------|
| [DS-ecosystem-development](https://github.com/aisystant/DS-ecosystem-development) | Спецификации модели данных ЦД, архитектура MCP-сервера |
| [PACK-personal](https://github.com/aisystant/PACK-personal) | Source-of-truth области «Созидатель» |
| [FMT-s2r](https://github.com/TserenTserenov/FMT-s2r) | Методология организации (используется в DS-ecosystem-development) |

### Принцип

Как Downstream-артефакт, digital-twin-mcp:
- **Реализует** спецификации из DS-ecosystem-development
- **Использует** терминологию из SPF/Pack
- **НЕ является** source-of-truth (при противоречии — приоритет у Pack)

## Спецификации

Модель данных цифрового двойника и архитектура MCP-сервера описаны в:
- [DS-ecosystem-development/B.Aisystant-Ecosystem/B2.Aisystant-Ecosystem/B2.2.Architecture/](https://github.com/aisystant/DS-ecosystem-development/tree/main/B.Aisystant-Ecosystem/B2.Aisystant-Ecosystem/B2.2.Architecture)

Ключевые документы:
- **Модель данных цифрового двойника 3.2.md** — 4 типа показателей (IND.1-4)
- **MCP-сервер цифрового двойника 3.2.md** — 3 инструмента MCP
- **Описание цифрового двойника 3.2.md** — концепция и use cases

## Indicator Classification (IND.1-4)

```
PRIMARY DATA:
├── IND.1.* Declarative — user inputs directly
│   └── Profile, goals, self-assessment, preferences
│   └── ✅ User can edit
│
└── IND.2.* Collected — automatically from actions
    └── Courses, time, payments, activity
    └── 🔒 Read only

SECONDARY DATA:
├── IND.3.* Derived — calculated, stored
│   └── Agency, stage, mastery, risks
│   └── 🔒 User cannot modify
│
└── IND.4.* Generated — on-demand, not stored
    └── Recommendations, forecasts, comparisons
    └── ⚡ Created on the fly
```

### Access Control Matrix

| Type | User | Guide | System |
|------|------|-------|--------|
| IND.1.* (1_declarative) | Read/Write | Read | Read/Write |
| IND.2.* (2_collected) | Read | Read | Write |
| IND.3.* (3_derived) | Read | Read | Write (calc) |
| IND.4.* (4_generated) | Read | Read/Generate | Generate |

## Metamodel Structure

```
metamodel/
├── 1_declarative/          # IND.1.* (20 indicators)
│   ├── 1_1_profile/
│   ├── 1_2_goals/
│   ├── 1_3_selfeval/
│   └── 1_4_context/
│
├── 2_collected/            # IND.2.* (5 indicators)
│   ├── 2_5_finance/
│   ├── 2_8_ai_logs/
│   └── 2_9_community/
│
├── 3_derived/              # IND.3.* (37 indicators)
│   ├── 3_1_agency/
│   ├── 3_2_mastery/
│   └── ... (10 subgroups)
│
├── 4_generated/            # IND.4.* (3 indicators)
│   ├── 4_3_forecasts/
│   └── 4_4_reports/
│
└── _shared/                # Shared definitions
    ├── stages.md
    └── degrees.md
```

## Strategic Map

See [MAPSTRATEGIC.md](./MAPSTRATEGIC.md) for strategic vision (phases, versions):

- **v1.0** ✅ Declarative indicators (IND.1.*)
- **v2.0** 🟡 Collected indicators (IND.2.*)
- **v3.0** 🟡 Derived indicators (IND.3.*)
- **v4.0** 🔴 Generated indicators (IND.4.*)
