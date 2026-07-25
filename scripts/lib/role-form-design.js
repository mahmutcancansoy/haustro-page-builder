const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const ROLE_EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/rol-duzenle-page-extensions.css'
);

function prop(block, key) {
  return (block.properties || []).find((p) => p.key === key);
}

function propVal(block, key) {
  const p = prop(block, key);
  return p == null ? '' : p.value;
}

function setProp(block, key, value) {
  const p = prop(block, key);
  if (p) p.value = value;
}

function ensureClasses(block, className) {
  if (!prop(block, 'classes')) {
    block.properties = block.properties || [];
    block.properties.push({
      key: 'classes',
      header: 'Classes',
      type: 'textarea-property',
      value: '',
    });
  }
  const current = String(propVal(block, 'classes') || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, 'classes', `${current} ${className}`.trim());
  }
}

function removeClass(block, key, className) {
  setProp(
    block,
    key,
    String(propVal(block, key) || '')
      .split(/\s+/)
      .filter((c) => c && c !== className)
      .join(' ')
  );
}

function enableSetting(block, settingKey) {
  const settings = prop(block, 'settings');
  if (settings?.value && typeof settings.value === 'object') {
    settings.value[settingKey] = true;
  }
}

function setGridClass(grid, className) {
  enableSetting(grid, 'customClasses');
  setProp(grid, 'custom-classes', className);
}

function isToolbarGrid(grid) {
  if (grid.type !== 'grid') return false;
  const name = String(propVal(grid, 'display-name') || '').toLowerCase();
  if (name.includes('toolbar')) return true;
  const btns = [];
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button') btns.push(String(propVal(n, 'text') || ''));
      walk(n.children);
    }
  }
  walk(grid.children);
  return btns.some((t) => t === 'Geri');
}

function simpleContainer(children, classes, displayName) {
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

function formFieldName(block) {
  return String(propVal(block, 'name') || '').trim();
}

function hasFormField(form, name) {
  return (form.children || []).some((c) => formFieldName(c) === name);
}

function mandatoryEvaluateRolesField(source, { defaultValue = '' } = {}) {
  const field = JSON.parse(JSON.stringify(source));
  setProp(field, 'display-name', 'Değerlendirilmesi Zorunlu');
  setProp(field, 'name', 'mandatoryEvaluateRoles');
  setProp(field, 'label', 'Değerlendirilmesi zorunlu:');
  setProp(field, 'search-placeholder', 'Rol ara..');
  setProp(field, 'dynamic-default-value', defaultValue);
  if (!defaultValue) setProp(field, 'static-default-value', '');
  return field;
}

function injectMandatoryEvaluateRolesField(form, options) {
  if (!form?.children?.length) return;
  if (hasFormField(form, 'mandatoryEvaluateRoles')) return;

  const evaluateRolesIdx = form.children.findIndex((c) => formFieldName(c) === 'evaluateRoles');
  const source =
    evaluateRolesIdx >= 0
      ? form.children[evaluateRolesIdx]
      : form.children.find((c) => c.type === 'input-multiselect');

  if (!source || source.type !== 'input-multiselect') return;

  const field = mandatoryEvaluateRolesField(source, options);
  const insertAt =
    evaluateRolesIdx >= 0
      ? evaluateRolesIdx + 1
      : form.children.findIndex((c) => c.type === 'button');
  const at = insertAt >= 0 ? insertAt : form.children.length;
  form.children.splice(at, 0, field);
}

function hidePageHeader(block, restoreText) {
  block.type = 'condition';
  block.isContainer = true;
  block.children = [];
  block.properties = [
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
  ];
  block._restorePageHeaderText = restoreText;
  return block;
}

function restorePageHeader(block, restoreText) {
  block.type = 'page-header';
  block.isContainer = false;
  block.children = [];
  block.properties = [
    {
      key: 'display-name',
      header: 'Display name',
      type: 'input-text-property',
      value: 'Page Title',
    },
    {
      key: 'classes',
      header: 'Classes',
      type: 'textarea-property',
      value: '',
    },
    {
      key: 'text',
      header: 'Text',
      type: 'textarea-property',
      value: restoreText,
      autoComplete: true,
      autoCompleteMode: 'template',
    },
    {
      key: 'bg-color',
      header: 'Background color',
      type: 'color-picker-property',
      value: '#fff',
    },
    {
      key: 'text-color',
      header: 'Text color',
      type: 'color-picker-property',
      value: '#777777',
    },
  ];
  return block;
}

function createRoleFormDesign(config) {
  const {
    pageId,
    layoutName,
    heroFile,
    formNamePattern,
    formHeadHtml,
    pageHeaderText,
    mandatoryFieldDefault = '',
  } = config;

  const UI_TYPES = new Set(['grid', 'page-header', 'form-container']);

  function isRoleForm(block) {
    return (
      block?.type === 'form-container' &&
      formNamePattern.test(String(propVal(block, 'display-name') || ''))
    );
  }

  function loadHeroHtml() {
    return fs.readFileSync(heroFile, 'utf8').trim();
  }

  function heroBlock() {
    return {
      type: 'render-template',
      isContainer: false,
      isTextEditor: true,
      content: loadHeroHtml(),
      properties: [
        {
          key: 'display-name',
          header: 'Display name',
          type: 'input-text-property',
          value: 'Sayfa hero',
        },
      ],
    };
  }

  function formHeadBlock() {
    return {
      type: 'render-template',
      isContainer: false,
      isTextEditor: true,
      content: formHeadHtml,
      properties: [
        {
          key: 'display-name',
          header: 'Display name',
          type: 'input-text-property',
          value: 'Form başlık',
        },
      ],
    };
  }

  function wrapFormSection(form) {
    ensureClasses(form, 'rldu-form');
    return simpleContainer([formHeadBlock(), form], 'ass__form-card', 'Rol formu kartı');
  }

  function patchRoleForm(form) {
    injectMandatoryEvaluateRolesField(form, { defaultValue: mandatoryFieldDefault });
    return form;
  }

  function patchDataSources(blocks) {
    for (const b of blocks || []) {
      if (b.type === 'data-source') {
        const settings = prop(b, 'settings');
        if (settings?.value) settings.value.debug = false;
      }
      patchDataSources(b.children);
    }
  }

  function patchUiBlocks(blocks) {
    const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
    const roleForm = blocks.find(isRoleForm);
    const pageHeader = blocks.find((b) => b.type === 'page-header');

    if (pageHeader) hidePageHeader(pageHeader, pageHeaderText);
    for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

    const ordered = [];
    for (const g of toolbarGrids) ordered.push(g);
    ordered.push(heroBlock());
    if (roleForm) ordered.push(wrapFormSection(patchRoleForm(roleForm)));

    return ordered;
  }

  function findLayoutWrapper(content) {
    return content.find(
      (b) =>
        b.type === 'simple-container' && prop(b, 'classes')?.value?.includes('ass-page')
    );
  }

  function unwrapUiBlocks(blocks) {
    const out = [];
    let toolbarKept = false;

    for (const b of blocks) {
      if (b.type === 'render-template') continue;

      if (
        b.type === 'simple-container' &&
        String(propVal(b, 'classes') || '').includes('ass__form-card')
      ) {
        const form = (b.children || []).find(isRoleForm);
        if (form) {
          removeClass(form, 'classes', 'rldu-form');
          out.push(form);
        }
        continue;
      }

      if (b.type === 'grid') {
        const cls = String(propVal(b, 'custom-classes') || '');
        const isToolbar = cls.includes('ass__toolbar') || isToolbarGrid(b);
        if (isToolbar) {
          if (toolbarKept) continue;
          toolbarKept = true;
          setProp(b, 'custom-classes', '');
          const settings = prop(b, 'settings');
          if (settings?.value) settings.value.customClasses = false;
        } else if (cls) {
          setProp(b, 'custom-classes', '');
          const settings = prop(b, 'settings');
          if (settings?.value) settings.value.customClasses = false;
        }
        out.push(b);
        continue;
      }

      if (isRoleForm(b)) {
        removeClass(b, 'classes', 'rldu-form');
        out.push(b);
        continue;
      }

      if (b.type === 'condition' && propVal(b, 'display-name') === 'Header hidden') {
        restorePageHeader(b, pageHeaderText);
      }

      out.push(b);
    }

    return out;
  }

  function applyLayout(content) {
    patchDataSources(content);

    const existingWrap = findLayoutWrapper(content);
    if (existingWrap) {
      const inner = unwrapUiBlocks(existingWrap.children || []);
      existingWrap.children = patchUiBlocks(inner);
      setProp(existingWrap, 'display-name', layoutName);
      return content;
    }

    const dataBlocks = [];
    const uiBlocks = [];

    for (const block of content) {
      if (block.type === 'data-source') {
        dataBlocks.push(block);
      } else if (UI_TYPES.has(block.type)) {
        uiBlocks.push(block);
      } else if (block.type === 'grid') {
        uiBlocks.push(block);
      } else if (block.type !== 'simple-container') {
        dataBlocks.push(block);
      }
    }

    if (!uiBlocks.length) return content;

    const layout = simpleContainer(patchUiBlocks(uiBlocks), 'ass-page', layoutName);
    return [...dataBlocks, layout];
  }

  function loadStyles() {
    const base = fs.readFileSync(BASE_STYLES_FILE, 'utf8').trim();
    const ext = fs.readFileSync(ROLE_EXT_STYLES_FILE, 'utf8').trim();
    return `${base}\n\n${ext}`;
  }

  return {
    PAGE_CONFIG: { pageId, layoutName },
    applyLayout,
    loadStyles,
  };
}

module.exports = {
  createRoleFormDesign,
};
