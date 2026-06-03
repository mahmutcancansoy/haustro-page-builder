#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');

const ROOT = path.join(__dirname, '..');
const CHANGE_PASSWORD_PAGE_ID = '667df2eeb03e3600b04c6f34';
const PHOTO_FORM_FRAGMENT = path.join(ROOT, 'templates/fragments/user-photo-form-minimal.json');

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function usersDataSource() {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Users' },
      { key: 'variable-name', header: 'Variable name', type: 'input-text-property', value: 'users' },
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
      {
        key: 'table-name',
        header: 'Table name',
        type: 'input-text-property',
        value: 'users',
        conditions: [{ key: 'function', rule: "value == 'get'" }],
      },
      {
        key: 'custom-function-name',
        header: 'Custom function name',
        type: 'input-text-property',
        value: '',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n    "_id" : "{{info._id}}"\n}',
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
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'debug-type',
        header: 'Debug type',
        type: 'select-property',
        options: [
          { label: 'Log', value: 'log' },
          { label: 'Table', value: 'table' },
        ],
        value: 'log',
        conditions: [{ key: 'settings', rule: 'value.debug' }],
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

function extractChangePasswordBlocks(content) {
  let form = null;
  const conditions = [];

  function walk(blocks) {
    for (const b of blocks) {
      if (b.type === 'form-container') {
        const fn = b.properties?.find((p) => p.key === 'custom-function-name')?.value;
        if (fn === 'changePassword') form = b;
      }
      if (b.type === 'condition') {
        const rule = b.properties?.find((p) => p.key === 'condition')?.value || '';
        if (rule.includes('changePasswordPost')) conditions.push(b);
      }
      if (b.children) walk(b.children);
    }
  }

  walk(content || []);
  if (!form) throw new Error('changePassword form-container bulunamadı');
  return { form: clone(form), conditions: conditions.map(clone) };
}

function findCloseModalButton(content) {
  function walk(blocks) {
    for (const b of blocks) {
      if (b.type === 'button' && b.properties?.find((p) => p.key === 'action')?.value === 'closeModal') {
        return clone(b);
      }
      if (b.children) {
        const found = walk(b.children);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(content || []);
}

function buildPasswordModal({ form, conditions, cancelButton }) {
  const formBlock = clone(form);
  formBlock.properties = formBlock.properties.map((p) => {
    if (p.key === 'display-name') return { ...p, value: 'Profil Şifre Formu' };
    if (p.key === 'on-success') return { ...p, value: 'reset' };
    return p;
  });

  const cancel = clone(cancelButton);
  cancel.properties = cancel.properties.map((p) => {
    if (p.key === 'display-name') return { ...p, value: 'İptal' };
    if (p.key === 'text') return { ...p, value: 'İptal' };
    if (p.key === 'severity') return { ...p, value: 'p-button-secondary' };
    if (p.key === 'size') return { ...p, value: 'p-button' };
    return p;
  });

  const submitIdx = formBlock.children.findIndex(
    (c) => c.type === 'button' && c.properties?.find((p) => p.key === 'action')?.value === 'submit'
  );
  if (submitIdx >= 0) {
    const submit = formBlock.children[submitIdx];
    submit.properties = submit.properties.map((p) => {
      if (p.key === 'text') return { ...p, value: 'Şifreyi Kaydet' };
      if (p.key === 'display-name') return { ...p, value: 'Şifreyi Kaydet' };
      return p;
    });
    formBlock.children.splice(submitIdx, 0, cancel);
  } else {
    formBlock.children.push(cancel);
  }

  for (const input of formBlock.children.filter((c) => c.type === 'input-password')) {
    input.properties = input.properties.map((p) => {
      if (p.key === 'width') return { ...p, value: '100%' };
      return p;
    });
  }

  return {
    type: 'modal',
    isContainer: true,
    children: [formBlock, ...conditions],
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Şifre Değiştir Modal' },
      { key: 'label', header: 'Label', type: 'input-text-property', value: 'Şifre Değiştir' },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: 'hp-prof-password-modal' },
      { key: 'header', header: 'Header', type: 'input-text-property', value: 'Şifre Değiştir' },
      { key: 'width', header: 'Width', type: 'input-text-property', value: 'min(440px, 92vw)' },
      { key: 'appendTo', header: 'Append To', type: 'input-text-property', value: 'body' },
      {
        key: 'position',
        type: 'select-property',
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Top', value: 'top' },
          { label: 'Bottom', value: 'bottom' },
        ],
        header: 'Position',
        value: 'center',
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
            key: 'openBtnClass',
            header: 'Open button class',
            type: 'input-text-property',
            value: 'hp-prof__btn hp-prof__btn--ghost p-button p-component',
            conditions: [{ key: 'open-type', rule: "value =='showOpenBtn'" }],
            inGroup: true,
          },
          {
            key: 'openBtnIcon',
            header: 'Open button icon',
            type: 'input-text-property',
            value: 'mdi mdi-key-change',
            conditions: [{ key: 'open-type', rule: "value =='showOpenBtn'" }],
            inGroup: true,
          },
          {
            key: 'openBtnText',
            header: 'Open button text',
            type: 'input-text-property',
            value: 'Şifre Değiştir',
            conditions: [{ key: 'open-type', rule: "value =='showOpenBtn'" }],
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
          { label: 'Closing with ESC key', name: 'closeOnEscape' },
          { label: 'Outside click close', name: 'dismissableMask' },
          { label: 'Show close icon', name: 'closable' },
          { label: 'Show the header', name: 'showHeader' },
          { label: 'Can be displayed full screen', name: 'maximizable' },
          { label: 'QR Modal', name: 'qrModal' },
        ],
        value: {
          draggable: false,
          keepInViewport: true,
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
      {
        key: 'closeIcon',
        header: 'Close Icon',
        type: 'input-text-property',
        value: 'pi pi-times',
        conditions: [{ key: 'settings', rule: 'value.closable' }],
      },
    ],
  };
}

function readTemplate(name) {
  return fs.readFileSync(path.join(ROOT, `templates/${name}`), 'utf8').trim();
}

function renderTemplateBlock(displayName, content) {
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

function buildPhotoFormBlock() {
  const fragment = JSON.parse(fs.readFileSync(PHOTO_FORM_FRAGMENT, 'utf8'));
  const formBlock = {
    type: 'form-container',
    isContainer: true,
    children: [],
    properties: clone(fragment.formProps),
  };

  formBlock.properties = formBlock.properties.map((p) => {
    if (p.key === 'display-name') return { ...p, value: 'Profil Fotoğrafı Güncelle' };
    if (p.key === 'field-id') return { ...p, value: '{{info._id}}' };
    if (p.key === 'on-success') return { ...p, value: 'route' };
    return p;
  });

  if (!formBlock.properties.some((p) => p.key === 'url')) {
    formBlock.properties.push({
      key: 'url',
      header: 'Url',
      type: 'textarea-property',
      value: '/d/kullanici-profilim',
      autoComplete: true,
      autoCompleteMode: 'template',
      conditions: [{ key: 'on-success', rule: "value == 'redirect' || value == 'route'" }],
    });
  } else {
    formBlock.properties = formBlock.properties.map((p) => {
      if (p.key === 'url') return { ...p, value: '/d/kullanici-profilim' };
      return p;
    });
  }

  const photo = clone(fragment.photo);
  photo.properties = photo.properties.map((p) => {
    if (p.key === 'display-name') return { ...p, value: 'Profil Fotoğrafı' };
    if (p.key === 'label') return { ...p, value: 'Yeni profil fotoğrafı' };
    if (p.key === 'width') return { ...p, value: '100%' };
    return p;
  });

  const submit = clone(fragment.submit);
  submit.properties = submit.properties.map((p) => {
    if (p.key === 'display-name') return { ...p, value: 'Fotoğrafı Kaydet' };
    if (p.key === 'text') return { ...p, value: 'Fotoğrafı Kaydet' };
    if (p.key === 'severity') return { ...p, value: 'p-button-success' };
    return p;
  });

  formBlock.children = [photo, submit];
  return formBlock;
}

function buildPhotoCardSection() {
  return {
    type: 'simple-container',
    isContainer: true,
    children: [
      renderTemplateBlock('Profil Fotoğrafı Başlık', readTemplate('kullanici-profilim-photo-header.html')),
      {
        type: 'simple-container',
        isContainer: true,
        children: [buildPhotoFormBlock()],
        properties: [
          {
            key: 'display-name',
            header: 'Display name',
            type: 'input-text-property',
            value: 'Profil Fotoğrafı Form',
          },
          {
            key: 'classes',
            header: 'Classes',
            type: 'textarea-property',
            value: 'hp-prof-photo-form-host',
          },
          {
            key: 'styles',
            header: 'Styles',
            type: 'code-editor',
            value: '{\n\n}',
          },
        ],
      },
    ],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Profil Fotoğrafı Kartı',
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'hp-prof-photo-card hp-prof__card hp-prof__card--wide',
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

function buildSecuritySection(passwordModal) {
  return {
    type: 'simple-container',
    isContainer: true,
    children: [
      renderTemplateBlock('Güvenlik Kartı', readTemplate('kullanici-profilim-security.html')),
      {
        type: 'simple-container',
        isContainer: true,
        children: [passwordModal],
        properties: [
          {
            key: 'display-name',
            header: 'Display name',
            type: 'input-text-property',
            value: 'Şifre Modal Host',
          },
          {
            key: 'classes',
            header: 'Classes',
            type: 'textarea-property',
            value: 'hp-prof-modal-host hp-prof__actions',
          },
          {
            key: 'styles',
            header: 'Styles',
            type: 'code-editor',
            value: '{\n\n}',
          },
        ],
      },
    ],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Güvenlik Bölümü',
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'hp-prof-security-card hp-prof__card hp-prof__card--wide',
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

async function buildContent() {
  const heroHtml = readTemplate('kullanici-profilim-body.html');
  const gridHtml = readTemplate('kullanici-profilim-grid.html');
  const cp = await getPageContent(CHANGE_PASSWORD_PAGE_ID);
  const modalSample = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp-modal-sample.json'), 'utf8'));
  const { form, conditions } = extractChangePasswordBlocks(cp.content);
  const cancelButton = findCloseModalButton(modalSample.children);
  if (!cancelButton) throw new Error('closeModal butonu bulunamadı');

  const passwordModal = buildPasswordModal({ form, conditions, cancelButton });
  const photoCardSection = buildPhotoCardSection();
  const securitySection = buildSecuritySection(passwordModal);

  return {
    content: [
      usersDataSource(),
      {
        type: 'simple-container',
        isContainer: true,
        children: [
          renderTemplateBlock('Kullanıcı Profili', heroHtml),
          photoCardSection,
          renderTemplateBlock('Profil Bilgi Grid', gridHtml),
          securitySection,
        ],
        properties: [
          {
            key: 'display-name',
            header: 'Display name',
            type: 'input-text-property',
            value: 'Profil Layout',
          },
          {
            key: 'classes',
            header: 'Classes',
            type: 'textarea-property',
            value: 'hp-prof-page',
          },
          {
            key: 'styles',
            header: 'Styles',
            type: 'code-editor',
            value: '{\n\n}',
          },
        ],
      },
    ],
    styles: readTemplate('kullanici-profilim-page-styles.css'),
  };
}

(async () => {
  try {
    loadEnv();
    await connect();
    const content = await buildContent();
    fs.writeFileSync(
      path.join(ROOT, 'templates/kullanici-profilim-content.json'),
      JSON.stringify(content, null, 2)
    );
    console.log('Wrote templates/kullanici-profilim-content.json');
    console.log('blocks:', content.content.map((b) => b.type).join(', '));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
