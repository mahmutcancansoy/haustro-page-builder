/**
 * mailRecipients koleksiyonu için başlangıç kayıtları.
 * key alanı backend'de getMailRecipients($db, $key) ile kullanılır.
 */
const MAIL_DOMAIN = '@thegalliard.com';

function user(username) {
  return { kind: 'username', value: String(username).replace(MAIL_DOMAIN, '') };
}

function email(addr) {
  return { kind: 'email', value: String(addr).trim() };
}

function recipientsText(recipients = []) {
  return recipients.map((r) => r.value).join(', ');
}

const MAIL_RECIPIENT_RULES = [
  // ── Cron / otomatik raporlar ──────────────────────────────────────────────
  {
    key: 'cron.checklist_report',
    label: 'Açılış/kapanış checklist raporları',
    category: 'cron',
    categoryLabel: 'Cron / otomatik raporlar',
    sourceFile: 'Backend/src/routes/cron/mailReportChecklists.php',
    recipientMode: 'fixed',
    recipients: [user('mgunduz'), user('mtenekeci'), user('ekosagan'), email('mahmutcancansoy12@gmail.com')],
    order: 10,
  },
  {
    key: 'custom.checklist_report',
    label: 'Checklist raporu (manuel endpoint)',
    category: 'cron',
    categoryLabel: 'Cron / otomatik raporlar',
    sourceFile: 'Backend/src/routes/custom/mailReportChecklist.php',
    recipientMode: 'fixed',
    recipients: [user('mgunduz'), user('mtenekeci'), user('ekosagan'), email('mahmutcancansoy12@gmail.com')],
    order: 11,
  },
  {
    key: 'cron.technical_demands',
    label: 'Bekleyen teknik talepler',
    category: 'cron',
    categoryLabel: 'Cron / otomatik raporlar',
    sourceFile: 'Backend/src/routes/cron/technicalDemandsReport.php',
    recipientMode: 'fixed',
    recipients: [user('auras'), user('dyilmaz'), email('mahmutcancansoy12@gmail.com')],
    order: 12,
  },
  {
    key: 'cron.attendance_confirm',
    label: 'Puantaj onay hatırlatması',
    category: 'cron',
    categoryLabel: 'Cron / otomatik raporlar',
    sourceFile: 'Backend/src/routes/cron/attendanceConfirmReport.php',
    recipientMode: 'fixed',
    recipients: [email('mahmutcancansoy12@gmail.com'), user('mtenekeci'), user('vtokgoz')],
    order: 13,
  },
  {
    key: 'cron.maintenance_calculation',
    label: 'Bakım checklist kontrolü',
    category: 'cron',
    categoryLabel: 'Cron / otomatik raporlar',
    sourceFile: 'Backend/src/routes/cron/maintenanceCalculation.php',
    recipientMode: 'fixed',
    recipients: [email('mahmutcancansoy12@gmail.com')],
    order: 14,
  },
  {
    key: 'cron.monthly_pre_confirm',
    label: 'Aylık pre-confirmation raporu',
    category: 'cron',
    categoryLabel: 'Cron / otomatik raporlar',
    sourceFile: 'Backend/src/routes/cron/monthyPreConfirmAttendance.php',
    recipientMode: 'fixed',
    recipients: [email('mahmutcancansoy12@gmail.com'), user('mgunduz')],
    order: 15,
  },
  {
    key: 'cron.monthly_pre_confirm_error',
    label: 'Pre-confirmation hata bildirimi',
    category: 'cron',
    categoryLabel: 'Cron / otomatik raporlar',
    sourceFile: 'Backend/src/routes/cron/monthyPreConfirmAttendance.php',
    recipientMode: 'fixed',
    recipients: [email('mahmutcancansoy12@gmail.com'), user('mgunduz')],
    order: 16,
  },

  // ── Puantaj / IK ─────────────────────────────────────────────────────────
  {
    key: 'cron.daily_attendance_excel',
    label: 'Günlük puantaj Excel raporu',
    category: 'attendance',
    categoryLabel: 'Puantaj / IK',
    sourceFile: 'Backend/src/routes/cron/dailyAttendanceExcel.php',
    recipientMode: 'role_plus_fixed',
    roleNote: 'Rol bazlı IK kullanıcıları + sabit ek alıcı',
    roleKey: 'ik_users',
    recipients: [email('mahmutcancansoy12@gmail.com')],
    order: 20,
  },
  {
    key: 'cron.attendance_reminder',
    label: 'Puantaj giriş hatırlatması (normal)',
    category: 'attendance',
    categoryLabel: 'Puantaj / IK',
    sourceFile: 'Backend/src/routes/cron/attendanceReminderCheck.php',
    recipientMode: 'role_only',
    roleNote: 'Rol bazlı IK kullanıcıları',
    roleKey: 'ik_users',
    recipients: [],
    order: 21,
  },
  {
    key: 'cron.attendance_reminder_test',
    label: 'Puantaj giriş hatırlatması (test modu)',
    category: 'attendance',
    categoryLabel: 'Puantaj / IK',
    sourceFile: 'Backend/src/routes/cron/attendanceReminderCheck.php',
    recipientMode: 'fixed',
    roleNote: '?type=test parametresi ile',
    recipients: [email('mahmutcancansoy12@gmail.com')],
    order: 22,
  },

  // ── Envanter talepleri & transferler ───────────────────────────────────────
  {
    key: 'inventory.new_demand',
    label: 'Yeni envanter talebi',
    category: 'inventory',
    categoryLabel: 'Envanter talepleri & transferler',
    sourceFile: 'Backend/src/routes/general/add.php',
    recipientMode: 'fixed',
    recipients: [user('mtenekeci'), user('vtokgoz'), user('sdurak'), user('sozdemir')],
    order: 30,
  },
  {
    key: 'inventory.demand_approved',
    label: 'Talep onaylandı',
    category: 'inventory',
    categoryLabel: 'Envanter talepleri & transferler',
    sourceFile: 'Backend/src/routes/custom/inventoryDemands.php',
    recipientMode: 'fixed',
    recipients: [user('odemiroluk'), user('sdurak'), user('sozdemir'), user('kozbek')],
    order: 31,
  },
  {
    key: 'inventory.transfer_departed',
    label: 'Transfer yola çıktı',
    category: 'inventory',
    categoryLabel: 'Envanter talepleri & transferler',
    sourceFile: 'Backend/src/routes/custom/inventoryDemands.php',
    recipientMode: 'fixed',
    recipients: [user('sdurak'), user('sozdemir'), user('kozbek')],
    order: 32,
  },
  {
    key: 'transfer.arrived_branch',
    label: 'Şubeye ulaştı (transfer)',
    category: 'inventory',
    categoryLabel: 'Envanter talepleri & transferler',
    sourceFile: 'Backend/src/routes/custom/transfers.php',
    recipientMode: 'fixed',
    recipients: [user('sdurak'), user('sozdemir')],
    order: 33,
  },
  {
    key: 'transfer.received',
    label: 'Teslim alındı (transfer)',
    category: 'inventory',
    categoryLabel: 'Envanter talepleri & transferler',
    sourceFile: 'Backend/src/routes/custom/transfers.php',
    recipientMode: 'fixed',
    recipients: [user('sozdemir')],
    order: 34,
  },
  {
    key: 'multi_transfer.arrived_branch',
    label: 'Şubeye ulaştı (çoklu transfer)',
    category: 'inventory',
    categoryLabel: 'Envanter talepleri & transferler',
    sourceFile: 'Backend/src/routes/custom/multiTransfer.php',
    recipientMode: 'fixed',
    recipients: [user('sdurak'), user('sozdemir')],
    order: 35,
  },
  {
    key: 'multi_transfer.received',
    label: 'Teslim alındı (çoklu transfer)',
    category: 'inventory',
    categoryLabel: 'Envanter talepleri & transferler',
    sourceFile: 'Backend/src/routes/custom/multiTransfer.php',
    recipientMode: 'fixed',
    recipients: [user('sozdemir')],
    order: 36,
  },

  // ── Teknik talep / parça talebi ───────────────────────────────────────────
  {
    key: 'technical.purchasing',
    label: 'Teknik talebe parça eklendiğinde',
    category: 'technical',
    categoryLabel: 'Teknik talep / parça talebi',
    sourceFile: 'Backend/src/resources/functions.php → sendPurchasingEmail()',
    recipientMode: 'fixed',
    recipients: [user('odemiroluk'), email('mahmutcancansoy12@gmail.com')],
    order: 40,
  },
];

module.exports = {
  MAIL_DOMAIN,
  MAIL_RECIPIENT_RULES,
  user,
  email,
  recipientsText,
};
