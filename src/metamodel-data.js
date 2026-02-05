// Auto-generated from MD files - do not edit manually
// Generated at: 2026-02-05T09:30:29.068Z
// Structure: 4-type classification (IND.1-4)

export const METAMODEL = {
  "categories": [
    {
      "name": "1_declarative",
      "description": "# 1. Декларируемые показатели (IND.1.*)\n\n**Тип:** Первичные данные\n**Источник:** Пользователь вводит сам\n**Права:** Пользователь — Read/Write, Проводник — Read, Система — Read/Write\n\n## Описание\n\nДекларируемые показатели — это данные, которые пользователь указывает самостоятельно: профиль, цели, самооценка, предпочтения. Эти данные субъективны и полностью контролируются пользователем.\n\n## Подгруппы\n\n- **1_1_profile** — Профиль и идентификация\n- **1_2_goals** — Цели и намерения\n- **1_3_selfeval** — Самооценка и предпочтения\n- **1_4_context** — Контекст и история\n\n## Версия реализации\n\n**v1.0** — Базовая функциональность\n",
      "subgroups": [
        {
          "name": "1_1_profile",
          "fullPath": "1_declarative/1_1_profile",
          "description": "",
          "indicators": {}
        },
        {
          "name": "1_2_goals",
          "fullPath": "1_declarative/1_2_goals",
          "description": "",
          "indicators": {
            "05_Интересующие области": "# IND.1.2.1\n\n**Name:** Интересующие области\n**Name (EN):** Domain focus\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "09_Цели обучения": "# IND.1.2.2\n\n**Name:** Цели обучения\n**Name (EN):** Learning objectives\n**Type:** semantic\n**Format:** structured_text\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "11_Мои приоритетные проекты": "# IND.1.2.3\n\n**Name:** Мои приоритетные проекты\n**Name (EN):** My priority projects\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "14_Планируемый результат ближайшего этапа": "# IND.1.2.4\n\n**Name:** Планируемый результат ближайшего этапа\n**Name (EN):** Planned stage result\n**Type:** semantic\n**Format:** structured_text\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "20_Рабочие продукты на неделю": "# IND.1.2.5\n\n**Name:** Рабочие продукты на неделю\n**Name (EN):** Weekly work products\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n"
          }
        },
        {
          "name": "1_3_selfeval",
          "fullPath": "1_declarative/1_3_selfeval",
          "description": "",
          "indicators": {
            "07_Выбранные руководства": "# IND.1.3.1\n\n**Name:** Выбранные руководства\n**Name (EN):** Selected guides\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "08_Фокусные методы": "# IND.1.3.2\n\n**Name:** Фокусные методы\n**Name (EN):** Highlighted methods\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "12_Текущие роли": "# IND.1.3.3\n\n**Name:** Текущие роли\n**Name (EN):** Current roles\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "16_Целевые показатели состояния": "# IND.1.3.4\n\n**Name:** Целевые показатели состояния\n**Name (EN):** Target state indicators\n**Type:** scale\n**Format:** object\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n\n## Schema\n```json\n{\n  \"energy\": \"1-5\",\n  \"attention\": \"1-5\",\n  \"sleep\": \"1-5\"\n}\n```\n",
            "18_Раздел руководства к изучению": "# IND.1.3.5\n\n**Name:** Раздел руководства к изучению\n**Name (EN):** Weekly guide section\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "19_Недельный бюджет времени": "# IND.1.3.6\n\n**Name:** Недельный бюджет времени\n**Name (EN):** Weekly time budget\n**Type:** temporal\n**Format:** float\n**Unit:** hours/week\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n"
          }
        },
        {
          "name": "1_4_context",
          "fullPath": "1_declarative/1_4_context",
          "description": "",
          "indicators": {
            "01_Текущие проблемы": "# IND.1.4.1\n\n**Name:** Текущие проблемы\n**Name (EN):** Current problems\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "02_Время отчёта за день": "# IND.1.4.4\n\n**Name:** Время отчёта за день\n**Name (EN):** Daily report time\n**Type:** structural\n**Format:** time\n**Unit:** HH:MM\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "03_Время получения задания": "# IND.1.4.5\n\n**Name:** Время получения задания\n**Name (EN):** Daily task time\n**Type:** structural\n**Format:** time\n**Unit:** HH:MM\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "04_Мои неудовлетворенности": "# IND.1.4.2\n\n**Name:** Мои неудовлетворенности\n**Name (EN):** My dissatisfactions\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "06_Мои эмоции и чувства": "# IND.1.4.3\n\n**Name:** Мои эмоции и чувства\n**Name (EN):** My emotions and feelings\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "10_Планируемое время на завтра": "# IND.1.4.6\n\n**Name:** Планируемое время на завтра\n**Name (EN):** Planned time tomorrow\n**Type:** temporal\n**Format:** float\n**Unit:** hours\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "13_Дата окончания ближайшего этапа": "# IND.1.4.7\n\n**Name:** Дата окончания ближайшего этапа\n**Name (EN):** Stage end date\n**Type:** temporal\n**Format:** date\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "15_Время запроса стратегирования": "# IND.1.4.8\n\n**Name:** Время запроса стратегирования\n**Name (EN):** Strategy request time\n**Type:** structural\n**Format:** day_time\n**Unit:** day_of_week + HH:MM\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
            "17_Время получения аналитики": "# IND.1.4.9\n\n**Name:** Время получения аналитики\n**Name (EN):** Weekly analytics time\n**Type:** structural\n**Format:** day_time\n**Unit:** day_of_week + HH:MM\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n"
          }
        }
      ]
    },
    {
      "name": "2_collected",
      "description": "# 2. Собираемые показатели (IND.2.*)\n\n**Тип:** Первичные данные\n**Источник:** Автоматически из действий пользователя\n**Права:** Пользователь — Read, Проводник — Read, Система — Write\n\n## Описание\n\nСобираемые показатели — это данные, которые система получает автоматически из действий пользователя: прохождение курсов, время сессий, платежи, активность в клубе, логи взаимодействия с ИИ.\n\n## Подгруппы\n\n- **2_1_account** — Аккаунт и сессии\n- **2_2_courses** — Прохождение курсов\n- **2_3_practice** — Задания и практики\n- **2_4_time** — Время и ритм\n- **2_5_finance** — Финансы\n- **2_8_ai_logs** — Логи ботов и ИИ\n- **2_9_community** — Сообщество (Клуб)\n\n## Версия реализации\n\n**v2.0** — Требуется интеграция с LMS, ботами и системами оплаты\n",
      "subgroups": [
        {
          "name": "2_1_account",
          "fullPath": "2_collected/2_1_account",
          "description": "",
          "indicators": {}
        },
        {
          "name": "2_2_courses",
          "fullPath": "2_collected/2_2_courses",
          "description": "",
          "indicators": {}
        },
        {
          "name": "2_3_practice",
          "fullPath": "2_collected/2_3_practice",
          "description": "",
          "indicators": {}
        },
        {
          "name": "2_4_time",
          "fullPath": "2_collected/2_4_time",
          "description": "",
          "indicators": {}
        },
        {
          "name": "2_5_finance",
          "fullPath": "2_collected/2_5_finance",
          "description": "",
          "indicators": {
            "01_Статус подписки": "# IND.2.5.01\n\n**Name:** Статус подписки\n**Name (EN):** Subscription status\n**Type:** categorical\n**Format:** enum\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n\n## Enum Values\n```json\n[\n  \"free\",\n  \"basic\",\n  \"pro\",\n  \"enterprise\"\n]\n```\n",
            "02_Реферальная активность": "# IND.2.5.02\n\n**Name:** Реферальная активность\n**Name (EN):** Referral activity\n**Type:** frequency\n**Format:** integer\n**Unit:** referrals\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n",
            "03_Срок участия в программе": "# IND.2.5.03\n\n**Name:** Срок участия в программе\n**Name (EN):** Program tenure\n**Type:** temporal\n**Format:** integer\n**Unit:** months\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n"
          }
        },
        {
          "name": "2_8_ai_logs",
          "fullPath": "2_collected/2_8_ai_logs",
          "description": "",
          "indicators": {
            "01_Использование AI Guide": "# IND.2.8.1\n\n**Name:** Использование AI Guide\n**Name (EN):** AI Guide usage\n**Type:** frequency\n**Format:** integer\n**Unit:** sessions/week\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n"
          }
        },
        {
          "name": "2_9_community",
          "fullPath": "2_collected/2_9_community",
          "description": "",
          "indicators": {
            "01_Активность в сообществе": "# IND.2.9.1\n\n**Name:** Активность в сообществе\n**Name (EN):** Community activity\n**Type:** frequency\n**Format:** integer\n**Unit:** interactions/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 1\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 3\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 5\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 10\n  }\n}\n```\n"
          }
        }
      ]
    },
    {
      "name": "3_derived",
      "description": "# 3. Расчётные показатели (IND.3.*)\n\n**Тип:** Вторичные данные\n**Источник:** Вычисляются системой, хранятся\n**Права:** Пользователь — Read, Проводник — Read, Система — Write (calc)\n\n## Описание\n\nРасчётные показатели — это метрики, которые система вычисляет на основе первичных данных (IND.1.* и IND.2.*). Результаты вычислений сохраняются для последующего использования.\n\n## Подгруппы\n\n- **3_1_agency** — Агентность\n- **3_2_mastery** — Мастерство\n- **3_3_characteristics** — Характеристики по ступеням\n- **3_4_qualification** — Квалификация и ступени\n- **3_5_roles** — Мастерство по ролям\n- **3_6_resourcefulness** — Ресурсность\n- **3_7_community** — Сообщество и вклад\n- **3_8_economics** — Экономика участия\n- **3_9_ai_usage** — Использование ИИ\n- **3_10_integral** — Интегральные профили и риски\n\n## Версия реализации\n\n**v3.0** — Требуется реализация расчётных моделей\n",
      "subgroups": [
        {
          "name": "3_10_integral",
          "fullPath": "3_derived/3_10_integral",
          "description": "",
          "indicators": {
            "01_Интегральный индекс агентности": "# IND.3.10.1\n\n**Name:** Интегральный индекс агентности\n**Name (EN):** Integral agency index\n**Type:** scale\n**Format:** float\n**Unit:** 0-100\n**Description:** Агрегированный показатель из групп 2.1-2.3\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: false\n"
          }
        },
        {
          "name": "3_1_agency",
          "fullPath": "3_derived/3_1_agency",
          "description": "",
          "indicators": {
            "01_Среднее число часов саморазвития в неделю": "# IND.3.1.01\n\n**Name:** Среднее число часов саморазвития в неделю\n**Name (EN):** Average self-development hours per week\n**Type:** temporal\n**Format:** float\n**Unit:** hours/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"max\": 0.5,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"min\": 4,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"min\": 6,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"min\": 8,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"min\": 10,\n    \"period_weeks\": 24\n  }\n}\n```\n",
            "02_Доля дней со слотом (регулярность)": "# IND.3.1.02\n\n**Name:** Доля дней со слотом (регулярность)\n**Name (EN):** Proportion of days with learning slot\n**Type:** frequency\n**Format:** float\n**Unit:** days/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 1,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 3,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 5,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 6,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 6.7,\n    \"period_weeks\": 24\n  }\n}\n```\n",
            "03_Стабильность слотов (серии дней подряд)": "# IND.3.1.03\n\n**Name:** Стабильность слотов (серии дней подряд)\n**Name (EN):** Slot stability (consecutive days)\n**Type:** frequency\n**Format:** integer\n**Unit:** consecutive_days\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 3,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 4,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 5,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 6,\n    \"period_weeks\": 24\n  }\n}\n```\n",
            "04_Частота срывов": "# IND.3.1.04\n\n**Name:** Частота срывов\n**Name (EN):** Relapse frequency\n**Type:** frequency\n**Format:** string\n**Unit:** relapses/period\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"1 срыв в 2 недели\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"1 срыв в месяц\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Нет срывов\"\n  }\n}\n```\n",
            "05_Индекс инициативности (регулярность стратегирования)": "# IND.3.1.05\n\n**Name:** Индекс инициативности (регулярность стратегирования)\n**Name (EN):** Initiative index (strategy regularity)\n**Type:** frequency\n**Format:** float\n**Unit:** percent_weeks\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 0,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 0,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 80,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 95,\n    \"period_weeks\": 24\n  }\n}\n```\n"
          }
        },
        {
          "name": "3_2_mastery",
          "fullPath": "3_derived/3_2_mastery",
          "description": "",
          "indicators": {
            "01_Интенсивность практики (степень мастерства по практикам)": "# IND.3.2.01\n\n**Name:** Интенсивность практики (степень мастерства по практикам)\n**Name (EN):** Practice intensity (mastery levels)\n**Type:** categorical\n**Format:** checklist\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Чек-листы: Объяснение 75%, Умение 50%\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Чек-листы: Умение 75%, Навык 50%\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Чек-листы: Навык 75%, Мастерство 50%\"\n  }\n}\n```\n",
            "02_Индекс рабочих продуктов (творческий конвейер)": "# IND.3.2.02\n\n**Name:** Индекс рабочих продуктов (творческий конвейер)\n**Name (EN):** Work products index (creative pipeline)\n**Type:** frequency\n**Format:** float\n**Unit:** drafts/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 0,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 1,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 1.5,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 2,\n    \"period_weeks\": 24\n  }\n}\n```\n",
            "03_Учтённое время (прохождение ритуала)": "# IND.3.2.03\n\n**Name:** Учтённое время (прохождение ритуала)\n**Name (EN):** Accounted time (ritual completion)\n**Type:** temporal\n**Format:** float\n**Unit:** hours/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 0,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 20,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 30,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 40,\n    \"period_weeks\": 24\n  }\n}\n```\n",
            "04_Развитие мировоззрения": "# IND.3.2.04\n\n**Name:** Развитие мировоззрения\n**Name (EN):** Worldview evolution\n**Type:** semantic\n**Format:** checklist\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": \"Понимаю зачем, чему, как и когда учиться\"\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Понимаю что такое мировоззрение и замечаю свои мемы\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Поменял как минимум один свой плохой мем\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Разобрался с большинством плохих мемов и помогаю другим\"\n  }\n}\n```\n",
            "05_Трансформация привычек": "# IND.3.2.05\n\n**Name:** Трансформация привычек\n**Name (EN):** Habit transformation\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": null\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Осознаю свои плохие привычки и начал работать\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Отказался или заменил плохую привычку на хорошую\"\n  }\n}\n```\n",
            "06_Развитие потенциала": "# IND.3.2.06\n\n**Name:** Развитие потенциала\n**Name (EN):** Potential growth\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": null\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Понимаю характеристику агента и потенциал\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Повысил потенциал хотя бы по одной характеристике\"\n  }\n}\n```\n",
            "07_Текущие негативные привычки": "# IND.3.2.07\n\n**Name:** Текущие негативные привычки\n**Name (EN):** Current negative habits\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n"
          }
        },
        {
          "name": "3_3_characteristics",
          "fullPath": "3_derived/3_3_characteristics",
          "description": "",
          "indicators": {
            "01_Индекс рефлексии (частота заметок)": "# IND.3.3.01\n\n**Name:** Индекс рефлексии (частота заметок)\n**Name (EN):** Reflection index (notes frequency)\n**Type:** frequency\n**Format:** float\n**Unit:** notes/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 0,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 5,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 6,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 6.7,\n    \"period_weeks\": 24\n  }\n}\n```\n",
            "02_Характеристики окружения (контроль инфопотока)": "# IND.3.3.02\n\n**Name:** Характеристики окружения (контроль инфопотока)\n**Name (EN):** Environment characteristics (infostream control)\n**Type:** semantic\n**Format:** checklist\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": \"Начал чистить окружение (убрал лишние каналы)\"\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Взял под контроль внимание, осознанно меняю окружение\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Стал активным участником сообщества\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Активно занимается просвещением\"\n  }\n}\n```\n",
            "03_Поведенческие паттерны": "# IND.3.3.03\n\n**Name:** Поведенческие паттерны\n**Name (EN):** Behavior patterns\n**Type:** categorical\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Выявляет и старается обходить\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Снижает/перепрошивает\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Переписывает сознательно\"\n  }\n}\n```\n",
            "04_Текущие мемы (продуктивные и непродуктивные)": "# IND.3.3.04\n\n**Name:** Текущие мемы (продуктивные и непродуктивные)\n**Name (EN):** Current memes\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Замечает мемы у других\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Замечает свои непродуктивные мемы\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Осознанно меняет\"\n  }\n}\n```\n",
            "05_Калибр личности (системные уровни целей)": "# IND.3.3.05\n\n**Name:** Калибр личности (системные уровни целей)\n**Name (EN):** Personality caliber (systemic intent levels)\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": null\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": null\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Уровень команды и сообщества\"\n  }\n}\n```\n"
          }
        },
        {
          "name": "3_4_qualification",
          "fullPath": "3_derived/3_4_qualification",
          "description": "",
          "indicators": {
            "01_Внутренняя ступень Ученика": "# IND.3.4.01\n\n**Name:** Внутренняя ступень Ученика\n**Name (EN):** Internal student stage\n**Type:** categorical\n**Format:** enum\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n\n## Enum Values\n```json\n[\n  \"STG.Student.Random\",\n  \"STG.Student.Practicing\",\n  \"STG.Student.Systematic\",\n  \"STG.Student.Disciplined\",\n  \"STG.Student.Proactive\"\n]\n```\n",
            "02_История смены ступеней": "# IND.3.4.02\n\n**Name:** История смены ступеней\n**Name (EN):** Stage change history\n**Type:** categorical\n**Format:** list[object]\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n",
            "03_Дата последнего присвоения": "# IND.3.4.03\n\n**Name:** Дата последнего присвоения\n**Name (EN):** Last assigned date\n**Type:** temporal\n**Format:** date\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n",
            "04_Критерии присвоения ступени": "# IND.3.4.04\n\n**Name:** Критерии присвоения ступени\n**Name (EN):** Qualification criteria snapshot\n**Type:** semantic\n**Format:** structured_text\n**Description:** Срез показателей на дату присвоения квалификации\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n"
          }
        },
        {
          "name": "3_5_roles",
          "fullPath": "3_derived/3_5_roles",
          "description": "",
          "indicators": {
            "01_Мастерство в целевых ролях": "# IND.3.5.01\n\n**Name:** Мастерство в целевых ролях\n**Name (EN):** Target role mastery\n**Type:** categorical\n**Format:** object\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n\n## Schema\n```json\n{\n  \"role\": \"string\",\n  \"level\": \"enum[Знакомство,Объяснение,Умение,Навык,Мастерство]\"\n}\n```\n",
            "02_Прогресс по ролевым чек-листам": "# IND.3.5.02\n\n**Name:** Прогресс по ролевым чек-листам\n**Name (EN):** Role checklist progress\n**Type:** frequency\n**Format:** float\n**Unit:** percent\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n",
            "03_Применение ролей в проектах": "# IND.3.5.03\n\n**Name:** Применение ролей в проектах\n**Name (EN):** Role application in projects\n**Type:** frequency\n**Format:** integer\n**Unit:** projects\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n"
          }
        },
        {
          "name": "3_6_resourcefulness",
          "fullPath": "3_derived/3_6_resourcefulness",
          "description": "",
          "indicators": {
            "01_Индекс ресурсности (продуктивность состояния)": "# IND.3.6.01\n\n**Name:** Индекс ресурсности (продуктивность состояния)\n**Name (EN):** Resourcefulness index (state productivity)\n**Type:** scale\n**Format:** float\n**Unit:** 1-5\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 3,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 3.7,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 4.3,\n    \"period_weeks\": 24\n  }\n}\n```\n",
            "02_Ритм работа–отдых (соблюдение ритма)": "# IND.3.6.02\n\n**Name:** Ритм работа–отдых (соблюдение ритма)\n**Name (EN):** Work-rest rhythm adherence\n**Type:** scale\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"3–4 дня в ритме/неделя\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"6–7 дней стабильно\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Автоматизированный ритм\"\n  }\n}\n```\n",
            "03_Устойчивость к сбоям (скорость восстановления)": "# IND.3.6.03\n\n**Name:** Устойчивость к сбоям (скорость восстановления)\n**Name (EN):** Fault tolerance (recovery speed)\n**Type:** temporal\n**Format:** integer\n**Unit:** days\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 7\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 3\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 1\n  }\n}\n```\n",
            "04_Управление текущим состоянием": "# IND.3.6.04\n\n**Name:** Управление текущим состоянием\n**Name (EN):** Current state regulation\n**Type:** scale\n**Format:** float\n**Unit:** 1-5\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": null\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 3,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 3.5,\n    \"period_weeks\": 24\n  }\n}\n```\n",
            "05_Частота методов восстановления": "# IND.3.6.05\n\n**Name:** Частота методов восстановления\n**Name (EN):** Recovery methods frequency\n**Type:** frequency\n**Format:** string\n**Unit:** times/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"1–2 метода в неделю\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Стабильные практики\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Саморегуляция в рутине\"\n  }\n}\n```\n",
            "06_Использованные методы поддержки": "# IND.3.6.06\n\n**Name:** Использованные методы поддержки\n**Name (EN):** Support methods used\n**Type:** frequency\n**Format:** string\n**Unit:** count/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"1–2 регулярных практики\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"3–5 встроенных в рутину\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Комплексная система поддержки\"\n  }\n}\n```\n",
            "07_Гибкость пересборки": "# IND.3.6.07\n\n**Name:** Гибкость пересборки\n**Name (EN):** Restructuring flexibility\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Переосмысливает раз в неделю\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Быстро корректирует план\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Перестраивает маршрут мгновенно\"\n  }\n}\n```\n"
          }
        },
        {
          "name": "3_7_community",
          "fullPath": "3_derived/3_7_community",
          "description": "",
          "indicators": {
            "02_Помощь другим участникам": "# IND.3.7.1\n\n**Name:** Помощь другим участникам\n**Name (EN):** Help to other members\n**Type:** frequency\n**Format:** integer\n**Unit:** helps/month\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n",
            "03_Публикации и вклад в контент": "# IND.3.7.2\n\n**Name:** Публикации и вклад в контент\n**Name (EN):** Publications and content contribution\n**Type:** frequency\n**Format:** integer\n**Unit:** posts/month\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n"
          }
        },
        {
          "name": "3_8_economics",
          "fullPath": "3_derived/3_8_economics",
          "description": "",
          "indicators": {}
        },
        {
          "name": "3_9_ai_usage",
          "fullPath": "3_derived/3_9_ai_usage",
          "description": "",
          "indicators": {
            "02_Качество взаимодействия с ИИ": "# IND.3.9.1\n\n**Name:** Качество взаимодействия с ИИ\n**Name (EN):** AI interaction quality\n**Type:** scale\n**Format:** float\n**Unit:** 1-5\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n",
            "03_Применение рекомендаций ИИ": "# IND.3.9.2\n\n**Name:** Применение рекомендаций ИИ\n**Name (EN):** AI recommendations adoption\n**Type:** frequency\n**Format:** float\n**Unit:** percent\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n"
          }
        }
      ]
    },
    {
      "name": "4_generated",
      "description": "# 4. Генерируемые показатели (IND.4.*)\n\n**Тип:** Вторичные данные\n**Источник:** Генерируются по запросу, не хранятся\n**Права:** Пользователь — Read, Проводник — Read/Generate, Система — Generate\n\n## Описание\n\nГенерируемые показатели — это данные, которые создаются динамически по запросу: персональные рекомендации, сравнения с когортой, прогнозы, отчёты. Эти данные не хранятся постоянно, а генерируются каждый раз заново.\n\n## Подгруппы\n\n- **4_1_recommendations** — Персональные рекомендации\n- **4_2_comparisons** — Сравнение с когортой\n- **4_3_forecasts** — Прогнозы\n- **4_4_reports** — Динамические отчёты\n\n## Версия реализации\n\n**v4.0** — Требуется интеграция с AI/ML моделями\n",
      "subgroups": [
        {
          "name": "4_1_recommendations",
          "fullPath": "4_generated/4_1_recommendations",
          "description": "",
          "indicators": {}
        },
        {
          "name": "4_2_comparisons",
          "fullPath": "4_generated/4_2_comparisons",
          "description": "",
          "indicators": {}
        },
        {
          "name": "4_3_forecasts",
          "fullPath": "4_generated/4_3_forecasts",
          "description": "",
          "indicators": {
            "02_Готовность к следующей ступени": "# IND.4.3.1\n\n**Name:** Готовность к следующей ступени\n**Name (EN):** Readiness for next stage\n**Type:** scale\n**Format:** float\n**Unit:** percent\n**Description:** Процент выполнения критериев следующей ступени\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: false\n"
          }
        },
        {
          "name": "4_4_reports",
          "fullPath": "4_generated/4_4_reports",
          "description": "",
          "indicators": {
            "03_Профиль сильных сторон": "# IND.4.4.1\n\n**Name:** Профиль сильных сторон\n**Name (EN):** Strengths profile\n**Type:** semantic\n**Format:** list[string]\n**Description:** Области с наивысшими показателями\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: false\n",
            "04_Профиль зон развития": "# IND.4.4.2\n\n**Name:** Профиль зон развития\n**Name (EN):** Growth areas profile\n**Type:** semantic\n**Format:** list[string]\n**Description:** Области требующие внимания\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: false\n"
          }
        }
      ]
    }
  ],
  "groups": [
    {
      "name": "1_declarative/1_1_profile",
      "description": "",
      "indicators": {}
    },
    {
      "name": "1_declarative/1_2_goals",
      "description": "",
      "indicators": {
        "05_Интересующие области": "# IND.1.2.1\n\n**Name:** Интересующие области\n**Name (EN):** Domain focus\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "09_Цели обучения": "# IND.1.2.2\n\n**Name:** Цели обучения\n**Name (EN):** Learning objectives\n**Type:** semantic\n**Format:** structured_text\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "11_Мои приоритетные проекты": "# IND.1.2.3\n\n**Name:** Мои приоритетные проекты\n**Name (EN):** My priority projects\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "14_Планируемый результат ближайшего этапа": "# IND.1.2.4\n\n**Name:** Планируемый результат ближайшего этапа\n**Name (EN):** Planned stage result\n**Type:** semantic\n**Format:** structured_text\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "20_Рабочие продукты на неделю": "# IND.1.2.5\n\n**Name:** Рабочие продукты на неделю\n**Name (EN):** Weekly work products\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n"
      }
    },
    {
      "name": "1_declarative/1_3_selfeval",
      "description": "",
      "indicators": {
        "07_Выбранные руководства": "# IND.1.3.1\n\n**Name:** Выбранные руководства\n**Name (EN):** Selected guides\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "08_Фокусные методы": "# IND.1.3.2\n\n**Name:** Фокусные методы\n**Name (EN):** Highlighted methods\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "12_Текущие роли": "# IND.1.3.3\n\n**Name:** Текущие роли\n**Name (EN):** Current roles\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "16_Целевые показатели состояния": "# IND.1.3.4\n\n**Name:** Целевые показатели состояния\n**Name (EN):** Target state indicators\n**Type:** scale\n**Format:** object\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n\n## Schema\n```json\n{\n  \"energy\": \"1-5\",\n  \"attention\": \"1-5\",\n  \"sleep\": \"1-5\"\n}\n```\n",
        "18_Раздел руководства к изучению": "# IND.1.3.5\n\n**Name:** Раздел руководства к изучению\n**Name (EN):** Weekly guide section\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "19_Недельный бюджет времени": "# IND.1.3.6\n\n**Name:** Недельный бюджет времени\n**Name (EN):** Weekly time budget\n**Type:** temporal\n**Format:** float\n**Unit:** hours/week\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n"
      }
    },
    {
      "name": "1_declarative/1_4_context",
      "description": "",
      "indicators": {
        "01_Текущие проблемы": "# IND.1.4.1\n\n**Name:** Текущие проблемы\n**Name (EN):** Current problems\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "02_Время отчёта за день": "# IND.1.4.4\n\n**Name:** Время отчёта за день\n**Name (EN):** Daily report time\n**Type:** structural\n**Format:** time\n**Unit:** HH:MM\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "03_Время получения задания": "# IND.1.4.5\n\n**Name:** Время получения задания\n**Name (EN):** Daily task time\n**Type:** structural\n**Format:** time\n**Unit:** HH:MM\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "04_Мои неудовлетворенности": "# IND.1.4.2\n\n**Name:** Мои неудовлетворенности\n**Name (EN):** My dissatisfactions\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "06_Мои эмоции и чувства": "# IND.1.4.3\n\n**Name:** Мои эмоции и чувства\n**Name (EN):** My emotions and feelings\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "10_Планируемое время на завтра": "# IND.1.4.6\n\n**Name:** Планируемое время на завтра\n**Name (EN):** Planned time tomorrow\n**Type:** temporal\n**Format:** float\n**Unit:** hours\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "13_Дата окончания ближайшего этапа": "# IND.1.4.7\n\n**Name:** Дата окончания ближайшего этапа\n**Name (EN):** Stage end date\n**Type:** temporal\n**Format:** date\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "15_Время запроса стратегирования": "# IND.1.4.8\n\n**Name:** Время запроса стратегирования\n**Name (EN):** Strategy request time\n**Type:** structural\n**Format:** day_time\n**Unit:** day_of_week + HH:MM\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n",
        "17_Время получения аналитики": "# IND.1.4.9\n\n**Name:** Время получения аналитики\n**Name (EN):** Weekly analytics time\n**Type:** structural\n**Format:** day_time\n**Unit:** day_of_week + HH:MM\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n"
      }
    },
    {
      "name": "2_collected/2_1_account",
      "description": "",
      "indicators": {}
    },
    {
      "name": "2_collected/2_2_courses",
      "description": "",
      "indicators": {}
    },
    {
      "name": "2_collected/2_3_practice",
      "description": "",
      "indicators": {}
    },
    {
      "name": "2_collected/2_4_time",
      "description": "",
      "indicators": {}
    },
    {
      "name": "2_collected/2_5_finance",
      "description": "",
      "indicators": {
        "01_Статус подписки": "# IND.2.5.01\n\n**Name:** Статус подписки\n**Name (EN):** Subscription status\n**Type:** categorical\n**Format:** enum\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n\n## Enum Values\n```json\n[\n  \"free\",\n  \"basic\",\n  \"pro\",\n  \"enterprise\"\n]\n```\n",
        "02_Реферальная активность": "# IND.2.5.02\n\n**Name:** Реферальная активность\n**Name (EN):** Referral activity\n**Type:** frequency\n**Format:** integer\n**Unit:** referrals\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n",
        "03_Срок участия в программе": "# IND.2.5.03\n\n**Name:** Срок участия в программе\n**Name (EN):** Program tenure\n**Type:** temporal\n**Format:** integer\n**Unit:** months\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: true\n"
      }
    },
    {
      "name": "2_collected/2_8_ai_logs",
      "description": "",
      "indicators": {
        "01_Использование AI Guide": "# IND.2.8.1\n\n**Name:** Использование AI Guide\n**Name (EN):** AI Guide usage\n**Type:** frequency\n**Format:** integer\n**Unit:** sessions/week\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n"
      }
    },
    {
      "name": "2_collected/2_9_community",
      "description": "",
      "indicators": {
        "01_Активность в сообществе": "# IND.2.9.1\n\n**Name:** Активность в сообществе\n**Name (EN):** Community activity\n**Type:** frequency\n**Format:** integer\n**Unit:** interactions/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 1\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 3\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 5\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 10\n  }\n}\n```\n"
      }
    },
    {
      "name": "3_derived/3_1_agency",
      "description": "",
      "indicators": {
        "01_Среднее число часов саморазвития в неделю": "# IND.3.1.01\n\n**Name:** Среднее число часов саморазвития в неделю\n**Name (EN):** Average self-development hours per week\n**Type:** temporal\n**Format:** float\n**Unit:** hours/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"max\": 0.5,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"min\": 4,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"min\": 6,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"min\": 8,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"min\": 10,\n    \"period_weeks\": 24\n  }\n}\n```\n",
        "02_Доля дней со слотом (регулярность)": "# IND.3.1.02\n\n**Name:** Доля дней со слотом (регулярность)\n**Name (EN):** Proportion of days with learning slot\n**Type:** frequency\n**Format:** float\n**Unit:** days/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 1,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 3,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 5,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 6,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 6.7,\n    \"period_weeks\": 24\n  }\n}\n```\n",
        "03_Стабильность слотов (серии дней подряд)": "# IND.3.1.03\n\n**Name:** Стабильность слотов (серии дней подряд)\n**Name (EN):** Slot stability (consecutive days)\n**Type:** frequency\n**Format:** integer\n**Unit:** consecutive_days\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 3,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 4,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 5,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 6,\n    \"period_weeks\": 24\n  }\n}\n```\n",
        "04_Частота срывов": "# IND.3.1.04\n\n**Name:** Частота срывов\n**Name (EN):** Relapse frequency\n**Type:** frequency\n**Format:** string\n**Unit:** relapses/period\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"1 срыв в 2 недели\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"1 срыв в месяц\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Нет срывов\"\n  }\n}\n```\n",
        "05_Индекс инициативности (регулярность стратегирования)": "# IND.3.1.05\n\n**Name:** Индекс инициативности (регулярность стратегирования)\n**Name (EN):** Initiative index (strategy regularity)\n**Type:** frequency\n**Format:** float\n**Unit:** percent_weeks\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 0,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 0,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 80,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 95,\n    \"period_weeks\": 24\n  }\n}\n```\n"
      }
    },
    {
      "name": "3_derived/3_10_integral",
      "description": "",
      "indicators": {
        "01_Интегральный индекс агентности": "# IND.3.10.1\n\n**Name:** Интегральный индекс агентности\n**Name (EN):** Integral agency index\n**Type:** scale\n**Format:** float\n**Unit:** 0-100\n**Description:** Агрегированный показатель из групп 2.1-2.3\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: false\n"
      }
    },
    {
      "name": "3_derived/3_2_mastery",
      "description": "",
      "indicators": {
        "01_Интенсивность практики (степень мастерства по практикам)": "# IND.3.2.01\n\n**Name:** Интенсивность практики (степень мастерства по практикам)\n**Name (EN):** Practice intensity (mastery levels)\n**Type:** categorical\n**Format:** checklist\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Чек-листы: Объяснение 75%, Умение 50%\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Чек-листы: Умение 75%, Навык 50%\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Чек-листы: Навык 75%, Мастерство 50%\"\n  }\n}\n```\n",
        "02_Индекс рабочих продуктов (творческий конвейер)": "# IND.3.2.02\n\n**Name:** Индекс рабочих продуктов (творческий конвейер)\n**Name (EN):** Work products index (creative pipeline)\n**Type:** frequency\n**Format:** float\n**Unit:** drafts/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 0,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 1,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 1.5,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 2,\n    \"period_weeks\": 24\n  }\n}\n```\n",
        "03_Учтённое время (прохождение ритуала)": "# IND.3.2.03\n\n**Name:** Учтённое время (прохождение ритуала)\n**Name (EN):** Accounted time (ritual completion)\n**Type:** temporal\n**Format:** float\n**Unit:** hours/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 0,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 20,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 30,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 40,\n    \"period_weeks\": 24\n  }\n}\n```\n",
        "04_Развитие мировоззрения": "# IND.3.2.04\n\n**Name:** Развитие мировоззрения\n**Name (EN):** Worldview evolution\n**Type:** semantic\n**Format:** checklist\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": \"Понимаю зачем, чему, как и когда учиться\"\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Понимаю что такое мировоззрение и замечаю свои мемы\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Поменял как минимум один свой плохой мем\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Разобрался с большинством плохих мемов и помогаю другим\"\n  }\n}\n```\n",
        "05_Трансформация привычек": "# IND.3.2.05\n\n**Name:** Трансформация привычек\n**Name (EN):** Habit transformation\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": null\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Осознаю свои плохие привычки и начал работать\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Отказался или заменил плохую привычку на хорошую\"\n  }\n}\n```\n",
        "06_Развитие потенциала": "# IND.3.2.06\n\n**Name:** Развитие потенциала\n**Name (EN):** Potential growth\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": null\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Понимаю характеристику агента и потенциал\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Повысил потенциал хотя бы по одной характеристике\"\n  }\n}\n```\n",
        "07_Текущие негативные привычки": "# IND.3.2.07\n\n**Name:** Текущие негативные привычки\n**Name (EN):** Current negative habits\n**Type:** semantic\n**Format:** list[string]\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n"
      }
    },
    {
      "name": "3_derived/3_3_characteristics",
      "description": "",
      "indicators": {
        "01_Индекс рефлексии (частота заметок)": "# IND.3.3.01\n\n**Name:** Индекс рефлексии (частота заметок)\n**Name (EN):** Reflection index (notes frequency)\n**Type:** frequency\n**Format:** float\n**Unit:** notes/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": 0,\n    \"period_weeks\": 1\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": 0,\n    \"period_weeks\": 4\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 5,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 6,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 6.7,\n    \"period_weeks\": 24\n  }\n}\n```\n",
        "02_Характеристики окружения (контроль инфопотока)": "# IND.3.3.02\n\n**Name:** Характеристики окружения (контроль инфопотока)\n**Name (EN):** Environment characteristics (infostream control)\n**Type:** semantic\n**Format:** checklist\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": \"Начал чистить окружение (убрал лишние каналы)\"\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Взял под контроль внимание, осознанно меняю окружение\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Стал активным участником сообщества\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Активно занимается просвещением\"\n  }\n}\n```\n",
        "03_Поведенческие паттерны": "# IND.3.3.03\n\n**Name:** Поведенческие паттерны\n**Name (EN):** Behavior patterns\n**Type:** categorical\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Выявляет и старается обходить\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Снижает/перепрошивает\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Переписывает сознательно\"\n  }\n}\n```\n",
        "04_Текущие мемы (продуктивные и непродуктивные)": "# IND.3.3.04\n\n**Name:** Текущие мемы (продуктивные и непродуктивные)\n**Name (EN):** Current memes\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Замечает мемы у других\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Замечает свои непродуктивные мемы\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Осознанно меняет\"\n  }\n}\n```\n",
        "05_Калибр личности (системные уровни целей)": "# IND.3.3.05\n\n**Name:** Калибр личности (системные уровни целей)\n**Name (EN):** Personality caliber (systemic intent levels)\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": null\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": null\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Уровень команды и сообщества\"\n  }\n}\n```\n"
      }
    },
    {
      "name": "3_derived/3_4_qualification",
      "description": "",
      "indicators": {
        "01_Внутренняя ступень Ученика": "# IND.3.4.01\n\n**Name:** Внутренняя ступень Ученика\n**Name (EN):** Internal student stage\n**Type:** categorical\n**Format:** enum\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n\n## Enum Values\n```json\n[\n  \"STG.Student.Random\",\n  \"STG.Student.Practicing\",\n  \"STG.Student.Systematic\",\n  \"STG.Student.Disciplined\",\n  \"STG.Student.Proactive\"\n]\n```\n",
        "02_История смены ступеней": "# IND.3.4.02\n\n**Name:** История смены ступеней\n**Name (EN):** Stage change history\n**Type:** categorical\n**Format:** list[object]\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n",
        "03_Дата последнего присвоения": "# IND.3.4.03\n\n**Name:** Дата последнего присвоения\n**Name (EN):** Last assigned date\n**Type:** temporal\n**Format:** date\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n",
        "04_Критерии присвоения ступени": "# IND.3.4.04\n\n**Name:** Критерии присвоения ступени\n**Name (EN):** Qualification criteria snapshot\n**Type:** semantic\n**Format:** structured_text\n**Description:** Срез показателей на дату присвоения квалификации\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n"
      }
    },
    {
      "name": "3_derived/3_5_roles",
      "description": "",
      "indicators": {
        "01_Мастерство в целевых ролях": "# IND.3.5.01\n\n**Name:** Мастерство в целевых ролях\n**Name (EN):** Target role mastery\n**Type:** categorical\n**Format:** object\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: true\n\n## Schema\n```json\n{\n  \"role\": \"string\",\n  \"level\": \"enum[Знакомство,Объяснение,Умение,Навык,Мастерство]\"\n}\n```\n",
        "02_Прогресс по ролевым чек-листам": "# IND.3.5.02\n\n**Name:** Прогресс по ролевым чек-листам\n**Name (EN):** Role checklist progress\n**Type:** frequency\n**Format:** float\n**Unit:** percent\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n",
        "03_Применение ролей в проектах": "# IND.3.5.03\n\n**Name:** Применение ролей в проектах\n**Name (EN):** Role application in projects\n**Type:** frequency\n**Format:** integer\n**Unit:** projects\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n"
      }
    },
    {
      "name": "3_derived/3_6_resourcefulness",
      "description": "",
      "indicators": {
        "01_Индекс ресурсности (продуктивность состояния)": "# IND.3.6.01\n\n**Name:** Индекс ресурсности (продуктивность состояния)\n**Name (EN):** Resourcefulness index (state productivity)\n**Type:** scale\n**Format:** float\n**Unit:** 1-5\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 3,\n    \"period_weeks\": 8\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 3.7,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 4.3,\n    \"period_weeks\": 24\n  }\n}\n```\n",
        "02_Ритм работа–отдых (соблюдение ритма)": "# IND.3.6.02\n\n**Name:** Ритм работа–отдых (соблюдение ритма)\n**Name (EN):** Work-rest rhythm adherence\n**Type:** scale\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"3–4 дня в ритме/неделя\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"6–7 дней стабильно\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Автоматизированный ритм\"\n  }\n}\n```\n",
        "03_Устойчивость к сбоям (скорость восстановления)": "# IND.3.6.03\n\n**Name:** Устойчивость к сбоям (скорость восстановления)\n**Name (EN):** Fault tolerance (recovery speed)\n**Type:** temporal\n**Format:** integer\n**Unit:** days\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": 7\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 3\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 1\n  }\n}\n```\n",
        "04_Управление текущим состоянием": "# IND.3.6.04\n\n**Name:** Управление текущим состоянием\n**Name (EN):** Current state regulation\n**Type:** scale\n**Format:** float\n**Unit:** 1-5\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": null\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": 3,\n    \"period_weeks\": 12\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": 3.5,\n    \"period_weeks\": 24\n  }\n}\n```\n",
        "05_Частота методов восстановления": "# IND.3.6.05\n\n**Name:** Частота методов восстановления\n**Name (EN):** Recovery methods frequency\n**Type:** frequency\n**Format:** string\n**Unit:** times/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"1–2 метода в неделю\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Стабильные практики\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Саморегуляция в рутине\"\n  }\n}\n```\n",
        "06_Использованные методы поддержки": "# IND.3.6.06\n\n**Name:** Использованные методы поддержки\n**Name (EN):** Support methods used\n**Type:** frequency\n**Format:** string\n**Unit:** count/week\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"1–2 регулярных практики\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"3–5 встроенных в рутину\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Комплексная система поддержки\"\n  }\n}\n```\n",
        "07_Гибкость пересборки": "# IND.3.6.07\n\n**Name:** Гибкость пересборки\n**Name (EN):** Restructuring flexibility\n**Type:** semantic\n**Format:** string\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n\n## Thresholds\n```json\n{\n  \"STG.Student.Random\": {\n    \"value\": null\n  },\n  \"STG.Student.Practicing\": {\n    \"value\": null\n  },\n  \"STG.Student.Systematic\": {\n    \"value\": \"Переосмысливает раз в неделю\"\n  },\n  \"STG.Student.Disciplined\": {\n    \"value\": \"Быстро корректирует план\"\n  },\n  \"STG.Student.Proactive\": {\n    \"value\": \"Перестраивает маршрут мгновенно\"\n  }\n}\n```\n"
      }
    },
    {
      "name": "3_derived/3_7_community",
      "description": "",
      "indicators": {
        "02_Помощь другим участникам": "# IND.3.7.1\n\n**Name:** Помощь другим участникам\n**Name (EN):** Help to other members\n**Type:** frequency\n**Format:** integer\n**Unit:** helps/month\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n",
        "03_Публикации и вклад в контент": "# IND.3.7.2\n\n**Name:** Публикации и вклад в контент\n**Name (EN):** Publications and content contribution\n**Type:** frequency\n**Format:** integer\n**Unit:** posts/month\n\n## Flags\n- for_prompts: false\n- for_qualification: true\n- trainee_model: false\n"
      }
    },
    {
      "name": "3_derived/3_8_economics",
      "description": "",
      "indicators": {}
    },
    {
      "name": "3_derived/3_9_ai_usage",
      "description": "",
      "indicators": {
        "02_Качество взаимодействия с ИИ": "# IND.3.9.1\n\n**Name:** Качество взаимодействия с ИИ\n**Name (EN):** AI interaction quality\n**Type:** scale\n**Format:** float\n**Unit:** 1-5\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n",
        "03_Применение рекомендаций ИИ": "# IND.3.9.2\n\n**Name:** Применение рекомендаций ИИ\n**Name (EN):** AI recommendations adoption\n**Type:** frequency\n**Format:** float\n**Unit:** percent\n\n## Flags\n- for_prompts: false\n- for_qualification: false\n- trainee_model: false\n"
      }
    },
    {
      "name": "4_generated/4_1_recommendations",
      "description": "",
      "indicators": {}
    },
    {
      "name": "4_generated/4_2_comparisons",
      "description": "",
      "indicators": {}
    },
    {
      "name": "4_generated/4_3_forecasts",
      "description": "",
      "indicators": {
        "02_Готовность к следующей ступени": "# IND.4.3.1\n\n**Name:** Готовность к следующей ступени\n**Name (EN):** Readiness for next stage\n**Type:** scale\n**Format:** float\n**Unit:** percent\n**Description:** Процент выполнения критериев следующей ступени\n\n## Flags\n- for_prompts: true\n- for_qualification: true\n- trainee_model: false\n"
      }
    },
    {
      "name": "4_generated/4_4_reports",
      "description": "",
      "indicators": {
        "03_Профиль сильных сторон": "# IND.4.4.1\n\n**Name:** Профиль сильных сторон\n**Name (EN):** Strengths profile\n**Type:** semantic\n**Format:** list[string]\n**Description:** Области с наивысшими показателями\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: false\n",
        "04_Профиль зон развития": "# IND.4.4.2\n\n**Name:** Профиль зон развития\n**Name (EN):** Growth areas profile\n**Type:** semantic\n**Format:** list[string]\n**Description:** Области требующие внимания\n\n## Flags\n- for_prompts: true\n- for_qualification: false\n- trainee_model: false\n"
      }
    }
  ],
  "rootFiles": {
    "degrees": "# Degrees (Степени квалификации)\n\nVersion: 0.3\n\nСтепени квалификации МИМ (Мастерской инженеров-менеджеров)\n\n## Degrees List\n\n### DEG.Freshman\n- **Name:** Первокурсник\n- **Order:** 0\n- **Description:** Поступил на первый курс, но ещё не закончил его\n\n### DEG.Student\n- **Name:** Ученик\n- **Order:** 1\n- **Description:** Демонстрирует ежедневный слот саморазвития и инвестирует более 10 часов в неделю\n\n### DEG.Worker\n- **Name:** Работник\n- **Order:** 2\n- **Description:** Показывает рациональную работу в логике целей организации с фокусом на ключевых объектах предметной области\n\n### DEG.Strategist\n- **Name:** Стратег\n- **Order:** 3\n- **Description:** Проявляет выбор метода и предмета работ при неопределённости, применяя системное мышление\n\n### DEG.Specialist\n- **Name:** Специалист\n- **Order:** 4\n- **Description:** Демонстрирует понимание обобщённого инженерного процесса и разделения труда, освоение руководств инженерной серии\n\n### DEG.Practitioner\n- **Name:** Практик\n- **Order:** 5\n- **Description:** Показывает изменение собственной культуры работы и организацию до 10 человек\n\n### DEG.Master\n- **Name:** Мастер\n- **Order:** 6\n- **Description:** Инициирует и проводит проекты организационного развития в масштабе компании, добиваясь заметного изменения поведения сотрудников\n\n### DEG.Reformer\n- **Name:** Реформатор\n- **Order:** 7\n- **Description:** Масштабирует мастерство до изменения культуры работы за пределами одного предприятия — на отрасли и сообщества\n\n### DEG.PublicFigure\n- **Name:** Общественный деятель\n- **Order:** 8\n- **Description:** Вносит вклад цивилизационного масштаба, создавая системы мирового значения\n",
    "stages": "# Stages (Ступени)\n\nVersion: 0.3\n\nСтупени внутри Степени квалификации «Ученик» (DEG.Student)\n\n## Stages List\n\n### STG.Student.Random\n- **Name:** Случайный\n- **Duration:** undefined weeks\n- **Description:** Начальная ступень без устойчивого учебного ритма\n\n### STG.Student.Practicing\n- **Name:** Практикующий\n- **Duration:** undefined weeks\n- **Description:** Регулярная практика с минимальными требованиями\n\n### STG.Student.Systematic\n- **Name:** Систематический\n- **Duration:** undefined weeks\n- **Description:** Систематическое обучение с рефлексией\n\n### STG.Student.Disciplined\n- **Name:** Дисциплинированный\n- **Duration:** undefined weeks\n- **Description:** Высокая дисциплина и устойчивые привычки\n\n### STG.Student.Proactive\n- **Name:** Проактивный\n- **Duration:** undefined weeks\n- **Description:** Максимальная вовлечённость и проактивность\n"
  },
  "accessControl": {
    "1_declarative": {
      "user": "rw",
      "guide": "r",
      "system": "rw"
    },
    "2_collected": {
      "user": "r",
      "guide": "r",
      "system": "w"
    },
    "3_derived": {
      "user": "r",
      "guide": "r",
      "system": "w"
    },
    "4_generated": {
      "user": "r",
      "guide": "rg",
      "system": "g"
    }
  }
};

// Helper to get category by name (1_declarative, 2_collected, etc.)
export function getCategory(name) {
  return METAMODEL.categories.find(c => c.name === name);
}

// Helper to get group by full path (e.g., "1_declarative/1_2_goals")
export function getGroup(fullPath) {
  return METAMODEL.groups.find(g => g.name === fullPath);
}

// Helper to get indicator content
export function getIndicator(groupPath, indicatorName) {
  const group = getGroup(groupPath);
  if (!group) return null;
  return group.indicators[indicatorName] || null;
}

// Helper to list all categories
export function listCategories() {
  return METAMODEL.categories.map(c => ({
    name: c.name,
    subgroupCount: c.subgroups.length,
    indicatorCount: c.subgroups.reduce((sum, s) => sum + Object.keys(s.indicators).length, 0)
  }));
}

// Helper to check write access
export function canWrite(path, role = 'user') {
  const category = path.split('/')[0];
  const access = METAMODEL.accessControl[category];
  if (!access) return false;
  const perm = access[role] || '';
  return perm.includes('w');
}

// Helper to check if path is generated (IND.4.*)
export function isGenerated(path) {
  return path.startsWith('4_generated');
}
