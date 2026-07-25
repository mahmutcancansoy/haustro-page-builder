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
const SOURCE_CREATE_PAGE_ID = '69b0a5025170eb01db5cbf62';

const PAGE_CONFIG = {
  pageId: '',
  layoutName: 'Transfer Taleplerim Layout',
  title: 'Transfer Taleplerim',
  url: 'transfer-taleplerim',
  templateName: 'transfer-taleplerim',
  parentId: TRANSFER_CATEGORY_ID,
  sourcePageId: SOURCE_ACTIVE_PAGE_ID,
  sourceCreatePageId: SOURCE_CREATE_PAGE_ID,
  heroSub: 'Oluşturduğunuz transfer taleplerinin güncel durumu.',
  listSub:
    'Kendi oluşturduğunuz aktif, tamamlanan ve reddedilen transferleri görüntüleyin.',
  emptyMessage: 'Henüz oluşturduğunuz bir transfer talebi bulunamadı.',
  chipLabel: 'talebim',
  chipFallback: 'Transfer taleplerim',
  tableFilters: `{
  "$and": [
    { "delete": { "$ne": 1 } },
    { ":users:Creator": "{{info._id}}" }
  ],
  "sort": { "_id": -1 }
}`,
  statusDefs: [
    {
      name: 'status == 0',
      condition: '"{{input.status}}" == "0"',
      text: 'Onay bekliyor',
      className: 'atr-status atr-status--pending',
    },
    {
      name: 'kargo status == 2',
      condition:
        '"{{input.transferMethods}}" == "kargo" && "{{input.status}}" == "2"',
      text: 'Çıkış bekleniyor',
      className: 'atr-status atr-status--waiting',
    },
    {
      name: 'kargo status == 3',
      condition:
        '"{{input.transferMethods}}" == "kargo" && "{{input.status}}" == "3"',
      text: 'Varışta bekliyor',
      className: 'atr-status atr-status--cargo',
    },
    {
      name: 'sofor status == 2',
      condition:
        '"{{input.transferMethods}}" != "kargo" && "{{input.status}}" == "2"',
      text: 'Şoför bekleniyor',
      className: 'atr-status atr-status--waiting',
    },
    {
      name: 'sofor status == 3',
      condition:
        '"{{input.transferMethods}}" != "kargo" && "{{input.status}}" == "3"',
      text: 'Yolda',
      className: 'atr-status atr-status--transit',
    },
    {
      name: 'sofor status == 4',
      condition:
        '"{{input.transferMethods}}" != "kargo" && "{{input.status}}" == "4"',
      text: 'Şube onayı bekliyor',
      className: 'atr-status atr-status--arrive',
    },
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

function applyPersonalLayout(content) {
  return applyLayout(content, PAGE_CONFIG);
}

function makePageMetaFromSibling(siblingPageMeta) {
  const meta = deepClone(siblingPageMeta);
  delete meta._id;
  delete meta.createdAt;
  meta.isExpanded = false;
  meta.type = 'sub';
  meta.parent = PAGE_CONFIG.parentId;
  meta.children = [];

  const props = meta.properties || [];
  const set = (key, value) => {
    const p = props.find((x) => x.key === key);
    if (p) p.value = value;
  };
  set('display-name', PAGE_CONFIG.title);
  set('label', PAGE_CONFIG.title);
  set('url', PAGE_CONFIG.url);
  set('icon', '');

  const settings = props.find((p) => p.key === 'settings');
  if (settings?.value && typeof settings.value === 'object') {
    settings.value.hidden = false;
    settings.value.leaveAlert = false;
  }

  return meta;
}

function makePageMeta() {
  const templatePath = path.join(
    __dirname,
    '../../templates/transfer-taleplerim-page.json'
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

  // Fallback — healthy sub schema (Geçmiş Transferler ile aynı yapı)
  const healthyPath = path.join(
    __dirname,
    '../../templates/gecmis-transferler-page.json'
  );
  if (fs.existsSync(healthyPath)) {
    return makePageMetaFromSibling(
      JSON.parse(fs.readFileSync(healthyPath, 'utf8'))
    );
  }

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
  applyPersonalLayout,
  loadStyles,
  deepClone,
  writeTemplateFiles,
  makePageMeta,
  makePageMetaFromSibling,
};
