#!/usr/bin/env node
/**
 * data/component-catalog.json → docs/COMPONENTS_REFERENCE.md
 */
const fs = require('fs');
const path = require('path');
const { catalogToMarkdown, getRawCatalog } = require('../src/componentCatalog');

const outPath = path.join(__dirname, '../docs/COMPONENTS_REFERENCE.md');
const raw = getRawCatalog();

let md = `# Haustro Component Referansı

> Otomatik üretim: \`node scripts/generate-component-docs.js\`  
> Kaynak: \`data/component-catalog.json\` (v${raw.version})

Bu dosyayı AI araçlarına \`@docs/COMPONENTS_REFERENCE.md\` ile verebilirsiniz.

${catalogToMarkdown(raw)}

## Tüm component'ler (detay)

`;

for (const c of raw.components) {
  md += `### \`${c.type}\` — ${c.label}\n\n`;
  md += `**Kategori:** ${c.category} · **Özet:** ${c.summary}\n\n`;
  if (c.whenToUse) md += `**Ne zaman:** ${c.whenToUse}\n\n`;
  if (c.properties?.length) {
    md += '| Property | Zorunlu | Açıklama |\n|---|---|---|\n';
    for (const p of c.properties) {
      md += `| \`${p.key}\` | ${p.required === true ? 'evet' : p.required || '—'} | ${p.description || ''} |\n`;
    }
    md += '\n';
  }
  if (c.docs?.length) {
    md += '**Notlar:**\n';
    for (const d of c.docs) md += `- ${d}\n`;
    md += '\n';
  }
  if (c.example) {
    md += '**Örnek:**\n\n```json\n' + JSON.stringify(c.example, null, 2) + '\n```\n\n';
  }
}

fs.writeFileSync(outPath, md);
console.log('Wrote', outPath);
