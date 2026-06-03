#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourcePage = JSON.parse(
  fs.readFileSync(path.join(root, 'templates/satin-alim-talebi-olustur-source-page.json'), 'utf8')
);
const html = fs.readFileSync(
  path.join(root, 'templates/satin-alim-talebi-olustur-rt-body.html'),
  'utf8'
);

const page = { ...sourcePage };
delete page._id;
delete page.children;

const content = {
  content: [
    {
      type: 'render-template',
      isContainer: false,
      isTextEditor: true,
      content: html.trim(),
      properties: [
        {
          key: 'display-name',
          header: 'Display name',
          type: 'input-text-property',
          value: 'Satın Alım Talebi — Render Template',
        },
      ],
    },
  ],
  styles: '',
};

fs.writeFileSync(
  path.join(root, 'templates/satin-alim-talebi-olustur-rt-page.json'),
  JSON.stringify(page, null, 2)
);
fs.writeFileSync(
  path.join(root, 'templates/satin-alim-talebi-olustur-rt-content.json'),
  JSON.stringify(content, null, 2)
);
console.log('Wrote satin-alim-talebi-olustur-rt-*.json');
