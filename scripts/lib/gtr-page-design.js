const fs = require('fs');
const path = require('path');
const {
  PAGE_CONFIG: ATR_CONFIG,
  applyLayout,
  loadStyles,
  deepClone,
} = require('./atr-page-design');

const TRANSFER_CATEGORY_ID = '6a3145913941e762df5f9a60';
const SOURCE_ACTIVE_PAGE_ID = ATR_CONFIG.pageId;

const PAGE_CONFIG = {
  pageId: '',
  layoutName: 'Geçmiş Transferler Layout',
  title: 'Geçmiş Transferler',
  url: 'gecmis-transferler',
  templateName: 'gecmis-transferler',
  parentId: TRANSFER_CATEGORY_ID,
  sourcePageId: SOURCE_ACTIVE_PAGE_ID,
  heroSub: 'Tamamlanan ve reddedilen transferlerin geçmiş listesi.',
  listSub: 'Tamamlanan / reddedilen transferleri envanter, şube ve durum bilgileriyle görüntüleyin.',
  emptyMessage: 'Geçmiş transfer kaydı bulunamadı.',
  chipLabel: 'geçmiş kayıt',
  chipFallback: 'Geçmiş transferler',
  tableFilters: `{
  "$and": [
    { "delete": { "$ne": 1 } },
    {
      "$or": [
        { "status": { "$in": [1, 5] } },
        { "status": { "$in": ["1", "5"] } }
      ]
    }
  ],
  "sort": { "_id": -1 }
}`,
  statusDefs: [
    {
      name: 'status == 1',
      condition: '"{{input.status}}" == "1"',
      text: 'Tamamlandı',
      className: 'atr-status atr-status--done',
    },
    {
      name: 'status == 5',
      condition: '"{{input.status}}" == "5"',
      text: 'Reddedildi',
      className: 'atr-status atr-status--danger',
    },
  ],
};

// Geçmiş listesi de aynı rozet CSS kurallarını kullanır.

function applyHistoryLayout(content) {
  return applyLayout(content, PAGE_CONFIG);
}

function makePageMeta() {
  const templatePath = path.join(
    __dirname,
    '../../templates/gecmis-transferler-page.json'
  );
  if (fs.existsSync(templatePath)) {
    const meta = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    meta.parent = PAGE_CONFIG.parentId;
    meta.type = 'sub';
    meta.isExpanded = false;
    meta.children = [];
    const props = meta.properties || [];
    const set = (key, value) => {
      const p = props.find((x) => x.key === key);
      if (p) p.value = value;
    };
    set('display-name', PAGE_CONFIG.title);
    set('label', PAGE_CONFIG.title);
    set('url', PAGE_CONFIG.url);
    return meta;
  }

  // Fallback — aktif transfer kardeş şemasıyla uyumlu minimal meta
  return {
    isExpanded: false,
    type: 'sub',
    properties: [
      {
        key: 'display-name',
        type: 'input-text-property',
        header: 'Display Name',
        value: PAGE_CONFIG.title,
      },
      {
        key: 'label',
        type: 'input-text-property',
        header: 'Label',
        value: PAGE_CONFIG.title,
      },
      {
        key: 'icon',
        type: 'input-text-property',
        header: 'Icon',
        value: '',
      },
      {
        key: 'route-type',
        type: 'select-property',
        options: [
          { label: 'Dynamic', value: 'dynamic' },
          { label: 'Static', value: 'static' },
          { label: 'External', value: 'external' },
        ],
        header: 'Route Type',
        value: 'dynamic',
      },
      {
        key: 'url-targer',
        type: 'select-property',
        options: [
          { label: '_self', value: '_self' },
          { label: '_blank', value: '_blank' },
        ],
        header: 'Target',
        value: '_self',
        conditions: [{ key: 'route-type', rule: "value == 'external'" }],
      },
      {
        key: 'url',
        type: 'input-text-property',
        header: 'Url',
        value: PAGE_CONFIG.url,
        conditions: [{ key: 'route-type', rule: "value != 'category'" }],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Hidden', name: 'hidden' },
          { label: 'Alert When Leave', name: 'leaveAlert' },
        ],
        value: { hidden: false, leaveAlert: false },
      },
    ],
    parent: PAGE_CONFIG.parentId,
    children: [],
  };
}

function writeTemplateFiles(content, styles) {
  const root = path.join(__dirname, '../../templates');
  fs.writeFileSync(
    path.join(root, `${PAGE_CONFIG.templateName}-page.json`),
    JSON.stringify(makePageMeta(), null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(root, `${PAGE_CONFIG.templateName}-content.json`),
    JSON.stringify(
      {
        pageId: PAGE_CONFIG.pageId || PAGE_CONFIG.url,
        content,
        styles,
      },
      null,
      2
    ) + '\n'
  );
}

module.exports = {
  PAGE_CONFIG,
  applyHistoryLayout,
  loadStyles,
  deepClone,
  writeTemplateFiles,
  makePageMeta,
};
