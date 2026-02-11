# Тип репозитория

**Тип**: `Downstream/instrument`
**Система (SoI)**: ИТ-платформа
**Содержание**: code
**Для кого**: team
**Source-of-truth**: no

## Роль

MCP-сервис цифрового двойника. Вычислительный/интеграционный контур для работы с индикаторами и характеристиками созидателя.

## Upstream dependencies

- [TserenTserenov/PACK-digital-platform](https://github.com/TserenTserenov/PACK-digital-platform) — source-of-truth области ИТ-платформы
- [aisystant/PACK-personal](https://github.com/aisystant/PACK-personal) — контракт индикаторов созидателя

## Downstream outputs

- MCP-инструменты для Claude и других LLM
- API для других сервисов экосистемы
- Интеграция с aist_bot

## Non-goals

- НЕ является source-of-truth (определения в pack'ах)
- НЕ определяет «что такое индикатор» — только реализует вычисления
- Генеративные тексты/интерпретации НЕ являются source-of-truth

## Что содержит

- Код MCP-сервера (Cloudflare Workers)
- Мета-модель индикаторов (markdown-файлы)
- API для работы с индикаторами
- Логика расчёта производных оценок
