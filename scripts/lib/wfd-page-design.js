const fs = require('fs');
const path = require('path');
const { WORKFLOW_DOCS } = require('./workflow-docs-data');

const STYLES_FILE = path.join(__dirname, '../../templates/wfd-page-styles.css');

const SABIT_VERILER_ID = '5fef75324fe5a5001340f982';

const INDEX_PAGE = {
  templateName: 'is-akislari',
  title: 'İş Akışları',
  url: 'is-akislari',
  pageId: '6a4d9881ad3c98e623eadfc5',
};

const IS_AKISLARI_CATEGORY = {
  id: '6a4d9881ad3c98e623eadfc2',
  title: 'İş Akışları',
  parentId: SABIT_VERILER_ID,
};

const CATEGORY = {
  title: 'İş Akışları',
  icon: 'pi pi-sitemap',
  defaultUrl: INDEX_PAGE.url,
};

/** PrimeIcons sınıfı — panelde eski sürümle uyumlu ikonlar */
function iconClass(name) {
  const base = String(name).replace(/^pi[\s-]*/, '');
  return `pi pi-${base}`;
}

function menuIcon(name) {
  return iconClass(name);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadStyles() {
  return fs.readFileSync(STYLES_FILE, 'utf8');
}

function makeHeaderHiddenCondition() {
  return {
    type: 'condition',
    isContainer: true,
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Header hidden' },
      {
        key: 'condition',
        header: 'Condition',
        type: 'textarea-property',
        value: 'false',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'oneTimeCheck',
        header: 'One Time Check',
        type: 'checkbox-property',
        options: [{ label: 'Check on Create Only', name: 'once' }],
        value: { once: false },
      },
    ],
    children: [],
  };
}

function makeCondition(displayName, condition, children) {
  return {
    type: 'condition',
    isContainer: true,
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: displayName },
      {
        key: 'condition',
        header: 'Condition',
        type: 'textarea-property',
        value: condition,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'oneTimeCheck',
        header: 'One Time Check',
        type: 'checkbox-property',
        options: [{ label: 'Check on Create Only', name: 'once' }],
        value: { once: false },
      },
    ],
    children,
  };
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: content.trim(),
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: displayName },
    ],
  };
}

function buildIndexHtml() {
  const cards = WORKFLOW_DOCS.map((wf) => {
    const stepCount = wf.steps.length;
    return `<a href="/d/${esc(wf.url)}" router-link="/d/${esc(wf.url)}" class="wfd-card">
      <div class="wfd-card__head">
        <span class="wfd-card__icon"><i class="${iconClass(wf.icon)}"></i></span>
        <h3 class="wfd-card__title">${esc(wf.title)}</h3>
      </div>
      <p class="wfd-card__meta">Koleksiyon: <code>${esc(wf.collection)}</code></p>
      <p class="wfd-card__desc">${esc(wf.summary)}</p>
      <span class="wfd-card__steps">${stepCount} adım → detay</span>
    </a>`;
  }).join('\n');

  return `<div class="wfd-page">
  <div class="wfd__hero">
    <div class="wfd__hero-main">
      <span class="wfd__eyebrow">Sabit veriler · Admin</span>
      <h1>İş Akışları</h1>
      <p>Satın alma, transfer, teknik talep, izin ve envanter süreçlerinin adım adım dokümantasyonu. Her akışın kuralları ve mail tetikleyicileri aşağıdaki kartlardan erişilebilir.</p>
    </div>
    <span class="wfd__hero-icon"><i class="pi pi-sitemap"></i></span>
  </div>
  <div class="wfd-grid">
    ${cards}
  </div>
</div>`;
}

function buildDetailHtml(wf) {
  const overviewNodes = wf.steps
    .map(
      (step, i) => `<span class="wfd-flow-node"><span class="wfd-flow-node__num">${i + 1}</span>${esc(step.title)}</span>${i < wf.steps.length - 1 ? '<span class="wfd-flow-arrow"><i class="pi pi-arrow-right"></i></span>' : ''}`
    )
    .join('');

  const stepBlocks = wf.steps
    .map((step, i) => {
      const rules = (step.rules || [])
        .map((r) => `<li>${esc(r)}</li>`)
        .join('');
      const mail =
        step.mail && step.mail.length
          ? `<div class="wfd-step__mail">
          <p class="wfd-step__mail-title"><i class="pi pi-envelope"></i> Mail tetikleyicileri</p>
          <ul>${step.mail.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
        </div>`
          : '';

      return `<div class="wfd-step">
      <div class="wfd-step__line"><span class="wfd-step__circle">${i + 1}</span></div>
      <div class="wfd-step__body">
        <div class="wfd-step__head">
          <h3 class="wfd-step__title">${esc(step.title)}</h3>
          <span class="wfd-step__code">status: ${esc(step.code)}</span>
        </div>
        <p class="wfd-step__desc">${esc(step.description)}</p>
        <div class="wfd-step__actor"><i class="pi pi-user"></i><span><strong>Yetkili:</strong> ${esc(step.actor)}</span></div>
        <p class="wfd-step__rules-title">Kurallar</p>
        <ul class="wfd-step__rules">${rules || '<li>—</li>'}</ul>
        ${mail}
      </div>
    </div>`;
    })
    .join('\n');

  return `<div class="wfd-page">
  <a href="/d/is-akislari" router-link="/d/is-akislari" class="wfd__back"><i class="pi pi-arrow-left"></i> Tüm akışlar</a>
  <div class="wfd__hero">
    <div class="wfd__hero-main">
      <span class="wfd__eyebrow">İş akışı dokümantasyonu</span>
      <h1>${esc(wf.title)}</h1>
      <p>${esc(wf.summary)}</p>
    </div>
    <span class="wfd__hero-icon"><i class="${iconClass(wf.icon)}"></i></span>
  </div>
  <div class="wfd-meta-bar">
    <span>Koleksiyon: <strong>${esc(wf.collection)}</strong></span>
    <span>Canlı sayfa: <a href="${esc(wf.detailUrl)}" router-link="${esc(wf.detailUrl)}">${esc(wf.detailUrl)}</a></span>
    <span>Adım sayısı: <strong>${wf.steps.length}</strong></span>
  </div>
  <div class="wfd-flow-overview">${overviewNodes}</div>
  <div class="wfd-steps">${stepBlocks}</div>
</div>`;
}

function buildIndexContent() {
  return [
    makeHeaderHiddenCondition(),
    makeCondition('Ana içerik', 'true', [makeRenderTemplate(buildIndexHtml(), 'İş akışları grid')]),
  ];
}

function buildDetailContent(wf) {
  return [
    makeHeaderHiddenCondition(),
    makeCondition('Ana içerik', 'true', [
      makeRenderTemplate(buildDetailHtml(wf), `${wf.title} flowchart`),
    ]),
  ];
}

function makePageMeta({ title, url, icon = 'pi pi-sitemap', showInMenu = true }) {
  return {
    isExpanded: false,
    type: 'sub',
    properties: [
      { key: 'display-name', type: 'input-text-property', header: 'Display Name', value: title },
      { key: 'label', type: 'input-text-property', header: 'Label', value: title },
      { key: 'icon', type: 'input-text-property', header: 'Icon', value: icon },
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
        value: url,
        conditions: [{ key: 'route-type', rule: "value != 'category'" }],
      },
      {
        key: 'bg',
        header: 'Background',
        type: 'group-property',
        children: [
          {
            key: 'bg-type',
            header: 'Type',
            type: 'select-button',
            options: [
              { label: 'Color', value: 'color' },
              { label: 'Gradient', value: 'gradient' },
            ],
            value: 'color',
            inGroup: true,
          },
          {
            key: 'bg-color',
            header: 'Color',
            type: 'color-property',
            value: '#ffffff',
            inGroup: true,
          },
        ],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Show in menu', name: 'showInMenu' },
          { label: 'Show header', name: 'showHeader' },
        ],
        value: { showInMenu, showHeader: true },
      },
    ],
    children: [],
  };
}

function makeCategoryPageMeta() {
  return {
    isExpanded: false,
    type: 'main',
    properties: [
      { key: 'display-name', type: 'input-text-property', header: 'Display Name', value: CATEGORY.title },
      { key: 'label', type: 'input-text-property', header: 'Label', value: CATEGORY.title },
      { key: 'icon', type: 'input-text-property', header: 'Icon', value: CATEGORY.icon },
      {
        key: 'route-type',
        type: 'select-property',
        options: [
          { label: 'Category', value: 'category' },
          { label: 'Static', value: 'static' },
          { label: 'External', value: 'external' },
        ],
        header: 'Route Type',
        value: 'category',
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
        value: '',
        conditions: [{ key: 'route-type', rule: "value != 'category'" }],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'Hidden', name: 'hidden' }],
        value: { hidden: false },
      },
      {
        key: 'default-url',
        header: 'Default Url',
        type: 'input-text-property',
        value: CATEGORY.defaultUrl,
        conditions: [{ key: 'route-type', rule: "value == 'category'" }],
      },
    ],
    children: [],
  };
}

function writeTemplateFiles(templatesDir) {
  const styles = loadStyles();

  fs.writeFileSync(
    path.join(templatesDir, `${INDEX_PAGE.templateName}-page.json`),
    JSON.stringify(
      makePageMeta({
        title: INDEX_PAGE.title,
        url: INDEX_PAGE.url,
        icon: 'pi pi-sitemap',
        showInMenu: false,
      }),
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(templatesDir, `${INDEX_PAGE.templateName}-content.json`),
    JSON.stringify({ pageId: '', content: buildIndexContent(), styles }, null, 2) + '\n'
  );

  for (const wf of WORKFLOW_DOCS) {
    fs.writeFileSync(
      path.join(templatesDir, `${wf.templateName}-page.json`),
      JSON.stringify(
        makePageMeta({ title: wf.title, url: wf.url, icon: menuIcon(wf.icon), showInMenu: true }),
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(
      path.join(templatesDir, `${wf.templateName}-content.json`),
      JSON.stringify({ pageId: '', content: buildDetailContent(wf), styles }, null, 2) + '\n'
    );
  }

  return { styles, count: WORKFLOW_DOCS.length + 1 };
}

module.exports = {
  SABIT_VERILER_ID,
  INDEX_PAGE,
  IS_AKISLARI_CATEGORY,
  CATEGORY,
  WORKFLOW_DOCS,
  iconClass,
  menuIcon,
  loadStyles,
  buildIndexContent,
  buildDetailContent,
  buildIndexHtml,
  buildDetailHtml,
  makePageMeta,
  makeCategoryPageMeta,
  writeTemplateFiles,
};
