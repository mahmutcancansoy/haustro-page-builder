const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/bekleyen-hareketler-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/bekleyen-hareketler-hero.html'
);

const PAGE_CONFIG = {
  pageId: '6074cf3598373700117238c2',
  layoutName: 'Bekleyen Hareketler Layout',
  url: 'bekleyen-hareketler',
};

const SECTION_ICONS = {
  myPurchasesCount: 'pi pi-shopping-cart',
  purchaseChainPendingCount: 'pi pi-check-square',
  purchaseOffersApprovedCount: 'pi pi-check-circle',
  purchaseFollowupCount: 'pi pi-send',
  offersCount: 'pi pi-file',
  pendingOffersCount: 'pi pi-wallet',
  missingOffersCount: 'pi pi-exclamation-triangle',
  'Muhasebe Rol Kontrolü': 'pi pi-book',
  'Monthly Cost Reports Kontrolü': 'pi pi-chart-bar',
  'Yaklaşan Bakımlar Kontrolü': 'pi pi-cog',
  'Operasyon Check List Kontrolü': 'pi pi-list',
  'İzin Talepleri Kontrolü': 'pi pi-calendar',
  'Teknik Talep Kontrolü': 'pi pi-cog',
  'Sözleşmeli Fatura Onayı': 'pi pi-file',
  'Departman Limit Talebi': 'pi pi-briefcase',
};

const SECTION_TITLES = {
  myPurchasesCount: 'Satın Alımlarım',
  purchaseChainPendingCount: 'Onay Bekleyen Satın Alımlar',
  purchaseOffersApprovedCount: 'Onaylanan Teklifler',
  purchaseFollowupCount: 'Takipteki Satın Alımlar',
  offersCount: 'Teklifler',
  pendingOffersCount: 'Bekleyen Teklifler',
  missingOffersCount: 'Eksik Teklifler',
  'Monthly Cost Reports Kontrolü': 'Aylık Maliyet Raporları',
};

function isCodeTitle(value) {
  const title = String(value || '').trim();
  if (!title) return true;
  if (Object.prototype.hasOwnProperty.call(SECTION_TITLES, title)) return true;
  return /^[a-z]+[A-Z]/.test(title) && !/\s/.test(title);
}

function extractListHeadTitle(nodes) {
  let found = '';
  function walk(list) {
    for (const n of list || []) {
      if (n.type === 'render-template') {
        const html = String(n.content || '');
        if (html.includes('ass__list-head')) {
          const match = html.match(/<h2>([^<]*)<\/h2>/);
          if (match) found = match[1].trim();
        }
      }
      walk(n.children);
    }
  }
  walk(nodes);
  return found;
}

function resolveSectionTitle(name, extracted) {
  if (extracted && !isCodeTitle(extracted)) return extracted;
  if (SECTION_TITLES[name]) return SECTION_TITLES[name];
  if (extracted && SECTION_TITLES[extracted]) return SECTION_TITLES[extracted];
  return extracted || name || 'Bekleyen kayıtlar';
}

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
    header:
      key === 'classes'
        ? 'Classes'
        : key === 'custom-classes'
          ? 'Custom classes'
          : key,
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
    content: String(html || '').trim(),
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

function listHeadBlock(title, icon) {
  const safeTitle = String(title || 'Bekleyen kayıtlar');
  const safeIcon = icon || 'pi pi-inbox';
  return renderTemplate(
    'Liste başlık',
    `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="${safeIcon}"></i></div>
  <div>
    <h2>${safeTitle}</h2>
    <p>Kayıtları kontrol edin; gerekirse detaya gidin veya işlemi tamamlayın.</p>
  </div>
</div>`
  );
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

function purchaseDetailHref() {
  return '/d/{{#cIf purchaseType "==" "service"}}hizmet-satin-alim-detayi{{else}}satin-alim-detayi{{/cIf}}?_id={{_id}}';
}

function purchaseCardHtml(eachExpr) {
  const href = purchaseDetailHref();
  return `<div class="bh-list">
  ${eachExpr}
  <a href="${href}" router-link="${href}" class="bh-card bh-card--{{status}}">
    <div class="bh-card-icon bh-card-icon--{{purchaseType}}">
      <i class="pi pi-shopping-cart bh-icon-default"></i>
      <i class="pi pi-th-large bh-icon-inventory"></i>
      <i class="pi pi-cog bh-icon-service"></i>
    </div>
    <div class="bh-card-main">
      <div class="bh-card-top">
        <h3>{{#if description}}{{description}}{{else}}Talep Belirtilmedi{{/if}}</h3>
        <span class="bh-badge"></span>
      </div>
      <div class="bh-card-meta">
        <span><i class="pi pi-home"></i> {{#if :departments:.label}}{{:departments:.label}}{{else}}{{:departments:}}{{/if}}</span>
        <span><i class="pi pi-user"></i> {{#if :users:demander.name}}{{:users:demander.name}} {{:users:demander.surname}}{{else}}{{:users:demander}}{{/if}}</span>
        <span class="bh-card-count"><i class="pi pi-th-large"></i> {{count}} Adet</span>
      </div>
    </div>
    <div class="bh-card-side">
      <span>{{renderDate datetime}}</span>
      <i class="pi pi-chevron-right"></i>
    </div>
  </a>
  {{else}}
  <div class="bh-empty">Bekleyen bildirim bulunmamaktadır.</div>
  {{/each}}
</div>`;
}

function restylePurchaseHtml(html) {
  const src = String(html || '');
  const each = (src.match(/\{\{#each [^}]+\}\}/) || [])[0];
  if (!each) return src;
  return purchaseCardHtml(each);
}

function styleButtons(root) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button') {
        const text = String(propVal(n, 'text') || '');
        if (text === 'Görüntüle') {
          applyButton(n, {
            classes: 'bh-view-btn',
            severity: 'p-button-secondary',
            size: 'p-button-sm',
            icon: 'pi pi-arrow-right',
            iconPosition: 'right',
            settings: { hasIcon: true, textButton: false },
          });
        } else if (text === 'Okundu') {
          applyButton(n, {
            classes: 'bh-read-btn',
            severity: 'p-button-success',
            size: 'p-button-sm',
            icon: 'pi pi-check',
            iconPosition: 'left',
            settings: { hasIcon: true, textButton: false },
          });
        } else if (text === 'Onayla') {
          applyButton(n, {
            classes: 'bh-approve-btn',
            severity: 'p-button-success',
            size: 'p-button-sm',
            icon: 'pi pi-check',
            iconPosition: 'left',
            settings: { hasIcon: true, textButton: false },
          });
        } else if (text === 'Departman Limitleri') {
          applyButton(n, {
            classes: 'bh-limits-btn',
            severity: 'p-button-default',
            size: 'p-button-sm',
            icon: 'pi pi-external-link',
            iconPosition: 'left',
            settings: { hasIcon: true, textButton: false },
          });
        }
      }
      walk(n.children);
    }
  }
  walk(Array.isArray(root) ? root : [root]);
}

function flattenNodes(nodes) {
  const out = [];
  for (const n of nodes || []) {
    if (n.type === 'grid' || n.type === 'column') {
      out.push(...flattenNodes(n.children));
      continue;
    }
    if (
      n.type === 'simple-container' &&
      String(propVal(n, 'classes') || '').includes('ass__list-card')
    ) {
      for (const inner of n.children || []) {
        if (
          inner.type === 'render-template' &&
          propVal(inner, 'display-name') === 'Liste başlık'
        ) {
          continue;
        }
        out.push(inner);
      }
      continue;
    }
    if (
      n.type === 'simple-container' &&
      !String(propVal(n, 'classes') || '').trim()
    ) {
      out.push(...flattenNodes(n.children));
      continue;
    }
    out.push(n);
  }
  return out;
}

function wrapCondition(cond) {
  const name = String(propVal(cond, 'display-name') || '');
  const rawCond = String(propVal(cond, 'condition') || '').trim();
  if (name === 'Header hidden' || rawCond === 'false') return cond;

  const flat = flattenNodes(cond.children || []);
  const data = [];
  const body = [];
  let title = extractListHeadTitle(cond.children || []);

  for (const n of flat) {
    if (n.type === 'data-source') {
      data.push(n);
      continue;
    }
    if (n.type === 'page-header') {
      hidePageHeader(n);
      continue;
    }
    if (n.type === 'content-header') {
      title = String(propVal(n, 'text') || propVal(n, 'display-name') || title);
      continue;
    }
    if (n.type === 'render-template') {
      if (propVal(n, 'display-name') === 'Sayfa hero') continue;
      n.content = restylePurchaseHtml(n.content);
      body.push(n);
      continue;
    }
    if (n.type === 'table' || n.type === 'simple-table') {
      appendClass(n, 'classes', 'ass__data-table');
      styleButtons(n);
      body.push(n);
      continue;
    }
    if (n.type === 'button') {
      styleButtons([n]);
      body.push(n);
      continue;
    }
    body.push(n);
  }

  if (!body.length) {
    cond.children = data.length ? data : cond.children;
    return cond;
  }

  const icon = SECTION_ICONS[name] || 'pi pi-inbox';
  cond.children = [
    ...data,
    simpleContainer(
      [listHeadBlock(resolveSectionTitle(name, title), icon), ...body],
      'ass__list-card',
      name || 'Bekleyen bölüm'
    ),
  ];
  return cond;
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

function findLayoutWrapper(content) {
  return (content || []).find(
    (b) =>
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass-page')
  );
}

function applyLayout(content) {
  patchDataSources(content);

  const existingWrap = findLayoutWrapper(content);
  const source = existingWrap ? existingWrap.children || [] : content;

  const dataBlocks = [];
  const uiBlocks = [];
  for (const block of source) {
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (
      block.type === 'render-template' &&
      propVal(block, 'display-name') === 'Sayfa hero'
    ) {
      continue;
    } else if (block.type === 'grid') {
      continue;
    } else {
      uiBlocks.push(block);
    }
  }

  const processed = uiBlocks.map((b) =>
    b.type === 'condition' ? wrapCondition(b) : b
  );

  const layout = simpleContainer(
    [heroBlock(), ...processed],
    'ass-page',
    PAGE_CONFIG.layoutName
  );

  if (existingWrap) {
    const rootData = content.filter((b) => b.type === 'data-source');
    return [...rootData, layout];
  }

  return [...dataBlocks, layout];
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
  purchaseCardHtml,
  purchaseDetailHref,
};
