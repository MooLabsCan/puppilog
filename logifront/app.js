/* Puppy Litter Tracker – Vanilla JS */
// In-memory state only. No persistence.
const state = {
  litters: [], // list of all litters in memory
  activeIndex: null, // index of selected litter in litters
  litter: null, // convenience pointer to active litter
  ui: { parentsExpanded: false }, // UI state flags
  puppyDetailIndex: null, // index of puppy in current litter for details modal
  photosByLitter: {}, // cache: litterId => photos array
};

// Helpers
const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  children.forEach((c) => n.append(c));
  return n;
};
const fmtDateTime = (v) => v ? new Date(v).toLocaleString() : '—';

// Generate a compact inline SVG dog avatar with a configurable collar color
function puppyAvatarSVG(color = '#ff6fb3', label = ''){
  const c = color || '#ff6fb3';
  const lbl = (label ?? '').toString();
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.4)"/>
      </filter>
    </defs>
    <!-- Head -->
    <g fill-rule="evenodd">
      <circle cx="50" cy="46" r="22" fill="#f6d6a8"/>
      <circle cx="34" cy="38" r="14" fill="#e2b984"/>
      <circle cx="66" cy="38" r="14" fill="#e2b984"/>
      <!-- Eyes -->
      <circle cx="42" cy="44" r="7" fill="#fff"/>
      <circle cx="58" cy="44" r="7" fill="#fff"/>
      <circle cx="42" cy="44" r="3.6" fill="#2a2630"/>
      <circle cx="58" cy="44" r="3.6" fill="#2a2630"/>
      <!-- Nose & tongue -->
      <circle cx="50" cy="52" r="3.2" fill="#2a2630"/>
      <path d="M45 56c2 6 8 6 10 0 1 5-2 9-5 9s-6-4-5-9z" fill="#ff8aa0"/>
    </g>
    <!-- Collar (dynamic color) -->
    <g filter="url(#s)">
      <ellipse cx="50" cy="74" rx="26" ry="10" fill="${c}" opacity="0.9"/>
      <ellipse cx="50" cy="74" rx="22" ry="6" fill="#000" opacity="0.35"/>
    </g>
    <!-- Tag -->
    <g>
      <circle cx="72" cy="66" r="6" fill="#c9ccd4" stroke="#8b8f98" stroke-width="2"/>
      <ellipse cx="78" cy="78" rx="7" ry="9" fill="#b98b1d" stroke="#8d6a12" stroke-width="2"/>
      ${lbl ? `<text x="78" y="79" text-anchor="middle" font-size="8" fill="#fff" font-weight="700">${lbl}</text>` : ''}
    </g>
  </svg>`;
}

// Service bindings (stubbed for now)
const svc = window.PuppilogService;

function openModal() { $('#modal').style.display = 'flex'; }
function closeModal() { $('#modal').style.display = 'none'; }
function setModalHeader(){
  const titleEl = $('#modal-title');
  const subEl = $('#modal-subtitle');
  if(titleEl && subEl){
    if(modalMode === 'edit'){
      titleEl.innerText = 'Edit Litter Details';
      subEl.innerText = 'You can update any info now or later';
    } else {
      titleEl.innerText = 'Create New Litter';
      subEl.innerText = 'Answer a few quick questions';
    }
  }
}

// Questionnaire steps
const steps = [
  {
    key: 'mother',
    title: 'Mother Dog',
    render(container, data) {
      container.replaceChildren(
        el('div', { className: 'row' }, [
          wrapInput('Mother Name', 'motherName', 'text', data.motherName || ''),
          wrapInput('Breed', 'motherBreed', 'text', data.motherBreed || ''),
          wrapInput('Age (years)', 'motherAge', 'number', data.motherAge || '')
        ])
      );
    },
    collect() {
      return {
        motherName: $('#motherName').value.trim(),
        motherBreed: $('#motherBreed').value.trim(),
        motherAge: $('#motherAge').value.trim(),
      };
    },
    validate(d){ return d.motherName && d.motherBreed; }
  },
  {
    key: 'father',
    title: 'Father Dog',
    render(container, data) {
      container.replaceChildren(
        el('div', { className: 'row' }, [
          wrapInput('Father Name', 'fatherName', 'text', data.fatherName || ''),
          wrapInput('Breed', 'fatherBreed', 'text', data.fatherBreed || ''),
          wrapInput('Age (years)', 'fatherAge', 'number', data.fatherAge || '')
        ])
      );
    },
    collect() {
      return {
        fatherName: $('#fatherName').value.trim(),
        fatherBreed: $('#fatherBreed').value.trim(),
        fatherAge: $('#fatherAge').value.trim(),
      };
    },
    validate(d){ return d.fatherName && d.fatherBreed; }
  },
  {
    key: 'pregnancy',
    title: 'Pregnancy Setup',
    render(container, data) {
      container.replaceChildren(
        el('div', { className: 'row' }, [
          wrapInput('Pregnancy Start', 'pregStart', 'date', data.pregStart || ''),
          wrapInput('Expected Due Date', 'dueDate', 'date', data.dueDate || ''),
          wrapInput('Number Expected', 'expectedCount', 'number', data.expectedCount || '')
        ]),
        el('div', { className:'alert', style:'margin-top:12px' }, [
          'Tip: You can update water broke time and add puppies from the dashboard after creating the litter.'
        ])
      );
    },
    collect(){
      return {
        pregStart: $('#pregStart').value,
        dueDate: $('#dueDate').value,
        expectedCount: $('#expectedCount').value,
      };
    },
    validate(d){ return d.pregStart && d.dueDate; }
  }
];

let stepIndex = 0;
let draft = {};
let modalMode = 'create'; // 'create' | 'edit'

function wrapInput(label, id, type = 'text', value = ''){
  const inputEl = el('input', { id, type, value });
  return el('div', { className: 'input' }, [
    el('label', { htmlFor: id, innerText: label }),
    inputEl,
  ]);
}

function renderStep(){
  const container = $('#step-content');
  const step = steps[stepIndex];
  stepsDots();
  const title = el('h3', { innerText: step.title });
  container.replaceChildren(title);
  step.render(container, draft);
  $('#prev-step').disabled = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const nextText = modalMode === 'edit' ? (isLast ? 'Save Changes' : 'Next') : (isLast ? 'Create Litter' : 'Next');
  $('#next-step').innerText = nextText;
}

function stepsDots(){
  const s = $('#steps');
  s.replaceChildren(...steps.map((_, i)=>{
    const d = el('div', { className: 'step-dot' });
    if (i<=stepIndex) d.classList.add('active');
    return d;
  }));
}

function initModal(mode = 'create'){
  modalMode = mode;
  stepIndex = 0;
  if(mode === 'edit' && state.litter){
    draft = buildDraftFromLitter(state.litter);
  } else {
    draft = {};
  }
  setModalHeader();
  renderStep();
  openModal();
}

function collectAndNext(){
  const step = steps[stepIndex];
  // Always collect entered data but do not block on validation
  Object.assign(draft, step.collect());
  if(stepIndex < steps.length - 1){
    stepIndex++; renderStep();
  } else {
    if(modalMode === 'edit'){
      applyDraftToActiveLitter();
    } else {
      createLitterFromDraft();
    }
    closeModal();
  }
}

function skipStep(){
  // Do not require inputs; proceed while keeping whatever is in draft currently (also collect any partial)
  const step = steps[stepIndex];
  Object.assign(draft, step.collect());
  if(stepIndex < steps.length - 1){
    stepIndex++; renderStep();
  } else {
    if(modalMode === 'edit'){
      applyDraftToActiveLitter();
    } else {
      createLitterFromDraft();
    }
    closeModal();
  }
}

function createLitterFromDraft(){
  const newLitter = {
    parents: {
      mother: { name: draft.motherName, breed: draft.motherBreed, age: draft.motherAge },
      father: { name: draft.fatherName, breed: draft.fatherBreed, age: draft.fatherAge },
    },
    pregnancy: {
      start: draft.pregStart,
      expectedDue: draft.dueDate,
      expectedCount: draft.expectedCount ? Number(draft.expectedCount) : null,
      waterBroke: null,
    },
    puppies: [],
    createdAt: new Date().toISOString(),
  };
  state.litters.push(newLitter);
  state.activeIndex = state.litters.length - 1;
  state.litter = newLitter;
  // pretend save
  svc.saveLitter(newLitter).catch(()=>{});
  renderLitters();
  showDashboard();
}

function renderAll(){
  renderParents();
  renderPregnancy();
  renderPuppies();
}

function buildDraftFromLitter(l){
  return {
    motherName: l.parents?.mother?.name || '',
    motherBreed: l.parents?.mother?.breed || '',
    motherAge: l.parents?.mother?.age || '',
    fatherName: l.parents?.father?.name || '',
    fatherBreed: l.parents?.father?.breed || '',
    fatherAge: l.parents?.father?.age || '',
    pregStart: l.pregnancy?.start || '',
    dueDate: l.pregnancy?.expectedDue || '',
    expectedCount: l.pregnancy?.expectedCount != null ? String(l.pregnancy.expectedCount) : '',
  };
}

function applyDraftToActiveLitter(){
  const l = state.litter;
  if(!l) return;
  l.parents.mother.name = draft.motherName || '';
  l.parents.mother.breed = draft.motherBreed || '';
  l.parents.mother.age = draft.motherAge || '';
  l.parents.father.name = draft.fatherName || '';
  l.parents.father.breed = draft.fatherBreed || '';
  l.parents.father.age = draft.fatherAge || '';
  l.pregnancy.start = draft.pregStart || '';
  l.pregnancy.expectedDue = draft.dueDate || '';
  l.pregnancy.expectedCount = draft.expectedCount ? Number(draft.expectedCount) : null;
  // pretend save
  svc.saveLitter?.(l).catch(()=>{});
  renderLitters();
  renderAll();
}

// List/Navigation Views
function showList(){
  const listCard = $('#litters-card');
  const dash = $('#dashboard');
  listCard.style.display = '';
  dash.style.display = 'none';
  $('#back-to-list').style.display = 'none';
  const editBtn = $('#edit-litter');
  if(editBtn) editBtn.style.display = 'none';
}

function showDashboard(){
  const listCard = $('#litters-card');
  const dash = $('#dashboard');
  listCard.style.display = 'none';
  dash.style.display = '';
  $('#back-to-list').style.display = '';
  const editBtn = $('#edit-litter');
  if(editBtn) editBtn.style.display = '';
  // Start Parents card collapsed each time we open a litter dashboard
  if(state.ui) state.ui.parentsExpanded = false;
  renderAll();
}

function renderLitters(){
  const wrap = $('#litters-list');
  wrap.replaceChildren();
  if(!state.litters.length){
    wrap.append(el('div', { className:'empty', innerText:'No litters yet. Click "Start New Litter" to begin.' }));
    return;
  }
  state.litters.forEach((l, idx)=>{
    const title = `${l.parents.mother.name || 'Mother'} × ${l.parents.father.name || 'Father'}`;
    const subtitle = `Created ${new Date(l.createdAt).toLocaleString()} · Due ${l.pregnancy.expectedDue ? new Date(l.pregnancy.expectedDue).toLocaleDateString() : '—'}`;
    const row = el('div', { className:'puppy' });
    const left = el('div', {}, [
      el('div', { innerText: title }),
      el('div', { className:'small muted', innerText: subtitle })
    ]);
    const openBtn = el('button', { className:'button', innerText:'Open' });
    openBtn.addEventListener('click', ()=>{
      state.activeIndex = idx;
      state.litter = state.litters[idx];
      showDashboard();
    });
    const right = el('div', {}, [openBtn]);
    row.append(left,right);
    wrap.append(row);
  });
}

function renderParents(){
  const card = $('#parents-content');
  const l = state.litter;
  if(!l){
    card.className='empty';
    card.textContent='No litter selected. Choose one from the list or create a new litter.';
    return;
  }
  const expanded = !!(state.ui && state.ui.parentsExpanded);
  const m = l.parents.mother || {};
  const f = l.parents.father || {};

  if(!expanded){
    const row = el('div', { className:'row', style:'align-items:center' }, [
      el('div', { style:'flex:1' }, [
        el('div', { className:'small muted', innerText:'Mother' }),
        el('div', { innerText: m.name || '—' })
      ]),
      el('div', { style:'flex:1' }, [
        el('div', { className:'small muted', innerText:'Father' }),
        el('div', { innerText: f.name || '—' })
      ])
    ]);
    const hint = el('div', { className:'small muted', style:'margin-top:6px' , innerText:'Tap to expand details' });
    card.className='';
    card.replaceChildren(row, hint);
    return;
  }

  const grid = el('div', { className: 'row' }, [
    panel('Mother', [
      line('Name', m.name),
      line('Breed', m.breed),
      line('Age', m.age)
    ]),
    panel('Father', [
      line('Name', f.name),
      line('Breed', f.breed),
      line('Age', f.age)
    ])
  ]);
  const hint2 = el('div', { className:'small muted', style:'margin-top:6px' , innerText:'Tap to collapse' });
  card.className='';
  card.replaceChildren(grid, hint2);
}

function panel(title, lines){
  const wrap = el('div', { className: 'card', style:'flex:1; padding:12px' });
  wrap.append(el('div', { className:'muted small', innerText:title }));
  lines.forEach(([k,v])=>{
    const row = el('div', { style:'display:flex; justify-content:space-between; margin-top:8px' });
    row.append(el('div', { className:'small muted', innerText:k }));
    row.append(el('div', { innerText: v || '—' }));
    wrap.append(row);
  });
  return wrap;
}
function line(k,v){ return [k,v]; }

function renderPregnancy(){
  const l = state.litter;
  $('#kpi-start').innerText = l ? (l.pregnancy.start ? new Date(l.pregnancy.start).toLocaleDateString() : '—') : '—';
  $('#kpi-due').innerText = l ? (l.pregnancy.expectedDue ? new Date(l.pregnancy.expectedDue).toLocaleDateString() : '—') : '—';
  $('#kpi-expected').innerText = l && l.pregnancy.expectedCount != null ? String(l.pregnancy.expectedCount) : '—';
  $('#kpi-water').innerText = l ? fmtDateTime(l.pregnancy.waterBroke) : '—';
  $('#waterTime').value = l && l.pregnancy.waterBroke ? l.pregnancy.waterBroke.substring(0,16) : '';
  $('#pregnancy-note').innerText = l ? `Created ${new Date(l.createdAt).toLocaleString()}` : '';
}

function colorNameFromHex(hex){
  const map = {
    '#22c55e':'Green',
    '#2563eb':'Blue',
    '#60a5fa':'Light Blue',
    '#ef4444':'Red',
    '#f59e0b':'Yellow',
    '#a78bfa':'Purple',
    '#fb923c':'Orange',
    '#ec4899':'Pink'
  };
  if(!hex) return '';
  const key = hex.toLowerCase();
  return map[key] || '';
}

function renderPuppies(){
  const list = $('#puppies-list');
  list.replaceChildren();
  const l = state.litter;
  if(!l){
    return;
  }
  if(!l.puppies.length){
    return;
  }
  l.puppies
    .slice()
    .sort((a,b)=>{
      const ta = a && a.birthTime ? Date.parse(a.birthTime) : Infinity;
      const tb = b && b.birthTime ? Date.parse(b.birthTime) : Infinity;
      return ta - tb;
    })
    .forEach((p, idx)=>{
      const item = el('div', { className: 'puppy' });
      const avatar = el('div', { className:'avatar' });
      avatar.innerHTML = puppyAvatarSVG(p.color, (idx+1).toString());
      const displayName = p.name && p.name.trim() ? p.name.trim() : (colorNameFromHex(p.color) || `Puppy ${idx+1}`);
      const left = el('div', {}, [
        el('div', { innerText: displayName }),
        el('div', { className:'small muted', innerText: p.notes || '' })
      ]);
      const badgeText = [
        p.gender ? p.gender : null,
        p.birthTime ? new Date(p.birthTime).toLocaleDateString() : null
      ].filter(Boolean).join(' · ');
      const right = el('div', {}, [
        el('span', { className:'badge', innerText: badgeText || '—' })
      ]);
      item.prepend(avatar);
      item.append(left,right);
      item.addEventListener('click', ()=>{
        const realIndex = state.litter.puppies.indexOf(p);
        openPuppyDetails(realIndex);
      });
      list.append(item);
    });
}

function onSaveWater(){
  if(!state.litter){ alert('Create a litter first.'); return; }
  const val = $('#waterTime').value;
  state.litter.pregnancy.waterBroke = val || null;
  svc.updatePregnancy(state.litter.pregnancy).catch(()=>{});
  renderPregnancy();
}

// Puppies modal handlers
const COLOR_PALETTE = ['#22c55e','#2563eb','#60a5fa','#ef4444','#f59e0b','#a78bfa','#fb923c','#ec4899'];
const COLOR_NAME_MAP = {
  '#22c55e':'Green',
  '#2563eb':'Blue',
  '#60a5fa':'Light Blue',
  '#ef4444':'Red',
  '#f59e0b':'Yellow',
  '#a78bfa':'Purple',
  '#fb923c':'Orange',
  '#ec4899':'Pink'
};
function isPaletteColorName(name){
  if(!name) return false;
  const n = name.trim().toLowerCase();
  return Object.values(COLOR_NAME_MAP).some(v => v.toLowerCase() === n);
}

function openPuppyModal(){
  if(!state.litter){ alert('Create a litter first.'); return; }
  const m = $('#puppy-modal');
  const birth = $('#puppyBirth2');
  const nameEl = $('#puppyName2');
  const notes = $('#puppyNotes2');
  const colorSel = $('#puppyColor');
  if(birth) birth.value = '';
  if(notes) notes.value = '';
  if(nameEl) nameEl.value = '';
  // Randomly pick an unused color if possible; otherwise any color
  const used = new Set((state.litter.puppies || []).map(p => (p.color||'').toLowerCase()));
  const remaining = COLOR_PALETTE.filter(h => !used.has(h));
  const pickFrom = remaining.length ? remaining : COLOR_PALETTE;
  const choice = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  if(colorSel) colorSel.value = choice;
  if(nameEl) nameEl.value = COLOR_NAME_MAP[choice] || '';
  if(m) m.style.display = 'flex';
}
function closePuppyModal(){
  const m = $('#puppy-modal');
  if(m) m.style.display = 'none';
}
function confirmAddPuppy(){
  if(!state.litter){ alert('Create a litter first.'); return; }
  const birth = $('#puppyBirth2').value;
  const notes = $('#puppyNotes2').value.trim();
  const color = $('#puppyColor')?.value;
  const nameVal = $('#puppyName2')?.value?.trim() || '';
  if(!color){ alert('Please choose a collar color.'); return; }
  const puppy = { color };
  if(!nameVal){ puppy.name = COLOR_NAME_MAP[color] || ''; } else { puppy.name = nameVal; }
  if(birth) puppy.birthTime = birth;
  if(notes) puppy.notes = notes;
  if(puppy.birthTime){ ensurePuppyWeightLog(puppy); }
  state.litter.puppies.push(puppy);
  // Persist whole litter since addPuppy endpoint is not implemented yet
  svc.saveLitter?.(state.litter).catch(()=>{});
  renderPuppies();
  closePuppyModal();
}

// Puppy Details Modal
function ymd(date){
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function addDays(dateStr, plus){
  const d = new Date(dateStr+"T00:00:00");
  d.setDate(d.getDate()+plus);
  return ymd(d);
}
function ensurePuppyWeightLog(p){
  if(!p || !p.birthTime) return;
  if(!Array.isArray(p.weightLog) || !p.weightLog.length){
    const start = ymd(p.birthTime);
    p.weightLog = Array.from({length:42}, (_,i)=>({ date: addDays(start,i), kg: null }));
  }
}
function renderPuppyWeightLog(p){
  const wrap = $('#pdWeightLog');
  wrap.replaceChildren();
  // Collapse by default on mobile
  wrap.classList.add('collapsed');
  if(!p || !p.birthTime){
    wrap.append(el('div',{className:'empty', innerText:'Set birth time to generate a 42-day weight log.'}));
    return;
  }
  ensurePuppyWeightLog(p);
  const today = ymd(new Date());
  // Show only rows up to today (hide future)
  const rows = p.weightLog
    .map((r, idx) => ({...r, idx}))
    .filter(r => r.date <= today);

  if(!rows.length){
    wrap.append(el('div',{className:'empty', innerText:'Weights will appear once birth time is set or the first day arrives.'}));
    return;
  }

  const table = el('table', { className:'weight-table' });
  const thead = el('thead');
  const thr = el('tr');
  thr.append(
    el('th', { innerText:'Day' }),
    el('th', { innerText:'Date' }),
    el('th', { innerText:"Weight (kg)" })
  );
  thead.append(thr);
  const tbody = el('tbody');

  rows.forEach((r, i)=>{
    const tr = el('tr');
    tr.append(
      el('td', { innerText: `Day ${r.idx+1}` }),
      el('td', { innerText: r.date }),
      (()=>{
        const td = el('td');
        const cell = el('div', { className:'cell-editable', innerText: r.kg != null ? String(r.kg) : '—' });
        cell.addEventListener('click', ()=> openWeightEdit(r.idx));
        td.append(cell);
        return td;
      })()
    );
    tbody.append(tr);
  });
  table.append(thead, tbody);
  wrap.append(table);
}
// Weight edit modal context
const weightCtx = { idx: null, day: null };

function updateWeightHeader(p){
  const title = $('#w-title');
  const sub = $('#w-sub');
  const dateLbl = $('#w-date-label');
  if(!p || weightCtx.day==null){
    if(title) title.innerText = 'Edit Weight';
    if(sub) sub.innerText = '—';
    if(dateLbl) dateLbl.innerText = '—';
    return;
  }
  const entry = (p.weightLog||[])[weightCtx.day];
  if(entry){
    if(title) title.innerText = `Day ${weightCtx.day+1}`;
    if(sub) sub.innerText = `${entry.date}`;
    if(dateLbl) dateLbl.innerText = entry.date;
  }
}
function openWeightEdit(dayIndex){
  if(state.puppyDetailIndex==null) return;
  const p = state.litter.puppies[state.puppyDetailIndex];
  ensurePuppyWeightLog(p);
  weightCtx.idx = state.puppyDetailIndex;
  weightCtx.day = dayIndex;
  const entry = p.weightLog[dayIndex];
  $('#w-input').value = entry && entry.kg!=null ? String(entry.kg) : '';
  updateWeightHeader(p);
  $('#weight-edit-modal').style.display = 'flex';
}
function closeWeightEdit(){
  $('#weight-edit-modal').style.display = 'none';
  weightCtx.idx = null; weightCtx.day = null;
}
function saveWeightEdit(){
  if(weightCtx.idx==null || weightCtx.day==null) { closeWeightEdit(); return; }
  const p = state.litter.puppies[weightCtx.idx];
  const v = $('#w-input').value.trim();
  p.weightLog[weightCtx.day].kg = v === '' ? null : Number(v);
  // Persist entire litter for now
  svc.saveLitter?.(state.litter).catch(()=>{});
  renderPuppyWeightLog(p);
  updateWeightHeader(p);
  closeWeightEdit();
}
function stepWeightEdit(delta){
  if(weightCtx.idx==null || weightCtx.day==null) return;
  const p = state.litter.puppies[weightCtx.idx];
  const max = (p.weightLog||[]).length - 1;
  let next = weightCtx.day + delta;
  // Prevent moving beyond today
  const today = ymd(new Date());
  while(next>=0 && next<=max){
    const d = p.weightLog[next];
    if(d && d.date <= today) break;
    next += delta; // skip future
  }
  if(next<0 || next>max) return;
  weightCtx.day = next;
  const entry = p.weightLog[next];
  $('#w-input').value = entry && entry.kg!=null ? String(entry.kg) : '';
  updateWeightHeader(p);
}

async function ensurePhotosLoaded(litterId){
  if(!litterId) return [];
  if(!state.photosByLitter[litterId]){
    try{
      const items = await svc.loadPhotos?.(litterId);
      state.photosByLitter[litterId] = Array.isArray(items) ? items : [];
    }catch(e){ state.photosByLitter[litterId] = []; }
  }
  return state.photosByLitter[litterId];
}
function timeFromTakenAt(t){
  try{ const d = new Date(t); return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }catch(_){ return ''; }
}
async function renderPuppyGallery(p){
  const sec = $('#pdGallerySection');
  const wrap = $('#pdGallery');
  if(!sec || !wrap) return;
  wrap.replaceChildren();
  if(!p || !p.id){
    wrap.append(el('div', { className:'empty', innerText:'Save this puppy first to see tagged photos.' }));
    return;
  }
  const litterId = state.litter?.id;
  const items = await ensurePhotosLoaded(litterId);
  const mine = (items||[]).filter(it => Array.isArray(it.puppyIds) && it.puppyIds.includes(p.id));
  if(!mine.length){
    wrap.append(el('div', { className:'empty', innerText:'No photos yet with this puppy.' }));
    return;
  }
  // group by date (YYYY-MM-DD)
  const groups = {};
  mine.sort((a,b)=> (b.takenAt||'').localeCompare(a.takenAt||''));
  mine.forEach(it=>{
    const key = (it.takenAt||'').slice(0,10);
    if(!groups[key]) groups[key] = [];
    groups[key].push(it);
  });
  Object.keys(groups).sort((a,b)=> b.localeCompare(a)).forEach(date =>{
    const gWrap = el('div', { className:'gallery-group' });
    const head = el('div', { className:'g-head' }, [
      el('div', { className:'date', innerText: new Date(date).toLocaleDateString() }),
      el('div', { className:'small muted', innerText: `${groups[date].length} photo${groups[date].length>1?'s':''}` })
    ]);
    const grid = el('div', { className:'gallery-grid' });
    groups[date].forEach(it=>{
      const cell = el('div', { className:'thumb' });
      const img = el('img', { src: it.imageDataUrl, alt: 'Puppy photo' });
      const tm = el('div', { className:'time', innerText: timeFromTakenAt(it.takenAt) });
      cell.append(img, tm);
      grid.append(cell);
    });
    gWrap.append(head, grid);
    wrap.append(gWrap);
  });
}

function openPuppyDetails(index){
  if(!state.litter) return;
  state.puppyDetailIndex = index;
  const p = state.litter.puppies[index];
  // Populate fields
  $('#pdName').value = p.name || '';
  $('#pdColor').value = p.color || '';
  $('#pdBirth').value = p.birthTime ? p.birthTime.substring(0,16) : '';
  $('#pdNotes').value = p.notes || '';
  $('#pdGender').value = p.gender || '';
  // Render avatar with collar color and index label
  const av = document.getElementById('pd-avatar');
  if (av) { av.innerHTML = puppyAvatarSVG(p.color, String(index+1)); }
  // today weight suggestion
  const today = ymd(new Date());
  const todayEntry = (p.weightLog||[]).find(r=>r.date===today);
  $('#pdTodayWeight').value = todayEntry && todayEntry.kg!=null ? todayEntry.kg : '';
  renderPuppyWeightLog(p);
  // initialize mobile collapse toggle label/state
  const tbtn = $('#pd-log-toggle');
  const log = $('#pdWeightLog');
  if(tbtn && log){
    const update = ()=>{ tbtn.innerText = log.classList.contains('collapsed') ? 'Show Weight Log' : 'Hide Weight Log'; };
    tbtn.onclick = ()=>{ log.classList.toggle('collapsed'); update(); };
    update();
  }
  // Reset and hide gallery section initially
  const gsec = $('#pdGallerySection');
  const gwrap = $('#pdGallery');
  if(gsec){ gsec.style.display = 'none'; }
  if(gwrap){ gwrap.replaceChildren(); }
  $('#puppy-detail-modal').style.display = 'flex';
}
function closePuppyDetails(){
  $('#puppy-detail-modal').style.display = 'none';
  state.puppyDetailIndex = null;
}
function savePuppyDetails(){
  if(state.puppyDetailIndex==null || !state.litter) { closePuppyDetails(); return; }
  const p = state.litter.puppies[state.puppyDetailIndex];
  p.name = $('#pdName').value.trim();
  p.color = $('#pdColor').value;
  const birthVal = $('#pdBirth').value;
  p.birthTime = birthVal || null;
  p.notes = $('#pdNotes').value.trim();
  const gender = $('#pdGender').value;
  if(gender) p.gender = gender; else delete p.gender;
  // Ensure/generate weight log if birth recorded
  if(p.birthTime){ ensurePuppyWeightLog(p); }
  // Apply today's weight if provided
  const todayVal = $('#pdTodayWeight').value;
  if(todayVal && p.birthTime){
    const today = ymd(new Date());
    ensurePuppyWeightLog(p);
    const entry = p.weightLog.find(r=>r.date===today);
    if(entry) entry.kg = Number(todayVal);
  }
  // Persist
  svc.saveLitter?.(state.litter).catch(()=>{});
  renderPuppies();
  closePuppyDetails();
}

let camStream = null; let camCapturedDataUrl = null;
async function openCameraModal(){
  if(!state.litter){ alert('Open a litter first.'); return; }
  $('#camera-modal').style.display = 'flex';
  $('#cam-preview').style.display = 'none';
  $('#cam-video').style.display = '';
  $('#cam-retake').style.display = 'none';
  $('#cam-capture').style.display = '';
  $('#cam-meta').style.display = 'none';
  $('#cam-save').disabled = true;
  $('#cam-time').value = new Date().toISOString().slice(0,16);
  // populate puppies
  const list = $('#cam-puppies');
  list.replaceChildren();
  (state.litter.puppies||[]).forEach(p=>{
    const id = `pchk_${p.id||Math.random().toString(36).slice(2)}`;
    const lbl = p.name && p.name.trim() ? p.name.trim() : (colorNameFromHex(p.color)||'Puppy');
    const row = el('label', { className:'puppy', style:'cursor:pointer' }, [
      (()=>{ const cb = el('input', { type:'checkbox', id, value: p.id||'' }); cb.style.marginRight='8px'; return cb; })(),
      el('span', { innerText: lbl })
    ]);
    list.append(row);
  });
  await startCamera();
}
async function startCamera(){
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' }, audio:false });
    const v = $('#cam-video');
    v.srcObject = camStream;
    await v.play();
  }catch(e){
    alert('Unable to access camera: '+ e.message);
  }
}
function stopCamera(){
  try{
    if(camStream){ camStream.getTracks().forEach(t=>t.stop()); }
  }catch(_){ }
  camStream = null;
}
function closeCameraModal(){
  stopCamera();
  $('#camera-modal').style.display = 'none';
}
function retakePhoto(){
  camCapturedDataUrl = null;
  $('#cam-preview').style.display = 'none';
  $('#cam-video').style.display = '';
  $('#cam-retake').style.display = 'none';
  $('#cam-capture').style.display = '';
  $('#cam-meta').style.display = 'none';
  $('#cam-save').disabled = true;
}
function capturePhoto(){
  const v = $('#cam-video');
  const canvas = $('#cam-canvas');
  const w = v.videoWidth || v.clientWidth; const h = v.videoHeight || v.clientHeight;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(v, 0, 0, w, h);
  camCapturedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const img = $('#cam-preview');
  img.src = camCapturedDataUrl;
  img.style.display = '';
  $('#cam-video').style.display = 'none';
  $('#cam-retake').style.display = '';
  $('#cam-capture').style.display = 'none';
  $('#cam-meta').style.display = '';
  $('#cam-save').disabled = false;
  stopCamera();
}
async function saveCapturedPhoto(){
  if(!state.litter){ closeCameraModal(); return; }
  if(!camCapturedDataUrl){ alert('Capture a photo first.'); return; }
  const takenAt = $('#cam-time').value || new Date().toISOString().slice(0,16);
  const selected = Array.from($('#cam-puppies').querySelectorAll('input[type=checkbox]:checked'))
    .map(cb => parseInt(cb.value,10)).filter(v=>!isNaN(v));
  try{
    const item = await svc.savePhoto({ litterId: state.litter.id, imageDataUrl: camCapturedDataUrl, takenAt, puppyIds: selected });
    console.debug('Saved photo', item);
    // Invalidate/refresh photo cache for this litter
    if(state.litter?.id){
      // Force reload next time
      delete state.photosByLitter[state.litter.id];
      // Optionally, if gallery open for current puppy and it was tagged, refresh it immediately
      if(state.puppyDetailIndex!=null && Array.isArray(item?.puppyIds) && item.puppyIds.length){
        const openSec = document.getElementById('pdGallerySection');
        if(openSec && openSec.style.display !== 'none'){
          ensurePhotosLoaded(state.litter.id).then(()=>{
            const p = state.litter.puppies[state.puppyDetailIndex];
            renderPuppyGallery(p);
          });
        }
      }
    }
    closeCameraModal();
  }catch(e){
    alert('Failed to save photo: '+ e.message);
  }
}

function bindEvents(){
  $('#start-new').addEventListener('click', ()=>initModal('create'));
  $('#start-new-2').addEventListener('click', ()=>initModal('create'));
  $('#edit-litter')?.addEventListener('click', ()=>initModal('edit'));
  $('#back-to-list').addEventListener('click', ()=>{ showList(); });
  $('#cancel-modal').addEventListener('click', closeModal);
  $('#prev-step').addEventListener('click', ()=>{ if(stepIndex>0){stepIndex--; renderStep();} });
  $('#skip-step')?.addEventListener('click', skipStep);
  $('#next-step').addEventListener('click', collectAndNext);
  $('#save-water').addEventListener('click', onSaveWater);
  // Parents card collapse/expand
  const pc = $('#parents-card');
  if(pc){
    pc.classList.add('collapsible');
    pc.addEventListener('click', ()=>{
      if(!state.litter) return;
      state.ui.parentsExpanded = !state.ui.parentsExpanded;
      renderParents();
    });
  }
  // Puppies modal events
  $('#add-puppy').addEventListener('click', openPuppyModal);
  $('#puppy-save').addEventListener('click', confirmAddPuppy);
  $('#puppy-cancel').addEventListener('click', closePuppyModal);
  const colorSel = $('#puppyColor');
  if(colorSel){
    colorSel.addEventListener('change', ()=>{
      const nameEl = $('#puppyName2');
      if(!nameEl) return;
      const current = nameEl.value.trim();
      if(!current || isPaletteColorName(current)){
        nameEl.value = COLOR_NAME_MAP[colorSel.value] || '';
      }
    });
  }
  $('#reset-session').addEventListener('click', ()=>{ 
    state.litters = [];
    state.activeIndex = null;
    state.litter = null;
    renderLitters();
    showList();
  });
  // Camera bindings
  $('#open-camera')?.addEventListener('click', openCameraModal);
  $('#cam-close')?.addEventListener('click', closeCameraModal);
  $('#cam-cancel')?.addEventListener('click', closeCameraModal);
  $('#cam-capture')?.addEventListener('click', capturePhoto);
  $('#cam-retake')?.addEventListener('click', retakePhoto);
  $('#cam-save')?.addEventListener('click', saveCapturedPhoto);
  // Gallery toggle buttons in Puppy Details
  $('#pd-gallery-toggle')?.addEventListener('click', async ()=>{
    if(state.puppyDetailIndex==null) return;
    const p = state.litter.puppies[state.puppyDetailIndex];
    const sec = $('#pdGallerySection');
    if(!sec) return;
    sec.style.display = '';
    await renderPuppyGallery(p);
    // scroll into view within modal
    sec.scrollIntoView({ behavior:'smooth', block:'start' });
  });
  $('#pd-gallery-close')?.addEventListener('click', ()=>{
    const sec = $('#pdGallerySection');
    if(sec) sec.style.display = 'none';
  });
  // Puppy details modal buttons
  $('#pd-cancel')?.addEventListener('click', closePuppyDetails);
  $('#pd-save')?.addEventListener('click', ()=>{
    // Soft requirement: if birth is set, recommend gender and weight
    const birth = $('#pdBirth').value;
    const gender = $('#pdGender').value;
    const todayW = $('#pdTodayWeight').value;
    if(birth && (!gender || !todayW)){
      // Non-blocking notice per requirement that it can be skipped
      console.info('Birth recorded — consider adding gender and today\'s weight.');
    }
    savePuppyDetails();
  });
  // Auto-name on color change if name is empty or a palette name
  $('#pdColor')?.addEventListener('change', ()=>{
    const nameEl = $('#pdName');
    if(nameEl){
      const current = nameEl.value.trim();
      if(!current || isPaletteColorName(current)){
        nameEl.value = COLOR_NAME_MAP[$('#pdColor').value] || '';
      }
    }
    // Update avatar preview in details header to reflect new color immediately
    const av = document.getElementById('pd-avatar');
    if (av && state.puppyDetailIndex != null && state.litter) {
      const label = String(state.puppyDetailIndex + 1);
      av.innerHTML = puppyAvatarSVG($('#pdColor').value, label);
    }
  });
  // Birth input hint updates (no mutation to model until save)
  $('#pdBirth')?.addEventListener('change', ()=>{
    const v = $('#pdBirth').value;
    const hint = $('#pd-hint');
    if(v){
      hint.innerText = 'Daily weight log (42 days from birth) will be generated on Save.';
    } else {
      hint.innerText = 'Daily weight log (42 days from birth). Edit as needed.';
    }
  });
  // Weight edit modal bindings
  $('#w-cancel')?.addEventListener('click', closeWeightEdit);
  $('#w-save')?.addEventListener('click', saveWeightEdit);
  $('#wprev')?.addEventListener('click', ()=> stepWeightEdit(-1));
  $('#wnext')?.addEventListener('click', ()=> stepWeightEdit(1));
}

window.addEventListener('DOMContentLoaded', () => {
  // confirm backend session exists (optional, non-blocking)
  svc.checkSession?.().catch(()=>{});
  bindEvents();
  // Initialize by loading all litters from backend
  if (svc.loadLitters) {
    svc.loadLitters()
      .then(items => { state.litters = Array.isArray(items) ? items : []; })
      .catch(() => { state.litters = []; })
      .finally(() => { renderLitters(); showList(); });
  } else {
    renderLitters();
    showList();
  }
});
