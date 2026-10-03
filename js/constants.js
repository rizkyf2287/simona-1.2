/* ================= BACKEND SHEETS DEFAULT ================= */
// URL Web App Google Apps Script bawaan (PT New Ratna Motor). Ditanam langsung di kode
// supaya SEMUA perangkat yang buka SIMONA otomatis tahu backend-nya tanpa perlu login
// dulu untuk mengaturnya (menghindari masalah "harus login untuk atur sync, tapi harus
// sync dulu untuk bisa login" saat pengguna baru pertama kali membuka di perangkat lain).
// Kosongkan (string kosong) kalau suatu saat mau nonaktifkan default ini.
const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxxQKdgXg0cDm6cevozWpB-_RAXCulkuZ8fc-2rnyMfeBdsqNjJ2dkBgoaYIr4dGrWcMA/exec';

/* ================= PENYIMPANAN TERPADU ================= */
// window.storage hanya tersedia saat SIMONA dijalankan di dalam Claude Artifacts.
// Saat di-hosting sendiri (GitHub Pages, Netlify, server kantor, dll), window.storage
// TIDAK ADA — jadi di sini otomatis jatuh ke localStorage bawaan browser, yang tersimpan
// permanen per-domain selama browser/cache tidak dibersihkan pengguna.
const simonaStorage = {
  async get(key, shared){
    if(window.storage && typeof window.storage.get === 'function'){
      try{ const r = await window.storage.get(key, shared); if(r) return r; }
      catch(e){ /* window.storage ada tapi gagal (mis. key belum pernah diset) -> coba localStorage */ }
    }
    try{
      const val = localStorage.getItem(key);
      return val !== null ? { key, value: val, shared: !!shared } : null;
    }catch(e){ return null; }
  },
  async set(key, value, shared){
    if(window.storage && typeof window.storage.set === 'function'){
      try{ const r = await window.storage.set(key, value, shared); if(r) return r; }
      catch(e){ /* fallback ke localStorage di bawah */ }
    }
    try{
      localStorage.setItem(key, value);
      return { key, value, shared: !!shared };
    }catch(e){ return null; }
  },
};

/* ================= BRAND MARK ================= */
// Wordmark SIMONA berbasis teks/CSS (bukan gambar eksternal) supaya tidak pernah rusak/expired
// seperti logo lama. size: 'lg' untuk halaman login, 'sm' untuk sidebar tiap menu.
function renderBrandMark(size){
  if(size==='lg'){
    return `
    <div class="flex flex-col items-center text-center">
      <div class="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
        <span class="text-white font-black text-3xl tracking-tight">S</span>
      </div>
      <h1 class="text-[30px] font-extrabold text-primary tracking-tight leading-none">SIMONA</h1>
      <p class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-1.5">Sistem Monitoring ArAp</p>
      <div class="flex items-center gap-2 mt-3">
        <span class="w-4 h-px bg-slate-300"></span>
        <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">PT New Ratna Motor</p>
        <span class="w-4 h-px bg-slate-300"></span>
      </div>
    </div>`;
  }
  return `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
        <span class="text-white font-black text-lg">S</span>
      </div>
      <div class="min-w-0">
        <p class="text-[15px] font-extrabold text-primary leading-none tracking-tight">SIMONA</p>
        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Sistem Monitoring ArAp</p>
      </div>
    </div>`;
}

/* ================= ICONS ================= */
const msi = (name, extra='') => `<span class="material-symbols-outlined ${extra}">${name}</span>`;

/* ================= CONSTANTS ================= */
const DEPARTMENTS = ['FPA Dept.','VSD Dept.','Acc & Tax Dept.','RB Dept.','Aftersales Dept.','LNK Dept.','Audit Internal Dept.','HC Dept.','GA & Legal Dept.','Corporate Strategy Dept.','Fleet & GSO Dept.','Direksi Dept.'];
const DOC_TYPES = ['AR','AP'];
const DOC_TYPE_LABEL = {AR:'AR (Account Receivable)', AP:'AP (Account Payable)'};
// "Disburse" adalah flag yang ditentukan di AWAL pengajuan dokumen, menandai apakah dana ini
// terkait dealer: untuk AR = akan disalurkan ke dealer; untuk AP = dibebankan ke dealer.
function disburseQuestion(docType){ return docType==='AP' ? 'Dibebankan ke Dealer?' : 'Disalurkan ke Dealer?'; }
function disburseShortLabel(docType){ return docType==='AP' ? 'Dibebankan Dealer' : 'Disalurkan Dealer'; }
const STATUS_LIST = ['Draft','Proses Tax','Proses Acc','Proses Evopay','Tagih','Cair','Bayar'];
const SUMBER = ['TAM','Affiliasi','Main Dealer','Lainnya'];
const DOCS_KEY = 'doctrack:documents:v2';
const USERS_KEY = 'doctrack:users:v2';
const SHEETS_URL_KEY = 'doctrack:sheets-url';

const STATUS_BADGE = {
  'Draft': 'bg-slate-100 text-slate-600',
  'Proses Tax': 'bg-amber-100 text-amber-700',
  'Proses Acc': 'bg-orange-100 text-orange-700',
  'Proses Evopay': 'bg-purple-100 text-purple-700',
  'Tagih': 'bg-blue-100 text-blue-700',
  'Cair': 'bg-green-100 text-green-700',
  'Bayar': 'bg-teal-100 text-teal-700',
};
const TYPE_BADGE = { AR:'bg-indigo-100 text-indigo-700', AP:'bg-rose-100 text-rose-700' };

function cryptoId(){ return 'id-' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function initials(name){ return (name||'').split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase(); }
function fmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return String(iso);
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) + ', ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function fmtDateShort(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return String(iso);
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}
function fmtIDR(n){ return 'Rp' + Number(n||0).toLocaleString('id-ID'); }
function timeAgo(iso){
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs/3600000);
  if(h < 1) return 'Baru saja';
  if(h < 24) return h+' jam lalu';
  const d = Math.floor(h/24);
  if(d===1) return 'Kemarin';
  if(d<7) return d+' hari lalu';
  return new Date(iso).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}
function fmtDuration(ms){
  if(ms<0) ms=0;
  const h = Math.floor(ms/3600000);
  if(h < 1) return '< 1 jam';
  if(h < 24) return h+' jam';
  const d = Math.floor(h/24), rh = h%24;
  return d+' hari'+(rh>0?' '+rh+' jam':'');
}
function isSettled(doc){ return (doc.docType==='AR' && doc.status==='Cair') || (doc.docType==='AP' && doc.status==='Bayar'); }
function hasDeptAccess(doc){
  if(!state.user) return false;
  if(state.user.role==='Super User' || state.user.role==='Admin') return true;
  return state.user.dept === doc.relatedDept;
}
function canEditStatus(doc){
  if(!state.user) return false;
  if(state.user.role==='Super User') return true;
  if(!hasDeptAccess(doc)) return false;
  return !!(state.user.permissions && state.user.permissions.editStatus);
}
function canEditDisburse(doc){
  if(!state.user) return false;
  if(state.user.role==='Super User') return true;
  if(!hasDeptAccess(doc)) return false;
  return !!(state.user.permissions && state.user.permissions.editDisburse);
}

