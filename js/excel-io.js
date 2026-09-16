/* ================= EXCEL EXPORT ================= */
function exportDocumentsToExcel(docs){
  if(typeof XLSX==='undefined'){ showToast('Pustaka Excel gagal dimuat', 'error', 'error'); return; }
  const rows = docs.map(d=>({
    'ID Dokumen': d.docId, 'Judul': d.title, 'Jenis Dokumen': d.docType, 'Related Dept': d.relatedDept,
    'No. Surat': d.noSurat, 'No. Rangka': d.docType==='AP' ? (d.noRangka||'') : '',
    'Vendor': d.docType==='AP' ? (d.vendor||'') : '', 'No. PV': d.docType==='AR' ? (d.noPV||'') : '',
    'No. Invoice': d.noInvoice, 'Tgl Invoice': fmtDateShort(d.tglInvoice), 'Tgl Terima': fmtDateShort(d.tglTerima),
    'Tgl Bayar/Cair': fmtDateShort(d.tglBayarCair),
    'Total DPP': d.docType==='AR' ? (d.totalDPP||0) : '', 'Nominal': d.nominal,
    'Transfer Cair': d.docType==='AR' ? (d.transferCair||0) : '',
    'Status': d.status, 'Sumber': d.sumber,
    'Diajukan Oleh': d.submittedBy, 'Terakhir Diperbarui': fmtDate(d.updatedAt),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = rows.length ? Object.keys(rows[0]).map(k=> k==='Judul'?{wch:32}:{wch:16}) : [];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Dokumen');
  XLSX.writeFile(wb, `daftar-dokumen-${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast(`${docs.length} dokumen berhasil diekspor`);
}

// Template AR: Sumber, No PV, Total DPP, Transfer Cair (khusus AR — sesuai alur pencairan piutang).
// Template AP: No Rangka & Vendor (khusus AP — sesuai alur pembayaran ke vendor/unit kendaraan).
// Kolom "Tgl Cair"/"Tgl Bayar" opsional — isi hanya jika dokumen sudah benar-benar selesai saat diimpor.
function templateHeaders(docType){
  const tglLabel = docType==='AP' ? 'Tgl Bayar' : 'Tgl Cair';
  return docType==='AP'
    ? ['No Surat','No Rangka','Vendor','Tgl Terima','No Invoice','Tgl Invoice',tglLabel,'Nominal','Sumber','Keterangan','Divisi']
    : ['No Surat','No PV','Sumber','Tgl Terima','No Invoice','Tgl Invoice',tglLabel,'Total DPP','Nominal','Transfer Cair','Keterangan','Divisi'];
}
function downloadExcelTemplate(docType){
  if(typeof XLSX==='undefined'){ showToast('Pustaka Excel gagal dimuat', 'error', 'error'); return; }
  const headers = templateHeaders(docType);
  const tglLabel = docType==='AP' ? 'Tgl Bayar' : 'Tgl Cair';
  const example = {
    'No Surat': 'SRT/'+docType+'/001/VIII/2026',
    'Tgl Terima':'2026-07-01','No Invoice':(docType==='AP'?'PO-2026-010':'INV-2026-010'),'Tgl Invoice':'2026-06-28',
    [tglLabel]: '', 'Nominal':5000000,'Sumber':SUMBER[0],'Keterangan':'Contoh keterangan dokumen','Divisi':DEPARTMENTS[0],
  };
  if(docType==='AP'){
    example['No Rangka'] = 'MHFXXXXXXXXXXXXXXX';
    example['Vendor'] = 'PT Contoh Vendor Sparepart';
  } else {
    example['No PV'] = 'PV/0001/2026';
    example['Total DPP'] = 4504504;
    example['Transfer Cair'] = '';
  }
  const ws = XLSX.utils.json_to_sheet([example], {header:headers});
  ws['!cols'] = headers.map(h=> h==='Keterangan' ? {wch:36} : {wch:18});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Impor '+docType);
  XLSX.writeFile(wb, `template-impor-${docType}.xlsx`);
  showToast('Template Excel diunduh');
}

function parseExcelFile(file){
  return new Promise((resolve, reject)=>{
    if(typeof XLSX==='undefined'){ reject(new Error('Pustaka Excel gagal dimuat')); return; }
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, {defval:''}));
      }catch(err){ reject(err); }
    };
    reader.onerror = ()=> reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}

function normalizeDate(v){
  if(v===undefined || v===null || v==='') return '';
  if(typeof v === 'number' && window.XLSX && XLSX.SSF){
    const d = XLSX.SSF.parse_date_code(v);
    if(d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  return String(v).trim();
}

// Impor dijalankan berurutan (bukan paralel) & setiap baris mendapat docId unik
// (timestamp+acak, lihat nextDocId di sync-sheets.js) supaya tidak ada dua baris
// impor yang "menumpuk"/bentrok ID meski diisi/diimpor bersamaan dari sesi berbeda.
function rowToDocument(row, idx, docType){
  const get = (...keys)=>{ for(const k of keys){ if(row[k]!==undefined && row[k]!=='') return row[k]; } return ''; };
  const noSurat = String(get('No Surat','no surat','NoSurat')||'').trim();
  const noRangka = docType==='AP' ? String(get('No Rangka','no rangka','NoRangka')||'').trim() : '';
  const vendor = docType==='AP' ? String(get('Vendor','vendor')||'').trim() : '';
  const noPV = docType==='AR' ? String(get('No PV','no pv','NoPV')||'').trim() : '';
  const noInvoice = String(get('No Invoice','no invoice','NoInvoice')||'').trim();
  const tglInvoice = normalizeDate(get('Tgl Invoice','tgl invoice'));
  const tglTerima = normalizeDate(get('Tgl Terima','tgl terima'));
  const nominal = Number(get('Nominal','nominal')) || 0;
  const totalDPP = docType==='AR' ? (Number(get('Total DPP','total dpp'))||0) : 0;
  const transferCair = docType==='AR' ? (Number(get('Transfer Cair','transfer cair'))||0) : 0;
  const sumberRaw = String(get('Sumber','sumber')||'').trim();
  const sumber = SUMBER.find(s=>s.toLowerCase()===sumberRaw.toLowerCase()) || 'Lainnya';
  const keterangan = String(get('Keterangan','keterangan')||'').trim();
  const divisiRaw = String(get('Divisi','divisi')||'').trim();
  const relatedDept = DEPARTMENTS.find(d=>d.toLowerCase()===divisiRaw.toLowerCase()) || DEPARTMENTS[0];
  const now = new Date().toISOString();
  const title = keterangan ? keterangan.slice(0,70) : (noSurat || noInvoice ? `${docType} ${noSurat||noInvoice}` : `Dokumen Impor ${idx+1}`);
  const termDays = docType==='AR' ? 30 : 21;
  const tglRencana = tglInvoice && !isNaN(new Date(tglInvoice)) ? new Date(new Date(tglInvoice).getTime() + termDays*86400000).toISOString().slice(0,10) : '';
  const tglBayarCair = normalizeDate(get('Tgl Cair','Tgl Bayar','tgl cair','tgl bayar'));
  const alreadySettled = !!tglBayarCair;
  const terminalStatus = docType==='AR' ? 'Cair' : 'Bayar';
  return {
    id:cryptoId(), docId: nextDocId(idx), title, docType, relatedDept,
    status: alreadySettled ? terminalStatus : 'Draft', sumber, disburse: alreadySettled ? 'Yes' : 'No',
    fileSize:'—', noSurat, noRangka, vendor, noPV, totalDPP, transferCair,
    noInvoice, tglInvoice, tglTerima, tglRencana, tglBayarCair, nominal, description:keterangan,
    submittedBy: state.user.name, createdAt:now, updatedAt:now, attachments:[],
    auditTrail:[{author:state.user.name, role:state.user.role, date:now, type:'submit', statusTo: alreadySettled ? terminalStatus : 'Draft', comment: alreadySettled ? `Dokumen ${docType} diimpor sudah dalam status ${terminalStatus} (tanggal ${docType==='AR'?'cair':'bayar'}: ${tglBayarCair}).` : `Dokumen ${docType} diimpor secara massal melalui Excel.`}],
  };
}

// Deteksi duplikat: dokumen dengan No. Invoice yang sama (case-insensitive, sudah ada di
// daftar ATAU sesama baris dalam satu file impor yang sama) TIDAK ditambahkan lagi.
// Mengembalikan {toAdd: [...dokumen unik], skipped: [...{row, reason}]}.
function filterDuplicateImports(newDocs){
  const existingInvoices = new Set(
    state.documents.filter(d=>d.noInvoice).map(d=> d.noInvoice.trim().toLowerCase())
  );
  const toAdd = [];
  const skipped = [];
  const seenInBatch = new Set();
  newDocs.forEach(d=>{
    const key = (d.noInvoice||'').trim().toLowerCase();
    if(!key){ toAdd.push(d); return; } // tanpa No. Invoice -> tidak bisa dicek duplikat, tetap ditambahkan
    if(existingInvoices.has(key)){
      skipped.push({ doc:d, reason:`No. Invoice "${d.noInvoice}" sudah ada di Daftar Dokumen` });
      return;
    }
    if(seenInBatch.has(key)){
      skipped.push({ doc:d, reason:`No. Invoice "${d.noInvoice}" duplikat di dalam file yang sama` });
      return;
    }
    seenInBatch.add(key);
    toAdd.push(d);
  });
  return { toAdd, skipped };
}
