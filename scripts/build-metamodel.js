#!/usr/bin/env node
/**
 * Build metamodel data from MD files for Cloudflare Workers
 * Generates src/metamodel-data.js with embedded MD content
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const METAMODEL_PATH = path.join(ROOT, 'metamodel');
const OUTPUT_PATH = path.join(ROOT, 'src', 'metamodel-data.js');

async function main() {
  console.log('Building metamodel data from MD files...');

  const metamodel = {
    groups: [],
    rootFiles: {}
  };

  // Read root MD files (stages.md, degrees.md)
  const entries = await fs.readdir(METAMODEL_PATH, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const content = await fs.readFile(path.join(METAMODEL_PATH, entry.name), 'utf-8');
      metamodel.rootFiles[entry.name.replace('.md', '')] = content;
      console.log(`  Read: ${entry.name}`);
    }
  }

  // Read group folders
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const groupPath = path.join(METAMODEL_PATH, entry.name);
      const group = {
        name: entry.name,
        description: '',
        indicators: {}
      };

      const groupEntries = await fs.readdir(groupPath, { withFileTypes: true });

      for (const file of groupEntries) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const content = await fs.readFile(path.join(groupPath, file.name), 'utf-8');
          const key = file.name.replace('.md', '');

          if (key === '_group') {
            group.description = content;
          } else {
            group.indicators[key] = content;
          }
        }
      }

      metamodel.groups.push(group);
      console.log(`  Read group: ${entry.name}/ (${Object.keys(group.indicators).length} indicators)`);
    }
  }

  // Sort groups by name
  metamodel.groups.sort((a, b) => a.name.localeCompare(b.name));

  // Generate JavaScript module
  const output = `// Auto-generated from MD files - do not edit manually
// Generated at: ${new Date().toISOString()}

export const METAMODEL = ${JSON.stringify(metamodel, null, 2)};

// Helper to get group by name
export function getGroup(name) {
  return METAMODEL.groups.find(g => g.name === name);
}

// Helper to get indicator content
export function getIndicator(groupName, indicatorName) {
  const group = getGroup(groupName);
  if (!group) return null;
  return group.indicators[indicatorName] || null;
}

// Helper to list all groups
export function listGroups() {
  return METAMODEL.groups.map(g => ({
    name: g.name,
    indicatorCount: Object.keys(g.indicators).length
  }));
}
`;

  await fs.writeFile(OUTPUT_PATH, output);
  console.log(`\nGenerated: ${OUTPUT_PATH}`);
  console.log(`  Groups: ${metamodel.groups.length}`);
  console.log(`  Root files: ${Object.keys(metamodel.rootFiles).length}`);
}

main().catch(console.error);
