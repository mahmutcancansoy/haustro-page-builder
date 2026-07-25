<?php
/**
 * Backend entegrasyon örnekleri — sabit mail alıcılarını DB'den okuma
 *
 * Önce deploy edin:
 *   deploy/mailRecipientsHelper.php → Backend/src/resources/mailRecipientsHelper.php
 *   deploy/mailRecipients.php       → Backend/src/routes/custom/mailRecipients.php
 *
 * Seed:
 *   node scripts/seed-mail-recipients.js
 */

// ── Örnek 1: cron/mailReportChecklists.php ───────────────────────────────────
// Eski:
//   $to = ['mgunduz@thegalliard.com', 'mtenekeci@thegalliard.com', ...];
// Yeni:
require_once __DIR__ . '/../../resources/mailRecipientsHelper.php';
// $to = getMailRecipients($db, 'cron.checklist_report');

// ── Örnek 2: custom/mailReportChecklist.php ──────────────────────────────────
// $to = getMailRecipients($db, 'custom.checklist_report');

// ── Örnek 3: cron/technicalDemandsReport.php ───────────────────────────────
// $to = getMailRecipients($db, 'cron.technical_demands');

// ── Örnek 4: cron/attendanceConfirmReport.php ────────────────────────────────
// $to = getMailRecipients($db, 'cron.attendance_confirm');

// ── Örnek 5: cron/maintenanceCalculation.php ─────────────────────────────────
// $to = getMailRecipients($db, 'cron.maintenance_calculation');

// ── Örnek 6: cron/monthyPreConfirmAttendance.php ─────────────────────────────
// Rapor:
//   $to = getMailRecipients($db, 'cron.monthly_pre_confirm');
// Hata bildirimi:
//   $to = getMailRecipients($db, 'cron.monthly_pre_confirm_error');

// ── Örnek 7: cron/dailyAttendanceExcel.php (rol + sabit) ─────────────────────
// $roleEmails = [...]; // mevcut IK rol sorgusu
// $to = getMailRecipientsWithRoleUsers($db, 'cron.daily_attendance_excel', $roleEmails);

// ── Örnek 8: cron/attendanceReminderCheck.php ──────────────────────────────────
// if ($type === 'test') {
//     $to = getMailRecipients($db, 'cron.attendance_reminder_test');
// } else {
//     $to = getMailRecipientsWithRoleUsers($db, 'cron.attendance_reminder', $roleEmails);
// }

// ── Örnek 9: general/add.php — yeni envanter talebi ───────────────────────────
// $to = getMailRecipients($db, 'inventory.new_demand');

// ── Örnek 10: custom/inventoryDemands.php ─────────────────────────────────────
// Onay:    $to = getMailRecipients($db, 'inventory.demand_approved');
// Yola çıktı: $to = getMailRecipients($db, 'inventory.transfer_departed');
// + talep sahibi ($getDemander) ve şoför ($getDriver) DB'den eklenmeye devam eder

// ── Örnek 11: custom/transfers.php ────────────────────────────────────────────
// Şubeye ulaştı: $to = array_merge(getMailRecipients($db, 'transfer.arrived_branch'), [$getDriver...]);
// Teslim alındı: $to = getMailRecipients($db, 'transfer.received');

// ── Örnek 12: custom/multiTransfer.php ────────────────────────────────────────
// $to = getMailRecipients($db, 'multi_transfer.arrived_branch');
// $to = getMailRecipients($db, 'multi_transfer.received');

// ── Örnek 13: resources/functions.php → sendPurchasingEmail() ─────────────────
// $to = getMailRecipients($db, 'technical.purchasing');

/**
 * Kural anahtarları (mailRecipients.key):
 *
 * cron.checklist_report
 * custom.checklist_report
 * cron.technical_demands
 * cron.attendance_confirm
 * cron.maintenance_calculation
 * cron.monthly_pre_confirm
 * cron.monthly_pre_confirm_error
 * cron.daily_attendance_excel
 * cron.attendance_reminder
 * cron.attendance_reminder_test
 * inventory.new_demand
 * inventory.demand_approved
 * inventory.transfer_departed
 * transfer.arrived_branch
 * transfer.received
 * multi_transfer.arrived_branch
 * multi_transfer.received
 * technical.purchasing
 */
