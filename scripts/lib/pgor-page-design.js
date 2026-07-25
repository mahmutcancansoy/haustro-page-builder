const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const SECTIONS_EXT_FILE = path.join(
  __dirname,
  '../../templates/depo-sube-detayi-page-extensions.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/personel-goruntule-page-extensions.css'
);
const BACKUP_FILE = path.join(
  __dirname,
  '../../templates/personel-goruntule-content.original.json'
);

const PAGE_CONFIG = {
  pageId: '655cacceb03e3606e173e59e',
  layoutName: 'Personel Görüntüle Layout',
};

const UI_TYPES = new Set(['content-header', 'form-container']);

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

function appendClass(block, key, className) {
  const current = String(propVal(block, key) || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, key, `${current} ${className}`.trim());
  }
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
  appendClass(block, 'classes', className);
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

function isDividerHeader(header) {
  const text = String(propVal(header, 'text') || '').trim();
  return /^-+$/.test(text) || text === '';
}

function isPageTitleHeader(header) {
  const text = String(propVal(header, 'text') || '').trim();
  return /personel kartı görüntüleme/i.test(text);
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

function heroBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__hero ass__hero--person">
  <div class="ass__hero-main">
    <span class="ass__eyebrow">Personel kartı</span>
    <h1>{{users.name}} {{users.surname}}</h1>
    <p class="ass__hero-sub">{{users.:departments:.label}}{{#if users.:roleTypes:.0.description}} · {{users.:roleTypes:.0.description}}{{/if}}</p>
  </div>
  <div class="ass__hero-meta">
    <span class="ass__chip"><i class="pi pi-id-card"></i> Özlük görüntüleme</span>
    {{#if users.email}}
      <span class="ass__chip"><i class="pi pi-envelope"></i> {{users.email}}</span>
    {{/if}}
    {{#if users.phone}}
      <span class="ass__chip"><i class="pi pi-phone"></i> {{users.phone}}</span>
    {{/if}}
  </div>
</div>`,
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

function patchContentHeader(header) {
  if (isDividerHeader(header)) {
    setProp(header, 'classes', 'ass__section-divider');
    setProp(header, 'bg-color', '#ffffff');
    setProp(header, 'text-color', '#94a3b8');
    return header;
  }
  appendClass(header, 'classes', 'ass__subsection-header');
  setProp(header, 'bg-color', '#f8fafc');
  setProp(header, 'text-color', '#4557a3');
  return header;
}

function patchFormBodyChildren(children, depth = 0) {
  for (const block of children || []) {
    if (block.type === 'label' && depth === 0) {
      appendClass(block, 'classes', 'ass__section-title');
    } else if (block.type === 'grid') {
      setGridClass(block, 'ass__field-grid');
    } else if (block.type === 'content-header') {
      patchContentHeader(block);
    } else if (block.type === 'loop') {
      ensureClasses(block, 'ass__asset-loop');
    } else if (block.type === 'form-array-container') {
      appendClass(block, 'classes', 'ass__form-array');
    }
    if (block.children?.length) {
      patchFormBodyChildren(block.children, depth + 1);
    }
  }
}

function patchForm(form) {
  const body = (form.children || []).find((c) => c.type === 'simple-container');
  if (body) {
    appendClass(body, 'classes', 'ass__view-body');
    patchFormBodyChildren(body.children);
  }
  appendClass(form, 'classes', 'ass__view-form');
  return simpleContainer([form], 'ass__view-card', 'Personel görüntüle kartı');
}

function loadFormFromBackup() {
  if (!fs.existsSync(BACKUP_FILE)) return null;
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  return backup.content?.find((b) => b.type === 'form-container') || null;
}

function resolveFormBlocks(inner) {
  if (inner.some((b) => b.type === 'form-container')) return inner;
  const form = loadFormFromBackup();
  return form ? [form] : inner;
}

function patchUiBlocks(blocks) {
  const form = blocks.find((b) => b.type === 'form-container');
  const ordered = [heroBlock()];
  if (form) ordered.push(patchForm(form));
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

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__view-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) {
        setProp(form, 'classes', String(propVal(form, 'classes') || '').replace('ass__view-form', '').trim());
        const body = (form.children || []).find((c) => c.type === 'simple-container');
        if (body) {
          setProp(
            body,
            'classes',
            String(propVal(body, 'classes') || '')
              .replace('ass__view-body', '')
              .replace(/\s+/g, ' ')
              .trim()
          );
          function restore(nodes) {
            for (const child of nodes || []) {
              if (child.type === 'label') {
                setProp(
                  child,
                  'classes',
                  String(propVal(child, 'classes') || '').replace('ass__section-title', '').trim()
                );
              }
              if (child.type === 'grid') {
                setProp(child, 'custom-classes', '');
                const settings = prop(child, 'settings');
                if (settings?.value) settings.value.customClasses = false;
              }
              if (child.type === 'content-header') {
                setProp(
                  child,
                  'classes',
                  String(propVal(child, 'classes') || '')
                    .replace('ass__subsection-header', '')
                    .replace('ass__section-divider', '')
                    .trim()
                );
              }
              if (child.type === 'loop') {
                setProp(
                  child,
                  'classes',
                  String(propVal(child, 'classes') || '').replace('ass__asset-loop', '').trim()
                );
              }
              if (child.type === 'form-array-container') {
                setProp(
                  child,
                  'classes',
                  String(propVal(child, 'classes') || '').replace('ass__form-array', '').trim()
                );
              }
              restore(child.children);
            }
          }
          restore(body.children);
        }
        out.push(form);
      }
      continue;
    }

    if (b.type === 'form-container') {
      out.push(b);
    }
  }

  return out;
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

function applyLayout(content) {
  patchDataSources(content);

  const existingWrap = findLayoutWrapper(content);
  if (existingWrap) {
    let inner = unwrapUiBlocks(existingWrap.children || []);
    inner = resolveFormBlocks(inner);
    existingWrap.children = patchUiBlocks(inner);
    setProp(existingWrap, 'display-name', PAGE_CONFIG.layoutName);
    return content;
  }

  const dataBlocks = [];
  const uiBlocks = [];

  for (const block of content) {
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (UI_TYPES.has(block.type)) {
      if (block.type === 'content-header' && isPageTitleHeader(block)) continue;
      uiBlocks.push(block);
    } else if (block.type !== 'simple-container') {
      dataBlocks.push(block);
    }
  }

  if (!uiBlocks.length) return content;

  const layout = simpleContainer(patchUiBlocks(uiBlocks), 'ass-page', PAGE_CONFIG.layoutName);
  return [...dataBlocks, layout];
}

function loadStyles() {
  const base = fs.readFileSync(BASE_STYLES_FILE, 'utf8').trim();
  const sections = fs.readFileSync(SECTIONS_EXT_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${sections}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
