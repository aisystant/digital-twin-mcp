/**
 * Migration script: restructure metamodel to 4-type classification
 * IND.1.* Declarative, IND.2.* Collected, IND.3.* Derived, IND.4.* Generated
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METAMODEL = path.join(__dirname, '..', 'metamodel');

// Mapping: old folder -> new folder + new code prefix
const migrations = [
  // 01_preferences -> 1_declarative (split by type)
  {
    from: '01_preferences',
    indicators: {
      // 1_1_profile - базовый профиль
      '01_Текущие проблемы': { to: '1_declarative/1_4_context', code: 'IND.1.4.1' },
      '04_Мои неудовлетворенности': { to: '1_declarative/1_4_context', code: 'IND.1.4.2' },
      '05_Интересующие области': { to: '1_declarative/1_2_goals', code: 'IND.1.2.1' },
      '06_Мои эмоции и чувства': { to: '1_declarative/1_4_context', code: 'IND.1.4.3' },

      // 1_2_goals - цели и намерения
      '09_Цели обучения': { to: '1_declarative/1_2_goals', code: 'IND.1.2.2' },
      '11_Мои приоритетные проекты': { to: '1_declarative/1_2_goals', code: 'IND.1.2.3' },
      '14_Планируемый результат ближайшего этапа': { to: '1_declarative/1_2_goals', code: 'IND.1.2.4' },
      '20_Рабочие продукты на неделю': { to: '1_declarative/1_2_goals', code: 'IND.1.2.5' },

      // 1_3_selfeval - самооценка и предпочтения
      '07_Выбранные руководства': { to: '1_declarative/1_3_selfeval', code: 'IND.1.3.1' },
      '08_Фокусные методы': { to: '1_declarative/1_3_selfeval', code: 'IND.1.3.2' },
      '12_Текущие роли': { to: '1_declarative/1_3_selfeval', code: 'IND.1.3.3' },
      '16_Целевые показатели состояния': { to: '1_declarative/1_3_selfeval', code: 'IND.1.3.4' },
      '18_Раздел руководства к изучению': { to: '1_declarative/1_3_selfeval', code: 'IND.1.3.5' },
      '19_Недельный бюджет времени': { to: '1_declarative/1_3_selfeval', code: 'IND.1.3.6' },

      // 1_4_context - контекст и расписание
      '02_Время отчёта за день': { to: '1_declarative/1_4_context', code: 'IND.1.4.4' },
      '03_Время получения задания': { to: '1_declarative/1_4_context', code: 'IND.1.4.5' },
      '10_Планируемое время на завтра': { to: '1_declarative/1_4_context', code: 'IND.1.4.6' },
      '13_Дата окончания ближайшего этапа': { to: '1_declarative/1_4_context', code: 'IND.1.4.7' },
      '15_Время запроса стратегирования': { to: '1_declarative/1_4_context', code: 'IND.1.4.8' },
      '17_Время получения аналитики': { to: '1_declarative/1_4_context', code: 'IND.1.4.9' },
    }
  },

  // 02_agency -> 3_derived/3_1_agency (расчётные метрики агентности)
  {
    from: '02_agency',
    to: '3_derived/3_1_agency',
    codePrefix: 'IND.3.1'
  },

  // 03_mastery -> 3_derived/3_2_mastery
  {
    from: '03_mastery',
    to: '3_derived/3_2_mastery',
    codePrefix: 'IND.3.2'
  },

  // 04_characteristics -> 3_derived/3_3_characteristics
  {
    from: '04_characteristics',
    to: '3_derived/3_3_characteristics',
    codePrefix: 'IND.3.3'
  },

  // 05_qualification -> 3_derived/3_4_qualification (расчётная ступень)
  {
    from: '05_qualification',
    to: '3_derived/3_4_qualification',
    codePrefix: 'IND.3.4'
  },

  // 06_roles -> 3_derived/3_5_roles
  {
    from: '06_roles',
    to: '3_derived/3_5_roles',
    codePrefix: 'IND.3.5'
  },

  // 07_resourcefulness -> 3_derived/3_6_resourcefulness
  {
    from: '07_resourcefulness',
    to: '3_derived/3_6_resourcefulness',
    codePrefix: 'IND.3.6'
  },

  // 08_community -> split (activity -> 2_collected, metrics -> 3_derived)
  {
    from: '08_community',
    indicators: {
      '01_Активность в сообществе': { to: '2_collected/2_9_community', code: 'IND.2.9.1' },
      '02_Помощь другим участникам': { to: '3_derived/3_7_community', code: 'IND.3.7.1' },
      '03_Публикации и вклад в контент': { to: '3_derived/3_7_community', code: 'IND.3.7.2' },
    }
  },

  // 09_economics -> 2_collected/2_5_finance (собираемые данные о платежах)
  {
    from: '09_economics',
    to: '2_collected/2_5_finance',
    codePrefix: 'IND.2.5'
  },

  // 10_ai_usage -> split
  {
    from: '10_ai_usage',
    indicators: {
      '01_Использование AI Guide': { to: '2_collected/2_8_ai_logs', code: 'IND.2.8.1' },
      '02_Качество взаимодействия с ИИ': { to: '3_derived/3_9_ai_usage', code: 'IND.3.9.1' },
      '03_Применение рекомендаций ИИ': { to: '3_derived/3_9_ai_usage', code: 'IND.3.9.2' },
    }
  },

  // 11_integral -> 3_derived/3_10_integral (some may become 4_generated)
  {
    from: '11_integral',
    indicators: {
      '01_Интегральный индекс агентности': { to: '3_derived/3_10_integral', code: 'IND.3.10.1' },
      '02_Готовность к следующей ступени': { to: '4_generated/4_3_forecasts', code: 'IND.4.3.1' },
      '03_Профиль сильных сторон': { to: '4_generated/4_4_reports', code: 'IND.4.4.1' },
      '04_Профиль зон развития': { to: '4_generated/4_4_reports', code: 'IND.4.4.2' },
    }
  },
];

async function migrateIndicator(fromPath, toPath, newCode) {
  try {
    let content = await fs.readFile(fromPath, 'utf-8');

    // Update the code in the first line (# IND.X.X.X)
    content = content.replace(/^# IND\.[^\n]+/, `# ${newCode}`);

    await fs.writeFile(toPath, content);
    console.log(`  ✓ ${path.basename(fromPath)} -> ${toPath}`);
    return true;
  } catch (err) {
    console.error(`  ✗ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('Migrating metamodel to 4-type classification...\n');

  let migrated = 0;
  let errors = 0;

  for (const migration of migrations) {
    const fromDir = path.join(METAMODEL, migration.from);
    console.log(`\nProcessing ${migration.from}:`);

    try {
      const files = await fs.readdir(fromDir);
      const mdFiles = files.filter(f => f.endsWith('.md') && f !== '_group.md');

      for (const file of mdFiles) {
        const baseName = file.replace('.md', '');
        const fromPath = path.join(fromDir, file);

        let toDir, newCode;

        if (migration.indicators && migration.indicators[baseName]) {
          // Specific mapping for this indicator
          const spec = migration.indicators[baseName];
          toDir = path.join(METAMODEL, spec.to);
          newCode = spec.code;
        } else if (migration.to) {
          // Default mapping for the whole folder
          toDir = path.join(METAMODEL, migration.to);
          const num = baseName.split('_')[0];
          newCode = `${migration.codePrefix}.${num}`;
        } else {
          console.log(`  ? Skipping ${file} (no mapping defined)`);
          continue;
        }

        const toPath = path.join(toDir, file);

        if (await migrateIndicator(fromPath, toPath, newCode)) {
          migrated++;
        } else {
          errors++;
        }
      }
    } catch (err) {
      console.error(`  Error reading ${migration.from}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Migration complete: ${migrated} indicators migrated, ${errors} errors`);

  // Move shared files
  console.log('\nMoving shared files...');
  try {
    await fs.copyFile(
      path.join(METAMODEL, 'stages.md'),
      path.join(METAMODEL, '_shared', 'stages.md')
    );
    await fs.copyFile(
      path.join(METAMODEL, 'degrees.md'),
      path.join(METAMODEL, '_shared', 'degrees.md')
    );
    console.log('  ✓ stages.md and degrees.md moved to _shared/');
  } catch (err) {
    console.error(`  Error moving shared files: ${err.message}`);
  }
}

main().catch(console.error);
