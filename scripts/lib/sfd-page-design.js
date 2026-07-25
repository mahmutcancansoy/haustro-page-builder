const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/sozlesmeli-faturalar-detay-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/sozlesmeli-faturalar-detay-hero.html'
);

const PAGE_CONFIG = {
  pageId: '698cb7db5170eb016c0fea42',
  layoutName: 'Sözleşmeli Faturalar Detay Layout',
};

function prop(block, key) {
  return (block.properties || []).find((p) => p.key === key);
}

function propVal(block, key) {
  const p = prop(block, key);
  return p == null ? '' : p.value;
}

function setProp(block, key, value) {
  const p = prop(block, key);
  if (p) {
    p.value = value;
    return;
  }
  block.properties = block.properties || [];
  block.properties.push({
    key,
    header: key,
    type:
      key === 'custom-classes' || key === 'classes'
        ? 'textarea-property'
        : 'input-text-property',
    value,
  });
}

function appendClass(block, key, className) {
  const current = String(propVal(block, key) || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, key, `${current} ${className}`.trim());
  }
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

function patchButtonSettings(block, patch) {
  const settings = prop(block, 'settings');
  if (!settings) return;
  if (!settings.value || typeof settings.value !== 'object') settings.value = {};
  Object.assign(settings.value, patch);
}

function applyButton(block, cfg) {
  if (cfg.classes != null) setProp(block, 'classes', cfg.classes);
  if (cfg.severity != null) setProp(block, 'severity', cfg.severity);
  if (cfg.size != null) setProp(block, 'size', cfg.size);
  if (cfg.icon != null) setProp(block, 'icon', cfg.icon);
  if (cfg.iconPosition != null) setProp(block, 'icon-position', cfg.iconPosition);
  if (cfg.settings) patchButtonSettings(block, cfg.settings);
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

function renderTemplate(displayName, html) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: html.trim(),
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

function heroBlock() {
  return renderTemplate('Sayfa hero', fs.readFileSync(HERO_FILE, 'utf8'));
}

function sectionHead(title, sub, icon, displayName) {
  return renderTemplate(
    displayName,
    `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi ${icon}"></i></div>
  <div>
    <h2>${title}</h2>
    <p>${sub}</p>
  </div>
</div>`
  );
}

function patchToolbarButtons(toolbar) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button') {
        const name = String(propVal(n, 'display-name') || '');
        const text = String(propVal(n, 'text') || '');
        if (name === 'Geri' || text === 'Geri') {
          applyButton(n, {
            classes: '',
            severity: 'p-button-secondary',
            size: 'p-button',
            icon: 'pi pi-chevron-left',
            iconPosition: 'left',
            settings: {
              hasIcon: true,
              textButton: true,
              hasOutline: false,
              rounded: false,
            },
          });
        }
      }
      walk(n.children);
    }
  }
  walk(toolbar.children);
}

function hidePageHeader(block) {
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
  return block;
}

function wrapInfoForm(form) {
  return simpleContainer(
    [
      sectionHead(
        'Sözleşme bilgileri',
        'Tedarikçi, hizmet, taksit ve sözleşme tarihleri.',
        'pi-info-circle',
        'Sözleşme başlık'
      ),
      form,
    ],
    'ass__detail-card',
    'Sözleşme bilgi kartı'
  );
}

function wrapInvoiceSearch(condition) {
  return simpleContainer(
    [
      sectionHead(
        'Fatura ekleme',
        'Logo faturalarını ara, senkronize et ve sözleşmeye bağla.',
        'pi-search',
        'Fatura ekleme başlık'
      ),
      condition,
    ],
    'ass__form-card sfd-invoice-card',
    'Fatura ekleme kartı'
  );
}

function styleTableSection(container, title, sub, icon, displayName) {
  const cls = String(propVal(container, 'classes') || '');
  if (!cls.includes('ass__list-card')) {
    setProp(container, 'classes', `${cls} ass__list-card`.trim());
  }
  setProp(container, 'display-name', displayName);

  const children = container.children || [];
  const hasHead = children.some(
    (c) =>
      c.type === 'render-template' &&
      String(propVal(c, 'display-name') || '').includes('başlık')
  );

  for (const child of children) {
    if (child.type === 'page-header') hidePageHeader(child);
    if (child.type === 'table') appendClass(child, 'classes', 'ass__data-table');
  }

  if (!hasHead) {
    container.children = [
      sectionHead(title, sub, icon, `${displayName} başlık`),
      ...children,
    ];
  }

  return container;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass-page')
  );
}

function unwrapUiBlocks(blocks) {
  const out = [];
  let toolbarKept = false;

  for (const b of blocks) {
    if (b.type === 'render-template') continue;
    if (b.type === 'content-header') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__detail-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(form);
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('sfd-invoice-card')
    ) {
      const cond = (b.children || []).find((c) => c.type === 'condition');
      if (cond) out.push(cond);
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      // strip injected heads, keep original section container structure
      const cleaned = {
        ...b,
        children: (b.children || []).filter((c) => c.type !== 'render-template'),
      };
      const cls = String(propVal(cleaned, 'classes') || '')
        .replace(/\bass__list-card\b/g, '')
        .trim();
      setProp(cleaned, 'classes', cls);
      for (const child of cleaned.children || []) {
        if (child.type === 'table') {
          const tcls = String(propVal(child, 'classes') || '')
            .replace(/\bass__data-table\b/g, '')
            .trim();
          setProp(child, 'classes', tcls);
        }
      }
      out.push(cleaned);
      continue;
    }

    if (b.type === 'grid') {
      if (toolbarKept && isToolbarGrid(b)) continue;
      if (isToolbarGrid(b)) toolbarKept = true;
      setProp(b, 'custom-classes', '');
      const settings = prop(b, 'settings');
      if (settings?.value) settings.value.customClasses = false;
      out.push(b);
      continue;
    }

    if (
      b.type === 'form-container' ||
      b.type === 'condition' ||
      b.type === 'simple-container'
    ) {
      out.push(b);
    }
  }

  return out;
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const infoForm = blocks.find(
    (b) =>
      b.type === 'form-container' &&
      /New Form Container 1/i.test(String(propVal(b, 'display-name') || ''))
  ) || blocks.find((b) => b.type === 'form-container');

  const invoiceCondition = blocks.find(
    (b) => b.type === 'condition' && String(propVal(b, 'display-name') || '') === 'true'
  );

  const tableSections = blocks.filter(
    (b) =>
      b.type === 'simple-container' &&
      (b.children || []).some((c) => c.type === 'table')
  );

  for (const g of toolbarGrids) {
    setGridClass(g, 'ass__toolbar');
    patchToolbarButtons(g);
  }

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (infoForm) ordered.push(wrapInfoForm(infoForm));
  if (invoiceCondition) ordered.push(wrapInvoiceSearch(invoiceCondition));

  // Approved first, then pending (original order)
  const approved = tableSections.find((s) =>
    (s.children || []).some(
      (c) =>
        c.type === 'data-source' &&
        /approved/i.test(String(propVal(c, 'display-name') || '') + propVal(c, 'variable'))
    )
  );
  const pending = tableSections.find((s) =>
    (s.children || []).some(
      (c) =>
        c.type === 'data-source' &&
        /pending/i.test(String(propVal(c, 'display-name') || '') + propVal(c, 'variable'))
    )
  );

  if (approved) {
    ordered.push(
      styleTableSection(
        approved,
        'İşlenen faturalar',
        'Sözleşmeye bağlanmış onaylı faturalar.',
        'pi-check-circle',
        'İşlenen faturalar kartı'
      )
    );
  }
  if (pending) {
    ordered.push(
      styleTableSection(
        pending,
        'Bekleyen faturalar',
        'Henüz işlenmemiş veya beklemedeki faturalar.',
        'pi-clock',
        'Bekleyen faturalar kartı'
      )
    );
  }

  // Any remaining table sections
  for (const s of tableSections) {
    if (s !== approved && s !== pending && !ordered.includes(s)) {
      ordered.push(
        styleTableSection(
          s,
          'Faturalar',
          'Sözleşmeye bağlı faturalar.',
          'pi-list',
          propVal(s, 'display-name') || 'Faturalar kartı'
        )
      );
    }
  }

  return ordered;
}

function applyLayout(content) {
  const existingWrap = findLayoutWrapper(content);
  if (existingWrap) {
    const inner = unwrapUiBlocks(existingWrap.children || []);
    existingWrap.children = patchUiBlocks(inner);
    setProp(existingWrap, 'display-name', PAGE_CONFIG.layoutName);
    return content;
  }

  const dataBlocks = [];
  const uiBlocks = [];

  for (const block of content) {
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (block.type === 'content-header') {
      // hero ile değiştirilir
      continue;
    } else if (
      block.type === 'grid' ||
      block.type === 'form-container' ||
      block.type === 'condition' ||
      block.type === 'simple-container'
    ) {
      const cls = String(propVal(block, 'classes') || '');
      if (!cls.includes('ass-page')) uiBlocks.push(block);
    } else {
      dataBlocks.push(block);
    }
  }

  if (!uiBlocks.length) return content;
  const layout = simpleContainer(patchUiBlocks(uiBlocks), 'ass-page', PAGE_CONFIG.layoutName);
  return [...dataBlocks, layout];
}

/**
 * Form-safe fingerprint — form / field / condition / data-source shape.
 * Path ve chrome (Header hidden, toolbar butonları) hariç.
 */
function formFingerprint(content) {
  const rows = [];

  function walk(nodes) {
    for (const n of nodes || []) {
      const name = String(propVal(n, 'display-name') || '');

      if (n.type === 'form-container') {
        rows.push({
          kind: 'form',
          name,
          table: propVal(n, 'table'),
          action: propVal(n, 'action'),
        });
      }

      if (
        [
          'input-select',
          'input-date-time',
          'input-number',
          'input-textarea',
          'input-text',
          'label',
        ].includes(n.type)
      ) {
        rows.push({
          kind: 'field',
          type: n.type,
          name,
          fieldId: propVal(n, 'field-id'),
          label: propVal(n, 'label'),
          defaultValue: propVal(n, 'default-value'),
          dynamicDefault: propVal(n, 'dynamic-default-value'),
        });
      }

      if (n.type === 'condition' && name !== 'Header hidden') {
        rows.push({
          kind: 'condition',
          name,
          condition: propVal(n, 'condition'),
        });
      }

      if (n.type === 'data-source') {
        rows.push({
          kind: 'data-source',
          name,
          variable: propVal(n, 'variable'),
          table: propVal(n, 'table'),
          filters: propVal(n, 'filters'),
          single: propVal(n, 'single'),
        });
      }

      walk(n.children);
      if (n.customContents) {
        for (const cc of n.customContents) walk(cc.children);
      }
    }
  }

  walk(content);
  return JSON.stringify(rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

function loadStyles() {
  const base = fs.readFileSync(BASE_STYLES_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${ext}\n`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
  formFingerprint,
};
