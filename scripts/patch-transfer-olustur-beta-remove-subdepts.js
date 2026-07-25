#!/usr/bin/env node
/**
 * transfer-olustur-beta: şube alt departman alanlarını kaldırır
 *
 *   node scripts/patch-transfer-olustur-beta-remove-subdepts.js
 *   node scripts/patch-transfer-olustur-beta-remove-subdepts.js --push
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

const SUB_DEPT_DS = new Set([
  'subDepartmentsOfNewDept',
  'subDepartmentsOfOldDept',
  'subDepartments',
  'oldSubDepartments',
  'newSubDepartments',
]);

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

function isSubDeptField(block) {
  if (block.type !== 'input-select') return false;
  const name = String(propVal(block, 'name') || '');
  return name === ':subDepartments:old' || name === ':subDepartments:new';
}

function isSubDeptDataSource(block) {
  if (block.type !== 'data-source') return false;
  const varName = String(propVal(block, 'variable-name') || '');
  const displayName = String(propVal(block, 'display-name') || '');
  return SUB_DEPT_DS.has(varName) || SUB_DEPT_DS.has(displayName);
}

function isSubDeptInnerCondition(block) {
  if (block.type !== 'condition') return false;
  const name = String(propVal(block, 'display-name') || '');
  return name.includes('oldSubDepartments kontrol') || name.includes('newSubDepartments kontrol');
}

function updateUserFilters(nodes) {
  if (!Array.isArray(nodes)) return;
  for (const n of nodes) {
    if (n.type === 'data-source') {
      const varName = String(propVal(n, 'variable-name') || '');
      if (varName === 'deliveredUsers') {
        setProp(
          n,
          'table-filters',
          '{\n "terminationDate":{"$exists":false},\n ":departments:":"{{forms.transfersExpo.:departments:old.value}}"\n}'
        );
      }
      if (varName === 'receivedUsers') {
        setProp(
          n,
          'table-filters',
          '{\n "terminationDate":{"$exists":false},\n ":departments:":"{{forms.transfersExpo.:departments:new.value}}"\n}'
        );
      }
    }
    updateUserFilters(n.children);
  }
}

function cleanNodes(nodes) {
  if (!Array.isArray(nodes)) return;

  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];

    if (isSubDeptField(n) || isSubDeptDataSource(n)) {
      nodes.splice(i, 1);
      continue;
    }

    if (isSubDeptInnerCondition(n)) {
      nodes.splice(i, 1, ...(n.children || []));
      continue;
    }

    if (n.type === 'condition') {
      const name = String(propVal(n, 'display-name') || '');
      if (name.includes('Eski Şube ve Alt Departman')) {
        setProp(n, 'display-name', 'Eski Şube Kontrolü');
        setProp(n, 'condition', '"{{forms.transfersExpo.:departments:old.value}}" != ""');
      }
      if (name.includes('Yeni Şube ve Alt Departman')) {
        setProp(n, 'display-name', 'Yeni Şube Kontrolü');
        setProp(n, 'condition', '"{{forms.transfersExpo.:departments:new.value}}" != ""');
      }
    }

    cleanNodes(n.children);
  }
}

function removeSubDepartments(content) {
  cleanNodes(content);
  updateUserFilters(content);
  return content;
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

    const content = removeSubDepartments(JSON.parse(JSON.stringify(existing.content)));

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

    console.log('sayfa: transfer-olustur-beta (alt departman kaldırıldı)');
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
