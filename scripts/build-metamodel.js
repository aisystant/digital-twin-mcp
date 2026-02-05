#!/usr/bin/env node
/**
 * Build metamodel data from MD files for Cloudflare Workers
 * Generates src/metamodel-data.js with embedded MD content
 *
 * Supports 4-type classification structure:
 * 1_declarative/1_1_profile/...
 * 2_collected/2_1_account/...
 * 3_derived/3_1_agency/...
 * 4_generated/4_1_recommendations/...
 * _shared/stages.md, degrees.md
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const METAMODEL_PATH = path.join(ROOT, 'metamodel');
const OUTPUT_PATH = path.join(ROOT, 'src', 'metamodel-data.js');

async function readIndicatorsFromDir(dirPath) {
  const indicators = {};
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_group.md') {
        const content = await fs.readFile(path.join(dirPath, entry.name), 'utf-8');
        indicators[entry.name.replace('.md', '')] = content;
      }
    }
  } catch (err) {
    // Directory may be empty or not exist
  }
  return indicators;
}

async function readGroupDescription(dirPath) {
  try {
    return await fs.readFile(path.join(dirPath, '_group.md'), 'utf-8');
  } catch {
    return '';
  }
}

async function main() {
  console.log('Building metamodel data from MD files (4-type structure)...\n');

  const metamodel = {
    categories: [],  // Top-level: 1_declarative, 2_collected, 3_derived, 4_generated
    groups: [],      // All groups flattened for backward compatibility
    rootFiles: {},   // _shared files
    accessControl: {
      '1_declarative': { user: 'rw', guide: 'r', system: 'rw' },
      '2_collected': { user: 'r', guide: 'r', system: 'w' },
      '3_derived': { user: 'r', guide: 'r', system: 'w' },
      '4_generated': { user: 'r', guide: 'rg', system: 'g' },
    }
  };

  const entries = await fs.readdir(METAMODEL_PATH, { withFileTypes: true });

  // Read _shared folder (stages.md, degrees.md)
  const sharedPath = path.join(METAMODEL_PATH, '_shared');
  try {
    const sharedEntries = await fs.readdir(sharedPath, { withFileTypes: true });
    for (const entry of sharedEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await fs.readFile(path.join(sharedPath, entry.name), 'utf-8');
        metamodel.rootFiles[entry.name.replace('.md', '')] = content;
        console.log(`  Shared: ${entry.name}`);
      }
    }
  } catch (err) {
    console.log('  No _shared folder found');
  }

  // Read category folders (1_declarative, 2_collected, 3_derived, 4_generated)
  for (const categoryEntry of entries) {
    if (!categoryEntry.isDirectory() || categoryEntry.name.startsWith('_')) {
      continue;
    }

    const categoryPath = path.join(METAMODEL_PATH, categoryEntry.name);
    const category = {
      name: categoryEntry.name,
      description: await readGroupDescription(categoryPath),
      subgroups: []
    };

    const subEntries = await fs.readdir(categoryPath, { withFileTypes: true });

    for (const subEntry of subEntries) {
      if (!subEntry.isDirectory()) continue;

      const subgroupPath = path.join(categoryPath, subEntry.name);
      const indicators = await readIndicatorsFromDir(subgroupPath);
      const indicatorCount = Object.keys(indicators).length;

      if (indicatorCount > 0 || true) { // Include empty groups for structure
        const subgroup = {
          name: subEntry.name,
          fullPath: `${categoryEntry.name}/${subEntry.name}`,
          description: await readGroupDescription(subgroupPath),
          indicators
        };

        category.subgroups.push(subgroup);

        // Also add to flat groups list for backward compatibility
        metamodel.groups.push({
          name: subgroup.fullPath,
          description: subgroup.description,
          indicators
        });

        if (indicatorCount > 0) {
          console.log(`  ${categoryEntry.name}/${subEntry.name}: ${indicatorCount} indicators`);
        }
      }
    }

    metamodel.categories.push(category);
  }

  // Sort
  metamodel.categories.sort((a, b) => a.name.localeCompare(b.name));
  metamodel.groups.sort((a, b) => a.name.localeCompare(b.name));

  // Count totals
  let totalIndicators = 0;
  for (const cat of metamodel.categories) {
    for (const sub of cat.subgroups) {
      totalIndicators += Object.keys(sub.indicators).length;
    }
  }

  // Generate JavaScript module
  const output = `// Auto-generated from MD files - do not edit manually
// Generated at: ${new Date().toISOString()}
// Structure: 4-type classification (IND.1-4)

export const METAMODEL = ${JSON.stringify(metamodel, null, 2)};

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
`;

  await fs.writeFile(OUTPUT_PATH, output);
  console.log(`\n✅ Generated: ${OUTPUT_PATH}`);
  console.log(`   Categories: ${metamodel.categories.length}`);
  console.log(`   Groups: ${metamodel.groups.length}`);
  console.log(`   Indicators: ${totalIndicators}`);
  console.log(`   Shared files: ${Object.keys(metamodel.rootFiles).length}`);
}

main().catch(console.error);
