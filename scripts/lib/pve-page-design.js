const fs = require('fs');
const path = require('path');

const HERO_FILE = path.join(
  __dirname,
  '../../templates/admin-sistem-ziyaret-haric-hero.html'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/admin-sistem-ziyaret-haric-page-extensions.css'
);
const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/admin-sistem-durumu-page-styles.css'
);

const PAGE = {
  title: 'Ziyaret Logu Hariç Tutulanlar',
  url: 'admin-sistem-ziyaret-haric',
  icon: 'pi pi-eye-slash',
};

const DASHBOARD_PAGE_ID = '6a4e3b63811889b624701420';
const SABIT_VERILER_ID = '5fef75324fe5a5001340f982';

function prop(key, type, value, extra = {}) {
  return { key, header: key, type, value, ...extra };
}

function makeHeaderHiddenCondition() {
  return {
    type: 'condition',
    isContainer: true,
    children: [],
    properties: [
      prop('display-name', 'input-text-property', 'Header hidden'),
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
  };
}

function makeCondition(displayName, condition, children) {
  return {
    type: 'condition',
    isContainer: true,
    children,
    properties: [
      prop('display-name', 'input-text-property', displayName),
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
  };
}

function makeSimpleContainer(children, displayName, classes) {
  return {
    type: 'simple-container',
    isContainer: true,
    children,
    properties: [
      prop('display-name', 'input-text-property', displayName),
      prop('classes', 'textarea-property', classes),
      prop('styles', 'code-editor', '{\n\n}'),
    ],
  };
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: content.trim(),
    properties: [prop('display-name', 'input-text-property', displayName)],
  };
}

function makePageVisitEnterDs() {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      prop('display-name', 'input-text-property', 'Sayfa ziyaret logu'),
      prop('variable-name', 'input-text-property', '_pageVisitEnter'),
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
      prop('table-name', 'input-text-property', ''),
      prop('custom-function-name', 'input-text-property', 'pageVisitLog'),
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value:
          '{\n  "action": "enter",\n  "pageId": "{{page._id}}",\n  "pageUrl": "admin-sistem-ziyaret-haric",\n  "path": "/d/admin-sistem-ziyaret-haric"\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
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
        value: { single: true, debug: false, canReload: false, forTable: false },
      },
    ],
  };
}

function makeMetaDs() {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      prop('display-name', 'input-text-property', 'Hariç tutulanlar meta'),
      prop('variable-name', 'input-text-property', 'visitExcludedMeta'),
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
      prop('table-name', 'input-text-property', ''),
      prop('custom-function-name', 'input-text-property', 'pageVisitExcludedUsers'),
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value: '{\n  "oprType": "list"\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
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
        value: { single: true, debug: false, canReload: true, forTable: false },
      },
    ],
  };
}

function makeExcludedListDs() {
  // Native panel table (forTable) bu koleksiyonda boş/spinner kalıyor.
  // listRows + forTable:false → HTML {{#each}} ve select ile bağlanır.
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Hariç tutulanlar liste',
      },
      {
        key: 'variable-name',
        header: 'Variable name',
        type: 'input-text-property',
        value: 'excludedUsers',
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
        value: 'pageVisitExcludedUsers',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value: '{\n  "oprType": "listRows"\n}',
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
        value: { single: false, debug: false, canReload: true, forTable: false },
      },
    ],
  };
}

function makeUsersDs() {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      prop('display-name', 'input-text-property', 'Kullanıcılar'),
      prop('variable-name', 'input-text-property', 'users'),
      {
        key: 'function',
        header: 'Function',
        type: 'select-property',
        options: [
          { label: 'Get', value: 'get' },
          { label: 'Custom', value: 'custom' },
        ],
        value: 'get',
      },
      prop('table-name', 'input-text-property', 'users'),
      prop('custom-function-name', 'input-text-property', ''),
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        // İşten çıkışlı personel hariç. Soft-delete (delete:1) kalsın (ör. Oktay Yörük).
        value:
          '{\n  "terminationDate": { "$exists": false },\n  "sort": { "name": 1, "surname": 1 }\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
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
        value: { single: false, debug: false, canReload: true, forTable: false },
      },
    ],
  };
}

const CLASSIC_DIR = path.join(__dirname, 'pve-classic');

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadClassic(name) {
  return deepClone(
    JSON.parse(fs.readFileSync(path.join(CLASSIC_DIR, name), 'utf8'))
  );
}

function setPropValue(block, key, value) {
  if (!block?.properties) return false;
  const p = block.properties.find((x) => x.key === key);
  if (!p) return false;
  p.value = value;
  return true;
}

function setOptionData(select, label, valuePath) {
  const od = (select.properties || []).find((p) => p.key === 'option-data');
  if (!od?.children) return;
  const lab = od.children.find((c) => c.key === 'label');
  const val = od.children.find((c) => c.key === 'value');
  if (lab) lab.value = label;
  if (val) val.value = valuePath;
}

function makeUserSelect() {
  const select = loadClassic('user-select.json');
  setPropValue(select, 'display-name', 'Kullanıcı seç');
  setPropValue(select, 'name', 'userId');
  setPropValue(select, 'label', 'Kullanıcı');
  setPropValue(select, 'placeholder', 'Kullanıcı seçin...');
  setPropValue(select, 'search-placeholder', 'İsim veya e-posta ile ara...');
  setPropValue(select, 'empty-message', 'Kullanıcı bulunamadı');
  setPropValue(select, 'data-source', 'users');
  setPropValue(select, 'on-change', 'nothing');
  setPropValue(select, 'settings', {
    selectFirst: false,
    search: true,
    inContainer: false,
    disabled: false,
    readonly: false,
    clearButton: true,
  });
  setOptionData(
    select,
    '{{option.name}} {{option.surname}} ({{option.email}})',
    'option._id'
  );
  return select;
}

function makeExcludedUserSelect() {
  const select = loadClassic('user-select.json');
  setPropValue(select, 'display-name', 'Hariç kullanıcı seç');
  setPropValue(select, 'name', 'userId');
  setPropValue(select, 'label', 'Listeden çıkarılacak kullanıcı');
  setPropValue(select, 'placeholder', 'Kullanıcı seçin...');
  setPropValue(select, 'search-placeholder', 'İsim veya e-posta ile ara...');
  setPropValue(select, 'empty-message', 'Hariç tutulan kullanıcı yok');
  setPropValue(select, 'data-source', 'excludedUsers');
  setPropValue(select, 'on-change', 'nothing');
  setPropValue(select, 'settings', {
    selectFirst: false,
    search: true,
    inContainer: false,
    disabled: false,
    readonly: false,
    clearButton: true,
  });
  setOptionData(
    select,
    '{{option.userName}} ({{option.userEmail}})',
    'option.userId'
  );
  return select;
}

function makeExcludedListHtml() {
  return makeRenderTemplate(
    `{{#each visitExcludedMeta}}
{{#if this.excludedCount}}
<div class="pve-html-table-wrap" data-page-size="10">
  <table class="pve-html-table">
    <thead>
      <tr>
        <th>Kullanıcı</th>
        <th>E-posta</th>
        <th>Eklenme</th>
        <th>Ekleyen</th>
      </tr>
    </thead>
    <tbody>
      {{#each this.items}}
      <tr class="pve-paginate-row">
        <td>{{this.userName}}</td>
        <td>{{this.userEmail}}</td>
        <td>{{this.createdAtLabel}}</td>
        <td>{{this.createdByName}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="pve-paginate" hidden>
    <button type="button" class="p-button p-button-text" data-pve-page="prev">Önceki</button>
    <span data-pve-page-info></span>
    <button type="button" class="p-button p-button-text" data-pve-page="next">Sonraki</button>
  </div>
</div>
{{else}}
<p class="pve-hint">Hariç tutulan kullanıcı yok.</p>
{{/if}}
{{/each}}
<script>
(function () {
  function initPager(root) {
    var pageSize = parseInt(root.getAttribute('data-page-size') || '10', 10);
    if (!pageSize || pageSize < 1) pageSize = 10;
    var rows = Array.prototype.slice.call(root.querySelectorAll('.pve-paginate-row'));
    var pager = root.querySelector('.pve-paginate');
    if (!pager || rows.length <= pageSize) {
      if (pager) pager.hidden = true;
      rows.forEach(function (row) { row.style.display = ''; });
      return;
    }
    pager.hidden = false;
    var page = 1;
    var totalPages = Math.ceil(rows.length / pageSize);
    var info = pager.querySelector('[data-pve-page-info]');
    var prev = pager.querySelector('[data-pve-page="prev"]');
    var next = pager.querySelector('[data-pve-page="next"]');
    function render() {
      var start = (page - 1) * pageSize;
      var end = start + pageSize;
      rows.forEach(function (row, i) {
        row.style.display = i >= start && i < end ? '' : 'none';
      });
      if (info) info.textContent = page + ' / ' + totalPages;
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= totalPages;
    }
    if (prev) prev.onclick = function () { if (page > 1) { page--; render(); } };
    if (next) next.onclick = function () { if (page < totalPages) { page++; render(); } };
    render();
  }
  function boot() {
    document.querySelectorAll('.pve-html-table-wrap').forEach(initPager);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
})();
</script>`,
    'Hariç liste tablosu'
  );
}

function makeButton(text, displayName, severity = 'p-button-success') {
  const button = loadClassic('submit-button.json');
  setPropValue(button, 'display-name', displayName);
  setPropValue(button, 'text', text);
  setPropValue(button, 'severity', severity);
  setPropValue(button, 'size', 'p-button');
  setPropValue(
    button,
    'icon',
    severity === 'p-button-danger' ? 'pi pi-trash' : 'pi pi-plus'
  );
  setPropValue(button, 'action', 'submit');
  setPropValue(button, 'width', 'auto');
  setPropValue(button, 'settings', {
    inForm: true,
    hasIcon: true,
    rounded: false,
    hasShadow: false,
    hasOutline: false,
    textButton: false,
    disabled: false,
  });
  return button;
}

function makeCustomForm({
  displayName,
  oprType,
  hiddenValues,
  children,
  onSuccess = 'route',
}) {
  const form = loadClassic('form-container.json');
  let hidden = {};
  try {
    hidden = JSON.parse(hiddenValues || '{}') || {};
  } catch (e) {
    hidden = {};
  }
  if (!hidden.oprType && oprType) hidden.oprType = oprType;

  setPropValue(form, 'display-name', displayName);
  setPropValue(form, 'action', 'custom');
  setPropValue(form, 'custom-function-name', 'pageVisitExcludedUsers');
  setPropValue(form, 'table-name', '');
  setPropValue(form, 'field-id', '');
  setPropValue(form, 'hidden-values', JSON.stringify(hidden, null, 2));
  setPropValue(form, 'table-filters', '{\n\n}');
  setPropValue(form, 'on-success', onSuccess);
  setPropValue(
    form,
    'url',
    onSuccess === 'route' || onSuccess === 'redirect'
      ? '/d/admin-sistem-ziyaret-haric'
      : ''
  );
  setPropValue(form, 'query-params', '{\n\n}');
  setPropValue(form, 'response-name', '');
  setPropValue(form, 'on-success-message', '');
  setPropValue(form, 'settings', {
    hidden: false,
    hasConfirm: false,
    debug: false,
    debugResponse: false,
    expose: false,
    minReqFields: false,
  });
  form.children = children || [];
  return form;
}

function sectionHead(title, sub, icon) {
  return makeRenderTemplate(
    `<div class="pve-card__head">
  <div class="pve-card__head-icon"><i class="pi ${icon}"></i></div>
  <div>
    <h2>${title}</h2>
    <p>${sub}</p>
  </div>
</div>`,
    title
  );
}

function buildContent() {
  const hero = fs.readFileSync(HERO_FILE, 'utf8');
  const addForm = makeCustomForm({
    displayName: 'Kullanıcı ekle formu',
    oprType: 'add',
    hiddenValues: '{\n\n}',
    children: [makeUserSelect(), makeButton('Listeye ekle', 'Ekle')],
    onSuccess: 'route',
  });
  const removeForm = makeCustomForm({
    displayName: 'Kullanıcı çıkar formu',
    oprType: 'remove',
    hiddenValues: '{\n\n}',
    children: [
      makeExcludedUserSelect(),
      makeButton('Listeden çıkar', 'Çıkar', 'p-button-danger'),
    ],
    onSuccess: 'route',
  });

  return [
    makePageVisitEnterDs(),
    makeMetaDs(),
    makeExcludedListDs(),
    makeUsersDs(),
    makeHeaderHiddenCondition(),
    makeCondition('Ana içerik', 'true', [
      makeSimpleContainer(
        [
          makeRenderTemplate(hero, 'Sayfa hero'),
          makeSimpleContainer(
            [
              sectionHead(
                'Kullanıcı ekle',
                'Seçilen kullanıcı loglanmaz ve anlık listede görünmez.',
                'pi-user-plus'
              ),
              makeSimpleContainer([addForm], 'Form alanı', 'pve-card__body pve-add-form'),
            ],
            'Ekle kartı',
            'pve-card'
          ),
          makeSimpleContainer(
            [
              sectionHead(
                'Hariç tutulanlar',
                'Liste aşağıda; çıkarmak için kullanıcıyı seçip Listeden çıkar’a basın.',
                'pi-eye-slash'
              ),
              makeSimpleContainer(
                [makeExcludedListHtml()],
                'Tablo alanı',
                'pve-card__body pve-table-wrap'
              ),
              makeSimpleContainer(
                [removeForm],
                'Çıkar form alanı',
                'pve-card__body pve-add-form pve-remove-form'
              ),
            ],
            'Liste kartı',
            'pve-card'
          ),
        ],
        'Ziyaret Hariç Layout',
        'auo-page pve-page'
      ),
    ]),
  ];
}

function loadStyles() {
  const base = fs.readFileSync(BASE_STYLES_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${ext}\n`;
}

function makePageMeta({ title, url, showInMenu = true, icon = 'pi pi-eye-slash' }) {
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
        key: 'url',
        type: 'input-text-property',
        header: 'Url',
        value: url,
        conditions: [{ key: 'route-type', rule: "value != 'category'" }],
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

module.exports = {
  PAGE,
  DASHBOARD_PAGE_ID,
  SABIT_VERILER_ID,
  buildContent,
  loadStyles,
  makePageMeta,
};
