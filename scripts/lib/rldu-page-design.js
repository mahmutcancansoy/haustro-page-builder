const path = require('path');
const { createRoleFormDesign } = require('./role-form-design');

const FORM_HEAD_HTML = `<div class="ass__list-head rldu-form-head">
  <div class="ass__list-head-icon"><i class="pi pi-shield"></i></div>
  <div>
    <h2>Rol bilgileri</h2>
    <p>Rol adı, kategori, satın alma yetkisi ve değerlendirme kapsamını güncelleyin.</p>
  </div>
</div>`;

const { PAGE_CONFIG, applyLayout, loadStyles } = createRoleFormDesign({
  pageId: '605283894fe5a50016378e1b',
  layoutName: 'Rol Düzenle Layout',
  heroFile: path.join(__dirname, '../../templates/rol-duzenle-hero.html'),
  formNamePattern: /rol düzenle/i,
  formHeadHtml: FORM_HEAD_HTML,
  pageHeaderText: 'Rol Düzenleme Sayfası',
  mandatoryFieldDefault: 'roleTypes.mandatoryEvaluateRoles',
});

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
