const fs = require('fs');
const path = require('path');
const { loadStyles: loadTrdStyles } = require('./trd-page-design');

const PAGE_CONFIG = {
  pageId: '69b0f0c45170eb03a1199ee2',
  sourcePageId: '600386804fe5a5011d6ca482',
};

const ACTIONS_WRAPPER_CLASS = 'ass__actions-stack';

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

function setGroupChild(groupProp, childKey, value) {
  const child = groupProp?.children?.find((c) => c.key === childKey);
  if (child) child.value = value;
}

function enableSetting(block, settingKey) {
  const settings = prop(block, 'settings');
  if (settings?.value && typeof settings.value === 'object') {
    settings.value[settingKey] = true;
  }
}

function isToolbarGrid(block) {
  if (block.type !== 'grid') return false;
  const cls = String(propVal(block, 'custom-classes') || '');
  if (cls.includes('ass__toolbar')) return true;
  const name = String(propVal(block, 'display-name') || '').toLowerCase();
  if (name.includes('toolbar')) return true;
  const btns = [];
  walkBlocks(block.children, (node) => {
    if (node.type === 'button') btns.push(String(propVal(node, 'text') || ''));
  });
  return btns.some((t) => t === 'Geri');
}

function findPageLayout(content) {
  return content.find(
    (block) =>
      block.type === 'simple-container' &&
      String(propVal(block, 'classes') || '').includes('ass-page') &&
      !String(propVal(block, 'classes') || '').includes('ass-page--beta-actions')
  );
}

function patchToolbarGrids(blocks) {
  for (const block of blocks) {
    if (!isToolbarGrid(block)) continue;
    enableSetting(block, 'customClasses');
    setProp(block, 'custom-classes', 'ass__toolbar');
  }
  return blocks;
}

function dedupeStatusBanners(blocks) {
  let kept = false;
  return blocks.filter((block) => {
    const isBanner =
      block.type === 'simple-container' &&
      String(propVal(block, 'classes') || '').includes('tdb-status-wrap');
    if (!isBanner) return true;
    if (kept) return false;
    kept = true;
    return true;
  });
}

function applyPageLayout(content) {
  const dataBlocks = content.filter((block) => block.type === 'data-source');
  const existingLayout = findPageLayout(content);

  if (existingLayout) {
    existingLayout.children = dedupeStatusBanners(existingLayout.children || []);
    patchToolbarGrids(existingLayout.children || []);
    const actions = (existingLayout.children || []).find(isActionsWrapper);
    if (actions) setProp(actions, 'classes', ACTIONS_WRAPPER_CLASS);
    setProp(existingLayout, 'display-name', 'Transfer Detay Beta Layout');
    return content;
  }

  const uiBlocks = dedupeStatusBanners(
    content
      .filter((block) => block.type !== 'data-source')
      .map((block) => {
        if (isActionsWrapper(block)) {
          const next = deepClone(block);
          setProp(next, 'classes', ACTIONS_WRAPPER_CLASS);
          return next;
        }
        return block;
      })
  );

  patchToolbarGrids(uiBlocks);

  const layout = simpleContainer(
    uiBlocks,
    'ass-page',
    'Transfer Detay Beta Layout'
  );

  return [...dataBlocks, layout];
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

function findFormByName(content, name) {
  let found = null;
  walkBlocks(content, (node) => {
    if (node.type === 'form-container' && propVal(node, 'display-name') === name) {
      found = node;
    }
  });
  return found;
}

function findAncestors(content, target) {
  const path = [];
  function walk(nodes, acc) {
    for (const node of nodes || []) {
      if (node === target) {
        path.push(...acc);
        return true;
      }
      if (walk(node.children, [...acc, node])) return true;
    }
    return false;
  }
  walk(content, []);
  return path;
}

function conditionBlock(displayName, expression, children) {
  return {
    type: 'condition',
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
        key: 'condition',
        header: 'Condition',
        type: 'textarea-property',
        value: expression,
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

function actionHeadBlock(title, description, icon) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__action-head">
  <div class="ass__action-head-icon"><i class="pi ${icon}"></i></div>
  <div>
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: `${title} başlık`,
      },
    ],
  };
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

function extractApprovalCondition(sourceContent) {
  const onaylaForm = findFormByName(sourceContent, 'onayla');
  if (!onaylaForm) {
    throw new Error('transfer-detayi içinde onayla formu bulunamadı');
  }

  const ancestors = findAncestors(sourceContent, onaylaForm);
  const statusCheck = ancestors
    .filter((node) => node.type === 'condition')
    .find(
      (node) =>
        propVal(node, 'display-name') === 'status check' &&
        String(propVal(node, 'condition')).includes('== 0')
    );

  if (!statusCheck) {
    throw new Error('onay status check (status == 0) bulunamadı');
  }

  return deepClone(statusCheck);
}

function extractDeliveryActionCards(sourceContent) {
  const cards = [];
  walkBlocks(sourceContent, (node) => {
    if (node.type !== 'simple-container') return;
    if (!String(propVal(node, 'classes') || '').includes('ass__action-card')) return;

    const name = String(propVal(node, 'display-name') || '');
    if (name.includes('Teslim Aldım') || name.includes('Teslim Ettim')) {
      cards.push(deepClone(node));
    }
  });

  if (cards.length !== 2) {
    throw new Error(`Teslim kartları eksik (bulunan: ${cards.length})`);
  }

  return cards;
}

function buildRejectForm(onaylaForm) {
  const form = deepClone(onaylaForm);
  setProp(form, 'display-name', 'reddet');
  setProp(
    form,
    'hidden-values',
    '{\n    "transferId" : "{{transfers._id}}",\n    "operationType" : "reject"\n}'
  );
  patchFormStayAndReload(form);

  const msg = prop(form, 'on-success-message');
  if (msg?.children) {
    setGroupChild(msg, 'header', 'Reddedildi');
    setGroupChild(msg, 'text', 'Transfer talebi reddedildi.');
  }

  walkBlocks([form], (node) => {
    if (node.type === 'input-text' && propVal(node, 'name') === 'confirmDescription') {
      setProp(node, 'name', 'rejectDescription');
      setProp(node, 'display-name', 'Red sebebi');
      setProp(node, 'label', 'Red sebebi:');
      setProp(node, 'placeholder', 'Red sebebini yazın');

      const validators = prop(node, 'validators');
      const options = validators?.children?.find((c) => c.key === 'options');
      if (options?.value) {
        options.value.required = true;
      }
    }

    if (node.type === 'button' && propVal(node, 'text') === 'Onayla') {
      setProp(node, 'display-name', 'Reddet');
      setProp(node, 'text', 'Reddet');
      setProp(node, 'severity', 'p-button-danger');
    }
  });

  return form;
}

function cleanApprovalStatusCondition(statusCondition) {
  const cleaned = deepClone(statusCondition);
  cleaned.children = (cleaned.children || []).filter((child) => child.type !== 'label');
  return cleaned;
}

function patchApprovalCardShell(approvalCard) {
  setProp(approvalCard, 'classes', 'ass__action-card ass__action-card--approval');

  walkBlocks(approvalCard.children || [], (node) => {
    if (node.type === 'condition' && propVal(node, 'display-name') === 'status check') {
      node.children = (node.children || []).filter((child) => child.type !== 'label');
    }

    if (
      node.type === 'input-text' &&
      ['confirmDescription', 'rejectDescription'].includes(propVal(node, 'name'))
    ) {
      setProp(node, 'width', '100%');
    }
  });

  return approvalCard;
}

function patchApprovalWithReject(approvalCard) {
  patchApprovalCardShell(approvalCard);

  const onaylaForm = findFormByName([approvalCard], 'onayla');
  if (!onaylaForm) return approvalCard;

  if (findFormByName([approvalCard], 'reddet')) return approvalCard;

  const ancestors = findAncestors(approvalCard.children || [], onaylaForm);
  const roleCheck = ancestors
    .filter((node) => node.type === 'condition')
    .find((node) => propVal(node, 'display-name') === 'role check');

  if (!roleCheck) return approvalCard;

  roleCheck.children = [...(roleCheck.children || []), buildRejectForm(onaylaForm)];

  walkBlocks(approvalCard.children || [], (node) => {
    if (node.type !== 'render-template') return;
    if (!String(node.content || '').includes('Transfer Onayı')) return;
    node.content = `<div class="ass__action-head">
  <div class="ass__action-head-icon"><i class="pi pi-check"></i></div>
  <div>
    <h2>Transfer Onayı</h2>
    <p>Transfer talebini onaylayın veya reddedin; açıklama ekleyin.</p>
  </div>
</div>`;
  });

  return approvalCard;
}

function isDeliveryVisibilityWrapper(block) {
  return (
    block.type === 'condition' &&
    String(propVal(block, 'display-name') || '').includes('görünürlük')
  );
}

function wrapDeliveryCardVisibility(card) {
  if (isDeliveryVisibilityWrapper(card)) return card;

  const innerCondition = (card.children || []).find((child) => child.type === 'condition');
  if (!innerCondition) return card;

  const expression = propVal(innerCondition, 'condition');
  const form = (innerCondition.children || []).find(
    (child) => child.type === 'form-container'
  );
  const head = (card.children || []).find((child) => child.type === 'render-template');
  if (!expression || !form) return card;

  const formName = propVal(form, 'display-name') || propVal(card, 'display-name');
  const unwrappedCard = deepClone(card);
  unwrappedCard.children = [head, form].filter(Boolean);

  return conditionBlock(`${formName} görünürlük`, expression, [unwrappedCard]);
}

function buildApprovalActionCard(statusCondition) {
  const statusCheck = cleanApprovalStatusCondition(statusCondition);
  statusCheck.children = [
    actionHeadBlock(
      'Transfer Onayı',
      'Transfer talebini onaylayın veya reddedin; açıklama ekleyin.',
      'pi-check'
    ),
    ...(statusCheck.children || []),
  ];
  const card = simpleContainer(
    [statusCheck],
    'ass__action-card ass__action-card--approval',
    'onayla kartı'
  );
  return wrapApprovalVisibility(patchApprovalWithReject(card));
}

function patchFormStayAndReload(form) {
  if (!form) return;
  // Panelde query-params yalnızca on-success=route iken uygulanır.
  // redirect kullanırken _id URL'ye gömülmeli; aksi halde /d/transfer-detay-beta
  // paramsız açılır ve 404 döner.
  setProp(form, 'on-success', 'redirect');
  setProp(form, 'url', '/d/transfer-detay-beta?_id={{transfers._id}}');
  setProp(form, 'query-params', '{\n    "_id": "{{transfers._id}}"\n}');
}

function patchOnaylaRedirect(approvalCard) {
  patchFormStayAndReload(findFormByName([approvalCard], 'onayla'));
}

function isEmptyStubForm(block) {
  return (
    block.type === 'form-container' &&
    propVal(block, 'display-name') === 'New Form Container 1' &&
    !(block.children || []).length
  );
}

function isActionsWrapper(block) {
  if (block.type !== 'simple-container') return false;
  const cls = String(propVal(block, 'classes') || '');
  return cls.includes('ass__actions-stack') || cls.includes('ass-page--beta-actions');
}

function buildActionsWrapper(cards) {
  return simpleContainer(cards, ACTIONS_WRAPPER_CLASS, 'Transfer işlemleri');
}

function isApprovalVisibilityWrapper(block) {
  return (
    block.type === 'condition' &&
    String(propVal(block, 'display-name') || '').includes('Transfer Onayı görünürlük')
  );
}

function moveApprovalHeadInsideStatus(approvalCard) {
  const children = approvalCard.children || [];
  const headIdx = children.findIndex(
    (c) =>
      c.type === 'render-template' && String(c.content || '').includes('Transfer Onayı')
  );
  const statusCheck = children.find(
    (c) => c.type === 'condition' && propVal(c, 'display-name') === 'status check'
  );
  if (headIdx < 0 || !statusCheck) return;

  const [head] = children.splice(headIdx, 1);
  const alreadyHasHead = (statusCheck.children || []).some(
    (c) =>
      c.type === 'render-template' && String(c.content || '').includes('Transfer Onayı')
  );
  if (!alreadyHasHead) {
    statusCheck.children = [head, ...(statusCheck.children || [])];
  }
}

function wrapApprovalVisibility(approvalCard) {
  if (isApprovalVisibilityWrapper(approvalCard)) {
    const inner = (approvalCard.children || []).find(
      (c) =>
        c.type === 'simple-container' &&
        String(propVal(c, 'display-name') || '').includes('onayla kartı')
    );
    if (inner) moveApprovalHeadInsideStatus(inner);
    return approvalCard;
  }

  moveApprovalHeadInsideStatus(approvalCard);
  return conditionBlock(
    'Transfer Onayı görünürlük',
    '"{{transfers.status}}" == 0',
    [approvalCard]
  );
}

function enhanceActionCards(cards) {
  return cards.map((card) => {
    const name = String(propVal(card, 'display-name') || '');
    if (isApprovalVisibilityWrapper(card)) {
      const approvalCard = (card.children || []).find(
        (c) =>
          c.type === 'simple-container' &&
          String(propVal(c, 'display-name') || '').includes('onayla kartı')
      );
      if (approvalCard) {
        patchOnaylaRedirect(approvalCard);
        patchApprovalWithReject(approvalCard);
        moveApprovalHeadInsideStatus(approvalCard);
      }
      return card;
    }
    if (name.includes('onayla kartı')) {
      patchOnaylaRedirect(card);
      return wrapApprovalVisibility(patchApprovalWithReject(card));
    }
    if (name.includes('Teslim')) {
      return wrapDeliveryCardVisibility(card);
    }
    if (isDeliveryVisibilityWrapper(card)) {
      return card;
    }
    return card;
  });
}

function applyActions(betaContent, approvalCard, deliveryCards) {
  const cards = enhanceActionCards([approvalCard, ...deliveryCards]);
  const withoutStub = betaContent.filter((block) => !isEmptyStubForm(block));
  const existingIdx = withoutStub.findIndex(isActionsWrapper);

  if (existingIdx >= 0) {
    const next = [...withoutStub];
    next[existingIdx] = buildActionsWrapper(cards);
    return next;
  }

  return [...withoutStub, buildActionsWrapper(cards)];
}

function loadHtmlTemplate(fileName) {
  return fs
    .readFileSync(path.join(__dirname, '../../templates', fileName), 'utf8')
    .trim();
}

function buildRenderBlock(displayName, html) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: html,
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

function buildStatusBannerBlock() {
  return simpleContainer(
    [buildRenderBlock('Transfer durumu', loadHtmlTemplate('transfer-detay-beta-status-banner.html'))],
    'tdb-status-wrap',
    'Transfer durumu banner'
  );
}

function isLegacyStatusBlock(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === 'Gruplama';
}

function hasStatusBanner(content) {
  let found = false;
  walkBlocks(content, (node) => {
    if (
      node.type === 'simple-container' &&
      String(propVal(node, 'classes') || '').includes('tdb-status-wrap')
    ) {
      found = true;
    }
  });
  return found;
}

function replaceLegacyStatusBlock(content) {
  const withoutLegacy = content.filter((block) => !isLegacyStatusBlock(block));
  if (hasStatusBanner(withoutLegacy)) {
    return updateStatusBannerContent(withoutLegacy);
  }

  const diagramIdx = withoutLegacy.findIndex(
    (block) =>
      block.type === 'render-template' &&
      String(block.content || '').includes('transfer-container')
  );
  const banner = buildStatusBannerBlock();

  if (diagramIdx >= 0) {
    const next = [...withoutLegacy];
    next.splice(diagramIdx, 0, banner);
    return next;
  }

  const visualIdx = withoutLegacy.findIndex(
    (block) =>
      block.type === 'render-template' &&
      String(block.content || '').includes('tdb-visual')
  );
  if (visualIdx >= 0) {
    const next = [...withoutLegacy];
    next.splice(visualIdx, 0, banner);
    return next;
  }

  return [...withoutLegacy, banner];
}

function updateStatusBannerContent(content) {
  const html = loadHtmlTemplate('transfer-detay-beta-status-banner.html');
  walkBlocks(content, (node) => {
    if (
      node.type === 'simple-container' &&
      String(propVal(node, 'classes') || '').includes('tdb-status-wrap')
    ) {
      const render = (node.children || []).find((c) => c.type === 'render-template');
      if (render) render.content = html;
    }
  });
  return content;
}

function updateVisualDiagram(content) {
  const html = loadHtmlTemplate('transfer-detay-beta-visual.html');
  let updated = false;
  walkBlocks(content, (block) => {
    if (updated || block.type !== 'render-template') return;
    const body = String(block.content || '');
    if (!body.includes('tdb-visual') && !body.includes('transfer-container')) return;
    block.content = html;
    setProp(block, 'display-name', 'Transfer görseli');
    updated = true;
  });
  return content;
}

const DRIVER_METHOD_RULE =
  '( "{{transfers.transferMethods}}" == "sofor" || "{{transfers.transferMethods}}" == "" )';

function patchDriverVisibilityConditions(content) {
  walkBlocks(content, (node) => {
    if (!isDeliveryVisibilityWrapper(node)) return;
    const name = propVal(node, 'display-name') || '';

    if (name === 'Teslim Aldım Formu görünürlük') {
      setProp(
        node,
        'condition',
        `${DRIVER_METHOD_RULE} && ("{{info._id}}" == "{{transfers.:users:driver._id}}" || "{{info.roleScore}}" >= 500) && "{{transfers.status}}" == 2`
      );
    }

    if (name === 'Teslim Ettim Formu görünürlük') {
      setProp(
        node,
        'condition',
        `${DRIVER_METHOD_RULE} && ("{{info._id}}" == "{{transfers.:users:driver._id}}" || "{{info.roleScore}}" >= 500) && "{{transfers.status}}" == 3`
      );
    }
  });
  return content;
}

function patchTransferActionForm(form, config) {
  setProp(form, 'display-name', config.formName);
  setProp(form, 'action', 'custom');
  setProp(form, 'custom-function-name', 'multiTransfer');
  setProp(form, 'hidden-values', config.hiddenValues);
  patchFormStayAndReload(form);

  const msg = prop(form, 'on-success-message');
  if (msg?.children) {
    setGroupChild(msg, 'header', config.successHeader);
    setGroupChild(msg, 'text', config.successText);
  }

  walkBlocks([form], (node) => {
    if (node.type === 'input-text' && propVal(node, 'name') === 'driverReceiveDescription') {
      setProp(node, 'name', config.fieldName);
      setProp(node, 'display-name', config.fieldLabel);
      setProp(node, 'label', `${config.fieldLabel}:`);
      setProp(node, 'placeholder', config.placeholder);
      setProp(node, 'width', '100%');
    }

    if (node.type === 'button' && propVal(node, 'text') === 'Teslim Aldım') {
      setProp(node, 'display-name', config.buttonLabel);
      setProp(node, 'text', config.buttonLabel);
      setProp(node, 'severity', config.buttonSeverity || 'p-button-success');
    }
  });

  return form;
}

function patchDriverActionForms(content) {
  const driverReceiveForm = findFormByName(content, 'Teslim Aldım Formu');
  if (driverReceiveForm) {
    patchTransferActionForm(driverReceiveForm, {
      formName: 'Teslim Aldım Formu',
      hiddenValues:
        '{\n    "transferId" : "{{transfers._id}}",\n    "operationType" : "driverReceived"\n}',
      fieldName: 'driverReceiveDescription',
      fieldLabel: 'Teslim alma açıklaması',
      placeholder: 'Transferi teslim alma notunu yazın',
      buttonLabel: 'Teslim Aldım',
      buttonSeverity: 'p-button-success',
      successHeader: 'Teslim alındı',
      successText: 'Transfer şoför tarafından teslim alındı ve yola çıktı.',
    });
  }

  const driverDeliveredForm = findFormByName(content, 'Teslim Ettim Formu');
  if (driverDeliveredForm) {
    setProp(driverDeliveredForm, 'action', 'custom');
    setProp(driverDeliveredForm, 'custom-function-name', 'multiTransfer');
    setProp(
      driverDeliveredForm,
      'hidden-values',
      '{\n    "transferId" : "{{transfers._id}}",\n    "operationType" : "driverDelivered"\n}'
    );
    patchFormStayAndReload(driverDeliveredForm);
    const msg = prop(driverDeliveredForm, 'on-success-message');
    if (msg?.children) {
      setGroupChild(msg, 'header', 'Teslim edildi');
      setGroupChild(msg, 'text', 'Transfer varış şubesine teslim edildi.');
    }
  }

  return content;
}

function buildKargoDepartCard(teslimForm) {
  const form = patchTransferActionForm(deepClone(teslimForm), {
    formName: 'Kargo Çıkış Formu',
    hiddenValues:
      '{\n    "transferId" : "{{transfers._id}}",\n    "operationType" : "cargoDeparted"\n}',
    fieldName: 'shippedDescription',
    fieldLabel: 'Çıkış açıklaması',
    placeholder: 'Kargo çıkış / takip notunu yazın',
    buttonLabel: 'Çıkış Yapıldı',
    buttonSeverity: 'p-button-warning',
    successHeader: 'Çıkış bildirildi',
    successText: 'Kargo çıkışı kaydedildi. Varış şubesi bilgilendirildi.',
  });

  const innerCard = simpleContainer(
    [
      actionHeadBlock(
        'Kargo Çıkışı',
        'Çıkış şubesinde kargonun gönderildiğini onaylayın.',
        'pi-upload'
      ),
      form,
    ],
    'ass__action-card ass__action-card--cargo ass__action-card--depart',
    'Kargo Çıkış Formu kartı'
  );

  return conditionBlock(
    'Kargo Çıkış Formu görünürlük',
    '"{{transfers.transferMethods}}" == "kargo" && "{{transfers.status}}" == 2 && ("{{info._id}}" == "{{transfers.:users:delivered._id}}" || "{{info.roleScore}}" >= 500)',
    [innerCard]
  );
}

function buildKargoReceiveCard(teslimForm) {
  const form = patchTransferActionForm(deepClone(teslimForm), {
    formName: 'Kargo Teslim Formu',
    hiddenValues:
      '{\n    "transferId" : "{{transfers._id}}",\n    "operationType" : "delivered"\n}',
    fieldName: 'deliveredDescription',
    fieldLabel: 'Teslim açıklaması',
    placeholder: 'Kargo teslim notunu yazın',
    buttonLabel: 'Kargoyu Teslim Aldım',
    buttonSeverity: 'p-button-success',
    successHeader: 'Teslim alındı',
    successText: 'Kargo transferi tamamlandı ve stoklar işlendi.',
  });

  const innerCard = simpleContainer(
    [
      actionHeadBlock(
        'Kargo Teslimi',
        'Varış şubesinde kargonun teslim alındığını onaylayın; stoklar işlenecektir.',
        'pi-box'
      ),
      form,
    ],
    'ass__action-card ass__action-card--cargo ass__action-card--arrive',
    'Kargo Teslim Formu kartı'
  );

  return conditionBlock(
    'Kargo Teslim Formu görünürlük',
    '"{{transfers.transferMethods}}" == "kargo" && "{{transfers.status}}" == 3 && ("{{info._id}}" == "{{transfers.:users:received._id}}" || "{{info.roleScore}}" >= 500)',
    [innerCard]
  );
}

function buildBranchReceiveCard(teslimForm) {
  const form = patchTransferActionForm(deepClone(teslimForm), {
    formName: 'Şubede Teslim Formu',
    hiddenValues:
      '{\n    "transferId" : "{{transfers._id}}",\n    "operationType" : "delivered"\n}',
    fieldName: 'deliveredDescription',
    fieldLabel: 'Teslim açıklaması',
    placeholder: 'Şubede teslim alma notunu yazın',
    buttonLabel: 'Şubede Teslim Aldım',
    buttonSeverity: 'p-button-success',
    successHeader: 'Transfer tamamlandı',
    successText: 'Transfer teslim alındı ve stoklar varış şubesine işlendi.',
  });

  const innerCard = simpleContainer(
    [
      actionHeadBlock(
        'Şubede Teslim',
        'Şoförün getirdiği envanteri teslim aldığınızı onaylayın; stoklar işlenecektir.',
        'pi-check-circle'
      ),
      form,
    ],
    'ass__action-card ass__action-card--arrive',
    'Şubede Teslim Formu kartı'
  );

  return conditionBlock(
    'Şubede Teslim Formu görünürlük',
    `${DRIVER_METHOD_RULE} && "{{transfers.status}}" == 4 && ("{{info._id}}" == "{{transfers.:users:received._id}}" || "{{info.roleScore}}" >= 500)`,
    [innerCard]
  );
}

function patchKargoFormVisibilities(content) {
  walkBlocks(content, (node) => {
    const name = propVal(node, 'display-name') || '';
    if (name.includes('Kargo Çıkış Formu görünürlük')) {
      setProp(
        node,
        'condition',
        '"{{transfers.transferMethods}}" == "kargo" && "{{transfers.status}}" == 2 && ("{{info._id}}" == "{{transfers.:users:delivered._id}}" || "{{info.roleScore}}" >= 500)'
      );
    }
    if (name.includes('Kargo Teslim Formu görünürlük')) {
      setProp(
        node,
        'condition',
        '"{{transfers.transferMethods}}" == "kargo" && "{{transfers.status}}" == 3 && ("{{info._id}}" == "{{transfers.:users:received._id}}" || "{{info.roleScore}}" >= 500)'
      );
    }
  });
  return content;
}

function hasKargoDepartCard(children) {
  return (children || []).some((node) =>
    String(propVal(node, 'display-name') || '').includes('Kargo Çıkış Formu görünürlük')
  );
}

function hasKargoReceiveCard(children) {
  return (children || []).some((node) =>
    String(propVal(node, 'display-name') || '').includes('Kargo Teslim Formu görünürlük')
  );
}

function hasBranchReceiveCard(children) {
  return (children || []).some((node) =>
    String(propVal(node, 'display-name') || '').includes('Şubede Teslim Formu görünürlük')
  );
}

function ensureTransferCards(children, content) {
  const teslimForm = findFormByName(content, 'Teslim Aldım Formu');
  if (!teslimForm) {
    throw new Error('Teslim Aldım Formu bulunamadı — transfer kartları oluşturulamadı');
  }

  let next = [...children];
  const approvalIdx = next.findIndex((node) => {
    if (isApprovalVisibilityWrapper(node)) return true;
    if (isDeliveryVisibilityWrapper(node)) return false;
    const card = node.type === 'simple-container' ? node : null;
    return card && String(propVal(card, 'display-name') || '').includes('onayla kartı');
  });
  let insertAt = approvalIdx >= 0 ? approvalIdx + 1 : 0;

  if (!hasKargoDepartCard(next)) {
    next.splice(insertAt, 0, buildKargoDepartCard(teslimForm));
    insertAt += 1;
  }

  if (!hasKargoReceiveCard(next)) {
    next.splice(insertAt, 0, buildKargoReceiveCard(teslimForm));
    insertAt += 1;
  }

  if (!hasBranchReceiveCard(next)) {
    next.splice(insertAt, 0, buildBranchReceiveCard(teslimForm));
  }

  return next;
}

function applyKargoFlow(content) {
  let next = replaceLegacyStatusBlock(content);
  next = updateVisualDiagram(next);
  next = patchDriverActionForms(next);
  next = patchDriverVisibilityConditions(next);
  next = patchKargoFormVisibilities(next);
  next = applyPageLayout(next);
  next = enableTransfersCanReload(next);

  const layout = findPageLayout(next);
  const wrapper = layout
    ? (layout.children || []).find(isActionsWrapper)
    : next.find(isActionsWrapper);

  if (!wrapper) {
    throw new Error('Transfer işlemleri bloğu bulunamadı');
  }

  wrapper.children = enhanceActionCards(wrapper.children || []);
  wrapper.children = ensureTransferCards(wrapper.children, next);
  next = patchAllActionFormReloads(next);
  return next;
}

function patchAllActionFormReloads(content) {
  const names = new Set([
    'onayla',
    'reddet',
    'Şubede Teslim Formu',
    'Kargo Çıkış Formu',
    'Kargo Teslim Formu',
    'Teslim Aldım Formu',
    'Teslim Ettim Formu',
  ]);
  walkBlocks(content, (node) => {
    if (node.type === 'form-container' && names.has(String(propVal(node, 'display-name') || ''))) {
      patchFormStayAndReload(node);
    }
  });
  return content;
}

function enableTransfersCanReload(content) {
  for (const node of content) {
    if (
      node.type === 'data-source' &&
      (propVal(node, 'variable-name') === 'transfers' ||
        propVal(node, 'display-name') === 'transfers')
    ) {
      enableSetting(node, 'canReload');
    }
  }
  return content;
}

function applyActionEnhancements(content) {
  return applyKargoFlow(content);
}

function loadActionStyles() {
  const base = loadTrdStyles();
  const betaExt = fs.readFileSync(
    path.join(__dirname, '../../templates/transfer-detay-beta-page-extensions.css'),
    'utf8'
  );
  return `${base}\n\n${betaExt}`;
}

function extractActionBlocks(sourceContent) {
  const approvalCondition = extractApprovalCondition(sourceContent);
  const approvalCard = buildApprovalActionCard(approvalCondition);
  patchOnaylaRedirect(approvalCard);
  const deliveryCards = extractDeliveryActionCards(sourceContent).map(wrapDeliveryCardVisibility);
  return { approvalCard, deliveryCards };
}

module.exports = {
  PAGE_CONFIG,
  applyActions,
  applyActionEnhancements,
  applyKargoFlow,
  extractActionBlocks,
  loadActionStyles,
  patchApprovalWithReject,
  wrapDeliveryCardVisibility,
};
