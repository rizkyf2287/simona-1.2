/* ================= LOG NOTIFIKASI ================= */
function renderNotifLog(){
  const log = state.notifLog || [];
  return `
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
      <h3 class="text-[28px] md:text-[32px] font-bold text-primary leading-tight">Log Notifikasi</h3>
      <p class="text-slate-500">Riwayat pengiriman notifikasi otomatis (Email &amp; WhatsApp) — dokumen baru, status berubah, dan jatuh tempo.</p>
    </div>
    <button type="button" id="refreshNotifLogBtn" class="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50">
      ${msi('refresh','text-[18px]')} Muat Ulang
    </button>
  </div>

  ${!state.sheetsUrl ? `
  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex gap-3">
    ${msi('info','text-[20px] flex-shrink-0')}
    <span>Sinkronisasi Sheets belum diatur, jadi log notifikasi belum bisa dimuat. Atur URL Web App dulu di menu <strong>Sinkronisasi Sheets</strong>.</span>
  </div>` : `
  <div class="bg-white rounded-xl soft-lift border border-slate-200 overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
      <h4 class="font-bold text-primary">Riwayat Terkirim (${log.length})</h4>
      <span class="text-xs text-slate-400">Menampilkan maksimal 200 entri terbaru</span>
    </div>
    ${log.length ? `
    <div class="overflow-x-auto">
    <table class="w-full text-left border-collapse text-sm">
      <thead><tr class="bg-slate-50 border-b border-slate-200">
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Waktu</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Kejadian</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Dokumen</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Penerima</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Kanal</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Status</th>
      </tr></thead>
      <tbody class="divide-y divide-slate-100">
        ${log.map(l=>`
        <tr class="hover:bg-slate-50">
          <td class="px-6 py-3 text-xs text-slate-500">${fmtDate(l.timestamp)}</td>
          <td class="px-6 py-3 text-xs font-semibold text-slate-700">${l.eventType}</td>
          <td class="px-6 py-3 font-mono text-xs text-primary">${l.docId||'—'}</td>
          <td class="px-6 py-3 text-xs text-slate-600">${l.recipient||'—'}</td>
          <td class="px-6 py-3"><span class="px-2 py-0.5 rounded text-[10px] font-black ${l.channel==='Email'?'bg-blue-100 text-blue-700':l.channel==='WhatsApp'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">${l.channel||'—'}</span></td>
          <td class="px-6 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${l.status==='success'?'bg-green-100 text-green-700':l.status==='failed'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-500'}">${l.status||'—'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>` : `<div class="py-16 text-center text-slate-400 text-sm">Belum ada notifikasi yang tercatat. Klik "Muat Ulang" setelah ada aktivitas dokumen baru/status berubah, atau tunggu jadwal pengecekan jatuh tempo berjalan.</div>`}
  </div>`}
  `;
}

async function loadNotifLog(){
  if(!state.sheetsUrl) return;
  try{
    const data = await jsonpRequest(state.sheetsUrl, { type:'NotifLog', limit:200 });
    state.notifLog = data.log || [];
  }catch(err){
    console.error('Gagal memuat log notifikasi', err);
  }
}
