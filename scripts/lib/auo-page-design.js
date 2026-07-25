const fs = require('fs');
const path = require('path');

const BODY_FILE = path.join(__dirname, '../../templates/admin-kullanici-ozeti-body.html');
const STYLES_FILE = path.join(__dirname, '../../templates/admin-kullanici-ozeti-page-styles.css');
const PROFILE_BODY_FILE = path.join(
  __dirname,
  '../../templates/admin-kullanici-profili-body.html'
);
const PROFILE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/admin-kullanici-profili-page-styles.css'
);

const SABIT_VERILER_ID = '5fef75324fe5a5001340f982';

const PAGE = {
  templateName: 'admin-kullanici-ozeti',
  title: 'Sistem Durumu',
  url: 'admin-kullanici-ozeti',
  pageId: '6a4e3b63811889b624701420',
};

const CATEGORY = {
  title: 'Sistem Yönetimi',
  icon: 'pi pi-cog',
  defaultUrl: 'admin-kullanici-ozeti',
};

function makeHeaderHiddenCondition() {
  return {
    type: 'condition',
    isContainer: true,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Header hidden',
      },
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
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
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

function makeCustomDataSource() {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Admin kullanıcı özeti',
      },
      {
        key: 'variable-name',
        header: 'Variable name',
        type: 'input-text-property',
        value: 'adminOverview',
      },
      {
        key: 'function',
        header: 'Function',
        type: 'select-property',
        options: [
          { label: 'Get', value: 'get' },
          { label: 'Custom', value: 'custom' },
        ],
        value: 'custom',
      },
      {
        key: 'table-name',
        header: 'Table name',
        type: 'input-text-property',
        value: '',
        conditions: [{ key: 'function', rule: "value == 'get'" }],
      },
      {
        key: 'custom-function-name',
        header: 'Custom function name',
        type: 'input-text-property',
        value: 'adminUserOverview',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'function', rule: "value == 'get'" }],
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value: '{\n  "userId": "{{params._id}}"\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Single data', name: 'single' },
          { label: 'Debug', name: 'debug' },
          { label: 'Can reload', name: 'canReload' },
          { label: 'For table', name: 'forTable' },
        ],
        value: {
          single: false,
          debug: false,
          canReload: true,
          forTable: false,
        },
      },
    ],
  };
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: content.trim(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
    ],
  };
}

function makeSimpleContainer(children, displayName, classes = '') {
  return {
    type: 'simple-container',
    isContainer: true,
    children,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: classes,
      },
      {
        key: 'styles',
        header: 'Styles',
        type: 'code-editor',
        value: '{\n\n}',
      },
    ],
  };
}

function buildContent() {
  const overviewHtml = fs.readFileSync(BODY_FILE, 'utf8').trim();
  const profileHtml = fs.readFileSync(PROFILE_BODY_FILE, 'utf8').trim();
  const bodyHtml = `{{#if params._id}}
${profileHtml}
{{else}}
${overviewHtml}
{{/if}}`;
  // data-source kök seviyede olmalı; condition içinde kalırsa bazı panel sürümlerinde
  // custom endpoint hiç çağrılmaz / sayfa spinner'da takılır.
  return [
    makeCustomDataSource(),
    makeHeaderHiddenCondition(),
    makeCondition('Ana içerik', 'true', [
      makeSimpleContainer(
        [makeRenderTemplate(bodyHtml, 'Kullanıcı özeti dashboard')],
        'Sistem Durumu Layout',
        'auo-page'
      ),
    ]),
  ];
}

function loadStyles() {
  const overview = fs.readFileSync(STYLES_FILE, 'utf8').trim();
  const profile = fs.readFileSync(PROFILE_STYLES_FILE, 'utf8').trim();
  return `${overview}\n\n${profile}`;
}

function makePageMeta({ title, url, showInMenu = true }) {
  return {
    isExpanded: false,
    type: 'sub',
    properties: [
      { key: 'display-name', type: 'input-text-property', header: 'Display Name', value: title },
      { key: 'label', type: 'input-text-property', header: 'Label', value: title },
      { key: 'icon', type: 'input-text-property', header: 'Icon', value: 'pi pi-users' },
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

function writeTemplateFiles() {
  const templatesDir = path.join(__dirname, '../../templates');
  const styles = loadStyles();
  const content = buildContent();

  fs.writeFileSync(
    path.join(templatesDir, `${PAGE.templateName}-page.json`),
    JSON.stringify(makePageMeta({ title: PAGE.title, url: PAGE.url }), null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(templatesDir, `${PAGE.templateName}-content.json`),
    JSON.stringify({ pageId: PAGE.pageId, content, styles }, null, 2) + '\n'
  );
}

module.exports = {
  PAGE,
  CATEGORY,
  SABIT_VERILER_ID,
  buildContent,
  loadStyles,
  makePageMeta,
  makeCategoryPageMeta,
  makeHeaderHiddenCondition,
  makeCondition,
  makeSimpleContainer,
  makeRenderTemplate,
  makeCustomDataSource,
  writeTemplateFiles,
};
