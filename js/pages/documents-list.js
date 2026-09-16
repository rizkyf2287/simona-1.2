/* ================= DOCUMENTS LIST ================= */
const DOCS_PER_PAGE = 10;
function filteredDocs(){
  return state.documents.filter(d=>{
    const s = state.search.toLowerCase();
    const matchSearch = !s || d.title.toLowerCase().includes(s) || d.docId.toLowerCase().includes(s) || (d.noInvoice||'').toLowerCase().includes(s) || (d.noSurat||'').toLowerCase().includes(s) || (d.noRangka||'').toLowerCase().includes(s) || (d.submittedBy||'').toLowerCase().includes(s);
    const matchStatus = state.statusFilter==='all' || d.status===state.statusFilter;
    const matchDept = state.deptFilter==='all' || d.relatedDept===state.deptFilter;
    const matchType = state.typeFilter==='all' || d.docType===state.typeFilter;
    return matchSearch && matchStatus && matchDept && matchType;
  }).sort((a,b)=> new Date(b.updatedAt)-new Date(a.updatedAt));
}

function renderDocuments(){
  const allDocs = filteredDocs();
  const totalPages = Math.max(1, Math.ceil(allDocs.length / DOCS_PER_PAGE));
  if(state.docsPage > totalPages) state.docsPage = totalPages;
  if(state.docsPage < 1) state.docsPage = 1;
  const startIdx = (state.docsPage-1) * DOCS_PER_PAGE;
  const docs = allDocs.slice(startIdx, startIdx + DOCS_PER_PAGE);
  return `
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
      <h3 class="text-[28px] md:text-[32px] font-bold text-primary leading-tight">Daftar Dokumen</h3>
      <p class="text-slate-500">Monitoring siklus hidup dokumen AR/AP &amp; klasifikasinya.</p>
    </div>
    <div class="flex gap-3 flex-wrap">
      <button type="button" data-action="export-all" class="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors active:scale-95">
        ${msi('download','text-[20px]')} Ekspor Semua
      </button>
      <button type="button" data-action="add-doc" data-doc-type="AR" class="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:opacity-90 transition-colors active:scale-95 shadow-md">
        ${msi('add','text-[20px]')} AR
      </button>
      <button type="button" data-action="add-doc" data-doc-type="AP" class="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white font-bold rounded-lg hover:opacity-90 transition-colors active:scale-95 shadow-md">
        ${msi('add','text-[20px]')} AP
      </button>
    </div>
  </div>

  <section class="bg-white p-5 rounded-xl soft-lift border border-slate-200 flex flex-wrap items-center gap-4">
    <div class="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex-1 min-w-[200px]">
      ${msi('search','text-slate-400')}
      <input id="docSearch" placeholder="Cari ID, judul, atau no. invoice..." class="w-full bg-transparent border-none p-0 text-sm focus:ring-0 outline-none">
    </div>
    <div class="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-w-[170px]">
      ${msi('category','text-slate-400')}
      <select id="typeFilter" class="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 cursor-pointer outline-none">
        <option value="all" ${state.typeFilter==='all'?'selected':''}>Semua Jenis</option>
        ${DOC_TYPES.map(t=>`<option value="${t}" ${state.typeFilter===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-w-[190px]">
      ${msi('filter_list','text-slate-400')}
      <select id="statusFilter" class="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 cursor-pointer outline-none">
        <option value="all" ${state.statusFilter==='all'?'selected':''}>Semua Status</option>
        ${STATUS_LIST.map(s=>`<option value="${s}" ${state.statusFilter===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-w-[190px]">
      ${msi('domain','text-slate-400')}
      <select id="deptFilter" class="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 cursor-pointer outline-none">
        <option value="all" ${state.deptFilter==='all'?'selected':''}>Semua Related Dept</option>
        ${DEPARTMENTS.map(d=>`<option value="${d}" ${state.deptFilter===d?'selected':''}>${d}</option>`).join('')}
      </select>
    </div>
  </section>

  <div class="bg-white rounded-xl soft-lift border border-slate-200 overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
      <h4 class="font-bold text-primary">Tabel Pelacakan Dokumen</h4>
      <span class="text-xs text-slate-400">${allDocs.length} hasil &middot; Halaman ${state.docsPage} dari ${totalPages}</span>
    </div>
    ${docs.length ? `
    <div class="overflow-x-auto">
    <table class="w-full text-left border-collapse text-sm">
      <thead><tr class="bg-slate-50 border-b border-slate-200">
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">ID Dokumen</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Judul</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Related Dept</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Jenis Dokumen</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">No. Surat</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">No. Rangka</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">No. Invoice</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Sumber</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Nominal</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Status</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Disburse</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Update</th>
        <th class="px-6 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 text-right">Aksi</th>
      </tr></thead>
      <tbody class="divide-y divide-slate-100">
        ${docs.map(d=>`
        <tr class="hover:bg-slate-50 transition-colors group">
          <td class="px-6 py-4"><span class="font-mono text-xs font-bold text-primary">${d.docId}</span></td>
          <td class="px-6 py-4">
            <p class="font-bold text-slate-800 truncate max-w-[200px]">${d.title}</p>
          </td>
          <td class="px-6 py-4">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">${initials(d.relatedDept)}</div>
              <span class="text-slate-500 text-xs">${d.relatedDept}</span>
            </div>
          </td>
          <td class="px-6 py-4"><span class="px-2.5 py-1 rounded text-[10px] font-black ${TYPE_BADGE[d.docType]}">${d.docType}</span></td>
          <td class="px-6 py-4 font-mono text-xs text-slate-600">${d.noSurat||'—'}</td>
          <td class="px-6 py-4 font-mono text-xs text-slate-600">${d.docType==='AP' ? (d.noRangka||'—') : '—'}</td>
          <td class="px-6 py-4 font-mono text-xs text-slate-600">${d.noInvoice||'—'}</td>
          <td class="px-6 py-4 text-xs text-slate-500">${d.sumber||'Lainnya'}</td>
          <td class="px-6 py-4"><span class="font-mono text-base font-extrabold text-slate-800">${fmtIDR(d.nominal)}</span></td>
          <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_BADGE[d.status]}">${d.status}</span></td>
          <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${d.disburse==='Yes'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">${d.disburse==='Yes'?'Yes':'No'}</span></td>
          <td class="px-6 py-4 text-slate-400 text-xs">${timeAgo(d.updatedAt)}</td>
          <td class="px-6 py-4 text-right whitespace-nowrap">
            <button type="button" data-open-detail="${d.id}" class="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95">Lihat Detail</button>
            <button type="button" data-edit="${d.id}" class="p-1.5 text-slate-400 hover:text-primary" title="Ubah">${msi('edit','text-[18px]')}</button>
            <button type="button" data-del="${d.id}" class="p-1.5 text-slate-400 hover:text-red-600" title="Hapus">${msi('delete','text-[18px]')}</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <div class="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
      <span class="text-xs text-slate-400">Menampilkan ${startIdx+1}–${Math.min(startIdx+DOCS_PER_PAGE, allDocs.length)} dari ${allDocs.length}</span>
      <div class="flex items-center gap-1.5">
        <button type="button" data-docs-page="prev" ${state.docsPage<=1?'disabled':''} class="px-3 py-1.5 rounded border text-xs font-bold ${state.docsPage<=1?'border-slate-100 text-slate-300 cursor-not-allowed':'border-slate-200 text-slate-600 hover:bg-slate-50'}">${msi('chevron_left','text-[16px]')}</button>
        ${Array.from({length: totalPages}, (_,i)=>i+1).filter(p=> p===1 || p===totalPages || Math.abs(p-state.docsPage)<=1).reduce((acc,p,i,arr)=>{
          if(i>0 && p-arr[i-1]>1) acc.push('...');
          acc.push(p);
          return acc;
        },[]).map(p=> p==='...' ? `<span class="px-2 text-xs text-slate-300">...</span>` : `<button type="button" data-docs-page="${p}" class="w-8 h-8 rounded text-xs font-bold ${p===state.docsPage?'bg-primary text-white':'text-slate-600 hover:bg-slate-100'}">${p}</button>`).join('')}
        <button type="button" data-docs-page="next" ${state.docsPage>=totalPages?'disabled':''} class="px-3 py-1.5 rounded border text-xs font-bold ${state.docsPage>=totalPages?'border-slate-100 text-slate-300 cursor-not-allowed':'border-slate-200 text-slate-600 hover:bg-slate-50'}">${msi('chevron_right','text-[16px]')}</button>
      </div>
    </div>
    ` : emptyState('Tidak ada dokumen yang cocok dengan filter/pencarian.')}
  </div>`;
}

