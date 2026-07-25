const fs = require('fs');
const path = require('path');

const STYLES_FILE = path.join(
  __dirname,
  '../../templates/denetleme-raporu-ozeti-page-styles.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/denetleme-raporu-ozeti-hero.html'
);
const HEAD_FILE = path.join(
  __dirname,
  '../../templates/denetleme-raporu-ozeti-page-head.html'
);

const PAGE_CONFIG = {
  pageId: '658aa9bfb03e360a944da502',
  layoutName: 'Denetleme Raporu Özeti Layout',
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

function appendClass(block, key, className) {
  const current = String(propVal(block, key) || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, key, `${current} ${className}`.trim());
  }
}

function clearGridBg(grid) {
  const bg = prop(grid, 'bg');
  const colorProp = bg?.children?.find((c) => c.key === 'color');
  if (colorProp) colorProp.value = 'rgba(0,0,0,0)';
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

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content,
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

function loadHeroHtml() {
  return fs.readFileSync(HERO_FILE, 'utf8').trim();
}

function loadHeadHtml() {
  return fs.readFileSync(HEAD_FILE, 'utf8').trim();
}

function pageHeadBlock() {
  return makeRenderTemplate(loadHeadHtml(), 'Sayfa üst navigasyon');
}

function heroBlock() {
  return makeRenderTemplate(loadHeroHtml(), 'Dönem hero');
}

function patchHeroGrid(grid) {
  setGridClass(grid, 'dro-hero-grid');
  clearGridBg(grid);

  const col = (grid.children || []).find((c) => c.type === 'column');
  if (!col) return;

  const labelIdx = (col.children || []).findIndex(
    (c) => c.type === 'label' && propVal(c, 'display-name') === 'Header'
  );
  if (labelIdx >= 0) {
    col.children[labelIdx] = heroBlock();
  }
}

function patchSummaryForm(formContainer) {
  for (const child of formContainer.children || []) {
    if (child.type !== 'label') continue;
    appendClass(child, 'classes', 'dro-summary-row');
    setProp(child, 'display-name', propVal(child, 'display-name') || 'Özet satırı');
  }
}

function patchAreaLabels(blocks) {
  for (const b of blocks || []) {
    if (b.type === 'label') {
      const text = String(propVal(b, 'text') || '');
      const action = String(propVal(b, 'action') || '');
      const formLabel = String(propVal(b, 'label') || '');

      if (text === 'Görüntüle' && action === 'route') {
        appendClass(b, 'classes', 'dro-area-action');
      } else if (text === 'Kaydedilmedi') {
        appendClass(b, 'classes', 'dro-area-missing');
      }
    }
    patchAreaLabels(b.children);
  }
}

function patchFormBlockGrid(grid) {
  setGridClass(grid, 'dro-card-grid');
  clearGridBg(grid);

  for (const col of grid.children || []) {
    const form = (col.children || []).find((c) => c.type === 'form-container');
    if (!form) continue;

    const name = propVal(form, 'display-name');
    if (name === 'Form 1') {
      enableSetting(col, 'customClasses');
      appendClass(col, 'custom-classes', 'dro-summary-col');
      patchSummaryForm(form);
    }
    if (name === 'Rapor Türü Seçme Formu') {
      enableSetting(col, 'customClasses');
      appendClass(col, 'custom-classes', 'dro-areas-col');
      patchAreaLabels(form.children);
    }
  }
}

function patchLoop(loop) {
  const product = (loop.children || []).find(
    (g) => g.type === 'grid' && propVal(g, 'display-name') === 'Product Block'
  );
  const form = (loop.children || []).find(
    (g) => g.type === 'grid' && propVal(g, 'display-name') === 'Form Block'
  );

  if (product) patchHeroGrid(product);
  if (form) patchFormBlockGrid(form);

  if (product && form) {
    loop.children = [
      simpleContainer([product, form], 'dro-report', 'Rapor dönemi kartı'),
    ];
  }
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('dro-page')
  );
}

function unwrapLayout(content) {
  const wrap = findLayoutWrapper(content);
  if (!wrap) return content;

  const out = [];
  for (const block of content) {
    if (block === wrap) {
      for (const child of wrap.children || []) {
        if (child.type === 'render-template') continue;
        if (
          child.type === 'simple-container' &&
          String(propVal(child, 'classes') || '').includes('dro-report')
        ) {
          out.push(...(child.children || []));
        } else if (child.type === 'loop') {
          const loop = JSON.parse(JSON.stringify(child));
          if ((loop.children || []).length === 1) {
            const reportWrap = loop.children[0];
            if (
              reportWrap.type === 'simple-container' &&
              String(propVal(reportWrap, 'classes') || '').includes('dro-report')
            ) {
              loop.children = reportWrap.children || [];
            }
          }
          out.push(loop);
        } else {
          out.push(child);
        }
      }
    } else {
      out.push(block);
    }
  }
  return out;
}

function applyLayout(content) {
  const existingWrap = findLayoutWrapper(content);
  if (existingWrap) {
    const restored = unwrapLayout(JSON.parse(JSON.stringify(content)));
    return applyLayout(restored);
  }

  const dataBlocks = content.filter((b) => b.type === 'data-source');
  const loop = content.find((b) => b.type === 'loop');
  if (!loop) return content;

  const loopCopy = JSON.parse(JSON.stringify(loop));
  patchLoop(loopCopy);

  const layout = simpleContainer(
    [pageHeadBlock(), loopCopy],
    'dro-page',
    PAGE_CONFIG.layoutName
  );

  return [...dataBlocks, layout];
}

function loadStyles() {
  return fs.readFileSync(STYLES_FILE, 'utf8').trim();
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
