/* Sanitas — barcode food scanner & scorer
   Data: Open Food Facts (https://world.openfoodfacts.org) — open database, ODbL licence. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const API = 'https://world.openfoodfacts.org';
const BAPI = 'https://world.openbeautyfacts.org';
const PAPI = 'https://world.openpetfoodfacts.org';
const OPAPI = 'https://world.openproductsfacts.org';
const SRC = {food:['Open Food Facts', API], beauty:['Open Beauty Facts', BAPI], pet:['Open Pet Food Facts', PAPI], products:['Open Products Facts', OPAPI], clothing:['your care label', '']};
const FIELDS = ['code','product_name','product_name_en','generic_name','brands','quantity','image_front_small_url','image_front_url',
  'nutriscore_grade','nova_group','nutriments','additives_tags','ingredients_text','ingredients_text_en','ingredients',
  'allergens_tags','traces_tags','labels_tags','packaging','packaging_tags','packagings','categories_tags','categories',
  'ingredients_analysis_tags','countries_tags','serving_size','manufacturing_places','origins','lang','ecoscore_grade','environmental_score_grade'].join(',');

// ---------------- navigation ----------------
function show(v){
  ['scan','result','history','me'].forEach(n => $('#v-'+n).classList.toggle('hidden', n !== v));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v !== 'scan') stopScan();
  $('#fab').classList.toggle('hidden', v !== 'result');
  if (v === 'scan') renderRecent();
  if (v === 'history') renderHistory();
  if (v === 'me') renderMyProducts();
  if (v === 'result' && !$('#v-result').innerHTML.trim())
    $('#v-result').innerHTML = '<div class="card"><p class="muted">No result yet — scan something first.</p></div>';
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => show(b.dataset.v));
const goScan = () => show('scan');
// ---------------- UI helpers: theme, toast, recent, fab ----------------
function applyTheme(pref){
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#0d120f' : '#1f7a4d');
  document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === pref));
}
let themePref = 'system'; try{ themePref = localStorage.getItem('fs_theme') || 'system'; }catch(e){}
applyTheme(themePref);
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themePref === 'system') applyTheme('system'); }); }catch(e){}
document.querySelectorAll('#themeSeg button').forEach(b => b.onclick = () => {
  themePref = b.dataset.t; try{ localStorage.setItem('fs_theme', themePref); }catch(e){}
  applyTheme(themePref); toast(themePref === 'dark' ? '🌙 Dark mode on' : themePref === 'light' ? '☀️ Light mode on' : '📱 Matching your phone');
});
let toastT = null;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

function renderRecent(){
  const h = store.get('fs_hist', []);
  $('#recentWrap').classList.toggle('hidden', !h.length);
  $('#recent').innerHTML = h.slice(0, 12).map(x => `<div class="rc" data-c="${esc(x.code)}">
    <div class="top">${x.img ? `<img src="${esc(x.img)}" alt="">` : `<div class="ph">${x.emoji || ({beauty:'🧴', pet:'🐾', products:'🧽', produce:'🥬', clothing:'👕'}[x.kind] || (x.cos ? '🧴' : '🛒'))}</div>`}
    <div class="sc" style="background:${col(x.score)};width:34px;height:34px;font-size:13px;border-radius:10px">${x.score}</div></div>
    <b>${esc(x.name)}</b><span>${esc(x.brand || '')}</span></div>`).join('');
  $('#recent').querySelectorAll('.rc').forEach(el => el.onclick = () => lookup(el.dataset.c));
}
$('#seeAll').onclick = () => show('history');
$('#btnSources').onclick = () => FSInfo.sources(); $('#btnPrivacy').onclick = () => FSInfo.privacy(); $('#btnAbout').onclick = () => FSInfo.about();
const setOffline = () => $('#offline').classList.toggle('hidden', navigator.onLine !== false);
window.addEventListener('online', setOffline); window.addEventListener('offline', setOffline); setOffline();
setTimeout(() => FSInfo.welcome(), 400);
$('#focusSearch').onclick = () => { $('#q').focus(); $('#q').scrollIntoView({behavior:'smooth', block:'center'}); };
$('#fab').onclick = () => { show('scan'); startScan(); };
$('#clearHist').onclick = () => { store.set('fs_hist', []); renderHistory(); renderRecent(); toast('History cleared'); };
$('#clearCustom').onclick = () => { store.set('fs_custom', {}); renderMyProducts(); toast('Your added products were deleted'); };
['#avoid','#regionSel','#usdaKey'].forEach(id => $(id).addEventListener('change', () => $('#saveMe').click()));

// "Why this score" summary + fold away the detail sections
function enhanceResult(r){
  if (!r || r.noIngredients) return;
  const root = $('#v-result');
  const heroCard = root.querySelector(':scope > .card'); if (!heroCard) return;
  const bd = r.breakdown || [];
  const good = bd.filter(b => b.points / b.max >= 0.8).sort((a, b) => b.points / b.max - a.points / a.max);
  const bad = bd.filter(b => b.points / b.max < 0.55).sort((a, b) => a.points / a.max - b.points / b.max);
  const first = s => { let t = String(s || '').replace(/\(e\.g\.[^)]*\)/g, '').split(/\.\s(?=[A-Z0-9])|;\s/)[0].replace(/\.$/, '').trim(); if (t.length > 95) t = t.slice(0, 92).replace(/\s\S*$/, '') + '…'; return t; };
  const aw = r.animalPenalty ? [`<li><span class="ic bad">🐾</span><div><b>Animal welfare</b> · −${r.animalPenalty} pts · ${esc(first(r.animal.main || r.animal.points[0]))}</div></li>`] : [];
  const al = r.alc ? [`<li><span class="ic bad">🍺</span><div><b>Alcohol</b> · −${r.alc.penalty} pts · ${r.alc.abv != null ? r.alc.abv + '% ABV' : 'alcoholic drink'}${r.alc.sd != null ? ', ' + r.alc.sd + ' standard drinks per container' : ''}</div></li>`] : [];
  const ev = r.envPenalty ? [`<li><span class="ic bad">🌍</span><div><b>Environment</b> · −${r.envPenalty} pts · impact grade ${esc(r.env.grade)}</div></li>`] : [];
  const items = [...al, ...aw, ...ev, ...bad.slice(0, 4).map(b => `<li><span class="ic bad">⚠️</span><div><b>${esc(b.factor)}</b> · ${esc(first(b.note))}</div></li>`),
                 ...good.slice(0, 3).map(b => `<li><span class="ic good">✅</span><div><b>${esc(b.factor)}</b> · ${esc(first(b.note))}</div></li>`)];
  const mini = bd.map(b => { const p = b.points / b.max; return `<div>${esc(b.factor.replace('Microplastics & packaging','Microplastics').replace('Skin benefits & fit for you','Skin fit').replace('Irritants & allergens','Irritants').replace('Other health concerns','Other concerns').replace('Hormone disruptors','Hormones').replace('Pesticide exposure','Pesticides').replace('Ingredient quality','Ingredients'))}<i><em style="width:${p * 100}%;background:${col(p * 100)}"></em></i></div>`; }).join('');
  const why = document.createElement('div'); why.className = 'card';
  why.innerHTML = `<h2>Why this score</h2><ul class="why">${items.join('') || '<li><span class="ic good">👌</span><div>Nothing stands out either way.</div></li>'}</ul><div class="minibars">${mini}</div>`;
  heroCard.after(why);
  // collapse long sections
  [...root.querySelectorAll(':scope > .card')].forEach((c, i) => {
    const h = c.querySelector(':scope > h2'); if (!h || c === heroCard || c === why) return;
    if (/alternatives|picks|Add it|Edit product|Not in/i.test(h.textContent)) return;
    const keepOpen = /Nutrition breakdown/.test(h.textContent);
    const d = document.createElement('details'); d.className = 'card sec';
    const s = document.createElement('summary'); s.innerHTML = h.innerHTML; h.remove();
    const cnt = c.querySelectorAll('.item').length; if (cnt) s.insertAdjacentHTML('beforeend', `<span class="cnt">${cnt}</span>`);
    const body = document.createElement('div'); body.className = 'secbody';
    while (c.firstChild) body.appendChild(c.firstChild);
    d.append(s, body); if (keepOpen) d.open = true; c.replaceWith(d);
  });
}


// ---------------- profile ----------------
const GOALS = ['General health','Lose weight','Build muscle','Endurance training','Heart health','Low sugar','Gut health'];
const DIETS = ['No restrictions','Vegetarian','Vegan','Gluten-free','Halal','Low carb','High protein','Avoid seed oils'];
let me = store.get('fs_me', {goals:['General health'], diets:['No restrictions','Avoid seed oils'], avoid:'', seedV:1});
if (!me.seedV){ if (!me.diets.includes('Avoid seed oils')) me.diets.push('Avoid seed oils'); me.seedV = 1; store.set('fs_me', me); }
function chips(el, list, key){
  el.innerHTML = list.map(x => `<span class="chip ${me[key].includes(x)?'on':''}" data-x="${esc(x)}">${esc(x)}</span>`).join('');
  el.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    const a = me[key], i = a.indexOf(c.dataset.x);
    i >= 0 ? a.splice(i, 1) : a.push(c.dataset.x);
    c.classList.toggle('on');
    store.set('fs_me', me); toast('Saved ✓');
  });
}
const REGIONS = [['en:australia','🇦🇺 Australia'],['world','🌍 Worldwide — no preference'],['en:new-zealand','🇳🇿 New Zealand'],['en:united-states','🇺🇸 USA'],['en:united-kingdom','🇬🇧 UK'],['en:canada','🇨🇦 Canada'],
  ['en:japan','🇯🇵 Japan'],['en:south-korea','🇰🇷 South Korea'],['en:china','🇨🇳 China'],['en:taiwan','🇹🇼 Taiwan'],['en:india','🇮🇳 India'],['en:thailand','🇹🇭 Thailand'],['en:philippines','🇵🇭 Philippines'],['en:vietnam','🇻🇳 Vietnam'],
  ['en:indonesia','🇮🇩 Indonesia'],['en:malaysia','🇲🇾 Malaysia'],['en:singapore','🇸🇬 Singapore'],['en:mexico','🇲🇽 Mexico'],['en:spain','🇪🇸 Spain'],['en:colombia','🇨🇴 Colombia'],['en:argentina','🇦🇷 Argentina'],['en:chile','🇨🇱 Chile'],
  ['en:peru','🇵🇪 Peru'],['en:france','🇫🇷 France'],['en:germany','🇩🇪 Germany'],['en:italy','🇮🇹 Italy'],['en:netherlands','🇳🇱 Netherlands'],['en:greece','🇬🇷 Greece'],['en:turkey','🇹🇷 Turkey'],['en:lebanon','🇱🇧 Lebanon'],['en:south-africa','🇿🇦 South Africa']];
const regionTag = () => me.region && me.region !== 'world' ? me.region : null;
const regionName = () => (REGIONS.find(r => r[0] === (me.region || 'en:australia')) || REGIONS[0])[1].replace(/^\S+\s/, '');
const countryLabel = tag => { const r = REGIONS.find(x => x[0] === tag); return r ? r[1] : titleCase(tag.replace(/^\w\w:/, '').replace(/-/g, ' ')); };
if (!me.region) me.region = 'en:australia';
const SKIN = ['Sensitive skin','Dry skin','Oily skin','Acne-prone','Eczema-prone','Fragrance-free','Pregnant / breastfeeding'];
if (!me.skin) me.skin = [];
const ANIMAL = ['Count animal welfare in the score','Cruelty-free only'];
if (!me.animal) me.animal = ['Count animal welfare in the score'];
const ENVPREF = ['Count environmental impact in the score'];
if (!me.envPref) me.envPref = [];
chips($('#goals'), GOALS, 'goals'); chips($('#diets'), DIETS, 'diets'); chips($('#skin'), SKIN, 'skin'); chips($('#animal'), ANIMAL, 'animal'); chips($('#envPref'), ENVPREF, 'envPref');
$('#regionSel').innerHTML = REGIONS.map(r => `<option value="${r[0]}" ${r[0] === me.region ? 'selected' : ''}>${r[1]}</option>`).join('');
$('#avoid').value = me.avoid || ''; $('#usdaKey').value = me.usdaKey || '';
$('#saveMe').onclick = () => {
  me.avoid = $('#avoid').value.trim(); me.usdaKey = $('#usdaKey').value.trim(); me.region = $('#regionSel').value; store.set('fs_me', me);
  $('#savedMsg').textContent = 'Saved ✓'; setTimeout(() => $('#savedMsg').textContent = '', 1800);
  toast('Saved ✓');
};
const titleCase = t => String(t || '').toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase());
const has = g => me.goals.includes(g) || me.diets.includes(g);

// ---------------- scanner ----------------
let stream = null, scanning = false, detector = null, scanTimer = null, tipTimer = null, track = null;
const FORMATS = ['ean_13','ean_8','upc_a','upc_e','code_128'];
$('#scanIdle').onclick = startScan;
$('#stopScan').onclick = stopScan;
$('#photoScan').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) scanPhoto(f); };

async function getDetector(){
  if (detector) return detector;
  try{
    if ('BarcodeDetector' in window){
      const f = await window.BarcodeDetector.getSupportedFormats();
      if (f.includes('ean_13')) return (detector = new window.BarcodeDetector({formats: FORMATS}));
    }
  }catch(e){}
  if (window.BarcodeDetectionAPI){
    try{
      BarcodeDetectionAPI.setZXingModuleOverrides({
        locateFile: (path, prefix) => path.endsWith('.wasm') ? new URL('zxing_reader.wasm', location.href).href : prefix + path
      });
    }catch(e){}
    return (detector = new BarcodeDetectionAPI.BarcodeDetector({formats: FORMATS}));
  }
  throw new Error('Barcode engine failed to load. Close and reopen the app.');
}
// warm up the engine early so the first scan is fast
setTimeout(() => getDetector().then(d => {
  const c = document.createElement('canvas'); c.width = c.height = 8; return d.detect(c);
}).catch(() => {}), 800);

function validCode(code){
  if (!/^\d+$/.test(code)) return code.length >= 6;
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const d = code.split('').map(Number), check = d.pop();
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}

async function startScan(){
  $('#scanErr').innerHTML = '';
  if (!navigator.mediaDevices?.getUserMedia){
    return scanError('Live camera isn\'t available here. Use "Take a photo of the barcode" instead, or type the numbers.');
  }
  $('#scanIdle').classList.add('hidden'); $('#scanLive').classList.remove('hidden');
  $('#hint').textContent = 'Line the barcode up in the box';
  scanning = true;
  const video = $('#video');
  try{
    const det = await getDetector();
    stream = await navigator.mediaDevices.getUserMedia({audio:false, video:{facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080}}});
    if (!scanning){ stream.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = stream; await video.play();
    track = stream.getVideoTracks()[0];
    setupCameraControls(track);
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', {willReadFrequently:true});
    let n = 0, last = '', busy = false;
    const tick = async () => {
      if (!scanning) return;
      if (!busy && video.readyState >= 2 && video.videoWidth){
        busy = true;
        try{
          const vw = video.videoWidth, vh = video.videoHeight;
          let src = video;
          if (n++ % 3 !== 2){
            // scan the middle of the frame (where the box is) — faster and sharper
            const cw = Math.round(vw * 0.9), ch = Math.round(vh * 0.5);
            canvas.width = cw; canvas.height = ch;
            ctx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, cw, ch);
            src = canvas;
          }
          const res = await det.detect(src);
          const hit = (res || []).map(r => r.rawValue).find(validCode);
          if (hit){
            if (hit === last || /^\d{13}$/.test(hit)) return found(hit);
            last = hit;
          }
        }catch(e){}
        busy = false;
      }
      scanTimer = setTimeout(tick, 90);
    };
    tick();
    tipTimer = setTimeout(() => { if (scanning) $('#hint').textContent = 'Tip: hold it 15–20cm away, try 2× zoom, or use Take a photo'; }, 7000);
  }catch(e){
    stopScan();
    scanError(e && e.name === 'NotAllowedError'
      ? 'Camera permission was blocked. Allow camera access for this site in your phone settings, or use "Take a photo of the barcode".'
      : (e.message || 'Could not start the camera.') + ' You can use "Take a photo of the barcode" instead.');
  }
}

function setupCameraControls(t){
  const zb = $('#zoomBtn'), tb = $('#torchBtn');
  zb.classList.add('hidden'); tb.classList.add('hidden');
  let caps = {};
  try{ caps = t.getCapabilities ? t.getCapabilities() : {}; }catch(e){}
  try{ if (caps.focusMode && caps.focusMode.includes('continuous')) t.applyConstraints({advanced:[{focusMode:'continuous'}]}); }catch(e){}
  if (caps.zoom && caps.zoom.max >= 1.5){
    let z = 1; zb.textContent = '1×'; zb.classList.remove('hidden');
    zb.onclick = () => { z = z === 1 ? Math.min(2, caps.zoom.max) : z === 2 && caps.zoom.max >= 3 ? 3 : 1;
      t.applyConstraints({advanced:[{zoom:z}]}).catch(()=>{}); zb.textContent = z + '×'; };
  }
  if (caps.torch){
    let on = false; tb.classList.remove('hidden'); tb.textContent = '🔦';
    tb.onclick = () => { on = !on; t.applyConstraints({advanced:[{torch:on}]}).catch(()=>{}); tb.style.background = on ? '#f2a900' : ''; };
  }
}

function stopScan(){
  scanning = false;
  clearTimeout(scanTimer); clearTimeout(tipTimer);
  if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
  track = null;
  const v = $('#video'); if (v) v.srcObject = null;
  $('#scanLive').classList.add('hidden'); $('#scanIdle').classList.remove('hidden');
}
function scanError(m){ $('#scanErr').innerHTML = `<div class="err">${esc(m)}</div>`; }
function found(code){
  if (!scanning) return;
  try{ navigator.vibrate && navigator.vibrate(60); }catch(e){}
  FSNative.haptic();
  stopScan();
  lookup(code);
}

async function scanPhoto(file){
  $('#scanErr').innerHTML = '<p class="muted" style="margin-top:10px">Reading barcode…</p>';
  try{
    const det = await getDetector();
    const bmp = await createImageBitmap(file);
    const tries = [];
    // full image, then a downscaled copy (helps with huge phone photos), then the centre crop
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    const scaled = s => { c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); ctx.drawImage(bmp, 0, 0, c.width, c.height); return c; };
    tries.push(() => bmp, () => scaled(Math.min(1, 1600 / Math.max(bmp.width, bmp.height))), () => {
      c.width = Math.round(bmp.width * 0.7); c.height = Math.round(bmp.height * 0.5);
      ctx.drawImage(bmp, bmp.width * 0.15, bmp.height * 0.25, c.width, c.height, 0, 0, c.width, c.height); return c; });
    for (const t of tries){
      const res = await det.detect(t()).catch(() => []);
      const hit = (res || []).map(r => r.rawValue).find(validCode);
      if (hit){ $('#scanErr').innerHTML = ''; FSNative.haptic(); try{ navigator.vibrate && navigator.vibrate(60); }catch(e){} return lookup(hit); }
    }
    scanError('Couldn\'t read a barcode in that photo. Get closer so the barcode fills most of the photo, make sure it\'s sharp and well lit, or type the numbers under the barcode.');
  }catch(e){
    scanError('Couldn\'t open that photo. Try again or type the numbers under the barcode.');
  }
}

// ---------------- manual / search ----------------
$('#qGo').onclick = doQuery;
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') doQuery(); });
async function doQuery(){
  const q = $('#q').value.trim(); if (!q) return;
  $('#q').blur();
  if (/^\d{6,14}$/.test(q) || /^9?\d{4}$/.test(q)) return lookup(q);
  $('#searchRes').innerHTML = '<p class="muted" style="margin-top:10px">Searching…</p>';
  try{
    let list = regionTag() ? await searchProducts(q, true) : [];
    if (list.length < 6) list = list.concat(await searchProducts(q, false)).filter((p, i, a) => a.findIndex(x => x.code === p.code) === i);
    const scored = list.slice(0, 16).map(p => {
      let sc = null;
      try{
        if (p._src !== 'food'){ const a = nonFoodAnalyse(p, p._src); if (!a.noIngredients) sc = a.score; }
        else if ((p.nutriments && Object.keys(p.nutriments).length > 2) || p.ingredients_text){ sc = analyse(p).score; }
      }catch(e){}
      return {p, sc};
    });
    const fresh = window.FSProduce ? FSProduce.search(q) : [];
    const freshHtml = fresh.length ? `<p class="muted" style="margin-top:10px">Loose fruit & veg</p>` + fresh.map(f => `<div class="sres" data-c="${esc(f.code)}"><div style="width:44px;height:44px;display:grid;place-items:center;font-size:26px">${f.emoji}</div><div style="flex:1"><b>${esc(f.name)}</b><span>Sticker code ${esc(f.code)} · organic: 9${esc(f.code)}</span></div></div>`).join('') : '';
    $('#searchRes').innerHTML = freshHtml + (scored.length ? `<p class="muted" style="margin-top:10px">${regionTag() ? `Showing ${esc(regionName())} first, then worldwide.` : 'Showing worldwide results.'} Tap one for the full breakdown.</p>` + scored.map(({p, sc}) => `
      <div class="sres" data-c="${esc(p.code)}">${p.image_front_small_url ? `<img src="${esc(p.image_front_small_url)}" alt="">` : '<div style="width:44px"></div>'}
      <div style="flex:1"><b>${KIND_ICON[p._src] || ''}${esc(nameOf(p))}</b><span>${esc([p.brands, p.quantity].filter(Boolean).join(' · '))}${p._world ? ' · 🌍' : ''}</span></div>
      ${sc != null ? `<div class="sc" style="background:${col(sc)};width:38px;height:38px;font-size:14px">${sc}</div>` : '<span class="muted" style="font-size:11px">no data</span>'}</div>`).join('')
      : (fresh.length ? '' : '<p class="muted" style="margin-top:10px">No matches. Try a different spelling or scan the barcode.</p>'));
    $('#searchRes').querySelectorAll('.sres').forEach(el => el.onclick = () => lookup(el.dataset.c));
  }catch(e){ $('#searchRes').innerHTML = '<div class="err">Search failed — check your internet connection.</div>'; }
}
async function searchProducts(q, au){
  const lists = await Promise.all([[API,'food'],[BAPI,'beauty'],[PAPI,'pet'],[OPAPI,'products']].map(([b, s]) => searchOne(b, q, au, s).catch(() => [])));
  const out = []; const n = Math.max(...lists.map(l => l.length));
  for (let i = 0; i < n; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}
async function searchOne(base, q, au, src){
  let url = `${base}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=${FIELDS},image_front_small_url`;
  if (au && regionTag()) url += '&tagtype_0=countries&tag_contains_0=contains&tag_0=' + encodeURIComponent(regionTag().replace(/^en:/, ''));
  const r = await fetch(url); const j = await r.json();
  return (j.products || []).filter(p => p.code && nameOf(p) !== 'Unnamed product').map(p => (p._src = src, p._world = !au && !!regionTag() && !(p.countries_tags || []).includes(regionTag()), p));
}
// Open Food/Beauty Facts tag every ingredient with a standard id (e.g. "en:sunflower-oil") whatever the label language.
function enName(i){ return i && i.id && /^en:/.test(i.id) ? i.id.slice(3).replace(/-/g, ' ') : ''; }
function englishIngredients(p){
  if (p.ingredients_text_en) return p.ingredients_text_en;
  const ids = (p.ingredients || []).map(enName).filter(Boolean);
  const orig = p.ingredients_text || '';
  if (ids.length && (!p.lang || p.lang !== 'en')) return ids.join(', ') + (orig ? ' | ' + orig : '');
  if (orig && window.FSSpecial && FSSpecial.looksForeign(orig)){ const tr = FSSpecial.translate(orig); if (tr) return tr + ' | ' + orig; }
  return orig || ids.join(', ');
}
window.FSEnglish = { enName, englishIngredients };
const nameOf = p => p.product_name_en || p.product_name || p.generic_name || 'Unnamed product';

// ---------------- lookup ----------------
async function getOne(base, code){
  const r = await fetch(`${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!r.ok && r.status !== 404) throw new Error('net');
  const j = await r.json();
  return j.status === 1 ? j.product : null;
}
const variants = code => { const v = [code]; if (/^\d{12}$/.test(code)) v.push('0' + code); if (/^0\d{12}$/.test(code)) v.push(code.slice(1)); return v; };
function cacheProduct(code, got){
  try{ const c = store.get('fs_cache', {}); c[code] = {p: got.p, src: got.src, ts: Date.now()};
    const keys = Object.keys(c); if (keys.length > 150) keys.sort((a, b) => c[a].ts - c[b].ts).slice(0, keys.length - 150).forEach(k => delete c[k]);
    store.set('fs_cache', c); }catch(e){}
}
async function getProduct(code){
  const g = await getProductLive(code);
  if (g && g.p && !g.custom && !g.produce) cacheProduct(code, g);
  return g;
}
async function getProductLive(code){
  const custom = store.get('fs_custom', {})[code];
  if (custom) return {p: custom, src: custom._src || 'food', custom: true};
  if (window.FSProduce && /^9?\d{4}$/.test(code)){ const pr = FSProduce.build(code); return pr ? {p: pr, src: 'food', produce: true} : null; }
  let netFail = 0, tried = 0;
  for (const c of variants(code)){
    tried++;
    const res = await Promise.all([API, BAPI, PAPI, OPAPI].map(b => getOne(b, c).catch(e => e)));
    const [food, beauty, petf, prod] = res.map(x => x instanceof Error ? null : x);
    if (res.every(x => x instanceof Error)){ netFail++; continue; }
    const foodLike = food && ((food.nutriments && Object.keys(food.nutriments).length > 2) || (food.categories_tags || []).length);
    if (food && foodLike) return {p: food, src: 'food'};
    if (beauty) return {p: beauty, src: 'beauty'};
    if (petf) return {p: petf, src: 'pet'};
    if (prod) return {p: prod, src: 'products'};
    if (food) return {p: food, src: 'food'};
  }
  const u = await getUSDA(code).catch(() => null);
  if (u) return {p: u, src: 'food'};
  if (netFail === tried){
    const c = store.get('fs_cache', {})[code];
    if (c) return {p: c.p, src: c.src, cached: true};
    throw new Error('net');
  }
  return null;
}
async function getUSDA(code){
  const key = (me.usdaKey || '').trim() || 'DEMO_KEY';
  const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(code)}&dataType=Branded&pageSize=10`);
  if (!r.ok) return null;
  const j = await r.json();
  const strip = x => String(x || '').replace(/^0+/, '');
  const f = (j.foods || []).find(x => strip(x.gtinUpc) === strip(code));
  if (!f) return null;
  const nut = {}; (f.foodNutrients || []).forEach(n => { nut[String(n.nutrientNumber)] = n.value; });
  const nutriments = {};
  if (nut['208'] != null) nutriments['energy-kcal_100g'] = nut['208'];
  if (nut['203'] != null) nutriments.proteins_100g = nut['203'];
  if (nut['204'] != null) nutriments.fat_100g = nut['204'];
  if (nut['606'] != null) nutriments['saturated-fat_100g'] = nut['606'];
  if (nut['205'] != null) nutriments.carbohydrates_100g = nut['205'];
  if (nut['269'] != null) nutriments.sugars_100g = nut['269'];
  if (nut['291'] != null) nutriments.fiber_100g = nut['291'];
  if (nut['307'] != null) nutriments.sodium_100g = nut['307'] / 1000;
  const ing = f.ingredients || '';
  return {code, product_name: titleCase(f.description), brands: titleCase(f.brandName || f.brandOwner || ''), quantity: f.packageWeight || '',
    ingredients_text: ing, nutriments, categories: f.foodCategory || '', categories_tags: [],
    additives_tags: window.FSLabel ? FSLabel.additivesFromText(ing) : [], _source: 'USDA FoodData Central'};
}
async function lookup(code){
  $('#q').value = ''; $('#searchRes').innerHTML = '';
  show('result');
  $('#v-result').innerHTML = `<div class="card loading"><div class="spin"></div><b>Looking up ${esc(code)}…</b><p class="muted">Checking ingredients, additives and nutrition</p></div>`;
  try{
    const got = await getProduct(code);
    if (!got || !got.p){ renderAddForm(code); return; }
    display(got, code);
  }catch(e){
    $('#v-result').innerHTML = `<div class="card"><div class="err">${navigator.onLine === false ? 'You\'re offline, and this product isn\'t saved on your phone yet. Try again when you\'re back online — or add it from the label.' : 'Couldn\'t reach the food databases. Check your internet and try again.'}</div><button class="btn ghost" style="margin-top:12px" id="addOff">📸 Add it from the label</button><button class="btn ghost" style="margin-top:12px" id="bk">Back</button></div>`;
    $('#bk').onclick = goScan;
    const ao = $('#addOff'); if (ao) ao.onclick = () => renderAddForm(code);
  }
}
function display(got, code){
    const p = got.p;
    p.code = p.code || code;
    if (got.src !== 'food'){
      const r = nonFoodAnalyse(p, got.src);
      renderCos(r);
      enhanceResult(r);
      addSourceNote(p, got);
      if (!r.noIngredients){
        const h = store.get('fs_hist', []).filter(x => x.code !== r.code);
        h.unshift({code:r.code, name:r.name, brand:r.brand, score:r.score, kind:got.src, cos:got.src === 'beauty', img:p.image_front_small_url || '', ts:Date.now()});
        store.set('fs_hist', h.slice(0, 50));
        findCosAlternatives(p, r, got.src).catch(() => { const el = $('#alts'); if (el) el.innerHTML = '<p class="muted">Couldn\'t load alternatives right now.</p>'; });
      }
      return;
    }
    const r = analyse(p);
    renderResult(r, p);
    enhanceResult(r);
    wireNutrition();
    addSourceNote(p, got);
    const nKeys = Object.keys(p.nutriments || {}).filter(k => /_100g$/.test(k) && p.nutriments[k] !== '' && p.nutriments[k] != null).length;
    const noIng = !(p.ingredients_text || p.ingredients_text_en || (p.ingredients || []).length);
    if (!got.custom && !p._produce && noIng && nKeys < 3){
      // not enough data for a meaningful score
      const ring = document.querySelector('#v-result .ring'); if (ring){ ring.querySelector('.num b').textContent = '?'; ring.querySelectorAll('circle')[1].setAttribute('stroke', 'var(--muted)'); ring.querySelectorAll('circle')[1].setAttribute('stroke-dashoffset', String(2 * Math.PI * 50)); }
      const gr = document.querySelector('#v-result .hero .grade'); if (gr){ gr.textContent = 'Not enough info'; gr.style.background = 'var(--muted)'; }
      const sum = document.querySelector('#v-result .hero + p'); if (sum) sum.textContent = 'The database only has the name for this one, so there\'s nothing to score yet. Complete it from the label for a real score.';
      const why = [...document.querySelectorAll('#v-result .card')].find(c => /Why this score/.test(c.textContent)); if (why) why.remove();
      const hist = store.get('fs_hist', []).filter(x => x.code !== r.code); store.set('fs_hist', hist);
    }
    if (!got.custom && !p._produce && (noIng || nKeys < 3)){
      const own = r.bc && r.bc.ownBrand ? ` Lots of ${r.bc.ownBrand} own-brand products are only partly filled in.` : '';
      $('#v-result').insertAdjacentHTML('afterbegin', `<div class="flag" style="display:flex;flex-direction:column;gap:10px">⚠️ This product is missing ${noIng && nKeys < 3 ? 'its ingredients and nutrition info' : noIng ? 'its ingredient list' : 'nutrition info'} in the database, so the score may be off.${own}<button class="btn primary" id="completeLbl" style="padding:11px">📸 Complete it from the label</button></div>`);
      $('#completeLbl').onclick = () => renderAddForm(code, Object.assign({}, p, {_src: 'food', _fromDb: true}));
    }
    const h = store.get('fs_hist', []).filter(x => x.code !== r.code);
    h.unshift({code:r.code, name:r.name, brand:r.brand, score:r.score, kind: p._produce ? 'produce' : 'food', emoji: p._produce ? p._produce.emoji : '', img:p.image_front_small_url || '', ts:Date.now()});
    store.set('fs_hist', h.slice(0, 50));
    findAlternatives(p, r).catch(() => { const el = $('#alts'); if (el) el.innerHTML = '<p class="muted">Couldn\'t load alternatives right now.</p>'; });
}

const KIND_ICON = {beauty:'🧴 ', pet:'🐾 ', products:'🧽 ', clothing:'👕 ', food:''};
function nonFoodAnalyse(p, src){
  const helpers = {clamp, cap, nameOf};
  if (src === 'clothing'){
    const r = FSCloth.analyse(p, me); r.src = src; r.srcName = SRC[src][0]; r.srcBase = '';
    r.envPenalty = r.env && (me.envPref || []).includes('Count environmental impact in the score') ? [0, 0, 0, 3, 6][r.env.idx] : 0;
    if (r.envPenalty) r.score = Math.max(0, r.score - r.envPenalty);
    return r;
  }
  const r = src === 'pet' ? FSOther.pet(p, me, helpers) : src === 'products' ? FSOther.household(p, me, helpers) : FSCos.analyse(p, me, helpers);
  r.src = src; r.srcName = SRC[src][0]; r.srcBase = SRC[src][1];
  r.bc = window.FSEnv ? FSEnv.barcodeCountry(p.code) : null;
  if (!r.noIngredients && window.FSEnv){
    r.env = FSEnv.nonFood(p, src === 'products' ? 'household' : src, r.ingText || (p.ingredients_text || ''));
    r.envPenalty = (me.envPref || []).includes('Count environmental impact in the score') ? r.env.penalty : 0;
    if (r.envPenalty) r.score = Math.max(0, r.score - r.envPenalty);
  }
  return r;
}
function addSourceNote(p, got){
  const last = [...document.querySelectorAll('#v-result .card')].pop(); if (!last) return;
  const firstP = last.querySelector('p.muted');
  if (got.custom){
    if (firstP) firstP.innerHTML = 'Added by you from the label · saved on this phone. General info, not medical advice.';
    const b = document.createElement('button'); b.className = 'btn ghost'; b.style.marginTop = '10px'; b.textContent = '✏️ Edit this product';
    b.onclick = () => p._src === 'clothing' ? renderClothForm(p.code, p) : renderAddForm(p.code, p); last.appendChild(b);
    if (p._src === 'clothing'){ if (firstP) firstP.innerHTML = 'Scored from the care label you entered · saved on this phone. Based on fibre content and labels — it can\'t check how or where it was made.'; }
    else if (!/^9?\d{4}$/.test(p.code)){
      const base = SRC[p._src || got.src || 'food'][1], name = SRC[p._src || got.src || 'food'][0];
      const a = document.createElement('a'); a.className = 'btn ghost'; a.style.marginTop = '8px'; a.target = '_blank'; a.rel = 'noopener';
      a.href = p._inDb ? `${base}/product/${encodeURIComponent(p.code)}` : `${base}/cgi/product.pl?type=add&code=${encodeURIComponent(p.code)}`;
      a.textContent = `🌍 ${p._inDb ? 'Update' : 'Add'} it on ${name}`;
      a.onclick = () => { try{ navigator.clipboard.writeText(offText(p)).then(() => toast('Details copied — paste them in ✓'), () => {}); }catch(e){} };
      last.appendChild(a);
      last.insertAdjacentHTML('beforeend', `<p class="muted" style="margin-top:8px">Helps everyone — once it's there, it works on any phone. The free ${esc(name)} app is quickest: snap the front, ingredients and nutrition panel. (The button above also copies the details for you.)</p>`);
    }
  } else if (p._source && firstP){
    firstP.innerHTML = `Barcode ${esc(p.code)} · Data from ${esc(p._source)}. General info, not medical advice.`;
  }
}


// ---------------- My products: list, export, import, share ----------------
const KIND_EMOJI = {food:'🛒', beauty:'🧴', pet:'🐾', products:'🧽', clothing:'👕'};
function myProducts(){ return store.get('fs_custom', {}); }
function renderMyProducts(){
  const all = myProducts(), list = Object.values(all).sort((a, b) => (b._updated || 0) - (a._updated || 0));
  $('#myCount').textContent = list.length ? `${list.length} product${list.length > 1 ? 's' : ''} you've added. Back them up, or share them with friends and family so their app knows them too.` : 'Nothing yet. When a product isn\'t found (or is incomplete), add it from the label and it shows up here.';
  $('#myList').innerHTML = list.slice(0, 50).map(p => `<div class="hist" data-c="${esc(p.code)}"><div class="ph" style="width:40px;height:40px;border-radius:10px;background:var(--soft);display:grid;place-items:center;font-size:20px;flex:none">${KIND_EMOJI[p._src || 'food']}</div>
    <div style="flex:1;min-width:0"><b>${esc(p.product_name)}</b><span>${esc([p.brands, p.code].filter(Boolean).join(' · '))}</span></div>
    <button class="del" data-c="${esc(p.code)}" style="border:0;background:var(--soft);color:var(--muted);border-radius:10px;padding:8px 10px;font:600 13px -apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",Roboto,sans-serif">✕</button></div>`).join('');
  $('#myList').querySelectorAll('.hist').forEach(el => el.onclick = e => { if (e.target.closest('.del')) return; lookup(el.dataset.c); });
  $('#myList').querySelectorAll('.del').forEach(btn => btn.onclick = () => {
    if (btn.dataset.armed){ const a = myProducts(); delete a[btn.dataset.c]; store.set('fs_custom', a); renderMyProducts(); toast('Deleted'); }
    else { btn.dataset.armed = '1'; btn.textContent = 'Delete?'; btn.style.background = 'var(--warn-bg)'; btn.style.color = 'var(--warn-ink)'; setTimeout(() => { if (btn.isConnected){ delete btn.dataset.armed; btn.textContent = '✕'; btn.style.background = 'var(--soft)'; btn.style.color = 'var(--muted)'; } }, 3000); }
  });
  ['#expShare','#expDl','#expCopy'].forEach(id => $(id).disabled = !list.length);
}
function exportJSON(){ return JSON.stringify({app: 'Sanitas', type: 'my-products', version: 1, exported: new Date().toISOString(), products: myProducts()}); }
function importJSON(text){
  let data; try{ data = JSON.parse(text); }catch(e){ toast('That isn\'t a Sanitas product list'); return; }
  const incoming = data && data.products && typeof data.products === 'object' ? data.products : null;
  if (!incoming){ toast('That isn\'t a Sanitas product list'); return; }
  const all = myProducts(); let added = 0, updated = 0;
  for (const [code, p] of Object.entries(incoming)){
    if (!p || typeof p !== 'object' || !/^(\d{4,14}|CL\d{6,16})$/.test(code)) continue;
    const clean = Object.assign({}, p, {code, _custom: true, product_name: String(p.product_name || 'Product').slice(0, 120), ingredients_text: String(p.ingredients_text || '').slice(0, 4000)});
    if (!all[code]){ all[code] = clean; added++; }
    else if ((clean._updated || 0) > (all[code]._updated || 0)){ all[code] = clean; updated++; }
  }
  store.set('fs_custom', all); renderMyProducts();
  toast(added || updated ? `Imported ${added} new${updated ? `, ${updated} updated` : ''} ✓` : 'Nothing new in that list');
}
$('#expShare').onclick = async () => {
  const json = exportJSON(), n = Object.keys(myProducts()).length;
  if (FSNative.native){ try{ await FSNative.shareFile('sanitas-products.json', json, 'My Sanitas products'); }catch(e){ if (!/cancel/i.test(String(e && e.message))) toast('Couldn\'t open the share sheet'); } return; }
  try{
    const file = new File([json], 'sanitas-products.json', {type: 'application/json'});
    if (navigator.canShare && navigator.canShare({files: [file]})) await navigator.share({files: [file], title: 'My Sanitas products', text: `${n} products for Sanitas — open Settings › My products › Import file.`});
    else if (navigator.share) await navigator.share({title: 'My Sanitas products', text: json});
    else toast('Sharing isn\'t available here — use Download or Copy');
  }catch(e){ if (e && e.name !== 'AbortError') toast('Sharing isn\'t available here — use Download or Copy'); }
};
$('#expDl').onclick = () => {
  try{
    const url = URL.createObjectURL(new Blob([exportJSON()], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = `sanitas-products-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Downloaded ✓');
  }catch(e){ toast('Download isn\'t available here — use Copy'); }
};
$('#expCopy').onclick = async () => { try{ await navigator.clipboard.writeText(exportJSON()); toast('Copied — paste it to a friend ✓'); }catch(e){ toast('Couldn\'t copy here'); } };
$('#impFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const r = new FileReader(); r.onload = () => importJSON(String(r.result)); r.readAsText(f); };
$('#impGo').onclick = () => { const t = $('#impText').value.trim(); if (t){ importJSON(t); $('#impText').value = ''; } };

// ---------------- Send to Open Food Facts ----------------
function offText(p){
  const n = p.nutriments || {};
  const rows = [['Energy', n['energy-kj_100g'], 'kJ'], ['Protein', n.proteins_100g, 'g'], ['Fat', n.fat_100g, 'g'], ['Saturated fat', n['saturated-fat_100g'], 'g'], ['Carbohydrate', n.carbohydrates_100g, 'g'], ['Sugars', n.sugars_100g, 'g'], ['Fibre', n.fiber_100g, 'g'], ['Sodium', n.sodium_100g != null ? Math.round(n.sodium_100g * 1000) : null, 'mg']].filter(r => r[1] != null);
  return [`Product: ${p.product_name}`, p.brands ? `Brand: ${p.brands}` : '', p.quantity ? `Quantity: ${p.quantity}` : '', `Barcode: ${p.code}`,
    p.ingredients_text ? `Ingredients: ${p.ingredients_text}` : '', rows.length ? 'Nutrition per 100g: ' + rows.map(r => `${r[0]} ${r[1]}${r[2]}`).join(', ') : ''].filter(Boolean).join('\n');
}
function bcText(bc){
  if (!bc) return '';
  if (bc.ownBrand) return `🛒 ${bc.ownBrand} own-brand barcode`;
  return bc.country.startsWith('In-store') ? '🏷️ In-store barcode' : '🏷️ Barcode registered in ' + esc(bc.country);
}


// ---------------- Clothing (care label) ----------------
function clothIntroThen(fn){
  let seen = false; try{ seen = !!localStorage.getItem('fs_cloth_intro'); }catch(e){}
  if (seen) return fn();
  const m = $('#modal');
  m.innerHTML = `<div class="sheet">
    <div style="font-size:40px;text-align:center">👕🏷️</div>
    <h2 style="text-align:center;margin:6px 0 10px">How clothing works</h2>
    <p style="font-size:15px">Clothes don't have a public product database, so Sanitas <b>reads the care label</b> — the little tag inside with the fibres and percentages (e.g. "60% cotton, 40% polyester") — instead of the barcode.</p>
    <ul class="plain" style="margin-top:10px">
      <li>📸 Snap the care label, or tap the fibres in yourself</li>
      <li>🏷️ Tick any logos on the tags (GOTS, OEKO-TEX, recycled…)</li>
      <li>💡 Flatten the label and use good light — they're tiny and often satiny</li>
      <li>🌿 Only "organic cotton" or a GOTS/OCS logo means organic — plain "cotton" isn't</li>
    </ul>
    <button class="btn primary" id="modalOk" style="margin-top:14px">Got it</button></div>`;
  m.classList.remove('hidden');
  $('#modalOk').onclick = () => { try{ localStorage.setItem('fs_cloth_intro', '1'); }catch(e){} m.classList.add('hidden'); m.innerHTML = ''; fn(); };
}
function renderClothForm(code, pre){
  show('result');
  const C = window.FSCloth;
  const id = code || ('CL' + Date.now());
  let fibres = (pre && pre.fibres ? pre.fibres.map(f => ({...f})) : []);
  const certs = new Set(pre && pre.certs || []), treat = new Set(pre && pre.treatments || []);
  let pfcFree = !!(pre && pre.pfcFree);
  const opts = Object.entries(C.F).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('');
  $('#v-result').innerHTML = `<div class="card"><h2>👕 ${pre && pre._custom ? 'Edit clothing item' : 'Clothing — from the care label'}</h2>
    <p class="muted">Snap the care label inside the garment, or add the fibres yourself.</p>
    <label class="lbl">What is it?</label>
    <input class="field" id="cName" placeholder="e.g. Grey crew-neck t-shirt" value="${esc(pre ? pre.product_name || '' : '')}">
    <input class="field" id="cBrand" placeholder="Brand (optional)" value="${esc(pre ? pre.brands || '' : '')}">
    <label class="btn ghost" for="cOcr" style="margin-top:12px">📸 Photo of the care label</label>
    <input type="file" id="cOcr" accept="image/*" capture="environment" style="display:none">
    <p class="muted" id="cStatus" style="margin-top:6px"></p>
    <label class="lbl">Fibres</label>
    <div id="cRows"></div>
    <div class="row" style="margin-top:8px"><button class="btn plain" id="cAdd" style="padding:10px">+ Add fibre</button></div>
    <p class="muted" id="cTotal" style="margin-top:6px"></p>
    <label class="lbl">Certifications on the tags</label>
    <div class="chips" id="cCerts">${C.CERTS.map(c => `<span class="chip ${certs.has(c[0]) ? 'on' : ''}" data-v="${c[0]}">${esc(c[0])}</span>`).join('')}</div>
    <label class="lbl">Special finishes</label>
    <div class="chips" id="cTreat">${C.TREAT.map(t => `<span class="chip ${treat.has(t[0]) ? 'on' : ''}" data-v="${esc(t[0])}">${esc(t[0])}</span>`).join('')}<span class="chip ${pfcFree ? 'on' : ''}" id="cPfc">PFC / PFAS-free</span></div>
    <button class="btn primary" id="cGo" style="margin-top:16px">Score it</button>
    <button class="btn ghost" id="cBack" style="margin-top:8px">Cancel</button></div>`;
  const rows = () => {
    $('#cRows').innerHTML = fibres.map((f, i) => `<div class="row" style="align-items:center;margin-top:6px">
      <input class="field" inputmode="decimal" data-i="${i}" data-k="pct" value="${f.pct}" style="flex:0 0 74px;margin-top:0;text-align:center">
      <span class="muted" style="flex:0 0 auto">%</span>
      <select class="field" data-i="${i}" data-k="fibre" style="flex:1;margin-top:0">${opts}</select>
      <button class="btn plain" data-i="${i}" data-k="del" style="flex:0 0 44px;padding:10px">✕</button></div>`).join('') || '<p class="muted">No fibres yet.</p>';
    $('#cRows').querySelectorAll('select').forEach(s => { s.value = fibres[+s.dataset.i].fibre; s.onchange = () => { fibres[+s.dataset.i].fibre = s.value; }; });
    $('#cRows').querySelectorAll('input').forEach(inp => inp.oninput = () => { fibres[+inp.dataset.i].pct = parseFloat(inp.value) || 0; total(); });
    $('#cRows').querySelectorAll('button').forEach(b => b.onclick = () => { fibres.splice(+b.dataset.i, 1); rows(); });
    total();
  };
  const total = () => { const t = fibres.reduce((a, f) => a + (f.pct || 0), 0); $('#cTotal').textContent = fibres.length ? `Total: ${Math.round(t)}%${Math.round(t) !== 100 ? ' — should add up to 100% (linings and trims can be separate)' : ' ✓'}` : ''; };
  rows();
  $('#cAdd').onclick = () => { const left = Math.max(0, 100 - fibres.reduce((a, f) => a + (f.pct || 0), 0)); fibres.push({fibre: fibres.length ? 'elastane' : 'cotton', pct: left || 100}); rows(); };
  $('#cCerts').querySelectorAll('.chip').forEach(c => c.onclick = () => { certs.has(c.dataset.v) ? certs.delete(c.dataset.v) : certs.add(c.dataset.v); c.classList.toggle('on'); });
  $('#cTreat').querySelectorAll('.chip[data-v]').forEach(c => c.onclick = () => { treat.has(c.dataset.v) ? treat.delete(c.dataset.v) : treat.add(c.dataset.v); c.classList.toggle('on'); });
  $('#cPfc').onclick = () => { pfcFree = !pfcFree; $('#cPfc').classList.toggle('on', pfcFree); };
  $('#cOcr').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    $('#cStatus').textContent = 'Reading the care label… (the first time takes a few extra seconds)';
    try{
      const text = await FSLabel.ocr(f, pc => { $('#cStatus').textContent = `Reading the care label… ${pc}%`; }, 'eng');
      const got = C.parseLabel(text);
      if (got.fibres.length){ fibres = got.fibres; rows(); }
      got.certs.forEach(c => { certs.add(c); }); got.treatments.forEach(t => treat.add(t)); if (got.pfcFree) pfcFree = true;
      $('#cCerts').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', certs.has(c.dataset.v)));
      $('#cTreat').querySelectorAll('.chip[data-v]').forEach(c => c.classList.toggle('on', treat.has(c.dataset.v))); $('#cPfc').classList.toggle('on', pfcFree);
      $('#cStatus').textContent = got.fibres.length ? `✓ Found ${got.fibres.map(x => x.pct + '% ' + C.F[x.fibre][0].toLowerCase()).join(', ')}. Check it matches the label.` : 'Couldn\'t read the fibres — try a closer, flatter photo, or add them below.';
    }catch(err){ $('#cStatus').textContent = err.message || 'Couldn\'t read that photo.'; }
  };
  $('#cBack').onclick = goScan;
  $('#cGo').onclick = () => {
    const fl = fibres.filter(f => f.pct > 0);
    if (!fl.length){ $('#cStatus').textContent = 'Add at least one fibre first.'; return; }
    const p = {code: id, product_name: $('#cName').value.trim() || 'Clothing item', brands: $('#cBrand').value.trim(), fibres: fl, certs: [...certs], treatments: [...treat], pfcFree,
      ingredients_text: fl.map(f => `${f.pct}% ${f.fibre}`).join(', '), _src: 'clothing', _custom: true, _updated: Date.now()};
    const all = store.get('fs_custom', {}); all[id] = p; store.set('fs_custom', all);
    show('result'); display({p, src: 'clothing', custom: true}, id);
    toast('Saved to My products ✓');
  };
}

$('#clothBtn').onclick = () => clothIntroThen(() => renderClothForm(null, null));

// ---------------- add a missing product from its label ----------------
function renderAddForm(code, pre){
  const instore = /^2\d{12}$/.test(code);
  const kind0 = pre && pre._src ? pre._src : 'food';
  const n = (pre && pre.nutriments) || {};
  const val = k => n[k] != null ? n[k] : '';
  const NF = [['kj','Energy (kJ)', val('energy-kj_100g')], ['protein','Protein (g)', val('proteins_100g')], ['fat','Fat, total (g)', val('fat_100g')], ['sat','Sat. fat (g)', val('saturated-fat_100g')],
    ['carbs','Carbs (g)', val('carbohydrates_100g')], ['sugar','Sugars (g)', val('sugars_100g')], ['fibre','Fibre (g)', val('fiber_100g')], ['sodium','Sodium (mg)', n.sodium_100g != null ? Math.round(n.sodium_100g * 1000) : ''], ['abv','Alcohol % (drinks)', val('alcohol_100g')]];
  $('#v-result').innerHTML = `
  ${pre ? '' : `<div class="card"><h2>🤔 Not in any database yet</h2>
    <p class="muted">${/^9?\d{4}$/.test(code) ? `Sticker code <b>${esc(code)}</b> isn't in the built-in fruit &amp; veg list (it covers about 300 common items). Try searching the name, e.g. "mango".` : instore ? 'This looks like an <b>in-store barcode</b> (bakery, deli or weighed items). These are unique to each store, so no database has them.' :
      `Barcode ${esc(code)} isn't in Open Food Facts, Open Beauty Facts, Open Pet Food Facts, Open Products Facts or USDA yet. Lots of Australian supermarket and bakery products are missing.`}</p></div>`}
  <div class="card"><h2>📸 ${pre && pre._fromDb ? 'Complete it from the label' : pre ? 'Edit product' : 'Add it from the label'}</h2>
    <p class="muted">Snap the ingredients and the nutrition panel. The app reads them on your phone, scores the product, and remembers it, so next time it comes straight up.</p>
    <label class="lbl">What is it?</label>
    <div class="chips" id="aKind"><span class="chip ${kind0 === 'food' ? 'on' : ''}" data-k="food">🍞 Food / drink / supplement</span><span class="chip ${kind0 === 'beauty' ? 'on' : ''}" data-k="beauty">🧴 Personal care</span><span class="chip ${kind0 === 'pet' ? 'on' : ''}" data-k="pet">🐾 Pet food</span><span class="chip ${kind0 === 'products' ? 'on' : ''}" data-k="products">🧽 Household</span><span class="chip" data-k="clothing">👕 Clothing</span></div>
    <label class="lbl">Product name</label>
    <input class="field" id="aName" placeholder="e.g. Wholemeal sandwich bread" value="${esc(pre ? pre.product_name : '')}">
    <input class="field" id="aBrand" placeholder="Brand (optional)" value="${esc(pre && pre.brands ? pre.brands : ownBrandOf(code))}">
    <div class="chips" id="aBrandChips" style="margin-top:8px">${['Woolworths','Woolworths Essentials','Macro','Woolworths Gold','Coles','Coles Simply','Coles Finest','Coles Nature\'s Kitchen','Aldi','IGA'].map(b => `<span class="chip" style="padding:6px 10px;font-size:12px">${esc(b)}</span>`).join('')}</div>
    <input class="field" id="aQty" placeholder="Size, e.g. 375ml or 500g (optional)" value="${esc(pre ? pre.quantity || '' : '')}">
    <label class="lbl">Label language</label>
    <select class="field" id="aLang"><option value="eng">English</option><option value="spa">Español (Spanish)</option><option value="jpn">日本語 (Japanese)</option><option value="kor">한국어 (Korean)</option><option value="chi_sim">简体中文 (Chinese, simplified)</option><option value="chi_tra">繁體中文 (Chinese, traditional)</option></select>
    <label class="lbl">Ingredients</label>
    <label class="btn ghost" for="ocrIng" style="margin-top:8px">📸 Photo of the ingredients</label>
    <input type="file" id="ocrIng" accept="image/*" capture="environment" style="display:none">
    <textarea class="field" id="aIng" placeholder="…or type / paste them here">${esc(pre ? pre.ingredients_text : '')}</textarea>
    <div id="nutBox" class="${kind0 === 'beauty' || kind0 === 'products' ? 'hidden' : ''}">
      <label class="lbl">Nutrition per 100g</label>
      <label class="btn ghost" for="ocrNut" style="margin-top:8px">📸 Photo of the nutrition panel</label>
      <input type="file" id="ocrNut" accept="image/*" capture="environment" style="display:none">
      <div class="ngrid">${NF.map(f => `<label><span>${f[1]}</span><input class="field" inputmode="decimal" id="n_${f[0]}" value="${esc(f[2])}"></label>`).join('')}</div>
      <p class="muted" style="margin-top:6px">Use the <b>per 100g</b> column. Leave blank if you don't know.</p>
    </div>
    <p class="muted" id="ocrStatus" style="margin-top:10px"></p>
    <button class="btn primary" id="aGo" style="margin-top:12px">Score it</button>
    <button class="btn ghost" id="aBack" style="margin-top:8px">Cancel</button>
  </div>`;
  let kind = kind0;
  $('#aBrandChips').querySelectorAll('.chip').forEach(c => c.onclick = () => { $('#aBrand').value = c.textContent; $('#aBrandChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); });
  $('#aKind').querySelectorAll('.chip').forEach(c => c.onclick = () => {
    if (c.dataset.k === 'clothing') return clothIntroThen(() => renderClothForm(code, {product_name: $('#aName').value.trim(), brands: $('#aBrand').value.trim()}));
    kind = c.dataset.k; $('#aKind').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
    $('#nutBox').classList.toggle('hidden', kind === 'beauty' || kind === 'products');
  });
  const status = t => { $('#ocrStatus').textContent = t; };
  const runOcr = async (file, what) => {
    status(`Reading the ${what}… (the first time takes a few extra seconds)`);
    const lang = $('#aLang').value;
    try{ return await FSLabel.ocr(file, pc => status(`Reading the ${what}… ${pc}%`), lang === 'eng' ? 'eng' : lang + '+eng'); }
    catch(e){ status(e.message || 'Couldn\'t read that photo.'); return null; }
  };
  $('#ocrIng').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const text = await runOcr(f, 'ingredients'); if (text == null) return;
    const ing = FSLabel.extractIngredients(text);
    if (ing.length < 5){ status('Couldn\'t find the ingredients in that photo. Get closer, keep it flat and well lit, or type them in.'); return; }
    $('#aIng').value = ing; status('✓ Ingredients read. Fix any typos, then tap Score it.');
  };
  $('#ocrNut').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const text = await runOcr(f, 'nutrition panel'); if (text == null) return;
    const nn = FSLabel.parseNutrition(text); let got = 0;
    ['kj','protein','fat','sat','carbs','sugar','fibre','sodium'].forEach(k => { if (nn[k] != null){ $('#n_' + k).value = Math.round(nn[k] * 10) / 10; got++; } });
    status(got ? `✓ Read ${got} of 8 values${nn.per100 ? ' from the per 100g column' : ' (couldn\'t see a per 100g column, so double-check them)'}. Fix anything that looks off.` :
      'Couldn\'t read the nutrition panel. Try a straighter, closer photo, or type the numbers.');
  };
  $('#aBack').onclick = goScan;
  $('#aGo').onclick = () => {
    const name = $('#aName').value.trim(), ing = $('#aIng').value.trim();
    const num2 = id => { const el = $('#n_' + id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? null : v; };
    const nutr = {};
    if (kind === 'food' || kind === 'pet'){
      const m = {kj:'energy-kj_100g', protein:'proteins_100g', fat:'fat_100g', sat:'saturated-fat_100g', carbs:'carbohydrates_100g', sugar:'sugars_100g', fibre:'fiber_100g'};
      for (const k in m){ const v = num2(k); if (v != null) nutr[m[k]] = v; }
      const so = num2('sodium'); if (so != null) nutr.sodium_100g = so / 1000;
      const ab = num2('abv'); if (ab != null) nutr.alcohol_100g = ab;
    }
    if (!ing && Object.keys(nutr).length < 2){ status('Add the ingredients or some nutrition info first.'); return; }
    const keepKeys = ['categories_tags','labels_tags','packaging_tags','packaging','image_front_url','image_front_small_url','countries_tags','manufacturing_places','origins','ecoscore_grade','environmental_score_grade','serving_size','_inDb'];
    const keep = {}; if (pre && (pre._fromDb || pre._custom)) keepKeys.forEach(k => { if (pre[k] != null) keep[k] = pre[k]; });
    if (pre && pre._fromDb) keep._inDb = true;
    const p = Object.assign(keep, {code, product_name: name || 'My product', brands: $('#aBrand').value.trim(), quantity: $('#aQty').value.trim(), ingredients_text: ing, nutriments: nutr,
      categories_tags: keep.categories_tags || [], additives_tags: FSLabel.additivesFromText(ing), _src: kind, _custom: true, _updated: Date.now()});
    const all = store.get('fs_custom', {}); all[code] = p; store.set('fs_custom', all);
    show('result'); display({p, src: kind, custom: true}, code);
    toast('Saved to My products ✓');
  };
}
function ownBrandOf(code){ const s = String(code || ''); return s.startsWith('9300633') ? 'Woolworths' : s.startsWith('9300601') ? 'Coles' : ''; }

// ---------------- knowledge tables ----------------
// Additive concern levels reflect regulator/agency positions (EFSA, IARC, FSANZ) and research trends; "mixed evidence" is noted.
const ADD = {
  e102:['Tartrazine (yellow 5)','moderate','Synthetic colour linked to hyperactivity in some children (Southampton study); EU requires a warning label.'],
  e104:['Quinoline yellow','moderate','Synthetic colour linked to hyperactivity in some children.'],
  e110:['Sunset yellow','moderate','Synthetic colour linked to hyperactivity in some children.'],
  e122:['Carmoisine','moderate','Synthetic colour linked to hyperactivity in some children.'],
  e124:['Ponceau 4R','moderate','Synthetic colour linked to hyperactivity in some children.'],
  e129:['Allura red','moderate','Synthetic colour linked to hyperactivity in some children.'],
  e133:['Brilliant blue','low','Synthetic colour; generally considered low risk at normal intakes.'],
  e150c:['Ammonia caramel','low','Colour; may contain trace 4-MEI, but levels are regulated.'],
  e150d:['Sulphite ammonia caramel','moderate','Common in cola; can contain 4-MEI, a possible carcinogen at high doses.'],
  e171:['Titanium dioxide','high','Banned in the EU since 2022 — EFSA could no longer rule out DNA damage.'],
  e211:['Sodium benzoate','moderate','Preservative; with vitamin C can form small amounts of benzene. Linked to hyperactivity with some colours.'],
  e220:['Sulphur dioxide','moderate','Sulphite; can trigger asthma and reactions in sensitive people.'],
  e223:['Sodium metabisulphite','moderate','Sulphite; can trigger asthma and reactions in sensitive people.'],
  e250:['Sodium nitrite','high','Used in processed meats; forms nitrosamines. Processed meat is an IARC Group 1 carcinogen.'],
  e251:['Sodium nitrate','high','Converts to nitrite in processed meats; linked to bowel cancer risk.'],
  e252:['Potassium nitrate','high','Converts to nitrite in processed meats; linked to bowel cancer risk.'],
  e282:['Calcium propionate','low','Bread preservative. A small study linked it to irritability and restlessness in some children.'],
  e127:['Erythrosine (Red 3)','high','Synthetic red colour. The US FDA is banning it in food from 2027 after it caused cancer in rats.'],
  e128:['Red 2G','high','Colour banned in the EU and Australia over cancer concerns.'],
  e173:['Aluminium','moderate','Metallic colouring; aluminium can build up with high exposure.'],
  e310:['Propyl gallate','moderate','Antioxidant; possible hormone effects in animal studies.'],
  e385:['Calcium disodium EDTA','low','Preservative; low concern at food levels.'],
  e443:['Brominated vegetable oil (BVO)','high','Banned in the US (2024), EU and Australia; bromine builds up in the body.'],
  e924:['Potassium bromate','high','Flour improver banned in Australia, the EU, UK and many countries — possible carcinogen (IARC 2B). Still used in some US and Asian baked goods.'],
  e927a:['Azodicarbonamide','high','Dough conditioner banned in Australia and the EU; breaks down into compounds of concern when baked.'],
  e319:['TBHQ','high','Synthetic antioxidant; animal studies raise immune and other concerns.'],
  e320:['BHA','high','IARC "possibly carcinogenic" (Group 2B).'],
  e321:['BHT','moderate','Synthetic antioxidant; mixed evidence on hormone effects.'],
  e338:['Phosphoric acid','moderate','Common in cola; high intake linked to lower bone density and tooth erosion.'],
  e339:['Sodium phosphates','moderate','Added phosphates; high intake linked to heart and kidney strain.'],
  e340:['Potassium phosphates','moderate','Added phosphates; high intake linked to heart and kidney strain.'],
  e341:['Calcium phosphates','low','Generally low concern.'],
  e407:['Carrageenan','moderate','Thickener; some studies link it to gut inflammation. Evidence mixed.'],
  e433:['Polysorbate 80','moderate','Emulsifier; animal studies show gut microbiome disruption.'],
  e450:['Diphosphates','moderate','Added phosphates; high intake linked to heart and kidney strain.'],
  e451:['Triphosphates','moderate','Added phosphates; high intake linked to heart and kidney strain.'],
  e452:['Polyphosphates','moderate','Added phosphates; high intake linked to heart and kidney strain.'],
  e466:['Carboxymethyl cellulose','moderate','Emulsifier; human and animal studies show gut microbiome changes.'],
  e471:['Mono- and diglycerides','moderate','Emulsifier; large French cohort linked it to higher heart disease risk. Evidence still emerging.'],
  e472e:['DATEM','low','Emulsifier used in bread; generally low concern.'],
  e476:['PGPR','low','Emulsifier in chocolate; low concern at normal intakes.'],
  e481:['Sodium stearoyl lactylate','low','Emulsifier; low concern.'],
  e621:['MSG','low','Flavour enhancer; safe for most people, some report sensitivity.'],
  e627:['Disodium guanylate','low','Flavour enhancer; low concern (avoid with gout).'],
  e631:['Disodium inosinate','low','Flavour enhancer; low concern (avoid with gout).'],
  e635:['Disodium ribonucleotides','low','Flavour enhancer; occasional itchy-rash reports.'],
  e950:['Acesulfame K','moderate','Artificial sweetener; evidence on gut and metabolic effects is mixed.'],
  e951:['Aspartame','moderate','IARC classed it "possibly carcinogenic" (2B) in 2023; JECFA kept the safe intake level.'],
  e952:['Cyclamate','moderate','Artificial sweetener; banned in the US.'],
  e954:['Saccharin','low','Artificial sweetener; now considered low risk.'],
  e955:['Sucralose','moderate','Artificial sweetener; recent studies raise gut microbiome and DNA concerns. Evidence emerging.'],
  e960:['Steviol glycosides','low','Plant-derived sweetener; low concern.'],
  e965:['Maltitol','low','Sugar alcohol; can cause bloating and laxative effects.'],
  e968:['Erythritol','moderate','Sugar alcohol; a 2023 study linked high blood levels to clotting risk.'],
  e1442:['Hydroxypropyl distarch phosphate','low','Modified starch; low concern.'],
  e1422:['Acetylated distarch adipate','low','Modified starch; low concern.']
};
const SEED_RE = /\b(canola|rapeseed|sunflower|safflower|soybean|soya bean|soy bean|soya|soy|corn|maize|cottonseed|grapeseed|grape seed|rice bran|vegetable|sesame|peanut)\s+(oil|fat)s?\b|\bvegetable oils?\b|\bmargarine\b|\bhigh oleic\b/gi;
const TESTED_RE = /informed-sport|informed-choice|nsf|usp-verified|bscg|third-party-tested|labdoor/;
function productType(p, N){
  const t = ((p.categories_tags || []).join(' ') + ' ' + (p.categories || '') + ' ' + nameOf(p)).toLowerCase();
  if (/protein-powder|whey|protein-shake|protein-bar|bodybuilding|sports-nutrition|protein powder|protein bar|isolate|casein|mass-gainer/.test(t) || (/protein/.test(t) && (N.protein ?? 0) >= 20)) return 'protein';
  if (/dietary-supplement|food-supplement|en:supplements|vitamin|multivitamin|capsule|tablet|gummies|fish-oil|omega-3|probiotic|creatine|electrolyte|pre-workout|magnesium|collagen/.test(t)) return 'supplement';
  return 'food';
}
const HM_RULES = [
  [/\brice\b(?!\s+bran\s+oil)|rice flour|rice protein|rice milk|rice cake|rice malt/, 'arsenic', 3, 'Rice soaks up arsenic from soil and water more than other grains. Brown rice, rice cakes and rice milk tend to be highest.'],
  [/(pea|rice|hemp|fava|pumpkin|plant|vegan)[- ]protein|protein[- ]blend.*(pea|rice)/, 'lead & cadmium', 4, 'Plant protein powders have repeatedly tested higher for lead and cadmium than whey.'],
  [/coco[ao]|cacao|dark[- ]chocolate|chocolate/, 'lead & cadmium', 3, 'Cocoa beans pick up cadmium from soil and lead during drying. Dark chocolate is higher than milk chocolate.'],
  [/\btuna\b/, 'mercury', 3, 'Tuna carries some mercury. Canned light/skipjack is lower than albacore or fresh tuna steaks — a few serves a week is fine for most adults.'],
  [/swordfish|\bshark\b|\bflake\b|marlin|king mackerel|orange roughy|catfish/, 'mercury', 5, 'Large predatory fish build up high mercury. FSANZ advises limiting shark/flake, swordfish, marlin and orange roughy.'],
  [/mussel|oyster|scallop|\bcrab\b|squid|octopus|shellfish/, 'cadmium', 2, 'Shellfish can concentrate cadmium.'],
  [/seaweed|\bkelp\b|hijiki|\bnori\b|wakame|spirulina|chlorella/, 'arsenic & lead', 3, 'Seaweed and algae concentrate arsenic and other metals (hijiki is especially high).'],
  [/apple juice|grape juice|fruit-juices|fruit juice/, 'arsenic & lead', 2, 'Fruit juices (especially apple and grape) often carry low levels of arsenic and lead.'],
  [/cinnamon|turmeric|curcumin|chilli powder|paprika|en:spices/, 'lead', 2, 'Some imported spices (cinnamon, turmeric, chilli) have been recalled for lead contamination.'],
  [/ashwagandha|ayurved|herbal-supplement|triphala|moringa/, 'lead & mercury', 3, 'Herbal and Ayurvedic supplements have had the highest heavy-metal failure rates in testing.'],
  [/\bliver\b|kidney|offal/, 'cadmium', 2, 'Organ meats store cadmium.']
];
const HIGH_RESIDUE = ['strawberr','spinach','kale','nectarine','apple','grape','peach','pear','cherr','blueberr','celery','tomato','capsicum','bell pepper','chilli','green bean','oat','wheat','raisin','sultana','tea','coffee','cocoa'];
const ALLERGEN_MAP = {milk:'milk',dairy:'milk',lactose:'milk',cheese:'milk',peanut:'peanuts',nut:'nuts',almond:'nuts',cashew:'nuts',egg:'eggs',soy:'soybeans',soya:'soybeans',
  gluten:'gluten',wheat:'gluten',fish:'fish',shellfish:'crustaceans',prawn:'crustaceans',crustacean:'crustaceans',sesame:'sesame-seeds',mustard:'mustard',lupin:'lupin',sulphite:'sulphur-dioxide-and-sulphites',sulfite:'sulphur-dioxide-and-sulphites',celery:'celery'};

// ---------------- scoring ----------------
const num = v => (v === undefined || v === null || v === '' || isNaN(+v)) ? null : +v;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function analyse(p){
  const n = p.nutriments || {};
  const N = {
    kj: num(n['energy-kj_100g']) ?? (num(n['energy-kcal_100g']) != null ? Math.round(n['energy-kcal_100g'] * 4.184) : num(n.energy_100g)),
    protein: num(n.proteins_100g), fat: num(n.fat_100g), sat: num(n['saturated-fat_100g']),
    carbs: num(n.carbohydrates_100g), sugar: num(n.sugars_100g), fibre: num(n.fiber_100g),
    sodium: num(n.sodium_100g) != null ? Math.round(n.sodium_100g * 1000) : (num(n.salt_100g) != null ? Math.round(n.salt_100g * 400) : null)
  };
  const ingText = englishIngredients(p).toLowerCase();
  const cats = (p.categories_tags || []).join(' ') + ' ' + (p.categories || '').toLowerCase();
  const isDrink = /beverage|drink|water|soda|juice/.test(cats);
  const breakdown = [], warnings = [], effects = [];
  const type = productType(p, N);
  const sp0 = window.FSSpecial ? FSSpecial.kind(p, N, cats, ingText) : null;
  const sp = p._produce ? 'produce' : (type === 'food' || sp0 === 'alcohol' ? sp0 : null);
  const alc = sp === 'alcohol' ? FSSpecial.alcohol(p) : null;
  const dose = type === 'supplement' && window.FSSpecial ? FSSpecial.doses(p) : [];
  let seedOils = (ingText.match(SEED_RE) || []).map(x => x.toLowerCase().replace(/\s+/g, ' ').trim());
  for (const m of ingText.matchAll(/(?:vegetable )?(?:oils?|fats?)\s*\(([^)]*)\)/g)){
    (m[1].match(/\b(canola|rapeseed|sunflower|safflower|soybean|soya|soy|cottonseed|grapeseed|rice bran|corn|maize)\b/g) || []).forEach(o => seedOils.push(o + ' oil'));
  }
  if (seedOils.some(o => o !== 'vegetable oil' && o !== 'vegetable oils')) seedOils = seedOils.filter(o => !/^vegetable oils?$/.test(o));
  seedOils = [...new Set(seedOils)];
  const tested = (p.labels_tags || []).some(t => TESTED_RE.test(t));
  const perServe = p.nutriments && num(p.nutriments.proteins_serving) != null ? {protein: +p.nutriments.proteins_serving, size: p.serving_size || 'serve'} : null;

  // 1. Nutrition (35)
  let nutPts, nutNote, nutName = 'Nutrition';
  const ns = (p.nutriscore_grade || '').toLowerCase();
  const labelsAll = (p.labels_tags || []).join(' ');
  const firstPart = ingText.split(' | ')[0];
  const spNotes = [];
  if (sp === 'produce'){
    const pr = p._produce;
    nutPts = pr.type === 'dates' ? 26 : pr.type === 'coconut' ? 22 : 33;
    if (N.fibre != null && N.fibre >= 3) nutPts = Math.min(35, nutPts + 2);
    nutNote = pr.type === 'coconut' ? 'Whole food, but high in saturated fat. ' : pr.type === 'dates' ? 'Whole fruit, but very sugar-dense — the fibre helps. ' : `Fresh ${pr.group === 'fruit' ? 'fruit' : 'vegetable'} — natural sugar comes packaged with fibre, water and vitamins. `;
  } else if (sp === 'alcohol'){
    nutPts = N.sugar != null && N.sugar > 5 ? 6 : 10;
    nutNote = 'Alcohol adds kilojoules with no nutrients' + (N.sugar != null && N.sugar > 5 ? ', plus added sugar' : '') + '. ';
  } else if (sp === 'formula'){
    nutName = 'Formula standard'; nutPts = 33;
    if (/\b(sucrose|sugar|glucose syrup|corn syrup|corn syrup solids)\b/.test(firstPart)){ nutPts -= 8; spNotes.push('contains added sucrose or glucose/corn syrup'); }
    if (/palm/.test(firstPart)){ nutPts -= 3; spNotes.push('palm olein can slightly lower calcium absorption'); }
    if (/organic/.test(labelsAll)) nutPts += 2;
    nutPts = clamp(nutPts, 0, 35);
    nutNote = 'All infant formula sold in Australia must meet the same FSANZ standard, so differences between brands are small. ' + (spNotes.length ? cap(spNotes.join('; ')) + '. ' : '');
  } else if (sp === 'toddlermilk'){
    nutPts = 16;
    if (/\b(sucrose|sugar|glucose syrup|corn syrup|honey)\b/.test(firstPart)){ nutPts -= 6; spNotes.push('has added sugar'); }
    nutNote = 'Toddler milks aren\'t needed — regular full-cream cow\'s milk is recommended from 12 months. ' + (spNotes.length ? cap(spNotes.join('; ')) + '. ' : '');
  } else if (sp === 'babyfood'){
    nutName = 'Baby nutrition'; nutPts = 31;
    if (/\b(sugar|syrup|honey|dextrose|fruit juice concentrate|juice concentrate)\b/.test(firstPart)){ nutPts -= 10; spNotes.push('added sugar — not recommended for babies'); }
    if (N.sugar != null && N.sugar > 15){ nutPts -= 6; spNotes.push(`${N.sugar}g sugar per 100g (pureed fruit counts as free sugar) — offer whole fruit too`); }
    if (N.sodium != null && N.sodium > 100){ nutPts -= 8; spNotes.push(`${N.sodium}mg sodium per 100g — above the 100mg limit for most baby foods`); }
    if (N.protein != null && N.protein >= 3) nutPts += 2;
    nutPts = clamp(nutPts, 0, 35);
    nutNote = 'Judged against baby food standards. ' + (spNotes.length ? cap(spNotes.join('; ')) + '. ' : 'No added sugar or salt. 👍 ');
  } else if ((sp === 'water' || sp === 'coffee' || sp === 'tea') && (N.sugar == null || N.sugar <= 1)){
    nutPts = 32;
    nutNote = sp === 'water' ? 'Plain water — no sugar or kilojoules. 👍 ' : 'No sugar and almost no kilojoules as sold. 👍 ';
  } else if (sp === 'healthyfat'){
    let h = 30;
    if (N.sugar != null) h -= N.sugar > 10 ? 6 : N.sugar > 5 ? 3 : 0;
    if (N.sodium != null) h -= N.sodium > 600 ? 6 : N.sodium > 300 ? 3 : 0;
    if (N.fat && N.sat != null && N.sat / N.fat > 0.35) h -= 5;
    if (N.fibre != null) h += N.fibre > 6 ? 3 : N.fibre > 3 ? 1 : 0;
    if (N.protein != null && N.protein >= 15) h += 2;
    const fromNs = 'abcde'.includes(ns) && ns.length === 1 ? {a:35,b:28,c:20,d:11,e:4}[ns] : 0;
    nutPts = clamp(Math.max(h, fromNs), 0, 35);
    nutNote = 'Mostly healthy unsaturated fats — judged on fat quality, not total fat. ';
  } else if (type === 'protein' && N.protein != null && N.kj){

    nutName = 'Protein quality';
    const pe = Math.round(N.protein * 17 / N.kj * 100);
    nutPts = pe >= 70 ? 33 : pe >= 50 ? 28 : pe >= 35 ? 22 : pe >= 20 ? 14 : 8;
    if (N.sugar != null) nutPts -= N.sugar > 15 ? 6 : N.sugar > 6 ? 3 : 0;
    if (N.sat != null && N.sat > 8) nutPts -= 3;
    if (tested) nutPts += 2;
    nutPts = clamp(nutPts, 0, 35);
    nutNote = `${pe}% of calories from protein${perServe ? ` (${perServe.protein}g per ${perServe.size})` : ''}. ` + (tested ? 'Third-party tested ✓. ' : 'No third-party testing label found (e.g. Informed Sport). ');
  } else if (type === 'supplement'){
    nutName = 'Quality & testing';
    nutPts = 24;
    if (tested){ nutPts += 9; }
    if (N.sugar != null) nutPts -= N.sugar > 40 ? 8 : N.sugar > 20 ? 5 : 0;
    if ((p.additives_tags || []).some(t => /e1(0[2-9]|1\d|2\d|3\d)|e171/.test(t))) nutPts -= 4;
    nutPts = clamp(nutPts, 0, 35);
    nutNote = 'Supplements are judged on quality, not food nutrition. ' + (tested ? 'Third-party tested ✓. ' : 'No third-party testing label found. ') + (N.sugar != null && N.sugar > 20 ? 'Lots of sugar (common in gummies). ' : '');
    const over = dose.filter(d => d.status === 'over' || d.status === 'way over');
    if (over.length){
      nutPts = clamp(nutPts - (over.some(d => d.status === 'way over') ? 14 : 8), 0, 35);
      nutNote += `${over.map(d => d.label).join(', ')} above the safe upper limit per serve. `;
      over.forEach(d => warnings.push(`${d.label}: ${d.amt}${d.unit} per serve is ${d.pct}% of the safe upper limit (${d.ul}${d.unit}/day). ${d.note}`));
    } else if (dose.length) nutNote += 'Doses are within safe upper limits. ';
  } else if ('abcde'.includes(ns) && ns.length === 1){
    nutPts = {a:35,b:28,c:20,d:11,e:4}[ns];
    nutNote = `Nutri-Score ${ns.toUpperCase()}. ` ;
  } else {
    nutPts = 30;
    if (N.sugar != null) nutPts -= N.sugar > 22.5 ? 12 : N.sugar > 10 ? 7 : N.sugar > 5 ? 3 : 0;
    if (N.sat != null) nutPts -= N.sat > 5 ? 8 : N.sat > 1.5 ? 4 : 0;
    if (N.sodium != null) nutPts -= N.sodium > 600 ? 8 : N.sodium > 300 ? 4 : 0;
    if (N.kj != null) nutPts -= N.kj > 2000 ? 6 : N.kj > 1200 ? 2 : 0;
    if (N.fat != null) nutPts -= N.fat > 17.5 ? 5 : N.fat > 10 ? 2 : 0;
    if (N.fibre != null) nutPts += N.fibre > 6 ? 4 : N.fibre > 3 ? 2 : 0;
    if (N.protein != null) nutPts += N.protein > 10 ? 3 : 0;
    nutPts = clamp(Math.round(nutPts), 0, 35);
    nutNote = N.sugar == null && N.sat == null ? 'Limited nutrition data available. ' : 'Estimated from the nutrition panel. ';
  }
  const nutBits = [];
  if (N.sugar != null && N.sugar > (isDrink ? 5 : 10)) nutBits.push(`high sugar (${N.sugar}g/100g)`);
  if (N.sat != null && N.sat > 5) nutBits.push(`high saturated fat (${N.sat}g)`);
  if (N.sodium != null && N.sodium > 600) nutBits.push(`high sodium (${N.sodium}mg)`);
  if (N.fibre != null && N.fibre >= 6) nutBits.push(`high fibre (${N.fibre}g)`);
  if (N.protein != null && N.protein >= 10) nutBits.push(`good protein (${N.protein}g)`);
  nutPts = Math.round(nutPts * 20 / 35);
  if (sp === 'cheese' && N.protein != null && N.protein >= 20){ nutPts = Math.min(20, nutPts + 3); nutNote += 'Good protein and calcium. '; }
  breakdown.push({factor:nutName, points:nutPts, max:20, note: nutNote + (type === 'supplement' || ['alcohol','formula','toddlermilk','water'].includes(sp) ? '' : nutBits.length ? cap(nutBits.join(', ')) + '.' : 'Nothing extreme per 100g.')});

  // 2. Processing (15)
  const nova = num(p.nova_group);
  const upf = (ingText.match(/syrup|flavour|flavor|colour|color|emulsifier|sweetener|maltodextrin|hydrolysed|hydrolyzed|modified starch|isolate|thickener|e\d{3}|\(\s*\d{3}/g) || []).length;
  let procPts = nova ? {1:15,2:12,3:8,4:2}[nova] : !ingText ? 8 : upf >= 2 ? 3 : upf === 1 ? 7 : 12;
  let procNote = null;
  if (sp === 'formula' || sp === 'toddlermilk'){ procPts = 12; procNote = 'Formula is processed by nature — not counted heavily against it.'; }
  else if ((sp === 'water' || sp === 'coffee' || sp === 'tea') && (!nova || nova <= 2) && upf === 0){ procPts = 15; procNote = 'Minimally processed.'; }
  breakdown.push({factor:'Processing', points:procPts, max:15,
    note: procNote || (!nova && ingText ? (upf >= 2 ? 'Likely ultra-processed (estimated from the ingredients).' : upf === 1 ? 'Probably processed (estimated from the ingredients).' : 'Looks minimally processed (estimated from the ingredients).') : nova ? ({1:'NOVA 1 — unprocessed or minimally processed.',2:'NOVA 2 — processed culinary ingredient.',3:'NOVA 3 — processed food.',4:'NOVA 4 — ultra-processed. Diets high in these are linked to heart disease, type 2 diabetes and weight gain.'}[nova]) : 'Processing level unknown.')});

  // 3. Additives (20)
  const additives = ((p.additives_tags && p.additives_tags.length) ? p.additives_tags : (window.FSLabel && ingText ? FSLabel.additivesFromText(ingText) : [])).map(t => {
    const code = t.replace(/^en:/, '').toLowerCase();
    const k = ADD[code] || ADD[code.replace(/[a-z]+$/, m => m.length === 1 ? '' : m)] || null;
    return k ? {code: code.toUpperCase(), name: k[0], concern: k[1], effects: k[2]} : {code: code.toUpperCase(), name: '', concern: 'low', effects: 'No significant concerns at normal intakes.'};
  });
  const hi = additives.filter(a => a.concern === 'high').length, mo = additives.filter(a => a.concern === 'moderate').length, lo = additives.filter(a => a.concern === 'low').length;
  const addPts = clamp(Math.round(25 - hi * 9 - mo * 4 - lo * 0.5), 0, 25);
  breakdown.push({factor:'Additives', points:addPts, max:25,
    note: additives.length ? `${additives.length} additive${additives.length > 1 ? 's' : ''}: ${hi} high, ${mo} moderate, ${lo} low concern.` : (ingText ? 'No additives listed. 👍' : 'No ingredient data to check.')});


  const organic = (p.labels_tags || []).some(t => t.includes('organic'));
  // 4. Ingredient quality (15) — what the product is actually made of
  let iq = 15; const iqBad = [], iqGood = [];
  if (!ingText){ iq = 8; iqBad.push('no ingredient list to check'); }
  else if (sp === 'formula'){ iq = /palm/.test(ingText) ? 11 : 13; (/palm/.test(ingText) ? iqBad : iqGood).push(/palm/.test(ingText) ? 'palm olein' : 'ingredients are set by law'); }
  else {
    const plain = ingText.split('|')[0];
    const parts = plain.split(/,(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
    const sugars = [...new Set((plain.match(/\b(sugar|cane sugar|raw sugar|brown sugar|glucose syrup|glucose|fructose|high fructose corn syrup|corn syrup|dextrose|maltose|invert sugar|golden syrup|rice malt syrup|malt extract|maltodextrin|honey|agave|treacle|molasses|fruit juice concentrate|caramel)\b/g) || []))];
    if (sugars.length){ iq -= Math.min(1 + sugars.length, 5); iqBad.push(`${sugars.length} type${sugars.length > 1 ? 's' : ''} of added sugar`); }
    if (parts.slice(0, 2).some(x => /sugar|syrup|dextrose|glucose|fructose/.test(x))){ iq -= 2; iqBad.push('sugar is a main ingredient'); }
    if (/hydrogenated/.test(plain)){ iq -= 5; iqBad.push('hydrogenated fat (trans fats)'); }
    if (seedOils.length){ if (has('Avoid seed oils')){ iq -= 4; iqBad.push('seed oils'); } }
    if (/\bpalm\b/.test(plain)){ iq -= 1; iqBad.push('palm oil'); }
    if (/(wheat flour|white flour|enriched flour|bromated flour|plain flour|refined flour)/.test(plain) && !/wholemeal|whole ?grain|whole wheat/.test(plain)){ iq -= 2; iqBad.push('refined white flour'); }
    if (/flavou?r(ing)?s?\b/.test(plain)){ iq -= 1; iqBad.push('added flavourings'); }
    const fillers = (plain.match(/maltodextrin|modified (?:corn |tapioca |maize )?starch|hydrolysed|hydrolyzed|protein isolate|soy protein isolate|invert sugar|polydextrose/g) || []).length;
    if (fillers && type !== 'protein'){ iq -= Math.min(fillers, 3); iqBad.push('processed fillers/starches'); }
    if (parts.length > 15){ iq -= 2; iqBad.push(`long ingredient list (${parts.length})`); }
    if (parts.length && parts.length <= 5 && !additives.length){ iq += 2; iqGood.push('short, simple ingredient list'); }
    if (parts[0] && /whole ?grain|wholemeal|whole wheat|\boats?\b|lentil|bean|chickpea|\bnuts?\b|almond|peanut|seed|vegetable|fruit|tomato|potato|rice|milk|yoghurt|yogurt|egg|chicken|beef|fish|salmon|tuna|water/.test(parts[0]) && !/syrup|sugar|flour/.test(parts[0])){ iq += 1; iqGood.push('a whole food is the main ingredient'); }
    if (organic) { iq += 1; iqGood.push('organic'); }
  }
  iq = clamp(Math.round(iq), 0, 15);
  breakdown.push({factor:'Ingredient quality', points:iq, max:15,
    note: iqBad.length || iqGood.length ? cap([...iqBad, ...iqGood.map(g => '✓ ' + g)].join('; ')) + '.' : 'Clean, simple ingredients. 👍'});


  // 5. Pesticide exposure (8) — estimate
  const PRETTY = {oat:'oats',strawberr:'strawberries',cherr:'cherries',blueberr:'blueberries',raisin:'raisins',sultana:'sultanas',apple:'apples',grape:'grapes',peach:'peaches',pear:'pears',nectarine:'nectarines',tomato:'tomatoes'};
  const residue = HIGH_RESIDUE.filter(w => new RegExp('\\b' + w).test(ingText)).map(w => PRETTY[w] || w);
  let pestPts, pestRisk, pestWhy;
  if (p._produce){
    const pr = p._produce;
    if (pr.organic){ pestPts = 9; pestRisk = 'low'; pestWhy = 'Organic (sticker starts with 9) — synthetic pesticides restricted.'; }
    else if (pr.residue === 'high'){ pestPts = 3; pestRisk = 'high'; pestWhy = `${cap(p.product_name.split(' — ')[0])} is one of the produce items that most often carries pesticide residues in testing (US data, EWG "Dirty Dozen"). Wash well, or buy organic (sticker starting with 9).`; }
    else if (pr.residue === 'low'){ pestPts = 9; pestRisk = 'low'; pestWhy = 'One of the cleanest crops for pesticide residues in testing (EWG "Clean Fifteen").'; }
    else { pestPts = 6; pestRisk = 'medium'; pestWhy = 'Moderate pesticide residues in testing — washing helps.'; }
  }
  else if (organic){ pestPts = 9; pestRisk = 'low'; pestWhy = 'Certified organic, so synthetic pesticide use is restricted.'; }
  else if (!ingText){ pestPts = 6; pestRisk = 'medium'; pestWhy = 'No ingredient list to check, so this is a rough guess.'; }
  else if (residue.length >= 2){ pestPts = 3; pestRisk = 'high'; pestWhy = `Contains non-organic ${residue.slice(0,4).join(', ')} — crops that often test with higher pesticide residues (e.g. glyphosate on oats/wheat, multiple residues on berries and leafy greens).`; }
  else if (residue.length === 1){ pestPts = 6; pestRisk = 'medium'; pestWhy = `Contains non-organic ${residue[0]}, a crop that commonly carries pesticide residues.`; }
  else { pestPts = 8; pestRisk = 'low'; pestWhy = 'No high-residue crops spotted in the ingredients. Not organic, so some residues are possible.'; }
  breakdown.push({factor:'Pesticide exposure', points:Math.round(pestPts * 0.8), max:8, note: pestWhy});

  // 5. Heavy metals (10) — estimate
  const hmText = ingText + ' ' + cats + ' ' + nameOf(p).toLowerCase();
  const hmHits = HM_RULES.filter(rule => rule[0].test(hmText));
  let hmPts = 10 - hmHits.reduce((a, r) => a + r[2], 0);
  if (tested && hmHits.length) hmPts += 2;
  hmPts = clamp(hmPts, 1, 10);
  const hmRisk = hmPts >= 8 ? 'low' : hmPts >= 5 ? 'medium' : 'high';
  const hmWhy = hmHits.length
    ? hmHits.map(r => `${cap(r[1])}: ${r[3]}`).join(' ') + (tested ? ' Third-party tested, which usually includes heavy metals ✓.' : '') + ' Organic doesn\'t help here — metals come from soil and water.'
    : (ingText ? 'No ingredients known for heavy-metal build-up.' : 'No ingredient list, so this is a rough guess.');
  breakdown.push({factor:'Heavy metals', points:Math.round(hmPts * 0.8), max:8, note: hmHits.length ? `Possible ${[...new Set(hmHits.map(r => r[1]))].join(', ')} from ${hmHits.length > 1 ? 'several ingredients' : 'an ingredient'} — see details below.` : hmWhy});

  // 6. Microplastics & packaging (5) — estimate
  const pack = ((p.packaging_tags || []).join(' ') + ' ' + (p.packaging || '') + ' ' + JSON.stringify(p.packagings || [])).toLowerCase();
  let mpPts = 9; const mpWhy = [];
  const plastic = /plastic|pet\b|en:pet|polyeth|polyprop|\bpp\b|\bpe\b|hdpe|ldpe|polystyrene|film|tray|pouch|tub/.test(pack);
  if (plastic){ mpPts -= 3; mpWhy.push('plastic packaging can shed microplastics, more so when heated or squeezed'); }
  if (/bottle/.test(pack) && plastic){ mpPts -= 1; mpWhy.push('plastic bottles are one of the biggest known sources'); }
  if (/can\b|en:can|tin\b|metal/.test(pack)){ mpPts -= 1; mpWhy.push('cans are usually lined with a plastic (BPA/BPA-free) coating'); }
  if (/glass/.test(pack) && !plastic) mpWhy.push('glass packaging is a good sign');
  if (/seafood|fish|tuna|salmon|prawn|shrimp|mussel|oyster|shellfish|sardine/.test(cats)){ mpPts -= 3; mpWhy.push('seafood tends to carry microplastics from the ocean'); }
  if (/sea-salt|salts\b|en:salts/.test(cats) || /sea salt/.test(ingText)){ mpPts -= 2; mpWhy.push('sea salt commonly contains microplastic particles'); }
  if (/bottled-water|en:waters|mineral-water|spring-water/.test(cats)){ mpPts -= 3; mpWhy.push('bottled water has some of the highest measured microplastic counts'); }
  if (/tea-bags|en:teas|herbal-teas/.test(cats) || sp === 'tea'){
    const tb = (pack + ' ' + nameOf(p).toLowerCase() + ' ' + ingText);
    if (/nylon|mesh|pyramid|silky|polypropylene|\bpla\b|plastic tea bag/.test(tb)){ mpPts -= 4; mpWhy.push('mesh/pyramid tea bags release billions of plastic particles in hot water'); }
    else if (/loose|leaf tea|loose-leaf/.test(tb)){ mpWhy.push('loose-leaf tea — no tea bag plastic'); }
    else if (/bag/.test(tb) || /tea-bags/.test(cats)){ mpPts -= 1; mpWhy.push('paper tea bags are usually fine, though many are heat-sealed with a little plastic'); }
  }
  if (nova === 4){ mpPts -= 1; mpWhy.push('ultra-processed foods pass through more plastic equipment'); }
  if (!pack.trim().length && !mpWhy.length) mpWhy.push('packaging info missing, so this is a rough guess');
  mpPts = clamp(mpPts, 1, 10);
  const mpRisk = mpPts >= 8 ? 'low' : mpPts >= 5 ? 'medium' : 'high';
  breakdown.push({factor:'Microplastics & packaging', points:Math.max(1, Math.round(mpPts * 0.4)), max:4, note: mpWhy.length ? cap(mpWhy.join('; ')) + '.' : 'No obvious microplastic sources.'});

  // 6. Fit for you (10)
  let fit = 10; const fitWhy = [];
  const allergens = (p.allergens_tags || []).map(t => t.replace(/^en:/, ''));
  const traces = (p.traces_tags || []).map(t => t.replace(/^en:/, ''));
  const avoid = (me.avoid || '').toLowerCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  for (const a of avoid){
    const key = Object.keys(ALLERGEN_MAP).find(k => a.includes(k));
    const tag = key ? ALLERGEN_MAP[key] : null;
    const stem = a.replace(/s$/, '');
    if ((tag && allergens.includes(tag)) || (stem.length > 2 && ingText.includes(stem))){ fit = 0; warnings.push(`Contains ${a} — on your avoid list.`); }
    else if (tag && traces.includes(tag)){ fit = Math.min(fit, 4); warnings.push(`May contain traces of ${a}.`); }
  }
  const ana = p.ingredients_analysis_tags || [];
  if (has('Vegan') && ana.includes('en:non-vegan')){ fit -= 6; fitWhy.push('not vegan'); }
  else if (has('Vegan') && ana.includes('en:maybe-non-vegan')){ fit -= 2; fitWhy.push('may not be vegan'); }
  if (has('Vegetarian') && ana.includes('en:non-vegetarian')){ fit -= 6; fitWhy.push('not vegetarian'); }
  if (has('Gluten-free') && allergens.includes('gluten')){ fit = 0; warnings.push('Contains gluten.'); }
  if (has('Halal') && !(p.labels_tags || []).some(t => t.includes('halal'))) fitWhy.push('no halal certification listed');
  if (has('Low sugar') && N.sugar != null && N.sugar > 10){ fit -= 3; fitWhy.push('too much sugar for your low-sugar goal'); }
  if (has('Lose weight') && N.kj != null && N.kj > 1600){ fit -= 2; fitWhy.push('energy dense — easy to overeat'); }
  if (has('Lose weight') && N.fibre != null && N.protein != null && N.fibre + N.protein >= 12){ fit += 1; fitWhy.push('filling protein and fibre'); }
  if (has('Build muscle') && N.protein != null){ if (N.protein >= 15){ fit += 1; fitWhy.push('high protein supports muscle gain'); } else if (N.protein < 5){ fit -= 1; fitWhy.push('low in protein'); } }
  if (has('High protein') && N.protein != null && N.protein < 8){ fit -= 2; fitWhy.push('low in protein'); }
  if (has('Heart health')){ if (N.sat != null && N.sat > 5){ fit -= 2; fitWhy.push('high saturated fat'); } if (N.sodium != null && N.sodium > 600){ fit -= 2; fitWhy.push('high sodium'); } }
  if (has('Gut health')){ if (N.fibre != null && N.fibre >= 6){ fit += 1; fitWhy.push('good fibre for your gut'); } if (additives.some(a => /E433|E466|E407|E471|E955/.test(a.code))){ fit -= 2; fitWhy.push('has emulsifiers/sweeteners linked to gut microbiome changes'); } }
  if (has('Endurance training') && N.carbs != null && N.carbs > 50 && (N.fibre ?? 0) < 3) fitWhy.push('fast carbs — handy as race/long-run fuel, less ideal day to day');
  const flags = [];
  if (has('Avoid seed oils') && seedOils.length){ flags.push(`Contains seed oils: ${seedOils.join(', ')}`); }
  if (has('Low carb') && N.carbs != null && N.carbs > 20){ fit -= 4; fitWhy.push('high in carbs'); }
  fit = clamp(Math.round(fit / 2), 0, 5);
  breakdown.push({factor:'Fit for you', points:fit, max:5,
    note: warnings.length ? warnings.join(' ') : fitWhy.length ? cap(fitWhy.join(', ')) + '.' : 'No conflicts with your goals or diet.'});

  // Effects on the body
  if (N.sugar != null && N.sugar > (isDrink ? 5 : 15)) effects.push('🩸 Fast sugar → blood sugar spike and crash; regular high intake raises type 2 diabetes and tooth decay risk.');
  if (N.sodium != null && N.sodium > 600) effects.push('🧂 High sodium → can raise blood pressure over time.');
  if (N.sat != null && N.sat > 5) effects.push('🫀 High saturated fat → can raise LDL ("bad") cholesterol.');
  if (nova === 4) effects.push('🏭 Ultra-processed → easy to overeat; diets high in these link to weight gain, heart disease and depression.');
  if (N.fibre != null && N.fibre >= 6) effects.push('🌾 High fibre → keeps you full, feeds good gut bacteria, steadies blood sugar.');
  if (N.protein != null && N.protein >= 10) effects.push('💪 Good protein → helps muscle repair and keeps you fuller for longer.');
  additives.filter(a => a.concern !== 'low').slice(0, 3).forEach(a => effects.push(`🧪 ${a.name || a.code}: ${a.effects}`));
  if (type === 'protein'){
    if (/whey/.test(ingText)) effects.push('🥛 Whey is a complete, fast-absorbing protein — great after training. Concentrate has some lactose; isolate has very little.');
    if (/\b(pea|rice|hemp|fava|pumpkin)\b.*protein|plant protein/.test(ingText)) effects.push('🌱 Plant protein powders have tested higher for heavy metals (like lead and cadmium) in independent checks. Pick a third-party tested brand.');
    if (/sucralose|acesulfame|aspartame|e95[0-5]|stevia|e960|erythritol|e968/.test(ingText + ' ' + (p.additives_tags || []).join(' '))) effects.push('🍬 Contains sweeteners — fine for most people, but some get bloating or gut upset.');
    effects.push('💪 Most people get full benefit from about 20–40g protein per meal; more than that adds calories, not extra muscle.');
  }
  if (type === 'supplement'){
    effects.push('💊 In Australia, check the pack for an AUST L or AUST R number. It means the product is listed or registered with the TGA.');
    effects.push('⚖️ More isn\'t better. Vitamins A, D, E and K and minerals like iron can build up to harmful levels. Stick to the label dose unless a doctor says otherwise.');
  }
  if (seedOils.length) effects.push(`🌻 Seed oils (${seedOils.join(', ')}): mostly linoleic (omega-6) fat. Major heart health bodies say they're fine and can lower LDL cholesterol when they replace saturated fat. The bigger issue is usually that they show up in ultra-processed and deep-fried foods.`);
  if (sp === 'coffee' || /\bcaffeine\b|guarana/.test(ingText)) effects.push('☕ Caffeine: up to 400mg a day is considered safe for most adults (about 4 cups of coffee); 200mg in pregnancy.');
  if (/energy-drinks/.test(cats) || /energy drink/.test(nameOf(p).toLowerCase())) effects.push('⚡ Energy drink — not recommended for children, teens or during pregnancy. Mixing with alcohol is risky.');
  if ((sp === 'babyfood' || sp === 'formula' || sp === 'toddlermilk') && /\bhoney\b/.test(ingText)){ warnings.push('Contains honey — never give honey to babies under 12 months (risk of infant botulism).'); }
  if (sp === 'babyfood' && /\brice\b/.test(ingText.split(' | ')[0])) effects.push('🍚 Rice-based baby foods can carry more arsenic — mix up grains (oats, barley, quinoa).');
  if (sp === 'formula') effects.push('🍼 If you have questions about formula, ask your child health nurse or GP.');
  if (sp === 'healthyfat') effects.push('🫒 Rich in unsaturated fats, which support heart health when they replace saturated fat. Still energy-dense — portions matter.');
  if (!effects.length) effects.push('Nothing stands out — fine as part of a balanced diet.');

  // Ingredients flags
  const ingList = (p.ingredients || []).filter(i => i.text).map(i => { const e = enName(i); return e && e.toLowerCase() !== i.text.toLowerCase() && p.lang && p.lang !== 'en' && !p.ingredients_text_en ? `${i.text} (${e})` : i.text; });
  const ingredients = (ingList.length ? ingList : ingText.split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean)).slice(0, 30).map(t => {
    const l = t.toLowerCase(); let flag = 'neutral', note = '';
    if (/hydrogenated|e171|titanium dioxide|nitrite|nitrate|e25[012]/.test(l)){ flag = 'avoid'; note = 'Linked to health risks — best avoided.'; }
    else if (/syrup|sugar|dextrose|glucose|fructose|maltodextrin/.test(l)){ flag = 'caution'; note = 'Added sugar.'; }
    else if (/palm/.test(l)){ flag = 'caution'; note = 'High in saturated fat; environmental concerns.'; }
    else if (new RegExp(SEED_RE.source, 'i').test(l)){ flag = 'caution'; note = 'Seed oil. Evidence on harm is mixed — see Seed oils.'; }
    else if (/sweetener|aspartame|sucralose|acesulfame|e95\d/.test(l)){ flag = 'caution'; note = 'Artificial sweetener.'; }
    else if (/flavour|flavor|colour|color|emulsifier|preservative|thickener|e\d{3}/.test(l)){ flag = 'caution'; note = 'Additive.'; }
    else if (!/oil|fat/.test(l) && /whole ?grain|wholemeal|oat|lentil|bean|chickpea|nut|seed|vegetable|fruit|tomato|spinach|almond|quinoa|brown rice/.test(l) || /olive oil|avocado oil/.test(l)){ flag = 'good'; }
    return {name: t, flag, note};
  });

  let score = clamp(breakdown.reduce((a, b) => a + b.points, 0), 0, 100);
  const animal = window.FSAnimal ? FSAnimal.food(p, ingText) : null;
  const animalCount = (me.animal || []).includes('Count animal welfare in the score');
  if (animal && animalCount && animal.penalty) score = clamp(score - animal.penalty, 0, 100);
  if (alc){ score = clamp(score - alc.penalty, 0, 100); }
  const env = window.FSEnv ? FSEnv.food(p, ingText, {imported: (originOf(p).startsWith('🌍') ? 'Imported — shipped from overseas.' : '')}) : null;
  const envPenalty = env && (me.envPref || []).includes('Count environmental impact in the score') ? env.penalty : 0;
  if (envPenalty) score = clamp(score - envPenalty, 0, 100);
  const caps = [];
  const nr = nutPts / 20;
  if (nr < 0.2 && score > 49){ score = 49; caps.push('Capped at 49 because the nutrition is very poor.'); }
  else if (nr < 0.4 && score > (sp === 'cheese' ? 69 : 59)){ score = sp === 'cheese' ? 69 : 59; caps.push(`Capped at ${score} because the nutrition is ${sp === 'cheese' ? 'high in saturated fat and salt' : 'poor'}.`); }
  if (sp === 'cheese' && (ns === 'd' || ns === 'e') && score > 69){ score = 69; caps.push('Capped at 69 because it\'s high in saturated fat and salt — fine in moderation.'); }
  const overDose = (dose || []).filter(d => d.status === 'over' || d.status === 'way over');
  if (overDose.length && score > (overDose.some(d => d.status === 'way over') ? 39 : 54)){ score = overDose.some(d => d.status === 'way over') ? 39 : 54; caps.push(`Capped at ${score} because a dose is above the safe upper limit.`); }
  if (warnings.some(w => /honey — never give honey/.test(w)) && score > 39){ score = 39; caps.push('Capped at 39 because it contains honey and is aimed at babies.'); }
  if (alc && score > 49){ score = 49; caps.push('Capped at 49 because it contains alcohol.'); }
  if (hi && score > 59){ score = 59; caps.push('Capped at 59 because of a high-concern additive.'); }
  if (hmRisk === 'high' && !tested && score > 59){ score = 59; caps.push('Capped at 59 because of high heavy-metal risk with no third-party testing.'); }
  if (warnings.some(w => /avoid list|gluten/i.test(w)) && score > 30){ score = 30; caps.push('Capped at 30 because it conflicts with your allergies/avoid list.'); }
  const worst = breakdown.slice().sort((a, b) => a.points / a.max - b.points / b.max)[0];
  const best = breakdown.filter(b => b.factor !== 'Fit for you').sort((a, b) => b.points / b.max - a.points / a.max)[0];
  const summary = `${label(score)} pick overall. Strongest on ${best.factor.toLowerCase()}, weakest on ${worst.factor.toLowerCase()}.` +
    (caps.length ? ' ' + caps[caps.length - 1] : '') + (warnings.length ? ' ⚠️ ' + warnings[0] : '') + (flags.length ? ' 🌻 Contains seed oils.' : '') + (hmRisk === 'high' ? ' ⚠️ Higher heavy-metal risk.' : '');

  return {code: p.code, name: nameOf(p), brand: p.brands || '', qty: p.quantity || '', img: p.image_front_url || p.image_front_small_url || '',
    score, nova, ns, breakdown, N, additives, ingredients, effects, warnings, summary,
    pest:{risk:pestRisk, why:pestWhy}, mp:{risk:mpRisk, why: mpWhy.length ? cap(mpWhy.join('; ')) + '.' : 'No obvious microplastic sources.'},
    hsr: (() => { const m = (p.labels_tags || []).join(' ').match(/health-star-rating-(\d)(?:-(5))?\b/); return m ? (m[2] ? m[1] + '.5' : m[1]) : null; })(), isDrink, env, envPenalty, bc: window.FSEnv ? FSEnv.barcodeCountry(p.code) : null, produce: p._produce || null, sp, alc, dose, animal, animalPenalty: animal && animalCount ? animal.penalty : 0, origin: originOf(p), cats: p.categories_tags || [], type, seedOils, tested, perServe, flags, hm:{risk:hmRisk, why:hmWhy}};
}
function originOf(p){
  const made = (p.manufacturing_places || p.origins || '').split(',')[0].trim();
  if (made) return '📍 Made in ' + titleCase(made);
  const c = (p.countries_tags || []).filter(t => /^en:/.test(t));
  if (c.length && regionTag() && !c.includes(regionTag())) return '🌍 Imported · sold in ' + c.slice(0, 2).map(countryLabel).join(', ');
  return '';
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// ---------------- alternatives ----------------
async function findAlternatives(p, r){
  const el = () => $('#alts');
  if (p._produce){
    const box = el(); if (!box) return;
    box.innerHTML = p._produce.residue === 'high' && !p._produce.organic
      ? `<p class="muted">Fresh produce is always a great choice. To cut pesticide exposure, look for the organic version (sticker <b>9${esc(p.code)}</b>) or wash well under running water.</p>`
      : '<p class="muted">Fresh fruit and veg is about as good as it gets. 👍 Aim for 2 serves of fruit and 5 of veg a day.</p>';
    return;
  }
  const cats = (p.categories_tags || []).filter(c => c.startsWith('en:'));
  const tryCats = r.alc ? cats.filter(c => /beer|wine|cider|spirit|alcohol|liqueur|ready-to-drink/.test(c)).slice(-3).reverse() : cats.slice(-3).reverse();
  let found = [];
  if (!tryCats.length && r.name && r.name !== 'My product'){
    const terms = r.name.replace(/[^a-z ]/gi, ' ').split(/\s+/).filter(w => w.length > 2).slice(-3).join(' ');
    for (const au of [true, false]){
      try{
        let url = `${API}/cgi/search.pl?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1&page_size=40&fields=${FIELDS}`;
        if (au){ if (!regionTag()) continue; url += '&tagtype_0=countries&tag_contains_0=contains&tag_0=' + encodeURIComponent(regionTag().replace(/^en:/, '')); }
        const j = await (await fetch(url)).json();
        (j.products || []).filter(x => x.code && x.code !== p.code && nameOf(x) !== 'Unnamed product' && x.nutriments && Object.keys(x.nutriments).length)
          .forEach(x => { const a = analyse(x); if (a.score > r.score + 4) found.push({p:x, r:a}); });
      }catch(e){}
      if (found.length >= 3) break;
    }
    const seen = new Set(); found = found.sort((a, b) => b.r.score - a.r.score).filter(f => { const k = (f.r.name + f.r.brand).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  for (const cat of tryCats){
    for (const au of [true, false]){
      let url = `${API}/api/v2/search?categories_tags=${encodeURIComponent(cat)}&fields=${FIELDS}&page_size=40&sort_by=popularity_key`;
      if (au){ if (!regionTag()) continue; url += '&countries_tags=' + encodeURIComponent(regionTag()); }
      try{
        const j = await (await fetch(url)).json();
        const cand = (j.products || []).filter(x => x.code && x.code !== p.code && nameOf(x) !== 'Unnamed product' && (x.nutriments && Object.keys(x.nutriments).length))
          .map(x => ({p:x, r:analyse(x)})).filter(x => x.r.score > r.score + 4);
        found = found.concat(cand);
      }catch(e){}
      const uniq = []; const seen = new Set();
      for (const f of found.sort((a, b) => b.r.score - a.r.score)){ const k = (f.r.name + f.r.brand).toLowerCase(); if (!seen.has(k)){ seen.add(k); uniq.push(f); } }
      found = uniq;
      if (found.length >= 3) break;
    }
    if (found.length >= 3) break;
  }
  const box = el(); if (!box) return;
  if (!found.length){
    if (r.type !== 'food'){ box.innerHTML = r.score >= 65 ? '<p class="muted">This is already one of the better options. 👍</p>' : '<p class="muted">Couldn\'t find a clearly better one in the database. Tip: look for an Informed Sport / Informed Choice logo, fewer sweeteners and colours, and (for supplements) an AUST L or AUST R number.</p>'; return; }
    box.innerHTML = r.score >= 65 ? '<p class="muted">This is already one of the better options in its category. 👍</p>'
      : '<p class="muted">Couldn\'t find a clearly better product in this category in the database. Tip: look for shorter ingredient lists, less added sugar and a Health Star Rating of 4+.</p>';
    return;
  }
  box.innerHTML = found.slice(0, 3).map(f => `<div class="alt" data-c="${esc(f.r.code)}">
    ${f.r.img ? `<img src="${esc(f.p.image_front_small_url || f.r.img)}" alt="">` : ''}
    <div style="flex:1"><b>${esc(f.r.name)}</b><p>${esc([f.r.brand, f.r.qty].filter(Boolean).join(' · '))}</p><p>${esc(whyBetter(r, f.r))}</p></div>
    <div class="sc" style="background:${col(f.r.score)}">${f.r.score}</div></div>`).join('');
  box.querySelectorAll('.alt').forEach(a => a.onclick = () => lookup(a.dataset.c));
}
function whyBetter(a, b){
  const out = [];
  if (a.N.sugar != null && b.N.sugar != null && b.N.sugar < a.N.sugar - 2) out.push(`${Math.round(a.N.sugar - b.N.sugar)}g less sugar`);
  if (a.N.sodium != null && b.N.sodium != null && b.N.sodium < a.N.sodium - 100) out.push('less sodium');
  if (a.N.sat != null && b.N.sat != null && b.N.sat < a.N.sat - 1) out.push('less saturated fat');
  if (b.N.fibre != null && (a.N.fibre ?? 0) < b.N.fibre - 1) out.push('more fibre');
  if (b.additives.length < a.additives.length) out.push('fewer additives');
  if (a.nova && b.nova && b.nova < a.nova) out.push('less processed');
  return out.length ? cap(out.slice(0, 3).join(', ')) + ' (per 100g)' : 'Scores better overall';
}

// ---------------- rendering ----------------
function col(s){ return s >= 80 ? 'var(--g5)' : s >= 60 ? 'var(--g4)' : s >= 40 ? 'var(--g3)' : s >= 20 ? 'var(--g2)' : 'var(--g1)'; }
function label(s){ return s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Mediocre' : s >= 20 ? 'Poor' : 'Bad'; }
const flagCol = {good:'var(--g5)', neutral:'#9aa59e', caution:'var(--g3)', avoid:'var(--g1)'};
const riskCol = {low:'var(--g5)', medium:'var(--g3)', moderate:'var(--g3)', high:'var(--g1)'};

// ---------------- Detailed nutrition breakdown ----------------
// Australian %DI reference values (FSANZ Standard 1.2.8) for an average adult.
const DI = {kj: 8700, protein: 50, fat: 70, sat: 24, carbs: 310, sugar: 90, fibre: 30, sodium: 2300};
// UK Food Standards Agency traffic-light thresholds per 100g (food) / 100ml (drinks).
const TL = {food: {fat: [3, 17.5], sat: [1.5, 5], sugar: [5, 22.5], sodium: [120, 600]}, drink: {fat: [1.5, 8.75], sat: [0.75, 2.5], sugar: [2.5, 11.25], sodium: [120, 300]}};
function gramsOf(str){
  const s = String(str || '').toLowerCase().replace(',', '.');
  const multi = s.match(/(\d+)\s?[x×]\s?(\d+(?:\.\d+)?)\s?(kg|g|ml|cl|l)\b/);
  const m = multi ? [null, multi[2], multi[3]] : s.match(/(\d+(?:\.\d+)?)\s?(kg|g|ml|cl|l)\b/);
  if (!m) return null;
  const v = parseFloat(m[1]), u = m[2];
  return {g: u === 'kg' || u === 'l' ? v * 1000 : u === 'cl' ? v * 10 : v, unit: u === 'ml' || u === 'l' || u === 'cl' ? 'ml' : 'g', pack: multi ? parseInt(multi[1]) : 1};
}
function nutritionCard(r, p){
  const N = r.N; if (!N) return '';
  const rows = [['kj','Energy','kJ'], ['protein','Protein','g'], ['fat','Fat, total','g'], ['sat','– saturated','g'], ['carbs','Carbohydrate','g'], ['sugar','– sugars','g'], ['fibre','Dietary fibre','g'], ['sodium','Sodium','mg']].filter(x => N[x[0]] != null);
  if (!rows.length) return '';
  const drink = r.isDrink;
  const u100 = drink ? '100ml' : '100g';
  const serve = gramsOf(p.serving_size), pack = gramsOf(p.quantity);
  const bases = [['100', `Per ${u100}`, 1]];
  if (serve && serve.g > 0 && serve.g < 2000) bases.push(['serve', `Per serve (${Math.round(serve.g)}${serve.unit})`, serve.g / 100]);
  if (pack && pack.g > 0 && pack.g <= 3000 && (!serve || Math.abs(pack.g - serve.g) > 1)) bases.push(['pack', `Whole ${pack.pack > 1 ? 'item' : 'pack'} (${Math.round(pack.g)}${pack.unit})`, pack.g / 100]);
  const lowSugar = has('Low sugar');
  const sugarLimit = lowSugar ? 25 : DI.sugar;
  const tl = (k, v100) => { const t = TL[drink ? 'drink' : 'food'][k]; if (!t || v100 == null) return null; return v100 > t[1] ? 'high' : v100 > t[0] ? 'med' : 'low'; };
  const TLC = {low: 'var(--g5)', med: 'var(--g3)', high: 'var(--g1)'}, TLW = {low: 'Low', med: 'Medium', high: 'High'};
  const fmt = v => v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  const note = (k, v) => {
    if (k === 'sugar'){
      const ing = (englishIngredients(p) || '').split(' | ')[0].toLowerCase();
      const added = /\b(sugar|syrup|dextrose|glucose|fructose|honey|maltodextrin|juice concentrate|agave|molasses|treacle|sucrose)\b/.test(ing);
      if (N.sugar != null && N.sugar <= 0.5) return 'Sugar-free (under 0.5g per 100).';
      const kind = r.produce ? 'Natural sugar from whole fruit or veg — it doesn\'t count towards added-sugar limits.' : ing && !added ? 'No added sugar in the ingredients — this is natural sugar (e.g. from milk or fruit).' : 'Includes added sugar.';
      return `≈ ${fmt(v / 4)} tsp of sugar. ${kind} ${lowSugar ? 'Measured against your low-sugar target of 25g a day.' : added ? 'The WHO advises under 50g of added sugar a day, ideally 25g (6 tsp).' : ''}`.trim();
    }
    if (k === 'sodium') return `≈ ${fmt(v * 2.5 / 1000)}g of salt. Aim for under 2000mg sodium (5g salt) a day.`;
    if (k === 'fibre') return 'Aim for 25–30g of fibre a day.';
    if (k === 'kj') return `≈ ${Math.round(v / 4.184)} Calories. Daily % is based on an average adult (8700kJ).`;
    if (k === 'sat') return 'Swap for unsaturated fats (olive oil, nuts, avocado) where you can.';
    if (k === 'protein') return 'Most adults need about 0.75–0.85g per kg of body weight a day.';
    return '';
  };
  const panel = (b) => {
    const f = b[2];
    const lights = ['fat', 'sat', 'sugar', 'sodium'].filter(k => N[k] != null).map(k => {
      const lv = tl(k, N[k]); const v = N[k] * f;
      return `<div class="tl" style="border-color:${TLC[lv]}"><span style="background:${TLC[lv]}">${TLW[lv]}</span><b>${fmt(v)}${k === 'sodium' ? 'mg' : 'g'}</b><small>${{fat:'Fat', sat:'Sat fat', sugar:'Sugars', sodium:'Sodium'}[k]}</small><small>${Math.round(v / (k === 'sugar' ? sugarLimit : DI[k]) * 100)}% DI</small></div>`;
    }).join('');
    const list = rows.map(([k, label, unit]) => {
      const v = N[k] * f, ref = k === 'sugar' ? sugarLimit : DI[k], pct = Math.round(v / ref * 100);
      const lv = tl(k, N[k]);
      const good = k === 'fibre' || k === 'protein';
      const barCol = good ? 'var(--g5)' : lv ? TLC[lv] : pct > 40 ? 'var(--g2)' : pct > 20 ? 'var(--g3)' : 'var(--g4)';
      const n = note(k, v);
      return `<div class="factor"><div class="top"><span>${label}</span><span>${fmt(v)}${unit} <span class="muted" style="font-weight:600">· ${pct}% DI</span></span></div>
        <div class="bar"><i style="width:${Math.min(100, pct)}%;background:${barCol}"></i></div>${n ? `<p>${esc(n)}</p>` : ''}</div>`;
    }).join('');
    return `<div class="nb" data-b="${b[0]}" ${b[0] === '100' ? '' : 'hidden'}><div class="tls">${lights}</div>${list}</div>`;
  };
  return `<div class="card"><h2>🥗 Nutrition breakdown</h2>
    ${bases.length > 1 ? `<div class="seg nbseg">${bases.map((b, i) => `<button data-b="${b[0]}" class="${i === 0 ? 'on' : ''}">${esc(b[1])}</button>`).join('')}</div>` : `<p class="muted">Per ${u100}${r.produce ? ' (typical values)' : ''}</p>`}
    <div style="margin-top:12px">${bases.map(panel).join('')}</div>
    <div class="note">% DI = percentage of daily intake, based on an average adult diet of 8700kJ (Australian labelling reference values). Traffic lights use UK Food Standards Agency limits per ${u100}.</div>
  </div>`;
}
function wireNutrition(){
  document.querySelectorAll('.nbseg button').forEach(btn => btn.onclick = () => {
    const card = btn.closest('.card, details');
    card.querySelectorAll('.nbseg button').forEach(x => x.classList.toggle('on', x === btn));
    card.querySelectorAll('.nb').forEach(x => x.hidden = x.dataset.b !== btn.dataset.b);
  });
}

function renderResult(r, p){
  r._p = p || {};
  const s = r.score, c = col(s), C = 2 * Math.PI * 50, N = r.N;
  const nut = [['Energy', N.kj, 'kJ'], ['Protein', N.protein, 'g'], ['Sugars', N.sugar, 'g'], ['Sat. fat', N.sat, 'g'], ['Fibre', N.fibre, 'g'], ['Sodium', N.sodium, 'mg']].filter(x => x[1] != null);
  $('#v-result').innerHTML = `
  ${r.warnings.length ? `<div class="warn">⚠️ ${r.warnings.map(esc).join('<br>')}</div>` : ''}
  ${(r.flags || []).length ? `<div class="flag">🌻 ${r.flags.map(esc).join('<br>')}</div>` : ''}
  <div class="card">
    ${r.img ? `<img class="pimg" src="${esc(r.img)}" alt="">` : ''}
    <div class="hero">
      <div class="ring"><svg width="118" height="118" viewBox="0 0 118 118"><circle cx="59" cy="59" r="50" fill="none" stroke="var(--line)" stroke-width="11"/>
        <circle cx="59" cy="59" r="50" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - s / 100)}"/></svg>
        <div class="num"><div><b>${s}</b><small>/ 100</small></div></div></div>
      <div>
        <h3>${esc(r.name)}</h3>
        <div class="brand">${esc([r.brand, r.qty].filter(Boolean).join(' · '))}</div>
        ${r.origin ? `<div class="brand" style="margin-top:-6px">${esc(r.origin)}</div>` : ''}
        ${r.produce ? `<div class="brand" style="margin-top:-6px">🏷️ PLU sticker ${esc(r.produce.plu)}${r.produce.organic ? ' · organic' : ''}</div>` : r.bc ? `<div class="brand" style="margin-top:-6px">${bcText(r.bc)}</div>` : ''}
        <span class="grade" style="background:${c}">${label(s)}</span>
        ${r.nova ? `<span class="pill" style="margin-left:6px">NOVA ${r.nova}</span>` : ''}
        ${r.env ? envPill(r.env) : ''}
        ${r.hsr ? `<span class="pill" style="margin:6px 6px 0 0">⭐ ${esc(r.hsr)} Health Stars</span>` : ''}
        ${r.alc ? `<span class="pill" style="margin:6px 6px 0 0;background:var(--warn-bg);color:var(--warn-ink)">🍺 ${r.alc.abv != null ? r.alc.abv + '%' : 'Alcohol'}${r.alc.sd != null ? ' · ' + r.alc.sd + ' std drinks' : ''}</span>` : ''}
        ${r.sp === 'healthyfat' ? '<span class="pill" style="margin:6px 6px 0 0">🫒 Healthy fats</span>' : r.sp === 'babyfood' ? '<span class="pill" style="margin:6px 6px 0 0">👶 Baby food</span>' : r.sp === 'formula' ? '<span class="pill" style="margin:6px 6px 0 0">🍼 Infant formula</span>' : r.sp === 'toddlermilk' ? '<span class="pill" style="margin:6px 6px 0 0">🍼 Toddler milk</span>' : ''}
        ${r.animal && r.animal.level !== 'none' ? `<span class="pill" style="margin:6px 6px 0 0;${r.animal.level === 'high' ? 'background:var(--warn-bg);color:var(--warn-ink)' : r.animal.level === 'some' ? 'background:var(--flag-bg);color:var(--flag-ink)' : ''}">${esc(r.animal.badge)}</span>` : ''}
        ${r.type === 'protein' ? '<span class="pill" style="margin-left:6px">💪 Protein</span>' : r.type === 'supplement' ? '<span class="pill" style="margin-left:6px">💊 Supplement</span>' : ''}
      </div>
    </div>
    <p style="margin-top:14px;font-size:15px">${esc(r.summary)}</p>
  </div>

  <div class="card"><h2>${s < 65 ? '🔁 Better alternatives' : '✨ Similar or better picks'}</h2>
    <div id="alts"><p class="muted">Finding better options…</p></div></div>

  <div class="card"><h2>📊 Score breakdown</h2>
    ${r.breakdown.map(b => { const p = b.points / b.max; return `<div class="factor"><div class="top"><span>${esc(b.factor)}</span><span>${b.points}/${b.max}</span></div>
      <div class="bar"><i style="width:${p * 100}%;background:${col(p * 100)}"></i></div><p>${esc(b.note)}</p></div>`; }).join('')}
  </div>

  <div class="card"><h2>🫀 Effects on your body</h2><ul class="plain">${r.effects.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>

  ${nutritionCard(r, r._p || {})}

  <div class="card"><h2>🧪 Additives</h2>
    ${r.additives.length ? r.additives.map(a => `<div class="item"><span class="dot" style="background:${riskCol[a.concern]}"></span><div><b>${esc([a.code, a.name].filter(Boolean).join(' · '))}</b> <span class="muted">— ${a.concern} concern</span><p>${esc(a.effects)}</p></div></div>`).join('')
      : '<p class="muted">No additives listed. 👍</p>'}
  </div>

  <div class="card"><h2>🌻 Seed oils</h2>
    ${r.seedOils && r.seedOils.length
      ? `<div class="risk"><b style="font-size:14px">Contains ${esc(r.seedOils.join(', '))}</b><span class="tag" style="background:var(--g3)">Yes</span></div>
         <p class="muted">Big health bodies (like the Heart Foundation) say seed oils are fine in normal amounts and better than saturated fat. Critics worry about too much omega-6 and oils reheated at high temps. This counts against the score by default. You can turn off <b>Avoid seed oils</b> in Me.</p>`
      : `<div class="risk"><b style="font-size:14px">No seed oils found</b><span class="tag" style="background:var(--g5)">None</span></div>${r.ingredients.length ? '' : '<p class="muted">No ingredient list available to check.</p>'}`}
  </div>

  ${r.alc ? alcoholCard(r) : ''}
  ${r.dose && r.dose.length ? doseCard(r) : r.type === 'supplement' ? doseCard(r) : ''}
  ${r.animal ? animalCard(r) : ''}
  ${r.env ? envCard(r) : ''}

  <div class="card"><h2>⚗️ Heavy metals</h2>
    <div class="risk"><b style="font-size:14px">Heavy metal exposure</b><span class="tag" style="background:${riskCol[r.hm.risk]}">${r.hm.risk}</span></div>
    <p class="muted">${esc(r.hm.why)}</p>
    <div class="note">Estimated from the ingredients. Actual levels vary by brand and batch, and individual products are rarely tested publicly.</div>
  </div>

  <div class="card"><h2>🌱 Pesticides & microplastics</h2>
    <div class="risk"><b style="font-size:14px">Pesticide exposure</b><span class="tag" style="background:${riskCol[r.pest.risk]}">${r.pest.risk}</span></div>
    <p class="muted" style="margin-bottom:12px">${esc(r.pest.why)}</p>
    <div class="risk"><b style="font-size:14px">Microplastic exposure</b><span class="tag" style="background:${riskCol[r.mp.risk]}">${r.mp.risk}</span></div>
    <p class="muted">${esc(r.mp.why)}</p>
    <div class="note">Estimates based on ingredients and packaging. Individual products are rarely lab tested for these.</div>
  </div>

  <div class="card"><h2>📝 Ingredients</h2>
    ${r.ingredients.length ? r.ingredients.map(i => `<div class="item"><span class="dot" style="background:${flagCol[i.flag]}"></span><div><b>${esc(i.name)}</b>${i.note ? `<p>${esc(i.note)}</p>` : ''}</div></div>`).join('') : '<p class="muted">No ingredient list in the database for this product.</p>'}
  </div>

  <div class="card"><p class="muted">Barcode ${esc(r.code)} · Data from <a href="https://world.openfoodfacts.org/product/${encodeURIComponent(r.code)}" target="_blank" rel="noopener" style="color:var(--brand)">Open Food Facts</a>. General info, not medical advice.</p>
    <button class="btn primary" style="margin-top:12px" id="again">Scan another</button></div>`;
  $('#again').onclick = () => { show('scan'); startScan(); };
}

function alcoholCard(r){
  const a = r.alc, lvl = {low:'low', some:'medium', high:'high', 'very high':'high', unknown:'medium'}[a.level];
  const big = a.abv != null ? `<div class="nut" style="margin-bottom:12px"><div><b>${a.abv}%</b><span>Alcohol (ABV)</span></div><div><b>${a.sd != null ? a.sd : '—'}</b><span>Std drinks / ${a.volMl ? Math.round(a.volMl) + 'ml' : 'container'}</span></div><div><b>${a.kjFromAlcohol}kJ</b><span>From alcohol /100ml</span></div></div>` : '';
  return `<div class="card"><h2>🍺 Alcohol</h2>
    <div class="risk"><b style="font-size:14px">Alcohol level</b><span class="tag" style="background:${riskCol[lvl]}">${esc(a.level)}</span></div>
    ${big}<ul class="plain">${a.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="note">−${a.penalty} points for alcohol, and alcoholic drinks are capped at 49.</div></div>`;
}
function doseCard(r){
  const d = r.dose || [];
  const st = {ok:['var(--g5)','OK'], near:['var(--g3)','Near limit'], over:['var(--g2)','Over limit'], 'way over':['var(--g1)','Way over']};
  return `<div class="card"><h2>💊 Doses vs safe limits</h2>
    ${d.length ? d.map(x => `<div class="factor"><div class="top"><span>${esc(x.label)} · ${x.amt}${x.unit}</span><span style="color:${st[x.status][0]}">${st[x.status][1]}</span></div>
      <div class="bar"><i style="width:${Math.min(100, x.pct / 2)}%;background:${st[x.status][0]}"></i></div><p>${x.pct}% of the adult upper limit (${x.ul}${x.unit}/day).${x.status !== 'ok' ? ' ' + esc(x.note) : ''}</p></div>`).join('')
      : '<p class="muted">Dose info isn\'t in the database for this product. Check the label against these adult daily upper limits: vitamin D 80µg (3200 IU) · vitamin A 3000µg · B6 50mg · iron 45mg · zinc 40mg · magnesium (supplements) 350mg · selenium 400µg · iodine 1100µg · calcium 2500mg.</p>'}
    <div class="note">Upper limits are for healthy adults from all sources combined (food + supplements). Your doctor may advise differently.</div></div>`;
}
const ENV_COL = ['#1f9d55', '#7cb342', '#f2a900', '#f26b1d', '#d93025'];
function envPill(e){ return `<span class="pill" style="margin:6px 6px 0 0;background:${ENV_COL[e.idx]};color:#fff">🌍 ${e.source.startsWith('Green') ? 'Green-Score' : 'Eco'} ${esc(e.grade)}</span>`; }
function envCard(r){
  const e = r.env;
  return `<div class="card"><h2>🌍 Environmental impact</h2>
    <div class="risk"><b style="font-size:14px">${e.source.startsWith('Green') ? 'Green-Score' : 'Estimated impact'}</b><span class="tag" style="background:${ENV_COL[e.idx]};text-transform:none">${esc(e.grade)}</span></div>
    <div style="display:flex;gap:4px;margin:8px 0 12px">${['A','B','C','D','E'].map((g, i) => `<div style="flex:1;text-align:center;padding:6px 0;border-radius:8px;font-weight:800;font-size:13px;color:#fff;background:${ENV_COL[i]};opacity:${i === e.idx ? 1 : .25}">${g}</div>`).join('')}</div>
    <ul class="plain">${e.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="note">${e.source.startsWith('Green') ? 'Green-Score from Open Food Facts — based on a life-cycle analysis (climate, water, land use, biodiversity) plus packaging, origin and labels.' : 'Estimated from the main ingredients, packaging and labels — no official score in the database.'}${r.envPenalty ? ` −${r.envPenalty} points taken off the score.` : ' Not counted in the score — you can turn that on in Settings.'}</div></div>`;
}
function animalCard(r){
  const a = r.animal, lvl = {great:'low', good:'low', none:'low', low:'low', unknown:'medium', some:'medium', high:'high'}[a.level];
  const word = {great:'Certified', good:'Good', none:'None', low:'Low concern', unknown:'Unknown', some:'Some concern', high:'High concern'}[a.level];
  return `<div class="card"><h2>🐾 Animal welfare</h2>
    <div class="risk"><b style="font-size:14px">${esc(a.badge.replace(/^\S+\s/, ''))}</b><span class="tag" style="background:${riskCol[lvl]}">${word}</span></div>
    <ul class="plain">${a.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${r.animalPenalty ? `<div class="note">−${r.animalPenalty} points taken off the score for animal welfare. You can turn this off in Settings.</div>` : ''}
  </div>`;
}
function renderCos(r){
  if (r.noIngredients){
    $('#v-result').innerHTML = `<div class="card">${r.img ? `<img class="pimg" src="${esc(r.img)}" alt="">` : ''}<h2>${esc((r.kindLabel || '🧴').split(' ')[0])} ${esc(r.name)}</h2>
      <p class="muted">${esc(r.brand)}</p><p style="margin-top:10px">Found it in ${esc(r.srcName || 'Open Beauty Facts')}, but there's no ingredient list yet, so it can't be scored. Tap <b>Add from label</b> to snap the ingredients — the app will remember it.</p>
      <button class="btn ghost" style="margin-top:12px" id="addLbl">📸 Add from label</button>
      <p style="margin-top:10px"><a href="${esc(r.srcBase || BAPI)}/product/${encodeURIComponent(r.code)}" target="_blank" rel="noopener" style="color:var(--brand);font-weight:600">Open on ${esc(r.srcName || 'Open Beauty Facts')} →</a></p>
      <button class="btn primary" style="margin-top:14px" id="again">Scan another</button></div>`;
    $('#again').onclick = () => { show('scan'); startScan(); };
    $('#addLbl').onclick = () => renderAddForm(r.code, {product_name: r.name, brands: r.brand, quantity: r.qty, ingredients_text: '', nutriments: {}, _src: r.src || 'beauty', _fromDb: true, image_front_url: r.img, categories_tags: r.cats});
    return;
  }
  const s = r.score, c = col(s), C = 2 * Math.PI * 50;
  $('#v-result').innerHTML = `
  ${r.warnings.length ? `<div class="warn">⚠️ ${r.warnings.map(esc).join('<br>')}</div>` : ''}
  ${r.flags.length ? `<div class="flag">🌸 ${r.flags.map(esc).join('<br>')}</div>` : ''}
  <div class="card">
    ${r.img ? `<img class="pimg" src="${esc(r.img)}" alt="">` : ''}
    <div class="hero">
      <div class="ring"><svg width="118" height="118" viewBox="0 0 118 118"><circle cx="59" cy="59" r="50" fill="none" stroke="var(--line)" stroke-width="11"/>
        <circle cx="59" cy="59" r="50" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - s / 100)}"/></svg>
        <div class="num"><div><b>${s}</b><small>/ 100</small></div></div></div>
      <div>
        <h3>${esc(r.name)}</h3>
        <div class="brand">${esc([r.brand, r.qty].filter(Boolean).join(' · '))}</div>
        <span class="grade" style="background:${c}">${label(s)}</span>
        ${r.bc ? `<div class="brand" style="margin-top:-6px">${bcText(r.bc)}</div>` : ''}
        <span class="pill" style="margin-left:6px">${esc(r.kindLabel || '🧴 Personal care')}</span>
        ${r.env ? envPill(r.env) : ''}
        ${r.animal ? `<span class="pill" style="margin-top:6px;${r.animal.certified ? '' : 'background:var(--soft);color:var(--muted)'}">${esc(r.animal.badge)}</span>` : ''}
      </div>
    </div>
    <p style="margin-top:14px;font-size:15px">${esc(r.summary)}</p>
  </div>

  <div class="card"><h2>${s < 65 ? '🔁 Better alternatives' : '✨ Similar or better picks'}</h2><div id="alts"><p class="muted">Finding better options…</p></div></div>

  <div class="card"><h2>📊 Score breakdown</h2>
    ${r.breakdown.map(b => { const p = b.points / b.max; return `<div class="factor"><div class="top"><span>${esc(b.factor)}</span><span>${b.points}/${b.max}</span></div>
      <div class="bar"><i style="width:${p * 100}%;background:${col(p * 100)}"></i></div><p>${esc(b.note)}</p></div>`; }).join('')}
  </div>

  <div class="card"><h2>${r.src === 'clothing' ? '👕 What it means for you' : '🧍 Effects on your skin & body'}</h2><ul class="plain">${r.effects.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>

  ${r.animal ? animalCard(r) : ''}
  ${r.env ? envCard(r) : ''}

  <div class="card"><h2>${r.src === 'clothing' ? '🧪 Finishes &amp; concerns' : '🧪 Ingredients of concern'}</h2>
    ${r.concerns.length ? r.concerns.map(a => `<div class="item"><span class="dot" style="background:${riskCol[a.level]}"></span><div><b>${esc(a.label)}</b> <span class="muted">— ${a.level} concern</span><p>${esc(a.note)}</p></div></div>`).join('')
      : '<p class="muted">Nothing of real concern found. 👍</p>'}
  </div>

  <div class="card"><h2>${r.src === 'clothing' ? '🧵 Fibres' : '📝 Full ingredient list'}</h2>
    ${r.ingredients.map(i => `<div class="item"><span class="dot" style="background:${flagCol[i.flag]}"></span><div><b>${esc(i.name)}</b>${i.note ? `<p>${esc(i.note)}</p>` : ''}</div></div>`).join('')}
  </div>

  <div class="card"><p class="muted">Barcode ${esc(r.code)} · Data from <a href="${esc(r.srcBase || BAPI)}/product/${encodeURIComponent(r.code)}" target="_blank" rel="noopener" style="color:var(--brand)">${esc(r.srcName || 'Open Beauty Facts')}</a>. Based on the ingredient list, not lab tests. General info, not medical advice.</p>
    <button class="btn primary" style="margin-top:12px" id="again">Scan another</button></div>`;
  $('#again').onclick = () => { show('scan'); startScan(); };
}

async function findCosAlternatives(p, r, src){
  src = src || 'beauty';
  if (src === 'clothing'){
    const box = $('#alts'); if (!box) return;
    box.innerHTML = `<ul class="plain"><li>🌿 Look for <b>GOTS</b> organic cotton, linen, hemp or Tencel™ lyocell.</li><li>🧪 <b>OEKO-TEX</b> means it's been tested for harmful chemicals.</li><li>♻️ Recycled fibres (GRS) and second-hand are the lowest-impact options of all.</li><li>⚠️ Skip "wrinkle-free" and waterproof finishes unless they say PFC-free.</li>${r.synth > 0.3 ? '<li>🧺 For activewear, recycled polyester with a microfibre wash bag is the practical middle ground.</li>' : ''}</ul>`;
    return;
  }
  const BASE = SRC[src][1];
  const cats = (p.categories_tags || []).filter(c => c.startsWith('en:')).slice(-3).reverse();
  let found = [];
  for (const cat of cats){
    for (const au of [true, false]){
      let url = `${BASE}/api/v2/search?categories_tags=${encodeURIComponent(cat)}&fields=${FIELDS}&page_size=50&sort_by=popularity_key`;
      if (au){ if (!regionTag()) continue; url += '&countries_tags=' + encodeURIComponent(regionTag()); }
      try{
        const j = await (await fetch(url)).json();
        (j.products || []).filter(x => x.code && x.code !== p.code && nameOf(x) !== 'Unnamed product' && (x.categories_tags || []).includes(cat)).forEach(x => {
          const a = nonFoodAnalyse(x, src);
          if (!a.noIngredients && a.score > r.score + 4) found.push({p:x, r:a});
        });
      }catch(e){}
      const seen = new Set(); found = found.sort((a, b) => b.r.score - a.r.score).filter(f => { const k = (f.r.name + f.r.brand).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      if (found.length >= 3) break;
    }
    if (found.length >= 3) break;
  }
  const box = $('#alts'); if (!box) return;
  if (!found.length){
    box.innerHTML = r.score >= 65 ? '<p class="muted">This is already one of the better options. 👍</p>'
      : `<p class="muted">Couldn't find a clearly better one in the database. Tip: ${src === 'pet' ? 'look for a named meat first, no artificial colours or BHA/BHT/ethoxyquin, and a "complete & balanced" claim' : src === 'products' ? 'look for an eco-label (EU Ecolabel, GECA), fragrance-free, and refills or concentrates' : 'look for fragrance-free, paraben-free formulas with a short ingredient list'}.</p>`;
    return;
  }
  box.innerHTML = found.slice(0, 3).map(f => {
    const fewer = r.concerns.length - f.r.concerns.length;
    const why = [fewer > 0 ? `${fewer} fewer ingredient${fewer > 1 ? 's' : ''} of concern` : '', r.fragrance && !f.r.fragrance ? 'fragrance-free' : '', f.r.goodList.length > r.goodList.length ? 'more skin-friendly ingredients' : ''].filter(Boolean).join(', ') || 'Scores better overall';
    return `<div class="alt" data-c="${esc(f.r.code)}">${f.p.image_front_small_url ? `<img src="${esc(f.p.image_front_small_url)}" alt="">` : ''}
      <div style="flex:1"><b>${esc(f.r.name)}</b><p>${esc(f.r.brand)}</p><p>${esc(cap(why))}</p></div>
      <div class="sc" style="background:${col(f.r.score)}">${f.r.score}</div></div>`; }).join('');
  box.querySelectorAll('.alt').forEach(a => a.onclick = () => lookup(a.dataset.c));
}

function renderHistory(){
  const h = store.get('fs_hist', []);
  $('#histList').innerHTML = h.length ? h.map(x => `<div class="hist" data-c="${esc(x.code)}"><div class="sc" style="background:${col(x.score)}">${x.score}</div>
    <div><b>${x.emoji ? x.emoji + ' ' : ({beauty:'🧴 ', pet:'🐾 ', products:'🧽 ', clothing:'👕 '}[x.kind] || (x.cos ? '🧴 ' : ''))}${esc(x.name)}</b><span>${esc(x.brand || '')} · ${new Date(x.ts).toLocaleDateString('en-AU')}</span></div></div>`).join('')
    : '<p class="muted">Nothing yet. Your scans will show up here.</p>';
  $('#histList').querySelectorAll('.hist').forEach(el => el.onclick = () => lookup(el.dataset.c));
}

// ---------------- install (PWA) ----------------
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
let deferred = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferred = e;
  $('#install').style.display = 'block'; $('#installTxt').textContent = 'Add Sanitas to your home screen so it opens like a normal app.';
});
$('#installBtn').onclick = async () => { if (deferred){ deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').style.display = 'none'; } };
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)){
  $('#install').style.display = 'block'; $('#installBtn').style.display = 'none';
  $('#installTxt').innerHTML = 'In Safari, tap the <b>Share</b> button <span style="font-size:16px">⬆︎</span> then <b>Add to Home Screen</b>.';
}
renderRecent();
if ('serviceWorker' in navigator && !FSNative.native && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
