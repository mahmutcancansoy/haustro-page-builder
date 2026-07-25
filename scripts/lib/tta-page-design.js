const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/tesisat-teknik-ariza-page-extensions.css'
);

const PAGE_CONFIG = {
  pageId: '645ae82bb03e3600126145b5',
  layoutName: 'Tesisat Teknik Arıza Layout',
  title: 'Tesisat Teknik Arıza',
  url: 'tesisat-teknik-ariza',
  eyebrow: 'Teknik servis',
  heroSub:
    'Açık teknik arızalar, hareketsiz talepler ve onay bekleyen kayıtların operasyon listesi.',
  chipIcon: 'pi-wrench',
  chipLabel: 'aktif talep',
  chipFallback: 'Teknik arızalar',
  sections: [
    {
      dataSource: 'overDueTechs',
      title: '3 Günden Uzun Hareketsiz Teknik Arızalar',
      sub: 'Son değişiklik üzerinden 3 günü aşmış açık talepler.',
      icon: 'pi-exclamation-triangle',
      emptyMessage: 'Hareketsiz teknik arıza bulunamadı.',
      cardClass: 'ass__list-card tta-section tta-section--overdue',
    },
    {
      dataSource: 'technicalDemands',
      title: 'Teknik Arızalar',
      sub: 'Aktif teknik arıza ve bakım taleplerinin listesi.',
      icon: 'pi-wrench',
      emptyMessage: 'Aktif teknik arıza bulunamadı.',
      cardClass: 'ass__list-card tta-section',
    },
    {
      dataSource: 'technicalDemands9',
      title: 'Onay Bekleyenler',
      sub: 'Arıza giderildi — şube onayı bekleyen talepler.',
      icon: 'pi-check-circle',
      emptyMessage: 'Onay bekleyen talep bulunamadı.',
      cardClass: 'ass__list-card tta-section tta-section--approval',
    },
  ],
};

const PERSONEL_PAGE_CONFIG = {
  pageId: '64807f49b03e3605033bd292',
  layoutName: 'Tesisat Teknik Arıza Personel Layout',
  title: 'Tesisler Teknik Arıza (Personel)',
  url: 'tesisat-teknik-ariza-personel',
  eyebrow: 'Teknik servis · Personel',
  heroSub: 'Size atanan açık teknik arıza taleplerinin listesi.',
  chipIcon: 'pi-user',
  chipLabel: 'atanan talep',
  chipFallback: 'Atanan talepler',
  sections: [
    {
      dataSource: 'technicalDemands',
      title: 'Atanan Teknik Arızalar',
      sub: 'Teknisyen olarak üzerinizde açık olan talepler.',
      icon: 'pi-wrench',
      emptyMessage: 'Atanan teknik arıza bulunamadı.',
      cardClass: 'ass__list-card tta-section',
    },
  ],
};

const SUBE_PAGE_CONFIG = {
  pageId: '6481b043b03e3605e056f538',
  layoutName: 'Tesisat Teknik Arıza Şube Layout',
  title: 'Tesisat Teknik Arıza',
  url: 'tesisat-teknik-ariza-sube',
  eyebrow: 'Teknik servis · Şube',
  heroSub: '{{departments.label}} — şube teknik arıza taleplerinin listesi.',
  chipIcon: 'pi-building',
  chipLabel: 'açık talep',
  chipFallback: 'Şube talepleri',
  activeSection: {
    title: 'Açık Teknik Arızalar',
    sub: 'Şubenize ait tamamlanmamış teknik arıza talepleri.',
    icon: 'pi-wrench',
    emptyMessage: 'Açık teknik arıza bulunamadı.',
    cardClass: 'ass__list-card tta-section',
  },
  archiveFilterSection: {
    title: 'Arşiv filtresi',
    sub: 'Tarih aralığı seçerek giderilmiş talepleri listeleyin.',
    icon: 'pi-calendar',
    cardClass: 'ass__list-card tta-section tta-section--filter',
  },
  archiveResultSection: {
    title: 'Arşiv sonuçları',
    sub: 'Seçilen tarih aralığındaki giderilmiş talepler.',
    icon: 'pi-history',
    emptyMessage: 'Arşiv kaydı bulunamadı.',
    cardClass: 'ass__list-card tta-section tta-section--approval',
  },
};

const SECTIONS = PAGE_CONFIG.sections;

const STATUS_DEFS = [
  {
    name: 'status 0',
    condition: '"{{input.status}}" == "0"',
    text: 'Beklemede',
    className: 'tta-status tta-status--pending',
  },
  {
    name: 'status 1',
    condition: '"{{input.status}}" == "1"',
    text: 'Teknisyen Atandı',
    className: 'tta-status tta-status--assigned',
  },
  {
    name: 'status 2',
    condition: '"{{input.status}}" == "2"',
    text: 'Arıza İnceleniyor',
    className: 'tta-status tta-status--inspect',
  },
  {
    name: 'status 3',
    condition: '"{{input.status}}" == "3"',
    text: 'Teklif Bekleniyor',
    className: 'tta-status tta-status--waiting',
  },
  {
    name: 'status 4',
    condition: '"{{input.status}}" == "4"',
    text: 'Onay Bekleniyor',
    className: 'tta-status tta-status--approval',
  },
  {
    name: 'status 5',
    condition: '"{{input.status}}" == "5"',
    text: 'Servis Bekleniyor',
    className: 'tta-status tta-status--waiting',
  },
  {
    name: 'status 6',
    condition: '"{{input.status}}" == "6"',
    text: 'Parça Bekleniyor',
    className: 'tta-status tta-status--waiting',
  },
  {
    name: 'status 7',
    condition: '"{{input.status}}" == "7"',
    text: 'Onarım Sürecinde',
    className: 'tta-status tta-status--progress',
  },
  {
    name: 'status 8',
    condition: '"{{input.status}}" == "8"',
    text: 'Arıza Giderildi',
    className: 'tta-status tta-status--done',
  },
  {
    name: 'status 9',
    condition: '"{{input.status}}" == "9"',
    text: 'Arıza Giderildi (Onay Bekliyor)',
    className: 'tta-status tta-status--approval',
  },
  {
    name: 'status 10',
    condition: '"{{input.status}}" == "10"',
    text: 'Onarımı Planlandı',
    className: 'tta-status tta-status--planned',
  },
];

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
  if (!block.properties) block.properties = [];
  block.properties.push({
    key,
    header: key,
    type: key === 'classes' ? 'textarea-property' : 'input-text-property',
    value,
  });
}

function appendClass(block, key, className) {
  const current = String(propVal(block, key) || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, key, `${current} ${className}`.trim());
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function walkBlocks(nodes, fn) {
  for (const node of nodes || []) {
    fn(node);
    walkBlocks(node.children, fn);
  }
}

function findColumn(nodes, name) {
  for (const n of nodes || []) {
    if (
      n.type === 'table-column' &&
      (propVal(n, 'display-name') === name || propVal(n, 'header') === name)
    ) {
      return n;
    }
    const found = findColumn(n.children, name);
    if (found) return found;
  }
  return null;
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

function heroBlock(config) {
  const eyebrow = config.eyebrow || 'Teknik servis';
  const chipIcon = config.chipIcon || 'pi-wrench';
  const chipLabel = config.chipLabel || 'aktif talep';
  const chipFallback = config.chipFallback || 'Teknik arızalar';
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__hero tta-hero">
  <div class="ass__hero-main">
    <span class="ass__eyebrow">${eyebrow}</span>
    <h1>${config.title}</h1>
    <p class="ass__hero-sub">${config.heroSub}</p>
  </div>
  <div class="ass__hero-meta">
    {{#if technicalDemands.length}}
      <span class="ass__chip"><i class="pi ${chipIcon}"></i> {{technicalDemands.length}} ${chipLabel}</span>
    {{else}}
      <span class="ass__chip"><i class="pi ${chipIcon}"></i> ${chipFallback}</span>
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

function listHeadBlock(section) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi ${section.icon}"></i></div>
  <div>
    <h2>${section.title}</h2>
    <p>${section.sub}</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: `${section.title} başlık`,
      },
    ],
  };
}

function buildStatusLabel(templateLabel, text, className) {
  const label = deepClone(templateLabel);
  setProp(label, 'display-name', text);
  setProp(label, 'text', text);
  setProp(label, 'classes', className);

  const styles = prop(label, 'styles');
  if (styles?.children) {
    for (const child of styles.children) {
      if (child.key === 'font-size') child.value = '';
      if (child.key === 'color') child.value = '';
    }
  }
  if (Object.prototype.hasOwnProperty.call(label, 'paddings')) {
    label.paddings = [0, 0, 0, 0];
  }
  if (Object.prototype.hasOwnProperty.call(label, 'margins')) {
    label.margins = [0, 0, 0, 0];
  }
  const spacings = prop(label, 'spacings');
  if (spacings) {
    spacings.paddings = [0, 0, 0, 0];
    spacings.margins = [0, 0, 0, 0];
  }

  return label;
}

function buildStatusCondition(templateCondition, def, labelTemplate) {
  const condition = deepClone(templateCondition);
  setProp(condition, 'display-name', def.name);
  setProp(condition, 'condition', def.condition);
  condition.children = [
    buildStatusLabel(labelTemplate, def.text, def.className),
  ];
  return condition;
}

function replaceStatusColumn(table) {
  const column =
    findColumn([table], 'Durumu') || findColumn([table], 'Durum');
  if (!column) return;

  const firstCondition = (column.children || []).find(
    (c) => c.type === 'condition'
  );
  const labelTemplate =
    (firstCondition?.children || []).find((c) => c.type === 'label') || null;
  if (!labelTemplate) return;

  const templateCondition = firstCondition || {
    type: 'condition',
    isContainer: true,
    children: [],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'status',
      },
      {
        key: 'condition',
        header: 'Condition',
        type: 'textarea-property',
        value: 'true',
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

  column.children = STATUS_DEFS.map((def) =>
    buildStatusCondition(templateCondition, def, labelTemplate)
  );
}

function patchDetailButtons(nodes) {
  walkBlocks(nodes, (n) => {
    if (n.type !== 'button' || propVal(n, 'display-name') !== 'Detay') return;
    appendClass(n, 'classes', 'tta-detail-btn');
    setProp(n, 'severity', 'p-button-secondary');
    setProp(n, 'icon', 'pi pi-arrow-right');
    setProp(n, 'icon-position', 'right');
    const settings = prop(n, 'settings');
    if (settings?.value) {
      settings.value.hasIcon = true;
      settings.value.hasOutline = false;
      settings.value.textButton = false;
    }
  });
}

function patchTableContent(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'label') {
      const name = String(propVal(n, 'display-name') || '');
      if (name === 'description' || name === 'modDescription') {
        appendClass(n, 'classes', 'tta-desc');
      }
      if (name === 'departments') appendClass(n, 'classes', 'tta-dept');
      if (name === 'users') appendClass(n, 'classes', 'tta-user');
      if (name === 'datetime') appendClass(n, 'classes', 'tta-date');
    }
    patchTableContent(n.children);
  }
}

function wrapTable(table, section) {
  appendClass(table, 'classes', 'ass__data-table');
  appendClass(table, 'classes', 'tta-data-table');
  setProp(table, 'empty-message', section.emptyMessage);
  replaceStatusColumn(table);
  patchTableContent(table.children);
  patchDetailButtons([table]);
  return simpleContainer(
    [listHeadBlock(section), table],
    section.cardClass,
    `${section.title} kartı`
  );
}

function collectTables(blocks) {
  const tables = [];
  for (const b of blocks || []) {
    if (b.type === 'table') tables.push(b);
    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      const table = (b.children || []).find((c) => c.type === 'table');
      if (table) tables.push(table);
    }
  }
  return tables;
}

function patchUiBlocks(blocks, config) {
  const tables = collectTables(blocks);
  const bySource = new Map(
    tables.map((t) => [String(propVal(t, 'data-source') || ''), t])
  );

  const sections = config.sections || SECTIONS;
  const ordered = [heroBlock(config)];
  for (const section of sections) {
    const table = bySource.get(section.dataSource);
    if (table) ordered.push(wrapTable(table, section));
  }
  return ordered;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' &&
      prop(b, 'classes')?.value?.includes('ass-page')
  );
}

function unwrapUiBlocks(blocks) {
  const out = [];

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      const table = (b.children || []).find((c) => c.type === 'table');
      if (table) {
        const cls = String(propVal(table, 'classes') || '')
          .replace(/\bass__data-table\b/g, '')
          .replace(/\btta-data-table\b/g, '')
          .trim();
        setProp(table, 'classes', cls);
        out.push(table);
      }
      continue;
    }

    if (b.type === 'table') out.push(b);
  }

  return out;
}

function applyLayout(content, config = PAGE_CONFIG) {
  const next = deepClone(content);

  const existingWrap = findLayoutWrapper(next);
  if (existingWrap) {
    const inner = unwrapUiBlocks(existingWrap.children || []);
    existingWrap.children = patchUiBlocks(inner, config);
    setProp(existingWrap, 'display-name', config.layoutName);
    return next;
  }

  const dataBlocks = [];
  const uiBlocks = [];

  for (const block of next) {
    if (block.type === 'data-source') dataBlocks.push(block);
    else if (block.type === 'table') uiBlocks.push(block);
    else if (block.type === 'page-header' || block.type === 'grid') {
      // Eski toolbar / section başlıkları hero + list-head ile değişiyor
      continue;
    } else {
      dataBlocks.push(block);
    }
  }

  // Tablolar dataBlocks arasında kalmış olabilir (sıra bozulmasın diye tekrar tara)
  const allTables = [];
  for (const block of next) {
    if (block.type === 'table') allTables.push(block);
  }

  if (!allTables.length && !uiBlocks.length) return next;

  const layout = simpleContainer(
    patchUiBlocks(allTables.length ? allTables : uiBlocks, config),
    'ass-page',
    config.layoutName
  );
  return [...dataBlocks.filter((b) => b.type === 'data-source'), layout];
}

function loadStyles() {
  const base = fs.readFileSync(BASE_STYLES_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${ext}`;
}

function isDataOnlyCondition(block) {
  if (block.type !== 'condition') return false;
  const kids = block.children || [];
  return kids.length > 0 && kids.every((c) => c.type === 'data-source');
}

function findInTree(nodes, pred) {
  for (const n of nodes || []) {
    if (pred(n)) return n;
    const found = findInTree(n.children, pred);
    if (found) return found;
  }
  return null;
}

function styleTable(table, emptyMessage) {
  appendClass(table, 'classes', 'ass__data-table');
  appendClass(table, 'classes', 'tta-data-table');
  if (emptyMessage) setProp(table, 'empty-message', emptyMessage);
  replaceStatusColumn(table);
  patchTableContent(table.children);
  patchDetailButtons([table]);
}

function styleFilterButton(nodes) {
  walkBlocks(nodes, (n) => {
    if (n.type !== 'button') return;
    if (String(propVal(n, 'text') || '') !== 'Filtrele') return;
    appendClass(n, 'classes', 'tta-filter-btn');
    setProp(n, 'severity', 'p-button-primary');
    setProp(n, 'icon', 'pi pi-filter');
    setProp(n, 'icon-position', 'left');
    const settings = prop(n, 'settings');
    if (settings?.value) {
      settings.value.hasIcon = true;
      settings.value.hasOutline = false;
      settings.value.textButton = false;
    }
  });
}

function unwrapListCards(nodes) {
  const out = [];
  for (const child of nodes || []) {
    if (
      child.type === 'simple-container' &&
      String(propVal(child, 'classes') || '').includes('ass__list-card')
    ) {
      for (const inner of child.children || []) {
        if (inner.type === 'render-template') continue;
        if (inner.type === 'table') {
          const cls = String(propVal(inner, 'classes') || '')
            .replace(/\bass__data-table\b/g, '')
            .replace(/\btta-data-table\b/g, '')
            .trim();
          setProp(inner, 'classes', cls);
        }
        out.push(inner);
      }
      continue;
    }
    if (child.type === 'condition') {
      child.children = unwrapListCards(child.children);
      out.push(child);
      continue;
    }
    out.push(child);
  }
  return out;
}

function styleArchiveUiCondition(condition, config) {
  const form = (condition.children || []).find(
    (c) => c.type === 'form-container'
  );
  const nested = (condition.children || []).find((c) => c.type === 'condition');
  const nextChildren = [];

  if (form) {
    styleFilterButton([form]);
    appendClass(form, 'classes', 'tta-archive-form');
    nextChildren.push(
      simpleContainer(
        [listHeadBlock(config.archiveFilterSection), form],
        config.archiveFilterSection.cardClass,
        'Arşiv filtresi kartı'
      )
    );
  }

  if (nested) {
    const dataSources = (nested.children || []).filter(
      (c) => c.type === 'data-source'
    );
    const table = (nested.children || []).find((c) => c.type === 'table');
    if (table) {
      styleTable(table, config.archiveResultSection.emptyMessage);
      nested.children = [
        ...dataSources,
        simpleContainer(
          [listHeadBlock(config.archiveResultSection), table],
          config.archiveResultSection.cardClass,
          'Arşiv sonuçları kartı'
        ),
      ];
    }
    nextChildren.push(nested);
  }

  condition.children = nextChildren;
  return condition;
}

function styleActiveUiCondition(condition, config) {
  const table = (condition.children || []).find((c) => c.type === 'table');
  if (!table) return condition;
  styleTable(table, config.activeSection.emptyMessage);
  condition.children = [
    simpleContainer(
      [listHeadBlock(config.activeSection), table],
      config.activeSection.cardClass,
      'Açık teknik arızalar kartı'
    ),
  ];
  return condition;
}

function applySubeLayout(content, config = SUBE_PAGE_CONFIG) {
  const next = deepClone(content);

  const existingWrap = findLayoutWrapper(next);
  let working = next;
  if (existingWrap) {
    const restoredUi = unwrapListCards(existingWrap.children || []).filter(
      (b) => b.type === 'condition'
    );
    working = [
      ...next.filter((b) => b !== existingWrap),
      ...restoredUi,
    ];
  }

  const dataBlocks = [];
  let archiveUi = null;
  let activeUi = null;

  for (const block of working) {
    if (block.type === 'data-source' || isDataOnlyCondition(block)) {
      dataBlocks.push(block);
      continue;
    }
    if (block.type === 'grid' || block.type === 'page-header') continue;
    if (block.type !== 'condition') {
      dataBlocks.push(block);
      continue;
    }

    const hasForm = Boolean(
      findInTree([block], (n) => n.type === 'form-container')
    );
    const hasTable = Boolean(findInTree([block], (n) => n.type === 'table'));
    const cond = String(propVal(block, 'condition') || '');

    if (hasForm || cond.includes('"archive"')) {
      archiveUi = block;
    } else if (hasTable) {
      activeUi = block;
    } else {
      dataBlocks.push(block);
    }
  }

  if (archiveUi) styleArchiveUiCondition(archiveUi, config);
  if (activeUi) styleActiveUiCondition(activeUi, config);

  const layoutChildren = [heroBlock(config)];
  if (archiveUi) layoutChildren.push(archiveUi);
  if (activeUi) layoutChildren.push(activeUi);

  const layout = simpleContainer(
    layoutChildren,
    'ass-page',
    config.layoutName
  );
  return [...dataBlocks, layout];
}

module.exports = {
  PAGE_CONFIG,
  PERSONEL_PAGE_CONFIG,
  SUBE_PAGE_CONFIG,
  SECTIONS,
  STATUS_DEFS,
  applyLayout,
  applySubeLayout,
  loadStyles,
  deepClone,
  prop,
  propVal,
  setProp,
};
