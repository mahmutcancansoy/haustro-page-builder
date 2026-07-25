const fs = require('fs');
const path = require('path');

const STYLES_FILE = path.join(__dirname, '../../templates/mail-alicilari-page-styles.css');
const EDIT_PAGE_STYLES_FILE = path.join(__dirname, '../../templates/mail-alici-duzenle-page-styles.css');
const EDIT_EXT_STYLES_FILE = path.join(__dirname, '../../templates/mail-alici-duzenle-page-extensions.css');
const LIST_GRID_FILE = path.join(__dirname, '../../templates/mail-alicilari-grid.html');
const EDIT_HERO_FILE = path.join(__dirname, '../../templates/mail-alici-duzenle-hero.html');
const EDIT_FORM_HEAD_FILE = path.join(__dirname, '../../templates/mail-alici-duzenle-form-head.html');
const RECIPIENT_ROW_FILE = path.join(__dirname, '../../templates/mail-alici-duzenle-recipient-row.html');
const RECIPIENTS_EMPTY_FILE = path.join(__dirname, '../../templates/mail-alici-duzenle-recipients-empty.html');

const LIST_PAGE = {
  templateName: 'mail-alicilari',
  title: 'Mail Alıcıları',
  url: 'mail-alicilari',
  pageId: '6a3bc0e643f4623d22b4042b',
};

const EDIT_PAGE = {
  templateName: 'mail-alici-duzenle',
  title: 'Mail Alıcı Düzenle',
  url: 'mail-alici-duzenle',
  pageId: '6a3bc0e743f4623d22b4042f',
};

const MAIL_YONETIMI_CATEGORY = {
  id: '6a3bc480000543755d5bfacd',
  title: 'Mail Yönetimi',
  parentId: '5fef75324fe5a5001340f982',
};

function makeHeaderHiddenCondition() {
  return {
    type: 'condition',
    isContainer: true,
    properties: [
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
    ],
    children: [],
  };
}

function makeCondition(displayName, condition, children) {
  return {
    type: 'condition',
    isContainer: true,
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
    children,
  };
}

function makeGetDataSource({
  displayName,
  variableName,
  tableName,
  tableFilters,
  single = false,
  canReload = true,
}) {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
      {
        key: 'variable-name',
        header: 'Variable name',
        type: 'input-text-property',
        value: variableName,
      },
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
        value: tableName,
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
        value: tableFilters,
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
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Single data', name: 'single' },
          { label: 'Debug', name: 'debug' },
          { label: 'Can reload', name: 'canReload' },
          { label: 'For table', name: 'forTable' },
        ],
        value: {
          single,
          debug: false,
          canReload,
          forTable: false,
        },
      },
    ],
  };
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: content.trim(),
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

function makeSimpleContainer(children, displayName, classes = '') {
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
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: classes },
      { key: 'styles', header: 'Styles', type: 'code-editor', value: '{\n\n}' },
    ],
  };
}

function makeLoopModeOptions() {
  return [
    { label: 'Varible', value: 'variable' },
    { label: 'Data source', value: 'dataSource' },
    { label: 'Static For Loop', value: 'forLoop' },
    { label: 'Increasment', value: 'increasment' },
  ];
}

function makeOnSuccessMessage(text) {
  return {
    key: 'on-success-message',
    header: 'On success message',
    type: 'group-property',
    children: [
      {
        key: 'header',
        header: 'Header',
        type: 'input-text-property',
        value: 'Başarılı',
        inGroup: true,
      },
      {
        key: 'text',
        header: 'Text',
        type: 'textarea-property',
        value: text,
        inGroup: true,
      },
      {
        key: 'popUp',
        header: 'Pop Up View',
        type: 'checkbox-property',
        options: [{ label: 'Enable', name: 'popUpView' }],
        value: { popUpView: true },
        inGroup: true,
      },
      {
        key: 'life',
        header: 'Life',
        type: 'input-number-property',
        value: 3000,
        min: 0,
        inGroup: true,
      },
    ],
  };
}

function makeSubmitButton(text = 'Kaydet', { severity = '', size = '', icon = 'pi pi-check' } = {}) {
  return {
    type: 'button',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: text,
      },
      { key: 'text', header: 'Text', type: 'input-text-property', value: text },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: '' },
      { key: 'severity', header: 'Severity', type: 'input-text-property', value: severity },
      { key: 'size', header: 'Size', type: 'input-text-property', value: size },
      {
        key: 'action',
        type: 'select-property',
        options: [{ label: 'Submit', value: 'submit' }],
        header: 'Action',
        value: 'submit',
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'In form', name: 'inForm' },
          { label: 'Has icon', name: 'hasIcon' },
        ],
        value: { inForm: true, hasIcon: !!icon },
      },
      { key: 'icon', header: 'Icon', type: 'input-text-property', value: icon },
      {
        key: 'icon-position',
        header: 'Icon position',
        type: 'select-property',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
        value: 'left',
      },
    ],
  };
}

function makeTextarea({ displayName, name, label, defaultValue = '', rows = 5 }) {
  return {
    type: 'input-textarea',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: 'w-100-sm' },
      { key: 'name', header: 'Name', type: 'input-text-property', value: name },
      {
        key: 'label',
        header: 'Label',
        type: 'input-text-property',
        value: label,
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'settings', rule: '!value.inContainer' }],
      },
      {
        key: 'placeholder',
        header: 'Placeholder',
        type: 'input-text-property',
        value: 'mgunduz, mtenekeci, ornek@firma.com',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'default-value',
        header: 'Default value',
        type: 'input-text-property',
        value: defaultValue,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'dynamic-default-value',
        header: 'Dynamic default value',
        type: 'input-text-property',
        value: defaultValue,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      { key: 'rows', header: 'Rows', type: 'input-number-property', value: rows, min: 0 },
      { key: 'width', header: 'Width', type: 'input-text-property', value: '100%' },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'In form', name: 'inForm' }],
        value: { inForm: true },
      },
    ],
  };
}

function makeFormActionOptions() {
  return [
    { label: 'Add', value: 'add' },
    { label: 'Get', value: 'get' },
    { label: 'Update', value: 'update' },
    { label: 'Custom', value: 'custom' },
    { label: 'Delete', value: 'delete' },
    { label: 'Hard delete', value: 'hardDelete' },
  ];
}

function makeOnSuccessOptions() {
  return [
    { label: 'Reset form', value: 'reset' },
    { label: 'Route', value: 'route' },
    { label: 'Redirect', value: 'redirect' },
    { label: 'Nothing', value: 'nothing' },
  ];
}

function makeCustomMailForm({
  displayName,
  hiddenValues,
  children,
  successText,
  classes = '',
}) {
  return {
    type: 'form-container',
    isContainer: true,
    children,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
      { key: 'formId', header: 'Form ID', type: 'input-text-property', value: '' },
      { key: 'submitId', header: 'Submit Button ID', type: 'input-text-property', value: '' },
      {
        key: 'action',
        type: 'select-property',
        options: makeFormActionOptions(),
        header: 'Action',
        value: 'custom',
      },
      {
        key: 'custom-function-name',
        header: 'Custom function name',
        type: 'input-text-property',
        value: 'mailRecipients',
        conditions: [{ key: 'action', rule: "value == 'custom'" }],
      },
      {
        key: 'table-name',
        header: 'Table name',
        type: 'input-text-property',
        value: '',
        conditions: [{ key: 'action', rule: "value != 'custom'" }],
      },
      {
        key: 'field-id',
        header: 'Field id',
        type: 'input-text-property',
        value: '',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'action', rule: "value == 'update'" }],
      },
      {
        key: 'hidden-values',
        header: 'Hidden values',
        type: 'code-editor',
        value: hiddenValues,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'action', rule: "value == 'custom'" }],
      },
      {
        key: 'on-success',
        type: 'select-property',
        options: makeOnSuccessOptions(),
        header: 'On success',
        value: 'route',
      },
      {
        key: 'url',
        header: 'Url',
        type: 'textarea-property',
        value: '/d/mail-alici-duzenle',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'on-success', rule: "value == 'redirect' || value == 'route'" }],
      },
      {
        key: 'query-params',
        header: 'Query Params',
        type: 'code-editor',
        value: '{\n    "_id": "{{params._id}}"\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'on-success', rule: "value == 'route'" }],
      },
      {
        key: 'response-name',
        header: 'Response name',
        type: 'input-text-property',
        value: '',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      makeOnSuccessMessage(successText),
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'Expose', name: 'expose' }],
        value: { expose: false },
      },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: classes },
    ],
  };
}

function makeRecipientInputField() {
  return {
    type: 'input-text',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Yeni alıcı',
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'mr-recipient-input w-100-sm',
      },
      { key: 'name', header: 'Name', type: 'input-text-property', value: 'recipient' },
      {
        key: 'label',
        header: 'Label',
        type: 'input-text-property',
        value: 'Yeni alıcı',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'settings', rule: '!value.inContainer' }],
      },
      {
        key: 'placeholder',
        header: 'Placeholder',
        type: 'input-text-property',
        value: 'ornek@thegalliard.com veya kullaniciadi',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      { key: 'width', header: 'Width', type: 'input-text-property', value: '100%' },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'In form', name: 'inForm' }],
        value: { inForm: true },
      },
    ],
  };
}

function makeAddRecipientForm() {
  return makeCustomMailForm({
    displayName: 'Alıcı ekle',
    hiddenValues:
      '{\n    "_id": "{{mailRecipients._id}}",\n    "oprType": "addRecipient"\n}',
    successText: 'Alıcı listeye eklendi.',
    classes: 'mr-form mr-recipient-add-form',
    children: [
      makeRecipientInputField(),
      makeSubmitButton('Ekle', { icon: 'pi pi-plus' }),
    ],
  });
}

function makeRecipientsEmptyBlock() {
  return makeCondition(
    'Alıcı yok uyarısı',
    '"{{mailRecipients.recipients.length}}" == "" || "{{mailRecipients.recipients.length}}" == "0"',
    [
      makeRenderTemplate(
        fs.readFileSync(RECIPIENTS_EMPTY_FILE, 'utf8'),
        'Alıcı yok mesajı'
      ),
    ]
  );
}

function makeRecipientLoopRow(rowHtml) {
  return {
    type: 'grid',
    isContainer: true,
    children: [
      {
        type: 'column',
        isContainer: true,
        children: [makeRenderTemplate(rowHtml, 'Alıcı satır metni')],
        properties: [
          {
            key: 'display-name',
            header: 'Display name',
            type: 'input-text-property',
            value: 'Alıcı metni',
          },
          { key: 'classes', header: 'Classes', type: 'textarea-property', value: '' },
        ],
      },
      {
        type: 'column',
        isContainer: true,
        children: [
          makeCustomMailForm({
            displayName: 'Alıcı sil',
            hiddenValues:
              '{\n    "_id": "{{mailRecipients._id}}",\n    "oprType": "removeRecipient",\n    "recipient": "{{input.value}}"\n}',
            successText: 'Alıcı listeden çıkarıldı.',
            classes: 'mr-recipient-remove-form',
            children: [makeSubmitButton('Sil', { severity: 'p-button-danger', icon: 'pi pi-times' })],
          }),
        ],
        properties: [
          {
            key: 'display-name',
            header: 'Display name',
            type: 'input-text-property',
            value: 'Sil düğmesi',
          },
          { key: 'classes', header: 'Classes', type: 'textarea-property', value: 'mr-recipient-remove-col' },
        ],
      },
    ],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Alıcı satırı',
      },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: 'mr-recipient-item-row' },
    ],
  };
}

function makeRecipientsListLoop() {
  const rowHtml = fs.readFileSync(RECIPIENT_ROW_FILE, 'utf8');
  return {
    type: 'loop',
    isContainer: true,
    children: [makeRecipientLoopRow(rowHtml)],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Kayıtlı alıcılar döngüsü',
      },
      {
        key: 'mode',
        type: 'select-property',
        options: makeLoopModeOptions(),
        header: 'Mode',
        value: 'variable',
      },
      {
        key: 'variable',
        header: 'Variable',
        type: 'input-text-property',
        value: 'mailRecipients.recipients',
        autoComplete: true,
        autoCompleteMode: 'variable',
        conditions: [{ key: 'mode', rule: "value == 'variable'" }],
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'mr-recipients-loop',
      },
    ],
  };
}

function makeEditRecipientsSection() {
  return [makeAddRecipientForm(), makeRecipientsEmptyBlock(), makeRecipientsListLoop()];
}

function makeHiddenField(displayName, name, value = '') {
  return {
    type: 'input-hidden',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
      { key: 'name', header: 'Name', type: 'input-text-property', value: name },
      {
        key: 'default-value',
        header: 'Default value',
        type: 'input-text-property',
        value,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'dynamic-default-value',
        header: 'Dynamic default value',
        type: 'input-text-property',
        value,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'In form', name: 'inForm' }],
        value: { inForm: true },
      },
    ],
  };
}

function makeRecipientsFormArray() {
  const valueField = {
    type: 'input-text',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Alıcı',
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'mr-recipient-input w-100-sm',
      },
      { key: 'name', header: 'Name', type: 'input-text-property', value: 'value' },
      {
        key: 'label',
        header: 'Label',
        type: 'input-text-property',
        value: 'E-posta veya kullanıcı adı',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'settings', rule: '!value.inContainer' }],
      },
      {
        key: 'placeholder',
        header: 'Placeholder',
        type: 'input-text-property',
        value: 'ornek@thegalliard.com',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      { key: 'width', header: 'Width', type: 'input-text-property', value: '100%' },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'In form', name: 'inForm' }],
        value: { inForm: true },
      },
    ],
  };

  return {
    type: 'form-array-container',
    isContainer: true,
    children: [
      {
        type: 'form-group-container',
        isContainer: true,
        children: [valueField],
        properties: [
          {
            key: 'display-name',
            header: 'Display name',
            type: 'input-text-property',
            value: 'Alıcı satırı',
          },
          { key: 'name', header: 'Name', type: 'input-text-property', value: '' },
          {
            key: 'classes',
            header: 'Classes',
            type: 'textarea-property',
            value: 'mr-recipient-row',
          },
        ],
      },
    ],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Alıcı listesi',
      },
      { key: 'name', header: 'Name', type: 'input-text-property', value: 'recipients' },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'mr-recipients-array',
      },
    ],
  };
}

function makeEditForm() {
  return {
    type: 'form-container',
    isContainer: true,
    children: [
      makeRecipientsFormArray(),
      makeHiddenField('recipientsText temizle', 'recipientsText', ''),
      makeSubmitButton('Alıcıları kaydet'),
    ],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Mail alıcı güncelleme formu',
      },
      { key: 'formId', header: 'Form ID', type: 'input-text-property', value: '' },
      { key: 'submitId', header: 'Submit Button ID', type: 'input-text-property', value: '' },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'mr-form',
      },
      {
        key: 'action',
        type: 'select-property',
        options: makeFormActionOptions(),
        header: 'Action',
        value: 'update',
      },
      {
        key: 'custom-function-name',
        header: 'Custom function name',
        type: 'input-text-property',
        value: '',
        conditions: [{ key: 'action', rule: "value == 'custom'" }],
      },
      {
        key: 'table-name',
        header: 'Table name',
        type: 'input-text-property',
        value: 'mailRecipients',
        conditions: [{ key: 'action', rule: "value != 'custom'" }],
      },
      {
        key: 'field-id',
        header: 'Field id',
        type: 'input-text-property',
        value: '{{mailRecipients._id}}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'action', rule: "value == 'update'" }],
      },
      {
        key: 'hidden-values',
        header: 'Hidden values',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'action', rule: "value == 'custom'" }],
      },
      {
        key: 'on-success',
        type: 'select-property',
        options: makeOnSuccessOptions(),
        header: 'On success',
        value: 'route',
      },
      {
        key: 'url',
        header: 'Url',
        type: 'textarea-property',
        value: '/d/mail-alici-duzenle',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'on-success', rule: "value == 'redirect' || value == 'route'" }],
      },
      {
        key: 'query-params',
        header: 'Query Params',
        type: 'code-editor',
        value: '{\n    "_id": "{{params._id}}"\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'on-success', rule: "value == 'route'" }],
      },
      {
        key: 'response-name',
        header: 'Response name',
        type: 'input-text-property',
        value: '',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      makeOnSuccessMessage('Mail alıcıları güncellendi.'),
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'Expose', name: 'expose' }],
        value: { expose: false },
      },
    ],
  };
}

function makeEditFormTextarea() {
  return {
    type: 'form-container',
    isContainer: true,
    children: [
      makeTextarea({
        displayName: 'Alıcılar',
        name: 'recipientsText',
        label: 'Sabit alıcılar (virgül veya satır ile ayırın)',
        defaultValue: '{{mailRecipients.recipientsText}}',
        rows: 8,
      }),
      makeSubmitButton('Alıcıları kaydet'),
    ],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Mail alıcı güncelleme formu',
      },
      { key: 'formId', header: 'Form ID', type: 'input-text-property', value: '' },
      { key: 'submitId', header: 'Submit Button ID', type: 'input-text-property', value: '' },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'mr-form',
      },
      {
        key: 'action',
        type: 'select-property',
        options: makeFormActionOptions(),
        header: 'Action',
        value: 'update',
      },
      {
        key: 'custom-function-name',
        header: 'Custom function name',
        type: 'input-text-property',
        value: '',
        conditions: [{ key: 'action', rule: "value == 'custom'" }],
      },
      {
        key: 'table-name',
        header: 'Table name',
        type: 'input-text-property',
        value: 'mailRecipients',
        conditions: [{ key: 'action', rule: "value != 'custom'" }],
      },
      {
        key: 'field-id',
        header: 'Field id',
        type: 'input-text-property',
        value: '{{mailRecipients._id}}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'action', rule: "value == 'update'" }],
      },
      {
        key: 'hidden-values',
        header: 'Hidden values',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'action', rule: "value == 'custom'" }],
      },
      {
        key: 'on-success',
        type: 'select-property',
        options: makeOnSuccessOptions(),
        header: 'On success',
        value: 'route',
      },
      {
        key: 'url',
        header: 'Url',
        type: 'textarea-property',
        value: '/d/mail-alici-duzenle',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'on-success', rule: "value == 'redirect' || value == 'route'" }],
      },
      {
        key: 'query-params',
        header: 'Query Params',
        type: 'code-editor',
        value: '{\n    "_id": "{{params._id}}"\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'on-success', rule: "value == 'route'" }],
      },
      {
        key: 'response-name',
        header: 'Response name',
        type: 'input-text-property',
        value: '',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      makeOnSuccessMessage('Mail alıcıları güncellendi.'),
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'Expose', name: 'expose' }],
        value: { expose: false },
      },
    ],
  };
}

function buildListContent() {
  const file = path.join(__dirname, '../../templates/mail-alicilari-content.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8')).content;
  }
  const gridHtml = fs.readFileSync(LIST_GRID_FILE, 'utf8');
  return [
    makeHeaderHiddenCondition(),
    makeCondition('Ana içerik', 'true', [
      makeGetDataSource({
        displayName: 'Mail kuralları',
        variableName: 'mailRules',
        tableName: 'mailRecipients',
        tableFilters: '{\n    "delete": { "$ne": 1 }\n}',
      }),
      makeSimpleContainer([makeRenderTemplate(gridHtml, 'Mail alıcı listesi')], 'Mail Alıcıları Layout'),
    ]),
  ];
}

function buildEditContent() {
  return buildEditContentTextarea();
}

function buildEditRecipientsContent() {
  const heroHtml = fs.readFileSync(EDIT_HERO_FILE, 'utf8');
  const formHeadHtml = fs.readFileSync(EDIT_FORM_HEAD_FILE, 'utf8');
  return [
    makeGetDataSource({
      displayName: 'Mail kuralı',
      variableName: 'mailRecipients',
      tableName: 'mailRecipients',
      tableFilters: '{\n    "_id": "{{params._id}}"\n}',
      single: true,
    }),
    makeSimpleContainer(
      [
        makeRenderTemplate(heroHtml, 'Düzenle hero'),
        makeSimpleContainer(
          [
            makeRenderTemplate(formHeadHtml, 'Form başlık'),
            ...makeEditRecipientsSection(),
          ],
          'Alıcı formu kartı',
          'mr-edit__form-card'
        ),
      ],
      'Mail Alıcı Düzenle Layout',
      'mr-page'
    ),
  ];
}

function buildEditContentTextarea() {
  const heroHtml = fs.readFileSync(EDIT_HERO_FILE, 'utf8');
  const formHeadHtml = fs.readFileSync(EDIT_FORM_HEAD_FILE, 'utf8');
  return [
    makeGetDataSource({
      displayName: 'Mail kuralı',
      variableName: 'mailRecipients',
      tableName: 'mailRecipients',
      tableFilters: '{\n    "_id": "{{params._id}}"\n}',
      single: true,
    }),
    makeSimpleContainer(
      [
        makeRenderTemplate(heroHtml, 'Düzenle hero'),
        makeSimpleContainer(
          [makeRenderTemplate(formHeadHtml, 'Form başlık'), makeEditFormTextarea()],
          'Alıcı formu kartı',
          'mr-edit__form-card'
        ),
      ],
      'Mail Alıcı Düzenle Layout',
      'mr-page'
    ),
  ];
}

function loadStyles() {
  const fromList = path.join(__dirname, '../../templates/mail-alicilari-content.json');
  if (fs.existsSync(fromList)) {
    try {
      const styles = JSON.parse(fs.readFileSync(fromList, 'utf8')).styles;
      if (styles && String(styles).trim()) return String(styles).trim();
    } catch {
      /* fallback */
    }
  }
  return fs.readFileSync(STYLES_FILE, 'utf8').trim();
}

function loadEditStyles() {
  const base = fs.existsSync(EDIT_PAGE_STYLES_FILE)
    ? fs.readFileSync(EDIT_PAGE_STYLES_FILE, 'utf8').trim()
    : fs.readFileSync(STYLES_FILE, 'utf8').trim();
  const ext = fs.existsSync(EDIT_EXT_STYLES_FILE)
    ? fs.readFileSync(EDIT_EXT_STYLES_FILE, 'utf8').trim()
    : '';
  if (!ext) return base;
  return `${base}\n\n/* mr-edit-extensions */\n${ext}`;
}

function makePageMeta({ title, url, showInMenu = true }) {
  return {
    isExpanded: false,
    type: 'sub',
    properties: [
      { key: 'display-name', type: 'input-text-property', header: 'Display Name', value: title },
      { key: 'label', type: 'input-text-property', header: 'Label', value: title },
      { key: 'icon', type: 'input-text-property', header: 'Icon', value: 'pi pi-envelope' },
      {
        key: 'route-type',
        type: 'select-property',
        options: [
          { label: 'Dynamic', value: 'dynamic' },
          { label: 'Static', value: 'static' },
          { label: 'External', value: 'external' },
        ],
        header: 'Route Type',
        value: 'dynamic',
      },
      {
        key: 'url-targer',
        type: 'select-property',
        options: [
          { label: '_self', value: '_self' },
          { label: '_blank', value: '_blank' },
        ],
        header: 'Target',
        value: '_self',
        conditions: [{ key: 'route-type', rule: "value == 'external'" }],
      },
      {
        key: 'url',
        type: 'input-text-property',
        header: 'Url',
        value: url,
        conditions: [{ key: 'route-type', rule: "value != 'category'" }],
      },
      {
        key: 'bg',
        header: 'Background',
        type: 'group-property',
        children: [
          {
            key: 'bg-type',
            header: 'Type',
            type: 'select-button',
            options: [
              { label: 'Color', value: 'color' },
              { label: 'Gradient', value: 'gradient' },
            ],
            value: 'color',
            inGroup: true,
          },
          {
            key: 'bg-color',
            header: 'Color',
            type: 'color-property',
            value: '#ffffff',
            inGroup: true,
          },
        ],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Show in menu', name: 'showInMenu' },
          { label: 'Show header', name: 'showHeader' },
        ],
        value: { showInMenu, showHeader: true },
      },
    ],
    children: [],
  };
}

module.exports = {
  LIST_PAGE,
  EDIT_PAGE,
  MAIL_YONETIMI_CATEGORY,
  buildListContent,
  buildEditContent,
  buildEditContentTextarea,
  buildEditRecipientsContent,
  loadStyles,
  loadEditStyles,
  makePageMeta,
  makeEditRecipientsSection,
  makeRenderTemplate,
};
