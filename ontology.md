# Онтология: Digital Twin MCP

> **Тип:** Downstream-instrument
> **Upstream:** spf-digital-platform-pack, spf-personal-pack
> **Базовая онтология:** [SPF/ontology.md](../SPF/ontology.md) (SPF.SPEC.002)
>
> Downstream ссылается на понятия Pack'ов и SPF. Новых онтологических понятий не вводит (SPF.SPEC.002 § 4.3).

---

## 1. Upstream-зависимости

| Уровень | Источник | Что используется |
|---------|----------|------------------|
| Pack | [spf-digital-platform-pack](../spf-digital-platform-pack/) | Архитектура цифрового двойника, MCP-сервисы |
| Pack | [spf-personal-pack](../spf-personal-pack/) | Индикаторы, характеристики созидателя |
| SPF | [SPF/ontology.md](../SPF/ontology.md) | Базовая онтология (U.*) |
| FPF | Через SPF | Мета-онтология |

---

## 2. Используемые понятия из Pack

### Из spf-digital-platform-pack

| Понятие | FPF-понятие | Как используется |
|---------|-------------|------------------|
| Цифровой двойник | U.System + U.Episteme | Основная реализуемая сущность |
| MCP-сервис | U.System + U.Interaction | Протокол интеграции |
| Индикатор | U.Characteristic | Наблюдаемые данные о созидателе |
| ИИ-система | U.System + U.Capability | Потребитель данных двойника |

### Из spf-personal-pack

| Понятие | FPF-понятие | Как используется |
|---------|-------------|------------------|
| Созидатель | U.System | Субъект, чей двойник моделируется |
| Характеристика | U.Characteristic | Оси оценки, хранимые в двойнике |
| Состояние | U.Flow | Текущий этап развития |

---

## 3. Терминология реализации

| Термин | Понятие Pack/SPF | Описание |
|--------|------------------|----------|
| Метамодель | U.Episteme | Структура индикаторов (declarative, collected, derived, generated) |
| Индикатор | U.Characteristic | Измеряемый параметр созидателя |
| Tool (MCP) | U.Interaction | Единица API, доступная через MCP-протокол |
| Resource (MCP) | U.Episteme | Данные, доступные через MCP-протокол |

---

## 4. Связанные документы

- [spf-digital-platform-pack/ontology.md](../spf-digital-platform-pack/ontology.md) — онтология платформы
- [spf-personal-pack/ontology.md](../spf-personal-pack/ontology.md) — онтология созидателя
- [SPF/ontology.md](../SPF/ontology.md) — базовая онтология (SPF.SPEC.002)
