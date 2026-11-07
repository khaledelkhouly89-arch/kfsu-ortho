/* KFSU Orthopedic & Trauma Surgery — Patient Registry
   Plain JavaScript, no build step. Data lives in Supabase (live mode)
   or in this browser's storage (demo mode, when config.js is empty). */
(function () {
'use strict';

const CFG = window.KFSU_CONFIG || {};
const DEMO = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const IDLE_MINUTES = 30;
// Invite / password-reset links arrive with #...type=invite|recovery — remember before the client consumes it
const AUTH_LINK_TYPE = ((location.hash || '').match(/type=(invite|recovery|signup|magiclink)/) || [])[1] || '';

/* ======================= Reference lists ======================= */
const DISTRICTS = ['Kafr El-Sheikh City (مدينة كفر الشيخ)','Desouk (دسوق)','Baltim (بلطيم)','Burullus (البرلس)','El-Hamoul (الحامول)','Biyala (بيلا)','Sidi Salem (سيدي سالم)','Fouh (فوه)','Metoubes (مطوبس)','Qallin (قلين)','El-Riyadh (الرياض)','Outside governorate (خارج المحافظة)'];
const ADMISSION = ['Outpatient clinic (عيادة خارجية)','Emergency / trauma (طوارئ)','Inter-hospital referral (تحويل)','Health insurance / state-funded (تأمين صحي / نفقة دولة)','Post-op follow-up (متابعة)'];
const MECHANISMS = ['Road traffic accident (حادث طريق)','Fall from height (سقوط من علو)','Simple fall / domestic (سقوط بسيط)','Sports / twisting injury (إصابة ملاعب)','Workplace / crush injury (إصابة عمل)','Gunshot / assault (طلق ناري / اعتداء)','Degenerative / osteoarthritis (خشونة)','Disc prolapse / radiculopathy (انزلاق غضروفي)','Paediatric deformity / DDH / clubfoot (تشوهات أطفال)','Non-union / malunion / deformity (عدم التئام)','Infection / osteomyelitis (التهاب / صديد)','Bone or soft-tissue tumour (ورم)','Other'];
const UNITS = ['Trauma & Ilizarov Reconstruction Unit','Arthroscopy & Sports Medicine Unit','Arthroplasty & Joint Replacement Unit','Spine Surgery Unit','Pediatric Orthopedics & Deformity Unit','Hand, Upper Limb & Microsurgery Unit','Foot & Ankle Unit','General Orthopedics'];
const STATUSES = [
  ['New','s-new'],['Under investigation','s-inv'],['Conservative management','s-fu'],['Awaiting surgery','s-await'],
  ['Scheduled for surgery','s-sched'],['Admitted','s-adm'],['Operated','s-op'],['Follow-up','s-fu'],['Discharged','s-dc']];
const TRIAGE = [['Stat trauma','t-stat'],['Urgent','t-urgent'],['Priority','t-priority'],['Routine','t-routine']];
const RED_FLAGS = ['Open fracture','Neurovascular deficit','Suspected compartment syndrome','Unreduced dislocation','Cauda equina symptoms','Suspected septic joint / infection','Unable to bear weight / locked joint'];
const NON_CRITICAL_FLAGS = ['Unable to bear weight / locked joint'];
const IMAGING = ['X-ray','CT','MRI','Ultrasound','DEXA','Pre-op labs'];
const COMORBID = ['Diabetes','Hypertension','Cardiac disease','Renal disease','Anticoagulants','Smoker','Osteoporosis','Pregnancy'];
const VISIT_TYPES = ['Follow-up','Clinic visit','Admission','Post-op','Wound / dressing','Imaging result','Discharge','Note'];
const BOOK_STATUSES = [['Scheduled','s-sched'],['Done','s-op'],['Postponed','s-await'],['Cancelled','s-cancel']];
const GOV = {'01':'Cairo','02':'Alexandria','03':'Port Said','04':'Suez','11':'Damietta','12':'Dakahlia','13':'Sharqia','14':'Qalyubia','15':'Kafr El-Sheikh','16':'Gharbia','17':'Monufia','18':'Beheira','19':'Ismailia','21':'Giza','22':'Beni Suef','23':'Fayoum','24':'Minya','25':'Assiut','26':'Sohag','27':'Qena','28':'Aswan','29':'Luxor','31':'Red Sea','32':'New Valley','33':'Matrouh','34':'North Sinai','35':'South Sinai','88':'Born abroad'};
const DX_SUGGEST = ['Distal radius fracture','Scaphoid fracture','Proximal humerus fracture','Clavicle fracture','Supracondylar humerus fracture','Neck of femur fracture','Intertrochanteric fracture','Femoral shaft fracture','Tibial plateau fracture','Tibial shaft fracture','Bimalleolar ankle fracture','Calcaneal fracture','ACL tear','Meniscal tear','Knee osteoarthritis','Hip osteoarthritis','Avascular necrosis of femoral head','Lumbar disc prolapse','Lumbar canal stenosis','Spondylodiscitis','DDH','Clubfoot (CTEV)','Flexible flatfoot','Hallux valgus','Non-union','Chronic osteomyelitis','Carpal tunnel syndrome','Flexor tendon injury','Recurrent shoulder dislocation','Rotator cuff tear'];
const PROC_SUGGEST = ['ORIF with plate & screws','Intramedullary nailing','K-wire fixation','Closed reduction + cast','External fixator','Ilizarov frame','Total knee arthroplasty','Total hip arthroplasty','Hemiarthroplasty (bipolar)','Arthroscopic ACL reconstruction','Arthroscopic meniscal repair','Arthroscopic meniscectomy','Shoulder arthroscopy / Bankart repair','Posterior lumbar decompression + fusion','Discectomy','Debridement & irrigation','Tendon repair','Carpal tunnel release','Implant removal','Corrective osteotomy','Calcaneo-stop / subtalar arthroereisis','Ponseti cast / tenotomy'];

const TRIAGE_RANK = Object.fromEntries(TRIAGE.map((t, i) => [t[0], i]));
const statusCls = s => (STATUSES.find(x => x[0] === s) || [0, 's-fu'])[1];
const triageCls = t => (TRIAGE.find(x => x[0] === t) || [0, 't-routine'])[1];
const bookCls = s => (BOOK_STATUSES.find(x => x[0] === s) || [0, 's-fu'])[1];

/* ======================= Helpers ======================= */
const $ = id => document.getElementById(id);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const isoDate = (d = new Date()) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
const fmtDate = v => { if (!v) return ''; const d = new Date(String(v).length === 10 ? v + 'T12:00:00' : v); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}); };
const fmtDateTime = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toLocaleString('en-GB', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}); };
const fmtDay = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
const options = (list, withBlank, blankLabel) => (withBlank ? `<option value="">${esc(blankLabel || '—')}</option>` : '') + list.map(v => { const x = Array.isArray(v) ? v[0] : v; return `<option value="${esc(x)}">${esc(x)}</option>`; }).join('');
const badge = (text, cls) => text ? `<span class="badge ${cls}">${esc(text)}</span>` : '';
const normDigits = s => String(s || '').replace(/[^\d+]/g, '');
const shortUnit = u => String(u || '').replace(/ Unit$/, '').replace(' & Joint Replacement', '').replace(' Reconstruction', '');
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.className = isError ? 'error' : '';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), isError ? 7000 : 3500);
}
function fail(e, what) {
  console.error(e);
  let m = (e && e.message) || String(e);
  if (/relation .* does not exist|Could not find the table/i.test(m)) m = 'Database tables not found — run supabase-setup.sql in Supabase (see SETUP-GUIDE).';
  if (/Failed to fetch|NetworkError/i.test(m)) m = 'No connection to the database server — check the internet connection and try again.';
  if (/JWT|not authenticated|permission denied/i.test(m)) m = 'Your session has expired or you lack permission. Please sign in again.';
  toast((what ? what + ': ' : '') + m, true);
}

/* ======================= Data stores ======================= */
function LocalStore() {
  const KEY = 'kfsu_ortho_demo_v1';
  let mem = null;
  const user = { email: 'demo user (this browser only)' };
  function db() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { mem = null; }
    if (!mem || !Array.isArray(mem.patients)) mem = { patients: [], visits: [], bookings: [], seq: 0 };
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* storage unavailable: keep in memory */ } }
  const byDesc = k => (a, b) => String(b[k]).localeCompare(String(a[k]));
  return {
    mode: 'demo',
    async getUser() { return user; },
    async signIn() { return user; },
    async signOut() {},
    async updatePassword() {},
    onAuth() {},
    async listPatients() { return clone(db().patients); },
    async createPatient(p) {
      const d = db(); d.seq++;
      const now = new Date().toISOString();
      const row = Object.assign({}, p, { id: uid(), mrn: 'KFS-ORT-' + new Date().getFullYear() + '-' + String(d.seq).padStart(5, '0'), created_at: now, updated_at: now, created_by_email: user.email, updated_by_email: user.email });
      d.patients.push(row); save(); return clone(row);
    },
    async updatePatient(id, patch) {
      const r = db().patients.find(x => x.id === id);
      if (!r) throw new Error('Patient not found');
      Object.assign(r, patch, { id: r.id, mrn: r.mrn, created_at: r.created_at, updated_at: new Date().toISOString(), updated_by_email: user.email });
      save(); return clone(r);
    },
    async deletePatient(id) {
      const d = db();
      d.patients = d.patients.filter(x => x.id !== id);
      d.visits = d.visits.filter(x => x.patient_id !== id);
      d.bookings = d.bookings.filter(x => x.patient_id !== id);
      save();
    },
    async listVisits(pid) { return clone(db().visits.filter(v => v.patient_id === pid).sort((a, b) => (b.visit_date + b.created_at).localeCompare(a.visit_date + a.created_at))); },
    async listAllVisits() { return clone(db().visits.slice().sort(byDesc('visit_date'))); },
    async addVisit(v) { const row = Object.assign({ id: uid(), created_at: new Date().toISOString(), author_email: user.email }, v); db().visits.push(row); save(); return clone(row); },
    async deleteVisit(id) { const d = db(); d.visits = d.visits.filter(x => x.id !== id); save(); },
    async listBookings(from, to) { return clone(db().bookings.filter(b => b.op_date >= from && b.op_date <= to)); },
    async listPatientBookings(pid) { return clone(db().bookings.filter(b => b.patient_id === pid).sort(byDesc('op_date'))); },
    async listAllBookings() { return clone(db().bookings); },
    async addBooking(b) { const row = Object.assign({ id: uid(), created_at: new Date().toISOString(), created_by_email: user.email }, b); db().bookings.push(row); save(); return clone(row); },
    async updateBooking(id, patch) { const r = db().bookings.find(x => x.id === id); if (!r) throw new Error('Booking not found'); Object.assign(r, patch); save(); return clone(r); },
    async deleteBooking(id) { const d = db(); d.bookings = d.bookings.filter(x => x.id !== id); save(); }
  };
}

function SupabaseStore() {
  if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase library failed to load (vendor/supabase.js missing).');
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const chk = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  async function fetchAll(table, order, build) {
    const size = 1000; let from = 0, out = [];
    for (;;) {
      let q = sb.from(table).select('*');
      if (build) q = build(q);
      const rows = chk(await q.order(order, { ascending: false }).order('id').range(from, from + size - 1));
      out = out.concat(rows);
      if (rows.length < size) break;
      from += size;
    }
    return out;
  }
  return {
    mode: 'live',
    async getUser() { const r = await sb.auth.getSession(); return r.data && r.data.session ? r.data.session.user : null; },
    async signIn(email, password) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) throw new Error(r.error.message); return r.data.user; },
    async signOut() { await sb.auth.signOut(); },
    async updatePassword(password) { const r = await sb.auth.updateUser({ password }); if (r.error) throw new Error(r.error.message); },
    onAuth(cb) { sb.auth.onAuthStateChange((ev, session) => cb(ev, session ? session.user : null)); },
    listPatients: () => fetchAll('patients', 'created_at'),
    async createPatient(p) { return chk(await sb.from('patients').insert(p).select().single()); },
    async updatePatient(id, p) { return chk(await sb.from('patients').update(p).eq('id', id).select().single()); },
    async deletePatient(id) { chk(await sb.from('patients').delete().eq('id', id)); },
    async listVisits(pid) { return chk(await sb.from('visits').select('*').eq('patient_id', pid).order('visit_date', { ascending: false }).order('created_at', { ascending: false })); },
    listAllVisits: () => fetchAll('visits', 'visit_date'),
    async addVisit(v) { return chk(await sb.from('visits').insert(v).select().single()); },
    async deleteVisit(id) { chk(await sb.from('visits').delete().eq('id', id)); },
    listBookings: (from, to) => fetchAll('or_bookings', 'op_date', q => q.gte('op_date', from).lte('op_date', to)),
    async listPatientBookings(pid) { return chk(await sb.from('or_bookings').select('*').eq('patient_id', pid).order('op_date', { ascending: false })); },
    listAllBookings: () => fetchAll('or_bookings', 'op_date'),
    async addBooking(b) { return chk(await sb.from('or_bookings').insert(b).select().single()); },
    async updateBooking(id, p) { return chk(await sb.from('or_bookings').update(p).eq('id', id).select().single()); },
    async deleteBooking(id) { chk(await sb.from('or_bookings').delete().eq('id', id)); }
  };
}

/* ======================= State ======================= */
let store;
const S = {
  user: null, patients: [], byId: new Map(), loadedAt: 0,
  view: 'register', editingId: null,
  joints: new Set(), latOverride: '', unitManual: false, aoManual: false, dupAck: '',
  page: 0, pageSize: 50, filtered: [],
  orDate: isoDate(), orBookings: [],
  drawerId: null, bookCtx: null
};

function indexPatients(list) {
  S.patients = list;
  S.byId = new Map(list.map(p => [p.id, p]));
  $('countPatients').textContent = list.length;
}
function upsertLocal(p) {
  const i = S.patients.findIndex(x => x.id === p.id);
  if (i >= 0) S.patients[i] = p; else S.patients.unshift(p);
  indexPatients(S.patients);
}
async function reloadPatients(silent) {
  try {
    indexPatients(await store.listPatients());
    S.loadedAt = Date.now();
    if (!silent) toast('Registry up to date — ' + S.patients.length + ' patients.');
  } catch (e) { fail(e, 'Could not load patients'); }
}

/* ======================= Auth & boot ======================= */
async function boot() {
  $('hdrDept').textContent = CFG.DEPARTMENT_NAME || 'Orthopedic & Trauma Surgery';
  $('hdrDeptAr').textContent = CFG.DEPARTMENT_NAME_AR || '';
  try { store = DEMO ? LocalStore() : SupabaseStore(); }
  catch (e) { $('loading').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
  initStaticUI();
  if (DEMO) { $('demoBar').classList.remove('hidden'); $('signOutBtn').classList.add('hidden'); $('pwBtn').classList.add('hidden'); }
  store.onAuth((ev) => { if (ev === 'SIGNED_OUT') showLogin(); });
  let user = null;
  try { user = await store.getUser(); } catch (e) { console.error(e); }
  if (user) await enterApp(user); else showLogin();
}
function showLogin(msg) {
  $('loading').classList.add('hidden');
  $('app').classList.add('hidden');
  closeDrawer(); closeModal('bookModal');
  $('loginScreen').classList.remove('hidden');
  const err = $('loginError');
  if (msg) { err.textContent = msg; err.classList.remove('hidden'); } else err.classList.add('hidden');
  indexPatients([]);
}
async function enterApp(user) {
  S.user = user;
  $('userEmail').textContent = user.email || '';
  $('loginScreen').classList.add('hidden');
  $('loading').classList.remove('hidden');
  await reloadPatients(true);
  $('loading').classList.add('hidden');
  $('app').classList.remove('hidden');
  resetForm();
  switchView(S.view);
  if (AUTH_LINK_TYPE === 'invite' || AUTH_LINK_TYPE === 'recovery') {
    history.replaceState(null, '', location.pathname);
    openPw(true);
  }
}
function openPw(first) {
  $('pwForm').reset();
  $('pwTitle').textContent = first ? 'Set your password' : 'Change password';
  $('pwIntro').textContent = first ? 'Welcome! Choose your own password (at least 8 characters) to finish setting up your account.' : 'Choose a new password of at least 8 characters.';
  $('pwModal').classList.remove('hidden');
  $('pw1').focus();
}
$('pwBtn').addEventListener('click', () => openPw(false));
$('pwForm').addEventListener('submit', async e => {
  e.preventDefault();
  const a = $('pw1').value, b = $('pw2').value;
  if (a.length < 8) { toast('Password must be at least 8 characters.', true); return; }
  if (a !== b) { toast('The two passwords do not match.', true); return; }
  const btn = $('pwSave'); btn.disabled = true;
  try { await store.updatePassword(a); closeModal('pwModal'); toast('Password saved.'); }
  catch (err) { fail(err, 'Could not change password'); }
  finally { btn.disabled = false; }
});
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('loginBtn'); btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const user = await store.signIn($('loginEmail').value.trim(), $('loginPassword').value);
    $('loginPassword').value = '';
    await enterApp(user);
  } catch (err) {
    $('loginError').textContent = /invalid/i.test(err.message) ? 'Wrong email or password.' : /fetch|network/i.test(err.message) ? 'Cannot reach the database server. Check the internet connection (or SUPABASE_URL in config.js).' : err.message;
    $('loginError').classList.remove('hidden');
  } finally { btn.disabled = false; btn.textContent = 'Sign in'; }
});
$('signOutBtn').addEventListener('click', async () => { await store.signOut(); showLogin(); });

// Auto sign-out after inactivity (shared hospital computers)
let lastActivity = Date.now();
['click', 'keydown', 'touchstart', 'mousemove'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(async () => {
  if (DEMO || !S.user || $('app').classList.contains('hidden')) return;
  if (Date.now() - lastActivity > IDLE_MINUTES * 60000) { S.user = null; await store.signOut(); showLogin('Signed out after ' + IDLE_MINUTES + ' minutes of inactivity.'); }
}, 30000);
// Pick up colleagues' changes when returning to the tab
window.addEventListener('focus', async () => {
  if (!S.user || $('app').classList.contains('hidden') || Date.now() - S.loadedAt < 60000) return;
  await reloadPatients(true); rerender();
});

/* ======================= Navigation ======================= */
function switchView(v) {
  S.view = v;
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === v)));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('hidden', s.id !== 'view-' + v));
  rerender();
  window.scrollTo(0, 0);
}
function rerender() {
  if (S.view === 'patients') renderPatients();
  else if (S.view === 'or') renderOR();
  else if (S.view === 'reports') renderReports();
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));

/* ======================= Static UI setup ======================= */
function checkGroup(containerId, list, name, extraCls) {
  $(containerId).innerHTML = list.map(v => `<label class="chk ${extraCls || ''}"><input type="checkbox" name="${name}" value="${esc(v)}"><span>${esc(v)}</span></label>`).join('');
}
function initStaticUI() {
  $('f_district').innerHTML = options(DISTRICTS, true);
  $('f_admission_type').innerHTML = options(ADMISSION, true);
  $('f_mechanism').innerHTML = options(MECHANISMS, true);
  $('f_unit').innerHTML = options(UNITS, true);
  $('f_status').innerHTML = options(STATUSES);
  $('f_triage').innerHTML = '<option value="">Auto (calculated)</option>' + options(TRIAGE);
  $('dxList').innerHTML = DX_SUGGEST.map(d => `<option value="${esc(d)}">`).join('');
  $('procList').innerHTML = PROC_SUGGEST.map(d => `<option value="${esc(d)}">`).join('');
  $('surgeonList').innerHTML = (CFG.SURGEONS || []).map(d => `<option value="${esc(d)}">`).join('');
  checkGroup('redFlags', RED_FLAGS, 'redFlags', 'flag');
  checkGroup('imaging', IMAGING, 'imaging');
  checkGroup('comorbidities', COMORBID, 'comorbidities');
  $('fUnit').innerHTML = options(UNITS, true, 'All units');
  $('fStatus').innerHTML = options(STATUSES, true, 'All statuses');
  $('fTriage').innerHTML = options(TRIAGE, true, 'All');
  $('b_theatre').innerHTML = options(CFG.THEATRES && CFG.THEATRES.length ? CFG.THEATRES : ['OR 1', 'OR 2'], true, 'Unassigned');
  $('b_status').innerHTML = options(BOOK_STATUSES);
  initSkeleton();
}

/* ======================= Skeleton map ======================= */
let JOINTS = [];
function initSkeleton() {
  const nodes = Array.from(document.querySelectorAll('#skeletonSvg .joint-node'));
  JOINTS = nodes.map(n => ({ name: n.dataset.joint, unit: n.dataset.unit, ao: n.dataset.ao }));
  nodes.forEach(n => {
    n.setAttribute('tabindex', '0'); n.setAttribute('role', 'checkbox'); n.setAttribute('aria-label', n.dataset.joint);
    const toggle = () => toggleJoint(n.dataset.joint);
    n.addEventListener('click', toggle);
    n.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
  });
  $('jointChecklist').innerHTML = JOINTS.map(j => `<label class="chk"><input type="checkbox" data-joint="${esc(j.name)}"><span>${esc(j.name)}</span></label>`).join('');
  $('jointChecklist').addEventListener('change', e => { if (e.target.dataset.joint) toggleJoint(e.target.dataset.joint, e.target.checked); });
  $('jointPills').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) toggleJoint(b.dataset.rm, false); });
  $('clearJointsBtn').addEventListener('click', () => { S.joints.clear(); syncJoints(); });
  $('latGroup').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.latOverride = b.dataset.lat; syncLat();
  });
}
function toggleJoint(name, force) {
  const on = force === undefined ? !S.joints.has(name) : force;
  if (on) S.joints.add(name); else S.joints.delete(name);
  syncJoints();
}
function autoLaterality() {
  const arr = Array.from(S.joints);
  const r = arr.some(j => /^Right/.test(j)), l = arr.some(j => /^Left/.test(j));
  return r && l ? 'Bilateral' : r ? 'Right' : l ? 'Left' : arr.length ? 'N/A (axial)' : '';
}
function syncLat() {
  document.querySelectorAll('#latGroup button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lat === S.latOverride)));
}
function syncJoints() {
  document.querySelectorAll('#skeletonSvg .joint-node').forEach(n => {
    const on = S.joints.has(n.dataset.joint);
    n.classList.toggle('selected', on); n.setAttribute('aria-checked', String(on));
  });
  document.querySelectorAll('#jointChecklist input').forEach(c => { c.checked = S.joints.has(c.dataset.joint); });
  $('jointCount').textContent = S.joints.size + ' selected';
  $('jointPills').innerHTML = S.joints.size ? Array.from(S.joints).map(j => `<span class="pill">${esc(j)}<button type="button" data-rm="${esc(j)}" aria-label="Remove ${esc(j)}">×</button></span>`).join('') : '<span class="small muted">Tap a joint on the skeleton</span>';
  const sel = JOINTS.filter(j => S.joints.has(j.name));
  if (!S.aoManual) $('f_ao_code').value = Array.from(new Set(sel.map(j => j.ao))).join(' + ');
  if (!S.unitManual && sel.length) $('f_unit').value = sel[0].unit;
  computeTriage();
}

/* ======================= Registration form ======================= */
const FIELD_IDS = ['name','national_id','dob','age','sex','phone','alt_phone','district','address','admission_type','referral','mechanism','unit','diagnosis','ao_code','consultant','status','notes'];
const checked = name => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(c => c.value);
const setChecked = (name, vals) => document.querySelectorAll(`input[name="${name}"]`).forEach(c => { c.checked = (vals || []).includes(c.value); });

function computeTriage() {
  const vas = parseInt($('f_pain_vas').value, 10);
  const flags = checked('redFlags');
  const mech = $('f_mechanism').value;
  const critical = flags.some(f => !NON_CRITICAL_FLAGS.includes(f));
  const highEnergy = /traffic|height|Gunshot/i.test(mech);
  let t;
  if (critical || (vas >= 9 && highEnergy) || S.joints.size >= 3) t = 'Stat trauma';
  else if (vas >= 7 || flags.length || highEnergy) t = 'Urgent';
  else if (vas >= 4) t = 'Priority';
  else t = 'Routine';
  const final = $('f_triage').value || t;
  const b = $('triageLive'); b.textContent = final + ($('f_triage').value ? ' (manual)' : ''); b.className = 'badge ' + triageCls(final);
  const vl = $('vasLabel');
  vl.textContent = vas + ' / 10 — ' + (vas >= 8 ? 'severe' : vas >= 5 ? 'moderate' : vas >= 1 ? 'mild' : 'none');
  vl.className = 'badge ' + (vas >= 8 ? 't-urgent' : vas >= 5 ? 't-priority' : 't-routine');
  return final;
}

function decodeNationalId(raw) {
  const id = String(raw || '').trim();
  const help = $('idHelp');
  if (!id) { help.textContent = 'Fills birth date, age and sex automatically'; help.className = 'help'; return null; }
  if (!/^[23]\d{13}$/.test(id)) { help.textContent = 'Egyptian National ID = 14 digits starting with 2 or 3.'; help.className = 'help warn'; return null; }
  const y = (id[0] === '2' ? 1900 : 2000) + parseInt(id.slice(1, 3), 10);
  const m = parseInt(id.slice(3, 5), 10), d = parseInt(id.slice(5, 7), 10);
  const dob = new Date(y, m - 1, d);
  if (m < 1 || m > 12 || dob.getMonth() !== m - 1 || dob > new Date()) { help.textContent = 'The birth date inside this ID is not valid — please re-check the number.'; help.className = 'help warn'; return null; }
  const gov = GOV[id.slice(7, 9)] || 'governorate code ' + id.slice(7, 9);
  const sex = parseInt(id[12], 10) % 2 === 1 ? 'Male' : 'Female';
  const dobIso = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  $('f_dob').value = dobIso; $('f_age').value = ageFrom(dobIso); $('f_sex').value = sex;
  help.textContent = '✓ Born ' + fmtDate(dobIso) + ' · ' + sex + ' · ' + gov;
  help.className = 'help ok';
  if (!S.unitManual && ageFrom(dobIso) < 15) $('f_unit').value = 'Pediatric Orthopedics & Deformity Unit';
  return { dob: dobIso, sex, gov };
}
function ageFrom(dobIso) {
  const b = new Date(dobIso + 'T12:00:00'), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}

function findDuplicates() {
  const nid = $('f_national_id').value.trim();
  const ph = normDigits($('f_phone').value);
  return S.patients.filter(p => p.id !== S.editingId && ((nid.length === 14 && p.national_id === nid) || (ph.length >= 8 && normDigits(p.phone) === ph)));
}
function showDuplicates() {
  const d = findDuplicates(), box = $('dupBox');
  if (!d.length) { box.classList.add('hidden'); return d; }
  box.innerHTML = '<b>Possible existing record' + (d.length > 1 ? 's' : '') + ':</b> same National ID or phone.' +
    d.slice(0, 4).map(p => `<div class="row between" style="margin-top:6px"><span>${esc(p.name)} · <span class="mono">${esc(p.mrn)}</span> · ${esc(fmtDate(p.created_at))}</span><button type="button" class="btn sm" data-open="${esc(p.id)}">Open record</button></div>`).join('');
  box.classList.remove('hidden');
  return d;
}
$('dupBox').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openDrawer(b.dataset.open); });

function readForm() {
  const p = {};
  FIELD_IDS.forEach(f => { const v = $('f_' + f).value; p[f] = typeof v === 'string' ? v.trim() : v; });
  p.age = p.age === '' ? null : parseInt(p.age, 10);
  p.dob = p.dob || null;
  ['national_id','sex','phone','alt_phone','district','address','admission_type','referral','mechanism','unit','diagnosis','ao_code','consultant','notes'].forEach(k => { if (p[k] === '') p[k] = null; });
  p.joints = Array.from(S.joints);
  p.laterality = S.latOverride || autoLaterality() || null;
  p.pain_vas = parseInt($('f_pain_vas').value, 10);
  p.red_flags = checked('redFlags');
  p.imaging = checked('imaging');
  p.comorbidities = checked('comorbidities');
  p.triage = computeTriage();
  return p;
}
function fillForm(p) {
  FIELD_IDS.forEach(f => { $('f_' + f).value = p[f] == null ? '' : p[f]; });
  S.joints = new Set(p.joints || []);
  const lat = p.laterality || '';
  S.latOverride = ['Right', 'Left', 'Bilateral'].includes(lat) ? lat : '';
  $('f_pain_vas').value = p.pain_vas == null ? 0 : p.pain_vas;
  setChecked('redFlags', p.red_flags); setChecked('imaging', p.imaging); setChecked('comorbidities', p.comorbidities);
  S.unitManual = true; S.aoManual = true;
  $('f_triage').value = '';
  syncLat(); syncJoints();
  // keep stored triage if it differs from the calculation (it was a manual override)
  if (p.triage && computeTriage() !== p.triage) { $('f_triage').value = p.triage; computeTriage(); }
  decodeNationalId(p.national_id);
  if (p.dob) $('f_dob').value = p.dob;
  if (p.age != null) $('f_age').value = p.age;
  if (p.sex) $('f_sex').value = p.sex;
}
function resetForm() {
  $('regForm').reset();
  S.editingId = null; S.joints = new Set(); S.latOverride = ''; S.unitManual = false; S.aoManual = false; S.dupAck = '';
  $('f_status').value = 'New'; $('f_pain_vas').value = 5;
  $('f_district').value = DISTRICTS[0];
  $('editBanner').classList.add('hidden'); $('dupBox').classList.add('hidden');
  $('regEyebrow').textContent = 'New patient'; $('regTitle').textContent = 'Patient registration';
  $('saveBtn').textContent = 'Register patient →'; $('cancelEditBtn').textContent = 'Clear form';
  $('regFootNote').textContent = 'A record number (MRN) is generated automatically.';
  decodeNationalId('');
  syncLat(); syncJoints();
}
function startEdit(id) {
  const p = S.byId.get(id); if (!p) return;
  closeDrawer();
  resetForm();
  S.editingId = id;
  fillForm(p);
  $('regEyebrow').textContent = 'Editing ' + p.mrn; $('regTitle').textContent = p.name;
  $('editBanner').textContent = 'You are editing an existing record (' + p.mrn + '). Save to update it for everyone.';
  $('editBanner').classList.remove('hidden');
  $('saveBtn').textContent = 'Save changes'; $('cancelEditBtn').textContent = 'Cancel editing';
  $('regFootNote').textContent = 'Last updated ' + fmtDateTime(p.updated_at) + (p.updated_by_email ? ' by ' + p.updated_by_email : '');
  switchView('register');
}

$('f_national_id').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 14); if (e.target.value.length === 14 || !e.target.value) decodeNationalId(e.target.value); });
$('f_national_id').addEventListener('blur', e => { decodeNationalId(e.target.value); showDuplicates(); });
$('f_phone').addEventListener('blur', showDuplicates);
$('f_dob').addEventListener('change', e => { if (e.target.value) $('f_age').value = ageFrom(e.target.value); });
$('f_unit').addEventListener('change', () => { S.unitManual = !!$('f_unit').value; });
$('f_ao_code').addEventListener('input', () => { S.aoManual = !!$('f_ao_code').value; });
$('f_pain_vas').addEventListener('input', computeTriage);
$('f_triage').addEventListener('change', computeTriage);
$('redFlags').addEventListener('change', computeTriage);
$('f_mechanism').addEventListener('change', e => {
  const v = e.target.value;
  if (!S.unitManual) {
    const map = [[/Sports/, 'Arthroscopy & Sports Medicine Unit'], [/traffic|height|Gunshot|Non-union|Infection/i, 'Trauma & Ilizarov Reconstruction Unit'], [/osteoarthritis/i, 'Arthroplasty & Joint Replacement Unit'], [/Disc/, 'Spine Surgery Unit'], [/Paediatric/, 'Pediatric Orthopedics & Deformity Unit'], [/Workplace/, 'Hand, Upper Limb & Microsurgery Unit']];
    const hit = map.find(m => m[0].test(v)); if (hit) $('f_unit').value = hit[1];
  }
  computeTriage();
});
$('cancelEditBtn').addEventListener('click', () => {
  const wasEditing = S.editingId;
  resetForm();
  if (wasEditing) openDrawer(wasEditing);
});

$('regForm').addEventListener('submit', async e => {
  e.preventDefault();
  const p = readForm();
  const missing = [];
  if (!p.name) missing.push('name'); if (p.age == null || isNaN(p.age)) missing.push('age');
  if (!p.sex) missing.push('sex'); if (!p.phone) missing.push('mobile');
  if (missing.length) { toast('Please fill in: ' + missing.join(', ') + '.', true); $('f_' + (missing[0] === 'mobile' ? 'phone' : missing[0])).focus(); return; }
  if (!/^\+?\d{8,15}$/.test(normDigits(p.phone))) { toast('Mobile number looks wrong — digits only, e.g. 01012345678.', true); $('f_phone').focus(); return; }
  if (p.national_id && !/^[23]\d{13}$/.test(p.national_id)) { toast('National ID must be 14 digits starting with 2 or 3 (or leave it empty).', true); $('f_national_id').focus(); return; }
  const dups = showDuplicates();
  const sig = dups.map(d => d.id).join(',');
  if (dups.length && S.dupAck !== sig) {
    S.dupAck = sig;
    toast('This patient may already be registered (see the yellow box). Press save again to register anyway.', true);
    $('dupBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const btn = $('saveBtn'); btn.disabled = true;
  try {
    let saved;
    if (S.editingId) {
      const before = S.byId.get(S.editingId);
      saved = await store.updatePatient(S.editingId, p);
      if (before && before.status !== saved.status) await logStatus(saved.id, before.status, saved.status);
      toast('Changes saved for ' + saved.name + '.');
    } else {
      saved = await store.createPatient(p);
      toast('Registered ' + saved.name + ' — ' + saved.mrn);
    }
    upsertLocal(saved);
    resetForm();
    openDrawer(saved.id);
  } catch (err) { fail(err, 'Could not save'); }
  finally { btn.disabled = false; }
});

/* ======================= Patients list ======================= */
function applyFilters() {
  const q = $('q').value.trim().toLowerCase();
  const qd = normDigits(q);
  const u = $('fUnit').value, st = $('fStatus').value, tr = $('fTriage').value;
  const from = $('fFrom').value, to = $('fTo').value;
  let list = S.patients.filter(p => {
    if (u && p.unit !== u) return false;
    if (st && p.status !== st) return false;
    if (tr && p.triage !== tr) return false;
    const day = isoDate(new Date(p.created_at));
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (q) {
      const hay = [p.name, p.mrn, p.national_id, p.phone, p.alt_phone, p.diagnosis, p.consultant, p.address, p.ao_code, (p.joints || []).join(' ')].join(' ').toLowerCase();
      const words = q.split(/\s+/);
      const textHit = words.every(w => hay.includes(w));
      const digitHit = qd.length >= 4 && (normDigits(p.phone).includes(qd) || normDigits(p.alt_phone).includes(qd) || String(p.national_id || '').includes(qd));
      if (!textHit && !digitHit) return false;
    }
    return true;
  });
  const sort = $('fSort').value;
  const cmp = {
    new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    old: (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
    name: (a, b) => String(a.name).localeCompare(String(b.name)),
    triage: (a, b) => (TRIAGE_RANK[a.triage] ?? 9) - (TRIAGE_RANK[b.triage] ?? 9) || String(b.created_at).localeCompare(String(a.created_at)),
    updated: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at))
  }[sort];
  return list.sort(cmp);
}
function renderPatients() {
  S.filtered = applyFilters();
  const pages = Math.max(1, Math.ceil(S.filtered.length / S.pageSize));
  if (S.page >= pages) S.page = pages - 1;
  const slice = S.filtered.slice(S.page * S.pageSize, (S.page + 1) * S.pageSize);
  $('patientRows').innerHTML = slice.length ? slice.map(p => `
    <tr class="click" data-id="${esc(p.id)}" tabindex="0">
      <td class="mono small nowrap">${esc(p.mrn)}</td>
      <td><div class="name">${esc(p.name)}</div><div class="small muted">${esc(p.age ?? '')}${p.age != null ? ' y' : ''} · ${esc(p.sex || '')}</div></td>
      <td class="mono small nowrap" data-l="Phone">${esc(p.phone || '')}</td>
      <td class="small" data-l="Unit">${esc(shortUnit(p.unit))}</td>
      <td class="small" data-l="Dx">${esc(p.diagnosis || (p.joints || []).join(', '))}</td>
      <td>${badge(p.triage, triageCls(p.triage))}</td>
      <td>${badge(p.status, statusCls(p.status))}</td>
      <td class="small nowrap" data-l="Registered">${esc(fmtDate(p.created_at))}</td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty">${S.patients.length ? 'No patients match these filters.' : 'No patients registered yet. Use “+ Register” to add the first one.'}</td></tr>`;
  const a = S.filtered.length ? S.page * S.pageSize + 1 : 0, b = Math.min(S.filtered.length, (S.page + 1) * S.pageSize);
  $('pagerInfo').textContent = `Showing ${a}–${b} of ${S.filtered.length} (total registry ${S.patients.length})`;
  $('prevPage').disabled = S.page === 0; $('nextPage').disabled = S.page >= pages - 1;
}
let qTimer;
$('q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.page = 0; renderPatients(); }, 150); });
['fUnit', 'fStatus', 'fTriage', 'fSort', 'fFrom', 'fTo'].forEach(id => $(id).addEventListener('change', () => { S.page = 0; renderPatients(); }));
$('clearFiltersBtn').addEventListener('click', () => { ['q', 'fUnit', 'fStatus', 'fTriage', 'fFrom', 'fTo'].forEach(id => { $(id).value = ''; }); $('fSort').value = 'new'; S.page = 0; renderPatients(); });
$('prevPage').addEventListener('click', () => { S.page--; renderPatients(); });
$('nextPage').addEventListener('click', () => { S.page++; renderPatients(); });
$('patientRows').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) openDrawer(tr.dataset.id); });
$('patientRows').addEventListener('keydown', e => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) openDrawer(tr.dataset.id); } });
$('refreshBtn').addEventListener('click', async () => { await reloadPatients(); renderPatients(); });
$('exportFilteredBtn').addEventListener('click', () => exportExcel(false));

/* ======================= Patient drawer ======================= */
async function logStatus(pid, from, to) {
  try { await store.addVisit({ patient_id: pid, visit_date: isoDate(), type: 'Status change', note: (from || '—') + ' → ' + to }); } catch (e) { console.warn(e); }
}
function closeDrawer() { S.drawerId = null; $('drawer').classList.add('hidden'); document.body.style.overflow = ''; }
async function openDrawer(id) {
  const p = S.byId.get(id); if (!p) { toast('Record not found — try Refresh.', true); return; }
  S.drawerId = id;
  $('drawer').classList.remove('hidden'); document.body.style.overflow = 'hidden';
  renderDrawer(p, null, null);
  try {
    const [visits, books] = await Promise.all([store.listVisits(id), store.listPatientBookings(id)]);
    if (S.drawerId === id) renderDrawer(S.byId.get(id) || p, visits, books);
  } catch (e) { fail(e, 'Could not load history'); }
}
function dl(pairs) { return '<div class="dl">' + pairs.filter(x => x[1] !== '' && x[1] != null).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('') + '</div>'; }
function renderDrawer(p, visits, books) {
  const loading = '<div class="small muted">Loading…</div>';
  $('drawerPanel').innerHTML = `
  <div class="drawer-h">
    <div class="row between">
      <span class="small mono" style="color:#5eead4">${esc(p.mrn)} · registered ${esc(fmtDateTime(p.created_at))}</span>
      <button class="btn ghost icon" type="button" data-act="close" aria-label="Close" style="color:#fff">✕</button>
    </div>
    <h2 id="dName">${esc(p.name)}</h2>
    <div class="row" style="margin-top:4px">${badge(p.triage, triageCls(p.triage))} ${badge(p.status, statusCls(p.status))} <span class="small" style="color:#cbd5e1">${esc(p.age ?? '')}${p.age != null ? ' y' : ''} · ${esc(p.sex || '')} · ${esc(shortUnit(p.unit))}</span></div>
    <div class="row" style="margin-top:12px">
      <button class="btn sm primary" type="button" data-act="edit">✎ Edit</button>
      <button class="btn sm" type="button" data-act="book">+ Book operation</button>
      <button class="btn sm" type="button" data-act="print">🖨 Print slip</button>
    </div>
  </div>
  <div class="drawer-b">
    <div class="card"><div class="card-b row">
      <label class="lbl" for="dStatus" style="margin:0">Update status</label>
      <select class="inp" id="dStatus" style="width:auto;flex:1;min-width:180px">${options(STATUSES)}</select>
      <button class="btn sm dark" type="button" data-act="status">Save status</button>
    </div></div>
    <div class="card"><div class="card-h"><h3>Patient details</h3></div><div class="card-b">${dl([
      ['National ID', p.national_id || ''], ['Date of birth', fmtDate(p.dob)], ['Mobile', p.phone || ''], ['Alt. phone', p.alt_phone || ''],
      ['District', p.district || ''], ['Address', p.address || ''], ['Pathway', p.admission_type || ''], ['Referred from', p.referral || ''], ['Consultant', p.consultant || '']])}</div></div>
    <div class="card"><div class="card-h"><h3>Clinical</h3></div><div class="card-b">${dl([
      ['Diagnosis', p.diagnosis || ''], ['Region', (p.joints || []).join(', ')], ['Side', p.laterality || ''], ['AO/OTA', p.ao_code || ''],
      ['Mechanism', p.mechanism || ''], ['Pain VAS', p.pain_vas == null ? '' : p.pain_vas + ' / 10'], ['Red flags', (p.red_flags || []).join(', ')],
      ['Imaging', (p.imaging || []).join(', ')], ['Comorbidities', (p.comorbidities || []).join(', ')]])}
      ${p.notes ? `<div style="margin-top:12px"><span class="lbl">Notes</span><div style="white-space:pre-wrap">${esc(p.notes)}</div></div>` : ''}</div></div>
    <div class="card"><div class="card-h"><h3>Operations</h3></div>
      ${books == null ? '<div class="card-b">' + loading + '</div>' : books.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Procedure</th><th>Theatre</th><th>Surgeon</th><th>Status</th><th></th></tr></thead><tbody>${books.map(b => `
        <tr><td class="nowrap">${esc(fmtDate(b.op_date))}</td><td>${esc(b.procedure)}${b.side ? ' (' + esc(b.side) + ')' : ''}</td><td>${esc(b.theatre || '')}</td><td>${esc(b.surgeon || '')}</td><td>${badge(b.status, bookCls(b.status))}</td>
        <td class="nowrap"><button class="btn sm" type="button" data-act="editbook" data-bid="${esc(b.id)}">Edit</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card-b small muted">No operations booked.</div>'}
    </div>
    <div class="card"><div class="card-h"><h3>Follow-up timeline</h3></div><div class="card-b">
      <form id="visitForm" class="grid g4" style="align-items:end;margin-bottom:16px">
        <div><label class="lbl" for="v_date">Date</label><input class="inp" type="date" id="v_date" value="${isoDate()}"></div>
        <div><label class="lbl" for="v_type">Type</label><select class="inp" id="v_type">${options(VISIT_TYPES)}</select></div>
        <div class="span4"><label class="lbl" for="v_note">Note</label><textarea class="inp" id="v_note" placeholder="Findings, X-ray result, plan, next appointment…"></textarea></div>
        <div><button class="btn primary" type="submit">Add entry</button></div>
      </form>
      ${visits == null ? loading : visits.length ? '<ul class="timeline">' + visits.map(v => `<li>
        <div class="row between"><b>${esc(v.type)}</b><span class="t-meta">${esc(fmtDate(v.visit_date))}${v.author_email ? ' · ' + esc(v.author_email) : ''} <button class="btn ghost sm" type="button" data-act="delvisit" data-vid="${esc(v.id)}" aria-label="Delete entry">🗑</button></span></div>
        ${v.note ? `<div style="white-space:pre-wrap;margin-top:2px">${esc(v.note)}</div>` : ''}</li>`).join('') + '</ul>' : '<div class="small muted">No entries yet.</div>'}
    </div></div>
    <div class="row between small muted">
      <span>Last updated ${esc(fmtDateTime(p.updated_at))}${p.updated_by_email ? ' by ' + esc(p.updated_by_email) : ''}</span>
      <button class="btn sm danger" type="button" data-act="delete">Delete patient</button>
    </div>
  </div>`;
  $('dStatus').value = p.status || 'New';
  S._drawerData = { visits, books };
}
$('drawer').addEventListener('click', async e => {
  if (e.target === $('drawer')) { closeDrawer(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = S.drawerId, p = S.byId.get(id); if (!p) return;
  const act = b.dataset.act;
  if (act === 'close') closeDrawer();
  else if (act === 'edit') startEdit(id);
  else if (act === 'print') printSlip(p);
  else if (act === 'book') openBooking({ patientId: id });
  else if (act === 'editbook') { const bk = (S._drawerData.books || []).find(x => x.id === b.dataset.bid); if (bk) openBooking({ booking: bk }); }
  else if (act === 'status') {
    const ns = $('dStatus').value; if (ns === p.status) return;
    try { const saved = await store.updatePatient(id, { status: ns }); await logStatus(id, p.status, ns); upsertLocal(saved); toast('Status updated to ' + ns + '.'); openDrawer(id); rerender(); }
    catch (err) { fail(err, 'Could not update'); }
  }
  else if (act === 'delvisit') {
    if (!confirm('Delete this timeline entry?')) return;
    try { await store.deleteVisit(b.dataset.vid); openDrawer(id); } catch (err) { fail(err, 'Could not delete'); }
  }
  else if (act === 'delete') {
    if (!confirm('Permanently delete ' + p.name + ' (' + p.mrn + ') with all visits and bookings?\nThis cannot be undone.')) return;
    try { await store.deletePatient(id); indexPatients(S.patients.filter(x => x.id !== id)); closeDrawer(); rerender(); toast('Patient record deleted.'); }
    catch (err) { fail(err, 'Could not delete'); }
  }
});
$('drawer').addEventListener('submit', async e => {
  if (e.target.id !== 'visitForm') return;
  e.preventDefault();
  const id = S.drawerId;
  const v = { patient_id: id, visit_date: $('v_date').value || isoDate(), type: $('v_type').value, note: $('v_note').value.trim() || null };
  if (!v.note && v.type === 'Note') { toast('Write a note first.', true); return; }
  try { await store.addVisit(v); toast('Entry added.'); openDrawer(id); } catch (err) { fail(err, 'Could not add entry'); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('pwModal').classList.contains('hidden')) closeModal('pwModal');
  else if (!$('bookModal').classList.contains('hidden')) closeModal('bookModal');
  else if (!$('drawer').classList.contains('hidden')) closeDrawer();
});

/* ======================= Booking modal ======================= */
function closeModal(id) { $(id).classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
$('bookModal').addEventListener('click', e => { if (e.target === $('bookModal')) closeModal('bookModal'); });

function setBookPatient(pid) {
  S.bookCtx.patientId = pid;
  const p = S.byId.get(pid);
  $('b_patient_sel').innerHTML = p ? `Selected: <b>${esc(p.name)}</b> · <span class="mono">${esc(p.mrn)}</span> · ${esc(p.diagnosis || '')}` : '';
  $('b_patient_sel').className = p ? 'help ok' : 'help';
  if (p) {
    if (!$('b_side').value && ['Right', 'Left', 'Bilateral'].includes(p.laterality)) $('b_side').value = p.laterality;
    if (!$('b_surgeon').value && p.consultant) $('b_surgeon').value = p.consultant;
  }
}
function openBooking(ctx) {
  S.bookCtx = { patientId: null, bookingId: null };
  $('bookForm').reset();
  $('b_ac').classList.add('hidden');
  const bk = ctx.booking;
  $('bookTitle').textContent = bk ? 'Edit booking' : 'Book operation';
  $('b_op_date').value = bk ? bk.op_date : (ctx.date || (S.view === 'or' ? S.orDate : addDays(isoDate(), 1)));
  $('b_status').value = 'Scheduled';
  $('b_patient_q').value = '';
  $('b_patient_sel').textContent = '';
  if (bk) {
    S.bookCtx.bookingId = bk.id; S.bookCtx.original = bk;
    ['theatre', 'procedure', 'side', 'surgeon', 'anesthesia', 'implant', 'status', 'order_no', 'notes'].forEach(k => { $('b_' + k).value = bk[k] == null ? '' : bk[k]; });
  }
  const pid = bk ? bk.patient_id : ctx.patientId;
  $('b_patient_q').classList.toggle('hidden', !!pid);
  if (pid) setBookPatient(pid);
  $('bookModal').classList.remove('hidden');
  (pid ? $('b_procedure') : $('b_patient_q')).focus();
}
$('b_patient_q').addEventListener('input', () => {
  const q = $('b_patient_q').value.trim().toLowerCase(), qd = normDigits(q), box = $('b_ac');
  if (q.length < 2) { box.classList.add('hidden'); return; }
  const hits = S.patients.filter(p => [p.name, p.mrn].join(' ').toLowerCase().includes(q) || (qd.length >= 4 && (normDigits(p.phone).includes(qd) || String(p.national_id || '').includes(qd)))).slice(0, 8);
  box.innerHTML = hits.length ? hits.map(p => `<button type="button" data-pid="${esc(p.id)}"><b>${esc(p.name)}</b> <span class="small muted mono">${esc(p.mrn)}</span><div class="small muted">${esc(p.diagnosis || shortUnit(p.unit))}</div></button>`).join('') : '<div class="small muted" style="padding:10px">No match</div>';
  box.classList.remove('hidden');
});
$('b_ac').addEventListener('click', e => { const b = e.target.closest('[data-pid]'); if (!b) return; setBookPatient(b.dataset.pid); $('b_patient_q').value = S.byId.get(b.dataset.pid).name; $('b_ac').classList.add('hidden'); });
$('bookForm').addEventListener('submit', async e => {
  e.preventDefault();
  const c = S.bookCtx;
  if (!c.patientId) { toast('Choose a patient first.', true); $('b_patient_q').focus(); return; }
  const b = { patient_id: c.patientId };
  ['op_date', 'theatre', 'procedure', 'side', 'surgeon', 'anesthesia', 'implant', 'status', 'notes'].forEach(k => { const v = $('b_' + k).value.trim(); b[k] = v === '' ? null : v; });
  if (!b.op_date || !b.procedure) { toast('Date and procedure are required.', true); return; }
  b.status = b.status || 'Scheduled';
  let order = parseInt($('b_order_no').value, 10);
  const btn = $('bookSave'); btn.disabled = true;
  try {
    if (!order) {
      const same = (await store.listBookings(b.op_date, b.op_date)).filter(x => (x.theatre || '') === (b.theatre || '') && x.id !== c.bookingId);
      order = same.reduce((m, x) => Math.max(m, x.order_no || 0), 0) + 1;
    }
    b.order_no = order;
    let prev = null;
    if (c.bookingId) { prev = c.original || null; await store.updateBooking(c.bookingId, b); }
    else await store.addBooking(b);
    await syncPatientAfterBooking(b, prev);
    closeModal('bookModal');
    toast(c.bookingId ? 'Booking updated.' : 'Operation booked for ' + fmtDate(b.op_date) + '.');
    if (S.drawerId === c.patientId) openDrawer(c.patientId);
    rerender();
  } catch (err) { fail(err, 'Could not save booking'); }
  finally { btn.disabled = false; }
});
// Keep the patient's status in step with theatre bookings
async function syncPatientAfterBooking(b, prev) {
  const p = S.byId.get(b.patient_id); if (!p) return;
  let ns = null;
  if (b.status === 'Scheduled' && ['New', 'Under investigation', 'Awaiting surgery', 'Conservative management'].includes(p.status)) ns = 'Scheduled for surgery';
  if (b.status === 'Done' && (!prev || prev.status !== 'Done')) {
    ns = 'Operated';
    try { await store.addVisit({ patient_id: p.id, visit_date: b.op_date, type: 'Operation', note: b.procedure + (b.side ? ' (' + b.side + ')' : '') + (b.surgeon ? ' — ' + b.surgeon : '') + (b.implant ? ' · ' + b.implant : '') }); } catch (e) { console.warn(e); }
  }
  if ((b.status === 'Postponed' || b.status === 'Cancelled') && p.status === 'Scheduled for surgery') ns = 'Awaiting surgery';
  if (ns && ns !== p.status) {
    const saved = await store.updatePatient(p.id, { status: ns });
    await logStatus(p.id, p.status, ns);
    upsertLocal(saved);
  }
}

/* ======================= Operative list ======================= */
function theatreOrder() {
  const t = (CFG.THEATRES && CFG.THEATRES.length) ? CFG.THEATRES.slice() : ['OR 1', 'OR 2'];
  return t;
}
function groupByTheatre(list) {
  const groups = new Map();
  theatreOrder().forEach(t => groups.set(t, []));
  list.forEach(b => { const k = b.theatre || 'Unassigned'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b); });
  groups.forEach(arr => arr.sort((a, b) => (a.order_no || 0) - (b.order_no || 0) || String(a.created_at).localeCompare(String(b.created_at))));
  return groups;
}
async function renderOR() {
  $('orDate').value = S.orDate;
  $('orDayTitle').textContent = fmtDay(S.orDate);
  let all;
  try { all = await store.listBookings(S.orDate, addDays(S.orDate, 14)); }
  catch (e) { fail(e, 'Could not load operative list'); return; }
  S._lastBookings = all;
  const day = all.filter(b => b.op_date === S.orDate);
  const active = day.filter(b => b.status !== 'Cancelled');
  $('orDaySummary').textContent = active.length + ' case' + (active.length === 1 ? '' : 's') + (day.length - active.length ? ' · ' + (day.length - active.length) + ' cancelled' : '');
  const groups = groupByTheatre(day);
  let html = '';
  groups.forEach((arr, theatre) => {
    if (!arr.length && !theatreOrder().includes(theatre)) return;
    html += `<div class="or-theatre"><h4><span>${esc(theatre)}</span><span class="small muted">${arr.length} case${arr.length === 1 ? '' : 's'}</span></h4>`;
    if (!arr.length) { html += '<div class="small muted" style="padding:10px 16px">No cases.</div></div>'; return; }
    html += `<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>#</th><th>Patient</th><th>Procedure</th><th>Surgeon</th><th>Anaes.</th><th>Implant / notes</th><th>Status</th><th></th></tr></thead><tbody>` +
      arr.map((b, i) => { const p = S.byId.get(b.patient_id) || { name: '(deleted patient)' }; return `<tr>
        <td><b>${i + 1}</b></td>
        <td><a href="#" class="name" data-open="${esc(b.patient_id)}" style="color:inherit">${esc(p.name)}</a><div class="small muted">${esc(p.age ?? '')}${p.age != null ? ' y' : ''} ${esc(p.sex ? '· ' + p.sex : '')} · <span class="mono">${esc(p.mrn || '')}</span></div></td>
        <td data-l="Procedure">${esc(b.procedure)}${b.side ? ' <b>(' + esc(b.side) + ')</b>' : ''}<div class="small muted">${esc(p.diagnosis || '')}</div></td>
        <td class="small" data-l="Surgeon">${esc(b.surgeon || '')}</td>
        <td class="small" data-l="Anaesthesia">${esc(b.anesthesia || '')}</td>
        <td class="small" data-l="Implant">${esc([b.implant, b.notes].filter(Boolean).join(' · '))}</td>
        <td><select class="inp" style="min-height:30px;padding:3px 6px;font-size:12px;width:auto" data-bstatus="${esc(b.id)}">${BOOK_STATUSES.map(s => `<option ${s[0] === b.status ? 'selected' : ''}>${esc(s[0])}</option>`).join('')}</select></td>
        <td class="nowrap"><button class="btn icon sm" type="button" data-move="-1" data-bid="${esc(b.id)}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn icon sm" type="button" data-move="1" data-bid="${esc(b.id)}" aria-label="Move down" ${i === arr.length - 1 ? 'disabled' : ''}>↓</button><button class="btn icon sm" type="button" data-editb="${esc(b.id)}" aria-label="Edit">✎</button><button class="btn icon sm danger" type="button" data-delb="${esc(b.id)}" aria-label="Delete">🗑</button></td>
      </tr>`; }).join('') + '</tbody></table></div></div>';
  });
  $('orDayBody').innerHTML = html || '<div class="empty">No theatres configured.</div>';

  // Waiting list: awaiting surgery and no future scheduled booking in window
  const bookedSoon = new Set(all.filter(b => b.status === 'Scheduled').map(b => b.patient_id));
  const waiting = S.patients.filter(p => p.status === 'Awaiting surgery' && !bookedSoon.has(p.id)).sort((a, b) => (TRIAGE_RANK[a.triage] ?? 9) - (TRIAGE_RANK[b.triage] ?? 9) || String(a.created_at).localeCompare(String(b.created_at)));
  $('orWaiting').innerHTML = waiting.length ? `<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Patient</th><th>Diagnosis</th><th>Unit</th><th>Triage</th><th>Waiting since</th><th></th></tr></thead><tbody>${waiting.map(p => `<tr>
      <td><a href="#" class="name" data-open="${esc(p.id)}" style="color:inherit">${esc(p.name)}</a><div class="small muted mono">${esc(p.mrn)}</div></td>
      <td class="small" data-l="Dx">${esc(p.diagnosis || (p.joints || []).join(', '))}</td><td class="small" data-l="Unit">${esc(shortUnit(p.unit))}</td>
      <td>${badge(p.triage, triageCls(p.triage))}</td><td class="small" data-l="Since">${esc(fmtDate(p.created_at))}</td>
      <td><button class="btn sm primary" type="button" data-bookp="${esc(p.id)}">Book</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card-b small muted">No patients waiting. Set a patient’s status to “Awaiting surgery” to list them here.</div>';

  // Upcoming
  const up = all.filter(b => b.op_date > S.orDate && b.status !== 'Cancelled').sort((a, b) => a.op_date.localeCompare(b.op_date) || (a.theatre || '').localeCompare(b.theatre || '') || (a.order_no || 0) - (b.order_no || 0));
  const byDay = new Map(); up.forEach(b => { if (!byDay.has(b.op_date)) byDay.set(b.op_date, []); byDay.get(b.op_date).push(b); });
  $('orUpcoming').innerHTML = byDay.size ? Array.from(byDay).map(([d, arr]) => `<div class="or-theatre"><h4><a href="#" data-goday="${d}" style="color:inherit">${esc(fmtDay(d))}</a><span class="small muted">${arr.length} case${arr.length === 1 ? '' : 's'}</span></h4>
      <div class="card-b small" style="padding-top:8px;padding-bottom:10px">${arr.map(b => { const p = S.byId.get(b.patient_id) || { name: '?' }; return `<div>${esc(b.theatre || 'Unassigned')} · <b>${esc(p.name)}</b> — ${esc(b.procedure)}${b.side ? ' (' + esc(b.side) + ')' : ''}</div>`; }).join('')}</div></div>`).join('') : '<div class="card-b small muted">Nothing booked in the next 14 days.</div>';
}
$('orDate').addEventListener('change', e => { if (e.target.value) { S.orDate = e.target.value; renderOR(); } });
$('orPrev').addEventListener('click', () => { S.orDate = addDays(S.orDate, -1); renderOR(); });
$('orNext').addEventListener('click', () => { S.orDate = addDays(S.orDate, 1); renderOR(); });
$('orToday').addEventListener('click', () => { S.orDate = isoDate(); renderOR(); });
$('orAdd').addEventListener('click', () => openBooking({ date: S.orDate }));
$('orPrint').addEventListener('click', printOR);
$('view-or').addEventListener('click', async e => {
  const t = e.target;
  const open = t.closest('[data-open]'); if (open) { e.preventDefault(); openDrawer(open.dataset.open); return; }
  const go = t.closest('[data-goday]'); if (go) { e.preventDefault(); S.orDate = go.dataset.goday; renderOR(); return; }
  const bp = t.closest('[data-bookp]'); if (bp) { openBooking({ patientId: bp.dataset.bookp, date: S.orDate }); return; }
  const eb = t.closest('[data-editb]'); if (eb) { const bk = S._lastBookings.find(x => x.id === eb.dataset.editb); if (bk) openBooking({ booking: bk }); return; }
  const db = t.closest('[data-delb]');
  if (db) { if (!confirm('Remove this case from the list?')) return; try { await store.deleteBooking(db.dataset.delb); toast('Case removed.'); renderOR(); } catch (err) { fail(err, 'Could not delete'); } return; }
  const mv = t.closest('[data-move]');
  if (mv) {
    const bk = S._lastBookings.find(x => x.id === mv.dataset.bid); if (!bk) return;
    const arr = groupByTheatre(S._lastBookings.filter(b => b.op_date === bk.op_date)).get(bk.theatre || 'Unassigned');
    const i = arr.findIndex(x => x.id === bk.id), j = i + parseInt(mv.dataset.move, 10);
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    try { await Promise.all(arr.map((x, k) => (x.order_no !== k + 1) ? store.updateBooking(x.id, { order_no: k + 1 }) : null)); renderOR(); }
    catch (err) { fail(err, 'Could not reorder'); }
  }
});
$('view-or').addEventListener('change', async e => {
  const sel = e.target.closest('[data-bstatus]'); if (!sel) return;
  const bk = S._lastBookings.find(x => x.id === sel.dataset.bstatus); if (!bk) return;
  try { await store.updateBooking(bk.id, { status: sel.value }); await syncPatientAfterBooking(Object.assign({}, bk, { status: sel.value }), bk); toast('Marked ' + sel.value + '.'); renderOR(); }
  catch (err) { fail(err, 'Could not update'); }
});

/* ======================= Printing ======================= */
function printHeader(title) {
  return `<div class="p-head"><div><h1>${esc(CFG.HOSPITAL_NAME || '')}</h1><div>${esc(CFG.DEPARTMENT_NAME || '')} — <span class="ar">${esc(CFG.DEPARTMENT_NAME_AR || '')}</span></div></div><div style="text-align:right"><b>${esc(title)}</b><div>Printed ${esc(fmtDateTime(new Date()))}</div></div></div>`;
}
function doPrint(html) { $('printArea').innerHTML = html; setTimeout(() => window.print(), 50); }
function printSlip(p) {
  const row = (k, v) => v ? `<tr><th style="width:30%">${esc(k)}</th><td>${esc(v)}</td></tr>` : '';
  doPrint(printHeader('Patient registration slip') + `<h2>${esc(p.name)} — ${esc(p.mrn)}</h2><table>
    ${row('Age / sex', (p.age ?? '') + ' y / ' + (p.sex || ''))}${row('National ID', p.national_id)}${row('Mobile', p.phone)}${row('District', p.district)}
    ${row('Pathway', p.admission_type)}${row('Unit', p.unit)}${row('Consultant', p.consultant)}${row('Diagnosis', p.diagnosis)}
    ${row('Region / side', (p.joints || []).join(', ') + (p.laterality ? ' — ' + p.laterality : ''))}${row('AO/OTA', p.ao_code)}${row('Mechanism', p.mechanism)}
    ${row('Triage', p.triage)}${row('Pain VAS', p.pain_vas == null ? '' : p.pain_vas + '/10')}${row('Red flags', (p.red_flags || []).join(', '))}
    ${row('Imaging', (p.imaging || []).join(', '))}${row('Comorbidities', (p.comorbidities || []).join(', '))}${row('Notes', p.notes)}
    ${row('Registered', fmtDateTime(p.created_at))}</table>`);
}
function printOR() {
  const day = (S._lastBookings || []).filter(b => b.op_date === S.orDate && b.status !== 'Cancelled');
  let html = printHeader('Operative list') + `<h2>${esc(fmtDay(S.orDate))}</h2>`;
  groupByTheatre(day).forEach((arr, t) => {
    if (!arr.length) return;
    html += `<h2>${esc(t)}</h2><table><thead><tr><th>#</th><th>Name</th><th>Age/Sex</th><th>MRN</th><th>Diagnosis</th><th>Procedure</th><th>Side</th><th>Surgeon</th><th>Anaes.</th><th>Implant / notes</th></tr></thead><tbody>` +
      arr.map((b, i) => { const p = S.byId.get(b.patient_id) || {}; return `<tr><td>${i + 1}</td><td>${esc(p.name || '')}</td><td>${esc(p.age ?? '')} ${esc((p.sex || '').charAt(0))}</td><td>${esc(p.mrn || '')}</td><td>${esc(p.diagnosis || '')}</td><td>${esc(b.procedure)}</td><td>${esc(b.side || '')}</td><td>${esc(b.surgeon || '')}</td><td>${esc(b.anesthesia || '')}</td><td>${esc([b.implant, b.notes].filter(Boolean).join(' · '))}</td></tr>`; }).join('') + '</tbody></table>';
  });
  if (!day.length) html += '<p>No cases booked.</p>';
  doPrint(html);
}

/* ======================= Reports ======================= */
function bars(id, counts, color) {
  const arr = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...arr.map(x => x[1]));
  $(id).innerHTML = arr.length ? arr.map(([k, v]) => `<div class="bar-row"><span class="lab" title="${esc(k)}">${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${(v / max * 100).toFixed(1)}%;${color ? 'background:' + color : ''}"></div></div><span class="num">${v}</span></div>`).join('') : '<div class="small muted">No data in this period.</div>';
}
function columns(id, series, color) {
  const max = Math.max(1, ...series.map(s => s[1]));
  $(id).innerHTML = series.map(([lab, v]) => `<div class="col"><span class="cv">${v || ''}</span><div class="c" style="height:${(v / max * 120).toFixed(0)}px;${color ? 'background:' + color : ''}"></div><span class="cl">${esc(lab)}</span></div>`).join('');
}
function last12Months() {
  const out = [], d = new Date(); d.setDate(1);
  for (let i = 11; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push([x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), x.toLocaleDateString('en-GB', { month: 'short' })]); }
  return out;
}
async function renderReports() {
  if (!$('rFrom').value) { const d = new Date(); $('rFrom').value = isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); $('rTo').value = isoDate(); }
  const from = $('rFrom').value, to = $('rTo').value || isoDate();
  let books = [];
  try { books = await store.listAllBookings(); } catch (e) { fail(e, 'Could not load operations'); }
  const inRange = S.patients.filter(p => { const d = isoDate(new Date(p.created_at)); return d >= from && d <= to; });
  const opsDone = books.filter(b => b.status === 'Done' && b.op_date >= from && b.op_date <= to);
  const count = (list, key) => list.reduce((m, p) => { const k = (Array.isArray(key) ? key.map(x => p[x]).find(Boolean) : p[key]) || 'Not recorded'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const waiting = S.patients.filter(p => p.status === 'Awaiting surgery' || p.status === 'Scheduled for surgery').length;
  $('kpis').innerHTML = [
    ['Registered in period', inRange.length, ''],
    ['Stat / urgent in period', inRange.filter(p => p.triage === 'Stat trauma' || p.triage === 'Urgent').length, 'color:var(--red)'],
    ['Operations done in period', opsDone.length, 'color:var(--brand-d)'],
    ['Waiting / scheduled for surgery now', waiting, 'color:var(--amber)']
  ].map(([l, v, st]) => `<div class="card kpi"><div class="l">${esc(l)}</div><div class="v" style="${st}">${v}</div></div>`).join('');
  const months = last12Months();
  const regM = {}, opM = {};
  S.patients.forEach(p => { const k = isoDate(new Date(p.created_at)).slice(0, 7); regM[k] = (regM[k] || 0) + 1; });
  books.filter(b => b.status === 'Done').forEach(b => { const k = b.op_date.slice(0, 7); opM[k] = (opM[k] || 0) + 1; });
  columns('chartMonthly', months.map(([k, l]) => [l, regM[k] || 0]));
  columns('chartOps', months.map(([k, l]) => [l, opM[k] || 0]), '#0369a1');
  const unitCounts = count(inRange, 'unit'); const shortCounts = {}; Object.entries(unitCounts).forEach(([k, v]) => { shortCounts[shortUnit(k)] = v; });
  bars('chartUnit', shortCounts);
  bars('chartStatus', count(inRange, 'status'), '#6d28d9');
  const mech = {}; Object.entries(count(inRange, 'mechanism')).forEach(([k, v]) => { mech[k.replace(/\s*\(.*\)$/, '')] = v; });
  bars('chartMech', mech, '#ea580c');
  const dist = {}; Object.entries(count(inRange, 'district')).forEach(([k, v]) => { dist[k.replace(/\s*\(.*\)$/, '')] = v; });
  bars('chartDistrict', dist, '#0f766e');
}
['rFrom', 'rTo'].forEach(id => $(id).addEventListener('change', renderReports));
$('exportAllBtn').addEventListener('click', () => exportExcel(true));

/* ======================= Excel export ======================= */
const PATIENT_COLS = [['MRN','mrn'],['Name','name'],['National ID','national_id'],['Date of birth','dob'],['Age','age'],['Sex','sex'],['Mobile','phone'],['Alt phone','alt_phone'],['District','district'],['Address','address'],['Pathway','admission_type'],['Referred from','referral'],['Mechanism','mechanism'],['Region','joints'],['Side','laterality'],['AO/OTA','ao_code'],['Diagnosis','diagnosis'],['Unit','unit'],['Consultant','consultant'],['Pain VAS','pain_vas'],['Triage','triage'],['Red flags','red_flags'],['Imaging','imaging'],['Comorbidities','comorbidities'],['Status','status'],['Notes','notes'],['Registered','created_at'],['Registered by','created_by_email'],['Last updated','updated_at'],['Updated by','updated_by_email']];
function rowFor(p) { const r = {}; PATIENT_COLS.forEach(([h, k]) => { let v = p[k]; if (Array.isArray(v)) v = v.join('; '); if (k === 'created_at' || k === 'updated_at') v = v ? fmtDateTime(v) : ''; r[h] = v == null ? '' : v; }); return r; }
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function loadXLSX() {
  if (window.XLSX) return;
  for (const src of ['vendor/xlsx.full.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']) {
    try { await loadScript(src); if (window.XLSX) return; } catch (e) { /* try next */ }
  }
  throw new Error('Excel library could not be loaded (check the internet connection).');
}
async function exportExcel(full) {
  try {
    await loadXLSX();
    const wb = XLSX.utils.book_new();
    const list = full ? S.patients.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) : applyFilters();
    const ws = XLSX.utils.json_to_sheet(list.map(rowFor), { header: PATIENT_COLS.map(c => c[0]) });
    ws['!cols'] = PATIENT_COLS.map(([h]) => ({ wch: Math.min(40, Math.max(10, h.length + 4)) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Patients');
    if (full) {
      const [visits, books] = await Promise.all([store.listAllVisits(), store.listAllBookings()]);
      const who = id => S.byId.get(id) || {};
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(books.slice().sort((a, b) => a.op_date.localeCompare(b.op_date)).map(b => ({ Date: b.op_date, Theatre: b.theatre || '', Order: b.order_no, MRN: who(b.patient_id).mrn || '', Patient: who(b.patient_id).name || '', Diagnosis: who(b.patient_id).diagnosis || '', Procedure: b.procedure, Side: b.side || '', Surgeon: b.surgeon || '', Anaesthesia: b.anesthesia || '', Implant: b.implant || '', Status: b.status, Notes: b.notes || '' }))), 'Operations');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(visits.map(v => ({ Date: v.visit_date, MRN: who(v.patient_id).mrn || '', Patient: who(v.patient_id).name || '', Type: v.type, Note: v.note || '', By: v.author_email || '' }))), 'Timeline');
    }
    XLSX.writeFile(wb, 'KFSU-ortho-' + (full ? 'registry-backup' : 'patients') + '-' + isoDate() + '.xlsx');
    toast('Excel file downloaded (' + list.length + ' patients).');
  } catch (e) { fail(e, 'Export failed'); }
}

/* ======================= Demo sample data ======================= */
$('seedDemoBtn').addEventListener('click', async () => {
  if (!DEMO) return;
  const T = isoDate();
  const samples = [
    { name: 'Sample Patient One', age: 34, sex: 'Male', phone: '01000000001', district: DISTRICTS[1], admission_type: ADMISSION[1], mechanism: MECHANISMS[0], unit: UNITS[0], diagnosis: 'Tibial shaft fracture', joints: ['Right Tibia & Fibula Shaft'], laterality: 'Right', ao_code: '42 (Tibial Diaphysis)', pain_vas: 8, triage: 'Urgent', red_flags: [], imaging: ['X-ray'], comorbidities: [], status: 'Awaiting surgery' },
    { name: 'Sample Patient Two', age: 71, sex: 'Female', phone: '01000000002', district: DISTRICTS[0], admission_type: ADMISSION[1], mechanism: MECHANISMS[2], unit: UNITS[2], diagnosis: 'Neck of femur fracture', joints: ['Left Hip & Femoral Neck'], laterality: 'Left', ao_code: '31 (Proximal Femur)', pain_vas: 7, triage: 'Urgent', red_flags: ['Unable to bear weight / locked joint'], imaging: ['X-ray', 'Pre-op labs'], comorbidities: ['Diabetes', 'Hypertension'], status: 'Scheduled for surgery' },
    { name: 'Sample Patient Three', age: 24, sex: 'Male', phone: '01000000003', district: DISTRICTS[4], admission_type: ADMISSION[0], mechanism: MECHANISMS[3], unit: UNITS[1], diagnosis: 'ACL tear', joints: ['Right Knee Joint (ACL / Meniscus / Tibial Plateau)'], laterality: 'Right', pain_vas: 3, triage: 'Routine', red_flags: [], imaging: ['MRI'], comorbidities: [], status: 'Under investigation' },
    { name: 'Sample Patient Four', age: 6, sex: 'Female', phone: '01000000004', district: DISTRICTS[7], admission_type: ADMISSION[0], mechanism: MECHANISMS[8], unit: UNITS[4], diagnosis: 'DDH', joints: ['Left Hip & Femoral Neck'], laterality: 'Left', pain_vas: 1, triage: 'Routine', red_flags: [], imaging: ['X-ray'], comorbidities: [], status: 'Follow-up' },
    { name: 'Sample Patient Five', age: 45, sex: 'Male', phone: '01000000005', district: DISTRICTS[8], admission_type: ADMISSION[1], mechanism: MECHANISMS[4], unit: UNITS[5], diagnosis: 'Flexor tendon injury zone II', joints: ['Right Wrist, Carpus & Hand'], laterality: 'Right', pain_vas: 6, triage: 'Stat trauma', red_flags: ['Neurovascular deficit'], imaging: ['X-ray'], comorbidities: ['Smoker'], status: 'Admitted' }
  ];
  try {
    for (const s of samples) upsertLocal(await store.createPatient(s));
    const p2 = S.patients.find(p => p.name === 'Sample Patient Two');
    await store.addBooking({ patient_id: p2.id, op_date: T, theatre: theatreOrder()[0], order_no: 1, procedure: 'Hemiarthroplasty (bipolar)', side: 'Left', anesthesia: 'Spinal', status: 'Scheduled' });
    toast('5 sample patients added (demo only).');
    rerender();
  } catch (e) { fail(e); }
});

boot();
})();
