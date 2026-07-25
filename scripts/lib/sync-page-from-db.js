const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMPLATES_DIR = path.join(__dirname, '../../templates');

function findRenderTemplate(blocks, displayName) {
  for (const b of blocks || []) {
    if (b.type === 'render-template') {
      const name = (b.properties || []).find((p) => p.key === 'display-name')?.value;
      if (name === displayName) return b;
    }
    const found = findRenderTemplate(b.children, displayName);
    if (found) return found;
  }
  return null;
}

function findFormContainer(blocks) {
  for (const b of blocks || []) {
    if (b.type === 'form-container') return b;
    const found = findFormContainer(b.children);
    if (found) return found;
  }
  return null;
}

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

/**
 * DB pageContents → templates/ dosyaları (+ isteğe bağlı HTML parçaları).
 */
function syncPageFromDb(pageDoc, { templateName, fragments = [], stylesFile = null }) {
  if (!pageDoc?.content) {
    throw new Error(`pageContents boş: ${templateName}`);
  }

  const contentPath = path.join(TEMPLATES_DIR, `${templateName}-content.json`);
  const payload = {
    pageId: pageDoc.pageId,
    content: pageDoc.content,
    styles: pageDoc.styles || '',
    syncedAt: new Date().toISOString(),
  };

  let previousHash = null;
  if (fs.existsSync(contentPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      previousHash = hashJson(prev.content);
    } catch {
      previousHash = null;
    }
  }

  fs.writeFileSync(contentPath, JSON.stringify(payload, null, 2) + '\n');

  const extracted = [];
  for (const { displayName, file } of fragments) {
    const block = findRenderTemplate(pageDoc.content, displayName);
    if (block?.content) {
      const out = path.join(TEMPLATES_DIR, file);
      fs.writeFileSync(out, block.content.trim() + '\n');
      extracted.push(file);
    }
  }

  if (stylesFile && pageDoc.styles) {
    fs.writeFileSync(path.join(TEMPLATES_DIR, stylesFile), pageDoc.styles.trim() + '\n');
  }

  const currentHash = hashJson(pageDoc.content);
  return {
    templateName,
    contentPath,
    changed: previousHash !== null && previousHash !== currentHash,
    contentHash: currentHash,
    extracted,
  };
}

function inspectPageContent(content) {
  const dataSources = [];
  const forms = [];
  const renderTemplates = [];

  function walk(blocks) {
    for (const b of blocks || []) {
      if (b.type === 'data-source') {
        const settings = propVal(b, 'settings');
        dataSources.push({
          name: propVal(b, 'display-name'),
          variable: propVal(b, 'variable-name'),
          table: propVal(b, 'table-name'),
          single: settings?.single ?? settings?.value?.single,
          filters: String(propVal(b, 'table-filters') || '').slice(0, 80),
        });
      }
      if (b.type === 'form-container') {
        const fields = (b.children || [])
          .filter((c) => propVal(c, 'name'))
          .map((c) => ({
            name: propVal(c, 'name'),
            type: c.type,
            defaultValue: propVal(c, 'default-value'),
            dynamicDefault: propVal(c, 'dynamic-default-value'),
          }));
        forms.push({
          name: propVal(b, 'display-name'),
          action: propVal(b, 'action'),
          table: propVal(b, 'table-name'),
          fieldId: propVal(b, 'field-id'),
          fields,
        });
      }
      if (b.type === 'render-template') {
        renderTemplates.push(propVal(b, 'display-name') || '(isimsiz)');
      }
      walk(b.children);
    }
  }
  walk(content);
  return { dataSources, forms, renderTemplates };
}

/** @deprecated mail-alici özel — genel inspectPageContent kullanın */
function inspectEditPageManualFields(content) {
  const { forms } = inspectPageContent(content);
  const form = forms[0];
  const field = form?.fields?.find((f) => f.name === 'recipientsText') || form?.fields?.[0];
  return {
    fieldId: form?.fieldId,
    fieldType: field?.type,
    recipientsDefault: field?.defaultValue,
    dynamicDefault: field?.dynamicDefault,
    tableName: form?.table,
    action: form?.action,
  };
}

function extractAllRenderTemplates(content, templateName) {
  const extracted = [];
  function walk(blocks) {
    for (const b of blocks || []) {
      if (b.type === 'render-template' && b.content) {
        const displayName = propVal(b, 'display-name') || 'render';
        const slug = displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const file = `${templateName}-${slug || 'render'}.html`;
        fs.writeFileSync(path.join(TEMPLATES_DIR, file), b.content.trim() + '\n');
        extracted.push({ displayName, file });
      }
      walk(b.children);
    }
  }
  walk(content);
  return extracted;
}

module.exports = {
  TEMPLATES_DIR,
  syncPageFromDb,
  inspectPageContent,
  inspectEditPageManualFields,
  extractAllRenderTemplates,
  findRenderTemplate,
  hashJson,
};
