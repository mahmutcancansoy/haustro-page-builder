const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/transfer-olustur-beta-page-extensions.css'
);
const HERO_FILE = path.join(__dirname, '../../templates/transfer-olustur-beta-hero.html');
const CARD_FILE = path.join(
  __dirname,
  '../../templates/transfer-olustur-beta-envanter-nizleme-kart.html'
);

const PAGE_CONFIG = {
  pageId: '69b0a5025170eb01db5cbf62',
  layoutName: 'Transfer Oluştur Beta Layout',
};

const UI_TYPES = new Set(['grid', 'content-header', 'form-container']);

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

function heroBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: fs.readFileSync(HERO_FILE, 'utf8').trim(),
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
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi pi-send"></i></div>
  <div>
    <h2>Transfer bilgileri</h2>
    <p>Envanter, miktar, kaynak ve hedef şube alanlarını doldurun.</p>
  </div>
</div>`,
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

function hideContentHeader(block) {
  block.type = 'condition';
  block.isContainer = true;
  block.children = [];
  block.properties = [
    {
      key: 'display-name',
      header: 'Display name',
      type: 'input-text-property',
      value: 'Eski header gizli',
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

function applyFullscreenModalProps(modalProps) {
  const set = (key, value) => {
    const p = modalProps.find((x) => x.key === key);
    if (p) p.value = value;
  };

  set('classes', 'tob-inv-modal-fullscreen');
  set('header', 'Envanter Detayı');
  set('width', '100vw');
  set('appendTo', 'body');
  set('position', 'top');

  const openWay = modalProps.find((p) => p.key === 'openWay');
  const stylesGroups = modalProps.find((p) => p.key === 'stylesGroups');
  const settings = modalProps.find((p) => p.key === 'settings');

  if (stylesGroups?.children) {
    const mask = stylesGroups.children.find((c) => c.key === 'maskStyleClass');
    const contentClass = stylesGroups.children.find((c) => c.key === 'contentStyleClass');
    if (mask) mask.value = 'tob-inv-modal-mask';
    if (contentClass) contentClass.value = 'tob-inv-modal-content';
  }

  if (settings?.value) {
    settings.value.draggable = false;
    settings.value.resizable = false;
    settings.value.maximizable = false;
    settings.value.keepInViewport = false;
    settings.value.modal = true;
    settings.value.blockScroll = true;
    settings.value.closeOnEscape = true;
    settings.value.dismissableMask = true;
    settings.value.closable = true;
    settings.value.showHeader = true;
  }

  return modalProps;
}

function createInventoryModal(cardHtml) {
  const modalProperties = applyFullscreenModalProps([
    {
      key: 'display-name',
      header: 'Display name',
      type: 'input-text-property',
      value: 'Envanter Önizleme Modal',
    },
    { key: 'label', header: 'Label', type: 'input-text-property', value: '' },
    {
      key: 'classes',
      header: 'Classes',
      type: 'textarea-property',
      value: 'tob-inv-modal-fullscreen',
    },
    {
      key: 'header',
      header: 'Header',
      type: 'input-text-property',
      value: 'Envanter Detayı',
    },
    { key: 'width', header: 'Width', type: 'input-text-property', value: '100vw' },
    { key: 'appendTo', header: 'Append to', type: 'input-text-property', value: 'body' },
    {
      key: 'position',
      type: 'select-property',
      options: [
        { label: 'Center', value: 'center' },
        { label: 'Top', value: 'top' },
        { label: 'Bottom', value: 'bottom' },
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
        { label: 'Top Left', value: 'top-left' },
        { label: 'Top Right', value: 'top-right' },
        { label: 'Bottom Left', value: 'bottom-left' },
        { label: 'Bottom Right', value: 'bottom-right' },
      ],
      header: 'Position',
      value: 'top',
    },
    {
      header: 'Open method',
      key: 'openWay',
      type: 'group-property',
      children: [
        {
          key: 'open-type',
          header: 'Open Type',
          type: 'select-property',
          options: [
            { label: 'Open onload', value: 'visible' },
            { label: 'Open on post', value: 'onPost' },
            { label: 'Show open button', value: 'showOpenBtn' },
          ],
          value: 'showOpenBtn',
          inGroup: true,
        },
        {
          key: 'responseName',
          header: 'Response Name',
          type: 'input-text-property',
          value: '',
          conditions: [{ key: 'open-type', rule: "value =='onPost'" }],
          inGroup: true,
        },
        {
          key: 'openBtnClass',
          header: 'Open button class',
          type: 'input-text-property',
          value: 'tob-preview-btn p-button-outlined p-button-sm p-button-info p-ripple',
          conditions: [{ key: 'open-type', rule: "value =='showOpenBtn'" }],
          inGroup: true,
        },
        {
          key: 'openBtnIcon',
          header: 'Open button icon',
          type: 'input-text-property',
          value: 'pi pi-eye',
          conditions: [{ key: 'open-type', rule: "value =='showOpenBtn'" }],
          inGroup: true,
        },
        {
          key: 'openBtnText',
          header: 'Open button text',
          type: 'input-text-property',
          value: 'Envanter Önizleme',
          conditions: [{ key: 'open-type', rule: "value =='showOpenBtn'" }],
          inGroup: true,
        },
      ],
    },
    {
      key: 'stylesGroups',
      header: 'Styles',
      type: 'group-property',
      children: [
        {
          key: 'maskStyleClass',
          header: 'Style class of the mask',
          type: 'input-text-property',
          value: 'tob-inv-modal-mask',
          inGroup: true,
        },
        {
          key: 'contentStyleClass',
          header: 'Style class of the content',
          type: 'input-text-property',
          value: 'tob-inv-modal-content',
          inGroup: true,
        },
        {
          key: 'contentStyle',
          header: 'Content Section Style',
          type: 'textarea-property',
          value: '',
          inGroup: true,
        },
      ],
    },
    {
      key: 'settings',
      type: 'checkbox-property',
      header: 'Settings',
      options: [
        { label: 'Draggable', name: 'draggable' },
        { label: 'Keeps dialog in the viewport', name: 'keepInViewport' },
        { label: 'Resizable', name: 'resizable' },
        { label: 'Block background', name: 'modal' },
        { label: 'Block scroll', name: 'blockScroll' },
        { label: 'Close on escape', name: 'closeOnEscape' },
        { label: 'Dismissable mask', name: 'dismissableMask' },
        { label: 'Closable', name: 'closable' },
        { label: 'Show header', name: 'showHeader' },
        { label: 'Maximizable', name: 'maximizable' },
        { label: 'QR Modal', name: 'qrModal' },
      ],
      value: {
        draggable: false,
        keepInViewport: false,
        resizable: false,
        modal: true,
        blockScroll: true,
        closeOnEscape: true,
        dismissableMask: true,
        closable: true,
        showHeader: true,
        maximizable: false,
        qrModal: false,
      },
    },
    { key: 'closeIcon', header: 'Close icon', type: 'input-text-property', value: 'pi pi-times' },
    {
      key: 'minimizeIcon',
      header: 'Minimize icon',
      type: 'input-text-property',
      value: 'pi pi-window-minimize',
    },
    {
      key: 'maximizeIcon',
      header: 'Maximize icon',
      type: 'input-text-property',
      value: 'pi pi-window-maximize',
    },
  ]);

  return {
    type: 'condition',
    isContainer: true,
    children: [
      {
        type: 'modal',
        isContainer: true,
        children: [
          {
            type: 'render-template',
            isContainer: false,
            isTextEditor: true,
            content: cardHtml.trim(),
            properties: [
              {
                key: 'display-name',
                header: 'Display name',
                type: 'input-text-property',
                value: 'Envanter Önizleme Kartı',
              },
            ],
          },
        ],
        properties: modalProperties,
      },
    ],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Envanter seçili — popup',
      },
      {
        key: 'condition',
        header: 'Condition',
        type: 'textarea-property',
        value: '"{{forms.transfersExpo.:inventory:.value}}" != ""',
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

function isInventoryPreviewCondition(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === 'Envanter Önizleme';
}

function isInventoryModalCondition(block) {
  if (block.type !== 'condition') return false;
  const name = String(propVal(block, 'display-name') || '');
  return (
    name.includes('Envanter seçili') ||
    name.includes('ön doldurma') ||
    name.includes('popup')
  );
}

function patchPreviewTemplateContent(previewCondition, cardHtml) {
  const rt = (previewCondition?.children || []).find((c) => c.type === 'render-template');
  if (rt) rt.content = cardHtml.trim();
}

function findInventoryPreviewCondition(blocks) {
  for (const grid of blocks) {
    if (!isToolbarGrid(grid)) continue;
    const found = (grid.children || []).find((c) => isInventoryPreviewCondition(c));
    if (found) return { parent: grid.children, block: found };
  }

  for (const b of blocks) {
    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__preview-card')
    ) {
      const cond = (b.children || []).find((c) => isInventoryPreviewCondition(c));
      if (cond) return { parent: null, block: cond, wrapped: b };
    }
    if (isInventoryPreviewCondition(b)) {
      return { parent: null, block: b };
    }
  }

  return null;
}

function extractInventoryPreview(blocks) {
  const hit = findInventoryPreviewCondition(blocks);
  if (!hit) return null;

  if (hit.parent) {
    const idx = hit.parent.indexOf(hit.block);
    if (idx !== -1) hit.parent.splice(idx, 1);
  } else if (hit.wrapped) {
    const idx = blocks.indexOf(hit.wrapped);
    if (idx !== -1) blocks.splice(idx, 1);
  } else {
    const idx = blocks.indexOf(hit.block);
    if (idx !== -1) blocks.splice(idx, 1);
  }

  return hit.block;
}

function removeInventoryModalsFromContent(content) {
  function walk(nodes) {
    if (!Array.isArray(nodes)) return;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (isInventoryModalCondition(n)) {
        nodes.splice(i, 1);
        continue;
      }
      if (n.type === 'modal' && propVal(n, 'display-name') === 'Envanter Önizleme Modal') {
        nodes.splice(i, 1);
        continue;
      }
      walk(n.children);
    }
  }
  walk(content);
}

function wrapInventoryPreviewSection(previewCondition) {
  return simpleContainer([previewCondition], 'ass__preview-card', 'Envanter önizleme kartı');
}

function patchDataSources(blocks) {
  for (const b of blocks) {
    if (b.type !== 'data-source') continue;
    const settings = prop(b, 'settings');
    if (settings?.value) settings.value.debug = false;
  }
}

function wrapFormSection(formContainer) {
  return simpleContainer([formHeadBlock(), formContainer], 'ass__form-card', 'Transfer form kartı');
}

function patchUiBlocks(blocks, cardHtml) {
  const preview = extractInventoryPreview(blocks);
  if (preview) patchPreviewTemplateContent(preview, cardHtml);

  const header = blocks.find((b) => b.type === 'content-header');
  if (header) hideContentHeader(header);

  for (const g of blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b))) {
    setGridClass(g, 'ass__toolbar');
  }

  const form = blocks.find((b) => b.type === 'form-container');
  if (form) removeInventoryModalsFromContent([form]);

  const ordered = [];
  for (const g of blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b))) {
    ordered.push(g);
  }
  ordered.push(heroBlock());
  if (preview) ordered.push(wrapInventoryPreviewSection(preview));
  if (form) ordered.push(wrapFormSection(form));

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
      String(propVal(b, 'classes') || '').includes('ass__preview-card')
    ) {
      const cond = (b.children || []).find((c) => isInventoryPreviewCondition(c));
      if (cond) out.push(cond);
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__form-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(form);
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
      }
      out.push(b);
      continue;
    }

    if (b.type === 'form-container' || b.type === 'content-header') {
      out.push(b);
      continue;
    }

    if (b.type === 'condition' && propVal(b, 'display-name') === 'Eski header gizli') {
      const restored = { ...b, type: 'content-header', children: b.children || [] };
      setProp(restored, 'display-name', 'Transfer Oluştur');
      setProp(restored, 'text', 'Transfer Oluştur');
      out.push(restored);
    }
  }

  return out;
}

function applyLayout(content) {
  const cardHtml = fs.readFileSync(CARD_FILE, 'utf8');
  patchDataSources(content);
  removeInventoryModalsFromContent(content);

  const existingWrap = findLayoutWrapper(content);
  if (existingWrap) {
    const inner = unwrapUiBlocks(existingWrap.children || []);
    existingWrap.children = patchUiBlocks(inner, cardHtml);
    setProp(existingWrap, 'display-name', PAGE_CONFIG.layoutName);
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
    } else if (block.type === 'condition') {
      dataBlocks.push(block);
    } else if (block.type !== 'simple-container') {
      dataBlocks.push(block);
    }
  }

  if (!uiBlocks.length) return content;

  const layout = simpleContainer(patchUiBlocks(uiBlocks, cardHtml), 'ass-page', PAGE_CONFIG.layoutName);
  return [...dataBlocks, layout];
}

function loadStyles() {
  const base = fs.readFileSync(BASE_STYLES_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
