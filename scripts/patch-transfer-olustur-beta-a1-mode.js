#!/usr/bin/env node
/**
 * Aşama 1: mod seçici + transferCreateBeta API + URL ön doldurma
 *
 *   node scripts/patch-transfer-olustur-beta-a1-mode.js
 *   node scripts/patch-transfer-olustur-beta-a1-mode.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { PAGE_CONFIG } = require('./lib/tob-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/transfer-olustur-beta-content.json'
);

const push = process.argv.includes('--push');
const INTER_BRANCH_ONLY = '"{{forms.transfersExpo.transferMode.value}}" == "interBranch"';

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

function selectOption(label, value) {
  return {
    type: 'input-select-option',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: label,
      },
      {
        key: 'label',
        header: 'Label',
        type: 'input-text-property',
        value: label,
      },
      {
        key: 'value',
        header: 'Value',
        type: 'input-text-property',
        value,
      },
      { key: 'icon', header: 'Icon', type: 'input-text-property', value: '' },
    ],
  };
}

function createTransferModeField(options) {
  return {
    type: 'input-select',
    isContainer: true,
    children: options.map(({ label, value }) => selectOption(label, value)),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Transfer Modu',
      },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: '' },
      {
        key: 'name',
        header: 'Name',
        type: 'input-text-property',
        value: 'transferMode',
      },
      {
        key: 'label',
        header: 'Label',
        type: 'input-text-property',
        value: 'Transfer Modu:',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'settings', rule: '!value.inContainer' }],
      },
      {
        key: 'placeholder',
        header: 'Placeholder',
        type: 'input-text-property',
        value: '',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'empty-message',
        header: 'Empty message',
        type: 'input-text-property',
        value: '',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'width',
        header: 'Width',
        type: 'input-text-property',
        value: '100%',
      },
      {
        key: 'type',
        header: 'Type',
        type: 'select-property',
        options: [
          { label: 'Static', value: 'static' },
          { label: 'Dynamic', value: 'dynamic' },
          { label: 'Both (Dynamic+Static)', value: 'both' },
        ],
        value: 'static',
      },
      {
        key: 'default-value',
        header: 'Default value',
        type: 'input-text-property',
        value: '{{params.mode}}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'type', rule: "value == 'static'" }],
      },
      {
        key: 'icon',
        header: 'Icon',
        type: 'input-text-property',
        value: 'mdi mdi-chevron-down mdi-28px',
      },
      {
        key: 'validators',
        header: 'Validators',
        type: 'group-property',
        children: [
          {
            key: 'options',
            type: 'checkbox-property',
            header: 'Options',
            options: [{ label: 'Required', name: 'required' }],
            value: { required: true },
            inGroup: true,
          },
          {
            key: 'required-text',
            header: 'Required text',
            type: 'input-text-property',
            value: 'Transfer modu seçin',
            conditions: [{ key: 'options', rule: 'value.required' }],
            inGroup: true,
          },
        ],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Select first', name: 'selectFirst' },
          { label: 'Search', name: 'search' },
          { label: 'In container', name: 'inContainer' },
          { label: 'Disabled', name: 'disabled' },
          { label: 'Readonly', name: 'readonly' },
          { label: 'Clear button', name: 'clearButton' },
        ],
        value: {
          selectFirst: true,
          search: false,
          inContainer: false,
          disabled: false,
          readonly: false,
          clearButton: false,
        },
      },
    ],
  };
}

function createTransferModeCondition(options, condition, displayName) {
  return {
    type: 'condition',
    isContainer: true,
    children: [createTransferModeField(options)],
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
  };
}

function buildTransferModeBlocks() {
  const fullOptions = [
    { label: 'Şubeler arası (onaylı)', value: 'interBranch' },
    { label: 'Express (anında)', value: 'express' },
  ];
  const basicOptions = [{ label: 'Şubeler arası (onaylı)', value: 'interBranch' }];

  return [
    createTransferModeCondition(
      fullOptions,
      '"{{info.roleScore}}" >= 500',
      'Transfer modu — yetkili kullanıcı'
    ),
    createTransferModeCondition(
      basicOptions,
      '"{{info.roleScore}}" < 500',
      'Transfer modu — standart kullanıcı'
    ),
  ];
}

function findTransfersForm(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'form-container' && propVal(n, 'key') === 'transfersExpo') return n;
    const found = findTransfersForm(n.children);
    if (found) return found;
  }
  return null;
}

function appendInterBranchCondition(block) {
  if (block.type !== 'condition') return;
  const current = String(propVal(block, 'condition') || '').trim();
  if (!current || current.includes('transferMode.value')) return;
  setProp(block, 'condition', `${current} && ${INTER_BRANCH_ONLY}`);
}

function wrapInterBranchOnlyField(nodes) {
  if (!Array.isArray(nodes)) return;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.type === 'input-select' && propVal(n, 'name') === 'transferMethods') {
      const wrapped = {
        type: 'condition',
        isContainer: true,
        children: [n],
        properties: [
          {
            key: 'display-name',
            header: 'Display name',
            type: 'input-text-property',
            value: 'Nakil yöntemi — şubeler arası',
          },
          {
            key: 'condition',
            header: 'Condition',
            type: 'textarea-property',
            value: INTER_BRANCH_ONLY,
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
      nodes[i] = wrapped;
      continue;
    }
    if (n.type === 'condition') {
      const name = String(propVal(n, 'display-name') || '');
      if (
        name.includes('Teslim Eden') ||
        name.includes('Personel Yoksa') ||
        name.includes('Teslim Alacak') ||
        name.includes('Şoför') ||
        propVal(n, 'condition').includes('deliveredUsers') ||
        propVal(n, 'condition').includes('receivedUsers') ||
        propVal(n, 'condition').includes('transferMethods')
      ) {
        appendInterBranchCondition(n);
      }
    }
    wrapInterBranchOnlyField(n.children);
  }
}

function removeTransferModeBlocks(nodes) {
  if (!Array.isArray(nodes)) return;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.type === 'input-select' && propVal(n, 'name') === 'transferMode') {
      nodes.splice(i, 1);
      continue;
    }
    if (
      n.type === 'condition' &&
      (n.children || []).some(
        (c) => c.type === 'input-select' && propVal(c, 'name') === 'transferMode'
      )
    ) {
      nodes.splice(i, 1);
      continue;
    }
    removeTransferModeBlocks(n.children);
  }
}

function patchForm(form) {
  const children = form.children || [];
  removeTransferModeBlocks(children);

  const idx = children.findIndex(
    (c) => c.type === 'input-select' && propVal(c, 'name') === ':inventory:'
  );
  const modeBlocks = buildTransferModeBlocks();
  if (idx === -1) children.unshift(...modeBlocks);
  else children.splice(idx, 0, ...modeBlocks);
  form.children = children;

  const newDept = children.find(
    (c) => c.type === 'input-select' && propVal(c, 'name') === ':departments:new'
  );
  if (newDept) {
    setProp(newDept, 'dynamic-default-value', 'params.toDepartment');
  }

  setProp(form, 'custom-function-name', 'transferCreateBeta');
  setProp(
    form,
    'hidden-values',
    '{\n    ":roleTypes:approvell": "606a1b029837370015518ffc",\n    ":users:Creator": "{{info._id}}"\n}'
  );
  setProp(form, 'response-name', 'transferCreateBeta');
  setProp(
    form,
    'query-params',
    '{\n    "_id": "{{response.transferCreateBeta.transferId}}"\n}'
  );

  const msg = prop(form, 'on-success-message');
  const textChild = msg?.children?.find((c) => c.key === 'text');
  if (textChild) {
    textChild.value = 'Transfer işlemi başarıyla tamamlandı.';
  }

  wrapInterBranchOnlyField(children);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const existing = await getPageContent(PAGE_CONFIG.pageId);
    if (!existing?.content?.length) {
      throw new Error(`pageContents bulunamadı: ${PAGE_CONFIG.pageId}`);
    }

    const content = JSON.parse(JSON.stringify(existing.content));
    const form = findTransfersForm(content);
    if (!form) throw new Error('transfersExpo form-container bulunamadı');

    patchForm(form);

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles: existing.styles || '',
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      console.log('template:', TEMPLATE_PATH);
      return;
    }

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content } }
    );

    console.log('sayfa: transfer-olustur-beta (Aşama 1 mod seçici)');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('template:', TEMPLATE_PATH);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
