# Mail Alıcıları — Backend Entegrasyonu

Entegrasyon **HaustroBackend** repo'suna uygulandı (`Backend/src/resources/functions.php`).

## Değiştirilen dosyalar

| Dosya | Kural anahtarı |
|---|---|
| `resources/functions.php` | `getMailRecipients()` + yardımcılar, `technical.purchasing` |
| `cron/mailReportChecklists.php` | `cron.checklist_report` |
| `custom/mailReportChecklist.php` | `custom.checklist_report` |
| `cron/technicalDemandsReport.php` | `cron.technical_demands` |
| `cron/attendanceConfirmReport.php` | `cron.attendance_confirm` |
| `cron/maintenanceCalculation.php` | `cron.maintenance_calculation` |
| `cron/monthyPreConfirmAttendance.php` | `cron.monthly_pre_confirm`, `cron.monthly_pre_confirm_error` |
| `cron/dailyAttendanceExcel.php` | `cron.daily_attendance_excel` (+ rol bazlı IK) |
| `cron/attendanceReminderCheck.php` | `cron.attendance_reminder`, `cron.attendance_reminder_test` |
| `general/add.php` | `inventory.new_demand` |
| `custom/inventoryDemands.php` | `inventory.demand_approved`, `inventory.transfer_departed` |
| `custom/transfers.php` | `transfer.arrived_branch`, `transfer.received` |
| `custom/multiTransfer.php` | `multi_transfer.arrived_branch`, `multi_transfer.received` |

## Deploy

Backend sunucusuna `HaustroBackend` değişikliklerini deploy etmen yeterli.
Ayrı `mailRecipientsHelper.php` dosyası **gerekmez** — mantık `functions.php` içinde.

`deploy/mailRecipients.php` → opsiyonel custom endpoint (panel şu an doğrudan MongoDB kullanıyor).

## Panel

Sabit Veriler → Mail Yönetimi → Mail Alıcıları

Alıcı değişikliği `mailRecipients` koleksiyonuna yazılır; cron'lar bir sonraki çalışmada yeni listeyi okur.

## Geriye dönük uyumluluk

- `recipientsText` (panel düzenlemesi) ve `recipients` (kind/value) desteklenir
- Eski `{email, name}` formatı da okunur
- `purchasing_part_request` anahtarı `technical.purchasing` alias'ına yönlendirilir
