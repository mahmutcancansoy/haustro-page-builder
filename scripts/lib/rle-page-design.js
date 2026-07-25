const path = require('path');
const { createRoleFormDesign } = require('./role-form-design');

const FORM_HEAD_HTML = `<div class="ass__list-head rldu-form-head">
  <div class="ass__list-head-icon"><i class="pi pi-shield"></i></div>
  <div>
    <h2>Yeni rol</h2>
    <p>Rol adı, kategori, satın alma skoru ve değerlendirme yetkilerini girin.</p>
  </div>
</div>`;

const { PAGE_CONFIG, applyLayout, loadStyles } = createRoleFormDesign({
  pageId: '605283804fe5a50016378d12',
  layoutName: 'Rol Ekle Layout',
  heroFile: path.join(__dirname, '../../templates/rol-ekle-hero.html'),
  formNamePattern: /rol ekle/i,
  formHeadHtml: FORM_HEAD_HTML,
  pageHeaderText: 'Rol Ekleme Sayfası',
  mandatoryFieldDefault: '',
});

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
