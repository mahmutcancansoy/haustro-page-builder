#!/usr/bin/env node
/**
 * mailRecipients koleksiyonunu seed eder (mevcut key'leri güncellemez, sadece eksikleri ekler).
 * Kullanım:
 *   node scripts/seed-mail-recipients.js
 *   node scripts/seed-mail-recipients.js --force   # tüm kayıtları upsert eder
 */
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { MAIL_RECIPIENT_RULES, recipientsText } = require('./lib/mail-recipients-seed-data');

const force = process.argv.includes('--force');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const col = db.collection('mailRecipients');

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const rule of MAIL_RECIPIENT_RULES) {
      const doc = {
        key: rule.key,
        label: rule.label,
        category: rule.category,
        categoryLabel: rule.categoryLabel,
        sourceFile: rule.sourceFile,
        recipientMode: rule.recipientMode || 'fixed',
        roleNote: rule.roleNote || '',
        roleKey: rule.roleKey || '',
        recipients: rule.recipients || [],
      recipientsText: recipientsText(rule.recipients || []),
        active: true,
        delete: 0,
        order: rule.order || 0,
        updatedAt: new Date(),
      };

      const existing = await col.findOne({ key: rule.key });

      if (!existing) {
        doc.createdAt = new Date();
        await col.insertOne(doc);
        inserted += 1;
        console.log('+', rule.key);
        continue;
      }

      if (force) {
        await col.updateOne(
          { key: rule.key },
          {
            $set: doc,
            $setOnInsert: { createdAt: existing.createdAt || new Date() },
          }
        );
        updated += 1;
        console.log('~', rule.key);
      } else {
        skipped += 1;
        console.log('=', rule.key, '(mevcut, atlandı)');
      }
    }

    await col.createIndex({ key: 1 }, { unique: true });
    await col.createIndex({ category: 1, order: 1 });
    await col.createIndex({ delete: 1, active: 1 });

    console.log('\nÖzet:', { inserted, updated, skipped, total: MAIL_RECIPIENT_RULES.length });
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
