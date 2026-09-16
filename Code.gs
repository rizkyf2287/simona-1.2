/**
 * DocTrack (SIMONA) — Backend Google Apps Script
 * ===============================================
 * Menyediakan API sederhana (GET & POST) untuk sinkronisasi:
 *  - Sheet "AR"    -> dokumen Account Receivable
 *  - Sheet "AP"    -> dokumen Account Payable
 *  - Sheet "Users" -> data manajemen user (nama, email, role, divisi, hak akses)
 *  - Google Drive  -> penyimpanan file lampiran dokumen AR/AP
 *
 * PENYIMPANAN FILE (GOOGLE DRIVE)
 * -----------------------------------------------
 * File yang diunggah dari SIMONA disimpan otomatis di Drive akun yang
 * men-deploy script ini, dengan struktur folder:
 *   SIMONA - New Ratna Motor / AR atau AP / {Tahun} / {Bulan} / {docId}_{namaFile}
 * Folder dibuat otomatis jika belum ada. File diberi akses "Anyone with
 * the link - View" agar bisa dibuka langsung dari SIMONA.
 *
 * PERILAKU DATA SHEET: UPSERT / ADDITIVE, BUKAN TIMPA
 * -----------------------------------------------
 * Setiap kali menerima data (push), script ini akan:
 *  - Mencocokkan baris berdasarkan kolom "id"
 *  - Jika id sudah ada di sheet -> baris tersebut DIPERBARUI
 *  - Jika id belum ada -> baris BARU ditambahkan
 *  - Baris lain di sheet yang TIDAK ada di data yang dikirim -> TETAP
 *    disimpan, tidak dihapus/ditimpa.
 *
 * CARA DEPLOY:
 * 1. Buat/buka Google Sheet baru (sheet AR/AP/Users dibuat otomatis
 *    oleh script ini saat pertama kali diakses).
 * 2. Menu Extensions → Apps Script.
 * 3. Hapus isi default, tempel SELURUH isi file ini, lalu simpan (Ctrl+S).
 * 4. Klik Deploy → New deployment.
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Klik Deploy. Karena script ini sekarang mengakses Google Drive,
 *    akan muncul layar "Authorize access" — klik akun Google Anda,
 *    lalu "Advanced" → "Go to (nama project) (unsafe)" → "Allow".
 *    (Peringatan "unsafe" ini normal untuk script buatan sendiri yang
 *    belum diverifikasi Google, bukan berarti scriptnya berbahaya.)
 * 6. Salin "Web app URL" yang muncul (format:
 *    https://script.google.com/macros/s/XXXXXXXX/exec)
 * 7. Tempel URL tersebut ke halaman "Sinkronisasi Sheets" di SIMONA.
 *
 * CATATAN PENTING:
 * - Setiap kali kode ini diubah/ditempel ulang, WAJIB buat deployment
 *   BARU: Deploy → Manage deployments → klik ikon pensil pada
 *   deployment aktif → Version: pilih "New version" → Deploy.
 *   Jika hanya menyimpan kode (Ctrl+S) tanpa membuat versi baru,
 *   Web App URL yang sudah dipakai TIDAK akan mendapat perubahan kode.
 * - URL Web App ini bersifat publik ("Anyone") agar bisa dipanggil
 *   dari browser. Jangan bagikan ke pihak yang tidak berkepentingan.
 * - Untuk memastikan deployment benar, buka URL berikut langsung di
 *   tab browser baru: {WEB_APP_URL}?action=ping — seharusnya muncul
 *   teks JSON seperti {"ok":true,"message":"..."}. Jika yang muncul
 *   malah halaman login Google atau error merah, deployment/izin
 *   akses belum benar (lihat langkah 4-5 di atas).
 *
 * NOTIFIKASI OTOMATIS (Email & WhatsApp):
 * - Cari bagian "NOTIFIKASI OTOMATIS" di bagian bawah file ini, isi
 *   konfigurasi email/nomor WA/token Fonnte di sana.
 * - Notifikasi "dokumen baru" & "status berubah" otomatis aktif begitu
 *   konfigurasi diisi (tidak perlu langkah tambahan).
 * - Notifikasi "jatuh tempo/terlambat" perlu 1 langkah tambahan: bikin
 *   Trigger terjadwal untuk fungsi checkOverdueAndNotify (instruksi
 *   lengkap ada tepat di atas fungsi tersebut).
 */

var DOC_HEADERS = [
  'id', 'docId', 'title', 'relatedDept', 'docType',
  'noSurat', 'noRangka', 'noInvoice', 'tglInvoice', 'tglTerima', 'tglRencana', 'tglBayarCair', 'nominal',
  'status', 'disburse', 'sumber', 'description', 'submittedBy',
  'createdAt', 'updatedAt', 'auditTrailJSON'
];

var USER_HEADERS = ['id', 'nik', 'name', 'email', 'phone', 'password', 'role', 'dept', 'editStatus', 'editDisburse'];

function doGet(e) {
  var action = e.parameter.action;
  var callback = e.parameter.callback; // jika ada -> respons dibungkus JSONP (untuk hindari CORS saat SIMONA dibuka via file://)

  var payload;
  if (action === 'ping') {
    payload = { ok: true, message: 'DocTrack Sheets backend aktif.' };
  } else {
    var type = e.parameter.type;
    if (type === 'AR' || type === 'AP') {
      payload = { ok: true, documents: readDocSheet(type) };
    } else if (type === 'Users') {
      payload = { ok: true, users: readUserSheet() };
    } else if (type === 'NotifLog') {
      payload = { ok: true, log: readNotifLog(Number(e.parameter.limit) || 200) };
    } else {
      // Tanpa parameter type -> kembalikan semuanya sekaligus
      payload = { ok: true, AR: readDocSheet('AR'), AP: readDocSheet('AP'), users: readUserSheet() };
    }
  }

  return respond(payload, callback);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var type = body.type;

    if (type === 'AR' || type === 'AP') {
      var r = upsertDocSheet(type, body.documents || []);
      return respond({ ok: true, added: r.added, updated: r.updated, total: r.total });
    }
    if (type === 'Users') {
      var r2 = upsertUserSheet(body.users || []);
      return respond({ ok: true, added: r2.added, updated: r2.updated, total: r2.total });
    }
    if (type === 'file') {
      var fileResult = saveFileToDrive(body);
      return respond({ ok: true, fileId: fileResult.fileId, url: fileResult.url, fileName: fileResult.fileName, folderPath: fileResult.folderPath });
    }
    if (type === 'delete') {
      var target = body.target; // 'AR' | 'AP' | 'Users'
      var ids = body.ids || [];
      var delResult;
      if (target === 'AR' || target === 'AP') {
        delResult = deleteRowsById(getDocSheet(target), ids);
      } else if (target === 'Users') {
        delResult = deleteRowsById(getUserSheet(), ids);
      } else {
        return respond({ ok: false, error: 'Field "target" harus "AR", "AP", atau "Users".' });
      }
      return respond({ ok: true, deleted: delResult });
    }
    return respond({ ok: false, error: 'Field "type" harus "AR", "AP", "Users", "file", atau "delete".' });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

/* ---------- Penyimpanan file dokumen pendukung ke Google Drive ---------- */
// Struktur folder otomatis: SIMONA - New Ratna Motor / {AR|AP} / {Tahun} / {Bulan} / {docId}_{namaFile}
var DRIVE_ROOT_FOLDER_NAME = 'SIMONA - New Ratna Motor';

function saveFileToDrive(body) {
  var docType = (body.docType === 'AP') ? 'AP' : 'AR';
  var docId = String(body.docId || 'UNKNOWN').replace(/[^a-zA-Z0-9\-_#]/g, '_');
  var fileName = body.fileName || 'lampiran';
  var mimeType = body.mimeType || 'application/octet-stream';
  var base64Data = body.base64Data;
  if (!base64Data) throw new Error('base64Data kosong, tidak ada file yang dikirim.');

  var now = new Date();
  var year = String(now.getFullYear());
  var month = ('0' + (now.getMonth() + 1)).slice(-2);

  var root = getOrCreateFolder(DriveApp.getRootFolder(), DRIVE_ROOT_FOLDER_NAME);
  var typeFolder = getOrCreateFolder(root, docType);
  var yearFolder = getOrCreateFolder(typeFolder, year);
  var monthFolder = getOrCreateFolder(yearFolder, month);

  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, mimeType, docId + '_' + fileName);
  var file = monthFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    url: file.getUrl(),
    fileName: file.getName(),
    folderPath: DRIVE_ROOT_FOLDER_NAME + '/' + docType + '/' + year + '/' + month,
  };
}

function getOrCreateFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

/* ---------- Hapus baris berdasarkan id (untuk sinkron penghapusan 2 arah) ---------- */
function deleteRowsById(sheet, ids) {
  if (!ids || !ids.length) return 0;
  var idSet = {};
  ids.forEach(function (id) { idSet[String(id)] = true; });

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  var headers = values[0];
  var idIndex = headers.indexOf('id');

  var kept = [values[0]]; // header
  var deletedCount = 0;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    if (idSet[String(row[idIndex])]) {
      deletedCount++;
    } else {
      kept.push(row);
    }
  }
  sheet.clearContents();
  kept.forEach(function (row) { sheet.appendRow(row); });
  sheet.setFrozenRows(1);
  return deletedCount;
}

/* ---------- Sheet helpers ---------- */
function getDocSheet(type) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(type);
  if (!sheet) {
    sheet = ss.insertSheet(type);
    sheet.appendRow(DOC_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getUserSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.appendRow(USER_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ---------- Read ---------- */
function readDocSheet(type) {
  var sheet = getDocSheet(type);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1).filter(function (row) { return row.join('') !== ''; });

  return rows.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    try {
      obj.auditTrail = JSON.parse(obj.auditTrailJSON || '[]');
    } catch (err) {
      obj.auditTrail = [];
    }
    delete obj.auditTrailJSON;
    return obj;
  });
}

function readUserSheet() {
  var sheet = getUserSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1).filter(function (row) { return row.join('') !== ''; });

  return rows.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/* ---------- Upsert (ADDITIF, tidak menimpa baris lain) ---------- */
function upsertDocSheet(type, docs) {
  var sheet = getDocSheet(type);
  var values = sheet.getDataRange().getValues();
  var headers = values.length ? values[0] : DOC_HEADERS;
  var idIndex = headers.indexOf('id');
  var statusIndex = headers.indexOf('status');
  var existingRows = values.length > 1 ? values.slice(1).filter(function (r) { return r.join('') !== ''; }) : [];

  var byId = {};
  var order = [];
  existingRows.forEach(function (row) {
    var key = String(row[idIndex]);
    byId[key] = row;
    order.push(key);
  });

  var added = 0, updated = 0;
  docs.forEach(function (d) {
    var key = String(d.id);
    var rowArr = DOC_HEADERS.map(function (h) {
      if (h === 'auditTrailJSON') return JSON.stringify(d.auditTrail || []);
      return d[h] !== undefined && d[h] !== null ? d[h] : '';
    });
    if (byId.hasOwnProperty(key)) {
      var oldStatus = byId[key][statusIndex];
      if (oldStatus && oldStatus !== d.status) {
        notifyStatusChange(type, d, oldStatus, d.status);
      }
      updated++;
    } else {
      added++;
      order.push(key);
      notifyNewDocument(type, d);
    }
    byId[key] = rowArr;
  });

  var finalRows = order.map(function (key) { return byId[key]; });
  sheet.clearContents();
  sheet.appendRow(DOC_HEADERS);
  if (finalRows.length) {
    sheet.getRange(2, 1, finalRows.length, DOC_HEADERS.length).setValues(finalRows);
  }
  sheet.setFrozenRows(1);
  return { added: added, updated: updated, total: finalRows.length };
}

function upsertUserSheet(users) {
  var sheet = getUserSheet();
  var values = sheet.getDataRange().getValues();
  var headers = values.length ? values[0] : USER_HEADERS;
  var idIndex = headers.indexOf('id');
  var existingRows = values.length > 1 ? values.slice(1).filter(function (r) { return r.join('') !== ''; }) : [];

  var byId = {};
  var order = [];
  existingRows.forEach(function (row) {
    var key = String(row[idIndex]);
    byId[key] = row;
    order.push(key);
  });

  var added = 0, updated = 0;
  users.forEach(function (u) {
    var key = String(u.id);
    var perms = u.permissions || {};
    var rowArr = USER_HEADERS.map(function (h) {
      if (h === 'editStatus') return (u.role === 'Super User' || perms.editStatus) ? true : false;
      if (h === 'editDisburse') return (u.role === 'Super User' || perms.editDisburse) ? true : false;
      return u[h] !== undefined && u[h] !== null ? u[h] : '';
    });
    if (byId.hasOwnProperty(key)) {
      updated++;
    } else {
      added++;
      order.push(key);
    }
    byId[key] = rowArr;
  });

  var finalRows = order.map(function (key) { return byId[key]; });
  sheet.clearContents();
  sheet.appendRow(USER_HEADERS);
  if (finalRows.length) {
    sheet.getRange(2, 1, finalRows.length, USER_HEADERS.length).setValues(finalRows);
  }
  sheet.setFrozenRows(1);
  return { added: added, updated: updated, total: finalRows.length };
}

function respond(obj, callback) {
  if (callback) {
    // Nama callback disaring agar aman (hanya huruf/angka/underscore) sebelum disisipkan ke JS.
    var safeCallback = String(callback).replace(/[^a-zA-Z0-9_]/g, '');
    return ContentService
      .createTextOutput(safeCallback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =====================================================================
 * NOTIFIKASI OTOMATIS — EMAIL & WHATSAPP (via Fonnte)
 * =====================================================================
 * Terpicu untuk 3 kejadian:
 *   1. Dokumen baru diajukan          -> dari upsertDocSheet() di atas
 *   2. Status dokumen berubah          -> dari upsertDocSheet() di atas
 *   3. Dokumen jatuh tempo/terlambat   -> dari checkOverdueAndNotify(),
 *      HARUS dijadwalkan manual lewat Trigger (lihat instruksi di bawah).
 *
 * KE SIAPA NOTIFIKASI DIKIRIM?
 * -----------------------------------------------------------------
 * TIDAK ke satu kontak tetap — melainkan otomatis ke SEMUA user yang
 * terdaftar di menu "Manajemen User" pada SIMONA yang:
 *   - Divisinya (Related Dept) sama dengan divisi dokumen tsb, ATAU
 *   - Role-nya Super User / Admin (selalu ikut menerima semua notifikasi)
 * Jadi cukup pastikan tiap user di Manajemen User sudah diisi Email &
 * No. HP yang benar — TIDAK ADA pengaturan email/WA terpisah di sini.
 *
 * Hanya token Fonnte (kredensial pengirim WA) yang perlu diisi 1x di
 * bawah ini, karena itu levelnya akun pengirim, bukan per-user.
 * ------------------------------------------------------------------- */
var NOTIFY_EMAIL_ENABLED = true;
var NOTIFY_WA_ENABLED = true;
var FONNTE_TOKEN = 'GANTI_DENGAN_TOKEN_FONNTE_ANDA'; // <-- GANTI (dari dashboard fonnte.com)

/* ---------- Cari penerima: user di divisi terkait + Super User/Admin ---------- */
function getNotificationRecipients_(relatedDept) {
  var users = readUserSheet();
  return users.filter(function (u) {
    return u.role === 'Super User' || u.role === 'Admin' || u.dept === relatedDept;
  });
}

/* ---------- Pengirim notifikasi + pencatatan log ---------- */
function sendNotification(subject, message, relatedDept, eventType, docId) {
  var recipients = getNotificationRecipients_(relatedDept);
  if (recipients.length === 0) {
    logNotification_(eventType, docId, '-', '-', 'skipped', 'Tidak ada user terdaftar untuk divisi ' + relatedDept);
    return;
  }
  recipients.forEach(function (u) {
    if (NOTIFY_EMAIL_ENABLED && u.email) {
      try {
        MailApp.sendEmail(u.email, subject, message);
        logNotification_(eventType, docId, u.name + ' (' + u.email + ')', 'Email', 'success', '');
      } catch (err) {
        logNotification_(eventType, docId, u.name + ' (' + u.email + ')', 'Email', 'failed', String(err));
      }
    }
    if (NOTIFY_WA_ENABLED && u.phone && FONNTE_TOKEN.indexOf('GANTI_DENGAN') === -1) {
      try {
        var waNumber = normalizeWaNumber_(u.phone);
        var res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
          method: 'post',
          headers: { Authorization: FONNTE_TOKEN },
          payload: { target: waNumber, message: subject + '\n\n' + message },
          muteHttpExceptions: true,
        });
        logNotification_(eventType, docId, u.name + ' (' + waNumber + ')', 'WhatsApp', 'success', res.getContentText().slice(0, 200));
      } catch (err) {
        logNotification_(eventType, docId, u.name + ' (' + u.phone + ')', 'WhatsApp', 'failed', String(err));
      }
    }
  });
}

// Format nomor HP Indonesia ke format internasional yang dipakai Fonnte (62xxxxxxxxxx)
function normalizeWaNumber_(phone) {
  var digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.charAt(0) === '0') digits = '62' + digits.substring(1);
  if (digits.substring(0, 2) !== '62') digits = '62' + digits;
  return digits;
}

function fmtRupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}

/* ---------- Log Notifikasi (sheet "NotifLog", bisa dilihat dari SIMONA) ---------- */
var NOTIF_LOG_HEADERS = ['timestamp', 'eventType', 'docId', 'recipient', 'channel', 'status', 'note'];

function getNotifLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('NotifLog');
  if (!sheet) {
    sheet = ss.insertSheet('NotifLog');
    sheet.appendRow(NOTIF_LOG_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function logNotification_(eventType, docId, recipient, channel, status, note) {
  try {
    var sheet = getNotifLogSheet();
    sheet.appendRow([new Date().toISOString(), eventType, docId, recipient, channel, status, note]);
    // Batasi log maksimal 500 baris terakhir supaya sheet tidak membengkak
    var lastRow = sheet.getLastRow();
    if (lastRow > 501) {
      sheet.deleteRows(2, lastRow - 501);
    }
  } catch (err) {
    Logger.log('Gagal mencatat log notifikasi: ' + err);
  }
}

function readNotifLog(limit) {
  var sheet = getNotifLogSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1).filter(function (r) { return r.join('') !== ''; });
  rows.reverse(); // terbaru dulu
  if (limit) rows = rows.slice(0, limit);
  return rows.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/* ---------- 1. Dokumen baru diajukan ---------- */
function notifyNewDocument(type, d) {
  var subject = '[SIMONA] Dokumen ' + type + ' Baru Diajukan — ' + d.docId;
  var message =
    'Dokumen ' + type + ' baru telah diajukan di SIMONA:\n\n' +
    'ID Dokumen   : ' + d.docId + '\n' +
    'Judul        : ' + d.title + '\n' +
    'Related Dept : ' + d.relatedDept + '\n' +
    'Nominal      : ' + fmtRupiah(d.nominal) + '\n' +
    'Status       : ' + d.status + '\n' +
    'Diajukan oleh: ' + d.submittedBy;
  sendNotification(subject, message, d.relatedDept, 'Dokumen Baru', d.docId);
}

/* ---------- 2. Status dokumen berubah ---------- */
function notifyStatusChange(type, d, oldStatus, newStatus) {
  var subject = '[SIMONA] Status ' + type + ' Berubah — ' + d.docId + ' (' + oldStatus + ' -> ' + newStatus + ')';
  var message =
    'Status dokumen ' + type + ' berubah di SIMONA:\n\n' +
    'ID Dokumen   : ' + d.docId + '\n' +
    'Judul        : ' + d.title + '\n' +
    'Related Dept : ' + d.relatedDept + '\n' +
    'Status       : ' + oldStatus + ' → ' + newStatus + '\n' +
    'Nominal      : ' + fmtRupiah(d.nominal);
  sendNotification(subject, message, d.relatedDept, 'Status Berubah', d.docId);
}

/* ---------- 3. Dokumen jatuh tempo / terlambat ----------
 * Fungsi ini TIDAK terpanggil otomatis oleh doGet/doPost — harus dijadwalkan
 * lewat Trigger (Time-driven) supaya jalan sendiri tiap hari. Caranya:
 *   1. Di Apps Script editor, klik ikon jam ⏰ "Triggers" di sidebar kiri.
 *   2. Klik "+ Add Trigger" (kanan bawah).
 *   3. Choose which function to run: checkOverdueAndNotify
 *   4. Select event source: Time-driven
 *   5. Select type of time based trigger: Day timer
 *   6. Select time of day: pilih jam, misal 08:00–09:00
 *   7. Klik Save (mungkin diminta otorisasi ulang, ikuti sampai selesai)
 * ------------------------------------------------------------------- */
function checkOverdueAndNotify() {
  checkOverdueForType_('AR', 'Cair');
  checkOverdueForType_('AP', 'Bayar');
}

function checkOverdueForType_(type, terminalStatus) {
  var docs = readDocSheet(type);
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Kelompokkan dokumen terlambat PER DIVISI, supaya tiap divisi cuma dapat
  // ringkasan punya mereka sendiri (bukan gabungan semua divisi).
  var overdueByDept = {};
  docs.forEach(function (d) {
    if (d.status === terminalStatus) return; // sudah selesai, tidak dihitung
    if (!d.tglRencana) return;
    var planDate = new Date(d.tglRencana);
    if (isNaN(planDate.getTime())) return;
    if (planDate < today) {
      var diffDays = Math.floor((today - planDate) / 86400000);
      var dept = d.relatedDept || '(Tanpa Divisi)';
      if (!overdueByDept[dept]) overdueByDept[dept] = [];
      overdueByDept[dept].push({ doc: d, diffDays: diffDays });
    }
  });

  var verb = (type === 'AR') ? 'cair' : 'dibayar';
  Object.keys(overdueByDept).forEach(function (dept) {
    var overdue = overdueByDept[dept];
    var subject = '[SIMONA] ' + overdue.length + ' Dokumen ' + type + ' Terlambat ' + (type === 'AR' ? 'Cair' : 'Bayar') + ' — ' + dept;
    var lines = overdue.map(function (o) {
      return '- ' + o.doc.docId + ' (' + o.doc.title + ') — terlambat ' + o.diffDays + ' hari, ' + fmtRupiah(o.doc.nominal);
    });
    var message =
      'Dokumen ' + type + ' divisi ' + dept + ' berikut sudah melewati rencana ' + verb + ' dan belum ' + verb + ':\n\n' +
      lines.join('\n');
    sendNotification(subject, message, dept, 'Jatuh Tempo', overdue.map(function(o){ return o.doc.docId; }).join(', '));
  });
}
