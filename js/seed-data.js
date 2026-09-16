/* ================= SEED: USERS ================= */
function seedUsers(){
  return [
    {id:cryptoId(), nik:'SU001', name:'Andi Wijaya', email:'andi.wijaya@newratnamotor.co.id', phone:'081234500001', password:'admin123', role:'Super User', dept:null, permissions:{editStatus:true, editDisburse:true}},
    {id:cryptoId(), nik:'AD001', name:'Maya Kusuma', email:'maya.kusuma@newratnamotor.co.id', phone:'081234500002', password:'admin123', role:'Admin', dept:null, permissions:{editStatus:true, editDisburse:true}},
    {id:cryptoId(), nik:'STF001', name:'Rina Amelia', email:'rina.amelia@newratnamotor.co.id', phone:'081234500003', password:'staff123', role:'Staff', dept:'FPA Dept.', permissions:{editStatus:true, editDisburse:false}},
    {id:cryptoId(), nik:'STF002', name:'Budi Santoso', email:'budi.santoso@newratnamotor.co.id', phone:'081234500004', password:'staff123', role:'Staff', dept:'Acc & Tax Dept.', permissions:{editStatus:true, editDisburse:true}},
    {id:cryptoId(), nik:'STF003', name:'Dedi Prasetyo', email:'dedi.prasetyo@newratnamotor.co.id', phone:'081234500005', password:'staff123', role:'Staff', dept:'GA & Legal Dept.', permissions:{editStatus:false, editDisburse:false}},
    {id:cryptoId(), nik:'STF004', name:'Sari Wulandari', email:'sari.wulandari@newratnamotor.co.id', phone:'081234500006', password:'staff123', role:'Staff', dept:'HC Dept.', permissions:{editStatus:true, editDisburse:true}},
  ];
}

/* ================= SEED: DOCUMENTS ================= */
function mk(n, title, docType, relatedDept, confid, noInvoice, tglInvoice, tglTerima, nominal, keterangan, submittedBy, steps){
  const trail = steps.map((s,i)=>{
    const date = new Date(Date.now() - s.hoursAgo*3600000).toISOString();
    if(i===0) return {author:s.author||submittedBy, role:s.role||'Pengaju', date, type:'submit', statusTo:s.status, comment:s.comment||'Dokumen diajukan ke dalam sistem.'};
    return {author:s.author||submittedBy, role:s.role||'Staf', date, type:'status_change', statusFrom:steps[i-1].status, statusTo:s.status, comment:s.comment||`Status diperbarui menjadi ${s.status}.`};
  });
  const termDays = docType==='AR' ? 30 : 21;
  const tglRencana = tglInvoice ? new Date(new Date(tglInvoice).getTime() + termDays*86400000).toISOString().slice(0,10) : '';
  const terminalStatus = docType==='AR' ? 'Cair' : 'Bayar';
  const isSettled = steps[steps.length-1].status === terminalStatus;
  const disburse = isSettled ? 'Yes' : 'No';
  const tglBayarCair = isSettled ? trail[trail.length-1].date.slice(0,10) : '';
  return {
    id:cryptoId(), docId:'#DTS-2026-'+String(n).padStart(3,'0'), title, docType, relatedDept,
    status: steps[steps.length-1].status, sumber:confid, disburse,
    fileSize:(1+Math.random()*2).toFixed(1)+' MB',
    noSurat: 'SRT/'+docType+'/'+String(n).padStart(3,'0')+'/VII/2026',
    noRangka: docType==='AP' ? ('MHF'+String(10000+n*137).slice(-8)+'XID'+String(n).padStart(3,'0')) : '',
    noPV: docType==='AR' ? ('PV/'+String(n).padStart(4,'0')+'/2026') : '',
    totalDPP: docType==='AR' ? Math.round(nominal/1.11) : 0,
    transferCair: (docType==='AR' && isSettled) ? nominal : 0,
    vendor: docType==='AP' ? ['PT Astra Otoparts','CV Sinar Jaya Motor','PT Berkah Suku Cadang','Toko Maju Bersama'][n%4] : '',
    noInvoice, tglInvoice, tglTerima, tglRencana, tglBayarCair, nominal, description:keterangan, submittedBy,
    createdAt:trail[0].date, updatedAt:trail[trail.length-1].date,
    attachments:[{name:(noInvoice||'dokumen').replace(/\s+/g,'_')+'.pdf', size:(1+Math.random()).toFixed(1)+' MB'}],
    auditTrail:trail,
  };
}
function seedDocuments(){
  return [
    mk(1,'Invoice Jasa Konsultasi Q3','AR','FPA Dept.','TAM','INV-2026-001','2026-06-20','2026-06-22',48500000,'Tagihan jasa konsultasi keuangan kuartal ketiga.','Rina Amelia',[      {status:'Draft', hoursAgo:200, author:'Rina Amelia', role:'Staf FPA'},
      {status:'Proses Tax', hoursAgo:170, author:'Budi Santoso', role:'Staf Acc & Tax', comment:'Sedang diverifikasi pajak.'},
      {status:'Proses Acc', hoursAgo:120, author:'Budi Santoso', role:'Staf Acc & Tax', comment:'Rekonsiliasi akuntansi selesai.'},
      {status:'Tagih', hoursAgo:60, author:'Rina Amelia', role:'Staf FPA', comment:'Tagihan dikirim ke pelanggan.'},
    ]),
    mk(2,'Invoice Penjualan Sparepart','AR','Acc & Tax Dept.','Main Dealer','INV-2026-002','2026-05-15','2026-05-17',97250000,'Penjualan sparepart ke mitra dealer cabang Semarang.','Budi Santoso',[      {status:'Draft', hoursAgo:400, author:'Budi Santoso', role:'Staf Acc & Tax'},
      {status:'Proses Tax', hoursAgo:360, comment:'Verifikasi pajak keluaran.'},
      {status:'Proses Acc', hoursAgo:300, comment:'Rekonsiliasi piutang selesai.'},
      {status:'Tagih', hoursAgo:200, comment:'Invoice terkirim.'},
      {status:'Cair', hoursAgo:24, author:'Rina Amelia', role:'Manajer FPA', comment:'Pembayaran diterima penuh dari pelanggan.'},
    ]),
    mk(3,'Purchase Order Sewa Gudang','AP','GA & Legal Dept.','Affiliasi','PO-2026-005','2026-06-01','2026-06-03',180000000,'Sewa gudang cabang Semarang untuk tahun 2026.','Dedi Prasetyo',[      {status:'Draft', hoursAgo:250, author:'Dedi Prasetyo', role:'Staf GA & Legal'},
      {status:'Proses Tax', hoursAgo:210, comment:'Pengecekan PPN sewa.'},
      {status:'Proses Acc', hoursAgo:140, comment:'Validasi anggaran selesai.'},
      {status:'Proses Evopay', hoursAgo:40, comment:'Menunggu jadwal pembayaran EvoPay.'},
    ]),
    mk(4,'PO Perlengkapan Bengkel','AP','Fleet & GSO Dept.','TAM','PO-2026-006','2026-04-20','2026-04-22',15400000,'Pengadaan perlengkapan bengkel cabang utama.','Hendra Gunawan',[      {status:'Draft', hoursAgo:500, author:'Hendra Gunawan', role:'Staf Fleet & GSO'},
      {status:'Proses Tax', hoursAgo:460},
      {status:'Proses Acc', hoursAgo:380},
      {status:'Proses Evopay', hoursAgo:200},
      {status:'Bayar', hoursAgo:30, author:'Andi Wijaya', role:'Super User', comment:'Pembayaran ke vendor selesai.'},
    ]),
    mk(5,'Invoice Klaim Garansi','AR','HC Dept.','Lainnya','INV-2026-003','2026-07-01','2026-07-02',6200000,'Klaim garansi suku cadang periode Juli.','Sari Wulandari',[      {status:'Draft', hoursAgo:20, author:'Sari Wulandari', role:'Staf HC'},
    ]),
    mk(6,'PO Bahan Bakar Operasional','AP','Aftersales Dept.','Main Dealer','PO-2026-007','2026-06-25','2026-06-26',22750000,'Pengadaan bahan bakar armada operasional.','Agus Wijaya',[      {status:'Draft', hoursAgo:90, author:'Agus Wijaya', role:'Staf Aftersales'},
      {status:'Proses Tax', hoursAgo:40, comment:'Verifikasi faktur pajak.'},
    ]),
    mk(7,'Invoice Sparepart Impor','AR','LNK Dept.','Affiliasi','INV-2026-004','2026-05-30','2026-06-01',134000000,'Penjualan sparepart impor ke mitra logistik.','Agus Wijaya',[      {status:'Draft', hoursAgo:600, author:'Agus Wijaya', role:'Staf LNK'},
      {status:'Proses Tax', hoursAgo:560},
      {status:'Proses Acc', hoursAgo:480, comment:'Rekonsiliasi selesai, nilai sesuai kontrak.'},
    ]),
    mk(8,'PO Renovasi Kantor Cabang','AP','RB Dept.','TAM','PO-2026-008','2026-03-10','2026-03-12',68000000,'Renovasi kantor cabang regional.','Budi Santoso',[      {status:'Draft', hoursAgo:800, author:'Budi Santoso', role:'Staf RB'},
      {status:'Proses Tax', hoursAgo:760},
      {status:'Proses Acc', hoursAgo:700},
      {status:'Proses Evopay', hoursAgo:600},
      {status:'Bayar', hoursAgo:500, comment:'Pembayaran ke kontraktor selesai.'},
    ]),
  ];
}

