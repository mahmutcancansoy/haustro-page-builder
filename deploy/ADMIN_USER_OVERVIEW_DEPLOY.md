# Admin Kullanıcı Özeti — Backend Deploy

Panel sayfası `admin-kullanici-ozeti` custom data-source `adminUserOverview` kullanır.

## Deploy

```bash
cp deploy/adminUserOverview.php /path/to/HaustroBackend/Backend/src/routes/custom/adminUserOverview.php
```

## Sayfa kurulumu

```bash
# Şablonları yaz
node scripts/setup-admin-kullanici-ozeti.js

# DB'ye sayfa oluştur / güncelle (Sabit Veriler altında, admin-only)
node scripts/setup-admin-kullanici-ozeti.js --push

# Mevcut sayfa içeriğini güncelle
node scripts/setup-admin-kullanici-ozeti.js --update
```

## Dönen veri

`adminOverview` (single):

- `summary.activeUserCount` — aktif personel sayısı
- `summary.loggedInToday` — bugün giriş yapanlar
- `summary.usersWithPending` — bekleyen bildirimi olan kullanıcılar
- `summary.neverLoggedIn` — hiç giriş yapmamış kullanıcılar
- `summary.totalUnreadMessages` — toplam okunmamış mesaj
- `summary.totalPendingNotifications` — `notifications` koleksiyonundaki toplam
- `users[]` — kullanıcı satırları (ad, departman, rol, son giriş, mesaj/bildirim sayıları, `logsUrl`)
- Profil (`userId` ile): `pageVisits[]`, `pageVisitCount`, `pageVisitDays` — sayfa giriş/çıkış logları

## Veri kaynakları

| Alan | Koleksiyon |
|------|------------|
| Aktif kullanıcılar | `users` |
| Son giriş | `loginLogs` (email / username eşleşmesi) |
| Okunmamış mesaj | `messageLogs` (`status: 0`, `:users:to`) |
| Bildirim kuyruğu | `notifications` (`userId`) |
| Sayfa ziyaretleri | `pageVisitLogs` (`userId`) — bkz. `PAGE_VISIT_LOGS_DEPLOY.md` |
