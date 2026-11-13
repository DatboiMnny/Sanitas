/* Sanitas — extra health-product databases.
   • NIH Dietary Supplement Label Database (DSLD): 200,000+ supplement labels, searchable by barcode. Free, no key.
   • U.S. FDA drug labels (openFDA): over-the-counter medicines, sunscreens, toothpaste, antiperspirants,
     acne and dandruff products, hand sanitiser — with full active and inactive ingredients. Free, no key.
   • UPCitemdb (free trial): only the product's name and brand, used to pre-fill "Add it from the label".
   Every lookup fails quietly, so a database being down never breaks a scan. */
(function(){
'use strict';
const DSLD = 'https://api.ods.od.nih.gov/dsld/v9';
const FDA = 'https://api.fda.gov/drug/label.json';
const digits = s => String(s || '').replace(/\D/g, '');
const title = s => String(s || '').toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\b(Mg|Mcg|Iu|Spf|Otc|Usp|Llc|Inc|Co|Ltd)\b/g, m => ({Co:'Co', Inc:'Inc', Ltd:'Ltd'})[m] || m.toUpperCase());

function timeout(ms){ const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }
async function getJSON(url, ms){
  const r = await fetch(url, {signal: timeout(ms || 8000)});
  if (!r.ok) return null;
  return r.json();
}
// US barcodes come as 12-digit UPC-A, or as 13 digits with a leading 0
function upc12(code){
  const d = digits(code);
  if (d.length === 12) return d;
  if (d.length === 13 && d[0] === '0') return d.slice(1);
  return null;
}

// ---------- NIH Dietary Supplement Label Database ----------
// [pattern on the ingredient name, Sanitas nutriment key, how to turn the label's unit into grams]
const NUT = [
  [/^vitamin a\d?\b|retinol|retinyl/i, 'vitamin-a', {mcg: 1e-6, 'mcg rae': 1e-6, mg: 1e-3, iu: 0.3e-6}],
  [/^vitamin d\d?\b|cholecalciferol|ergocalciferol/i, 'vitamin-d', {mcg: 1e-6, mg: 1e-3, iu: 0.025e-6}],
  [/^vitamin e\b|tocopher/i, 'vitamin-e', {mg: 1e-3, 'mg ate': 1e-3, mcg: 1e-6, iu: 0.67e-3}],
  [/^vitamin b-?6\b|pyridox/i, 'vitamin-b6', {mg: 1e-3, mcg: 1e-6}],
  [/^niacin|nicotinic acid/i, 'vitamin-pp', {mg: 1e-3, 'mg ne': 1e-3}],
  [/^fol(ic acid|ate)/i, 'vitamin-b9', {mcg: 1e-6, 'mcg dfe': 0.6e-6, mg: 1e-3}],
  [/^iron\b/i, 'iron', {mg: 1e-3, mcg: 1e-6}],
  [/^zinc\b/i, 'zinc', {mg: 1e-3, mcg: 1e-6}],
  [/^selenium\b/i, 'selenium', {mcg: 1e-6, mg: 1e-3}],
  [/^iodine\b/i, 'iodine', {mcg: 1e-6, mg: 1e-3}],
  [/^calcium\b/i, 'calcium', {mg: 1e-3, g: 1}],
  [/^magnesium\b/i, 'magnesium', {mg: 1e-3, g: 1}],
  [/^vitamin c\b|ascorbic/i, 'vitamin-c', {mg: 1e-3, g: 1}],
  [/^protein\b/i, 'proteins', {g: 1}],
  [/^(total )?sugars?\b/i, 'sugars', {g: 1}],
  [/^sodium\b/i, 'sodium', {mg: 1e-3, g: 1}],
  [/^calories\b/i, 'energy-kcal', {'': 1, kcal: 1, calories: 1}]
];
const TESTED = [[/nsf/i, 'en:nsf-certified'], [/informed[- ]sport/i, 'en:informed-sport'], [/informed[- ]choice/i, 'en:informed-choice'], [/usp[- ]verified/i, 'en:usp-verified'], [/bscg/i, 'en:bscg-certified']];

function rowsFlat(rows, out){
  (rows || []).forEach(r => { out.push(r); if (r.nestedRows) rowsFlat(r.nestedRows, out); });
  return out;
}
function fromDSLD(code, L){
  const rows = rowsFlat(L.ingredientRows, []);
  const nutriments = {};
  for (const r of rows){
    const q = (r.quantity || [])[0]; if (!q || q.quantity == null) continue;
    const unit = String(q.unit || '').toLowerCase().trim();
    for (const [re, key, conv] of NUT){
      if (!re.test(r.name || '')) continue;
      const f = conv[unit] != null ? conv[unit] : conv[unit.split(' ')[0]];
      if (f == null || nutriments[key + '_serving'] != null) break;
      nutriments[key + '_serving'] = Number(q.quantity) * f;
      break;
    }
  }
  const other = L.otheringredients || L.otherIngredients || {};
  const otherText = other.text || (other.ingredients || []).map(i => i.name).filter(Boolean).join(', ');
  const active = rows.map(r => r.name).filter(Boolean);
  const statements = (L.statements || []).map(s => s.notes || '').concat((L.claims || []).map(c => c.langualCodeDescription || '')).join(' ');
  const labels_tags = TESTED.filter(t => t[0].test(statements)).map(t => t[1]);
  const ss = (L.servingSizes || [])[0];
  const ingredients_text = active.join(', ') + (otherText ? (active.length ? '. Other ingredients: ' : '') + otherText : '');
  return {
    code, product_name: L.fullName || '', brands: L.brandName || '',
    quantity: ((L.netContents || [])[0] || {}).display || '',
    serving_size: ss ? `${ss.minQuantity || 1} ${ss.unit || ''}`.trim() : '',
    categories: 'Dietary supplements', categories_tags: ['en:dietary-supplements'],
    ingredients_text, labels_tags, nutriments,
    additives_tags: window.FSLabel && otherText ? FSLabel.additivesFromText(otherText) : [],
    _source: 'NIH Dietary Supplement Label Database'
  };
}
function fmtUPC(u){ return `${u[0]} ${u.slice(1, 6)} ${u.slice(6, 11)} ${u[11]}`; }
async function dsld(code){
  const u = upc12(code); if (!u) return null;
  for (const q of [`"${fmtUPC(u)}"`, u]){
    const j = await getJSON(`${DSLD}/search-filter?q=${encodeURIComponent(q)}&size=5`);
    const hits = (j && j.hits) || [];
    for (const h of hits.slice(0, 3)){
      const s = h._source || {};
      if (s.upcSku && digits(s.upcSku) !== u) continue;
      const L = await getJSON(`${DSLD}/label/${encodeURIComponent(h._id || s.id)}`);
      if (L && L.fullName && digits(L.upcSku) === u) return fromDSLD(code, L);
    }
  }
  return null;
}

// ---------- U.S. FDA drug labels (openFDA) ----------
function ndcFromUPC(u){
  // US medicine barcodes are "3" + the 10-digit National Drug Code + a check digit
  if (!u || u[0] !== '3') return [];
  const n = u.slice(1, 11);
  return [`${n.slice(0, 4)}-${n.slice(4, 8)}-${n.slice(8)}`, `${n.slice(0, 5)}-${n.slice(5, 8)}-${n.slice(8)}`, `${n.slice(0, 5)}-${n.slice(5, 9)}-${n.slice(9)}`];
}
const strip = (s, re) => String(s || '').replace(re, '').replace(/\s+/g, ' ').trim();
const CARE = /sunscreen|spf|sun ?block|tooth ?paste|dentifrice|fluoride|mouth ?wash|rinse|antiperspirant|deodorant|shampoo|dandruff|lotion|cream|moisturi|acne|benzoyl|salicylic|cleanser|face wash|body wash|soap|hand sanitizer|sanitiser|lip balm|lip|diaper|makeup|foundation|bb cream|cc cream|tinted/i;
function fromFDA(code, R){
  const o = R.openfda || {};
  const brand = (o.brand_name || [])[0] || '';
  const generic = (o.generic_name || [])[0] || '';
  const maker = (o.manufacturer_name || [])[0] || '';
  const activeTxt = strip((R.active_ingredient || []).join(' '), /^\s*active ingredients?\s*(\([^)]*\))?\s*:?\s*/i);
  const inactiveTxt = strip((R.inactive_ingredient || []).join(' '), /^\s*inactive ingredients?\s*:?\s*/i);
  const purpose = strip((R.purpose || []).join(' '), /^\s*purposes?\s*:?\s*/i);
  const uses = strip((R.indications_and_usage || []).join(' '), /^\s*uses?\s*:?\s*/i);
  const route = (o.route || R.route || []).join(' ').toLowerCase();
  const all = [brand, generic, purpose, uses, route].join(' ');
  const care = /topical|dental|oral rinse/.test(route) && CARE.test(all) || (/topical/.test(route) && !/pain|itch|antibiotic|hydrocortisone|antifungal|lidocaine/i.test(all));
  const substances = (o.substance_name || []).map(title);
  const base = {
    code, product_name: title(brand || generic), brands: title(maker), generic: title(generic),
    _source: 'U.S. FDA drug labels (openFDA)', _fdaRoute: route
  };
  if (care){
    // personal care that's regulated as a medicine in the US (sunscreen, fluoride toothpaste, antiperspirant…)
    const ing = [substances.join(', ') || activeTxt, inactiveTxt].filter(Boolean).join(', ');
    return {src: 'beauty', p: Object.assign(base, {ingredients_text: ing, categories: purpose || 'Personal care', _inDb: false})};
  }
  return {src: 'medicine', p: Object.assign(base, {
    active: activeTxt, actives: substances, inactive: inactiveTxt, purpose, uses,
    warnings: strip((R.warnings || []).join(' '), /^\s*warnings?\s*:?\s*/i),
    do_not_use: strip((R.do_not_use || []).join(' '), /^\s*do not use\s*:?\s*/i),
    ask_doctor: strip((R.ask_doctor || []).join(' '), /^\s*ask a doctor before use if( you have)?\s*:?\s*/i),
    pregnancy: strip((R.pregnancy_or_breast_feeding || []).join(' '), /^\s*if pregnant or breast-?feeding,?\s*/i),
    directions: strip((R.dosage_and_administration || []).join(' '), /^\s*directions\s*:?\s*/i),
    otc: /otc/i.test((o.product_type || []).join(' '))
  })};
}
async function fda(code){
  const u = upc12(code); if (!u) return null;
  const terms = [`openfda.upc:"${u}"`, `openfda.upc:"0${u}"`].concat(ndcFromUPC(u).map(n => `openfda.package_ndc:"${n}"`));
  const key = (window.FS_FDA_KEY || '').trim();
  const j = await getJSON(`${FDA}?search=${terms.map(encodeURIComponent).join('+')}&limit=1${key ? '&api_key=' + encodeURIComponent(key) : ''}`);
  const R = j && (j.results || [])[0];
  return R ? fromFDA(code, R) : null;
}

// ---------- name-only fallback ----------
async function nameOnly(code){
  const d = digits(code); if (d.length < 8) return null;
  try{
    const j = await getJSON(`https://api.upcitemdb.com/prod/trial/lookup?upc=${d}`, 6000);
    const it = j && (j.items || [])[0];
    if (!it || !it.title) return null;
    const cat = String(it.category || '').toLowerCase();
    const kind = /health & beauty|personal care|cosmetic|skin|hair|bath|oral care|deodorant|fragrance/.test(cat) ? 'beauty'
      : /pet|animal/.test(cat) ? 'pet' : /household|cleaning|laundry/.test(cat) ? 'products' : 'food';
    return {product_name: it.title, brands: it.brand || '', _src: kind, _hint: 'UPCitemdb'};
  }catch(e){ return null; }
}

async function lookup(code){
  const [s, m] = await Promise.all([dsld(code).catch(() => null), fda(code).catch(() => null)]);
  if (s) return {p: s, src: 'food'};
  if (m) return m;
  return null;
}

// ---------- medicine card ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; };
const DYES = /fd&c|d&c|red no|yellow no|blue no|tartrazine|allura|sunset yellow|brilliant blue|erythrosine/i;
function renderMedicine(p){
  const dyes = (p.inactive || '').split(/,\s*/).filter(x => DYES.test(x));
  const sec = (h, body) => body ? `<div class="card"><h2>${h}</h2><p style="font-size:14px;line-height:1.5">${esc(body)}</p></div>` : '';
  return `
  <div class="card">
    <div style="display:flex;gap:12px;align-items:center">
      <div style="font-size:40px">💊</div>
      <div><h2 style="margin:0">${esc(p.product_name || 'Medicine')}</h2>
        <div class="brand">${esc(p.brands || '')}${p.generic && p.generic !== p.product_name ? ' · ' + esc(p.generic) : ''}</div>
        <span class="pill" style="margin-top:6px">${p.otc ? '💊 Over-the-counter medicine' : '💊 Medicine'}</span></div>
    </div>
    <p class="muted" style="margin-top:12px">Medicines aren't given a health score. Follow the label and ask a pharmacist or doctor if you're unsure — especially if you take other medicines, are pregnant, or it's for a child.</p>
  </div>
  ${p.active || p.actives.length ? `<div class="card"><h2>🧪 Active ingredients</h2><p style="font-size:14px;line-height:1.5">${esc(p.active || p.actives.join(', '))}</p>${p.purpose ? `<p class="muted" style="margin-top:6px">${esc(p.purpose)}</p>` : ''}</div>` : ''}
  ${sec('🎯 Uses', short(p.uses, 500))}
  ${sec('⛔ Do not use', short(p.do_not_use, 500))}
  ${sec('🩺 Ask a doctor first if', short(p.ask_doctor, 500))}
  ${sec('🤰 Pregnancy & breastfeeding', short(p.pregnancy, 400))}
  ${sec('⚠️ Warnings', short(p.warnings, 700))}
  ${sec('📏 Directions', short(p.directions, 500))}
  ${p.inactive ? `<div class="card"><h2>📝 Inactive ingredients</h2><p style="font-size:14px;line-height:1.5">${esc(p.inactive)}</p>${dyes.length ? `<p class="muted" style="margin-top:6px">🎨 Contains artificial colours (${esc(dyes.join(', '))}). Some children are sensitive to these — dye-free versions are often available.</p>` : ''}</div>` : ''}
  <div class="card"><p class="muted">Barcode ${esc(p.code)} · Data from the U.S. FDA (openFDA). This is the US label — the same brand can have different ingredients or doses in Australia. General info, not medical advice.</p></div>`;
}

window.FSHealth = {lookup, dsld, fda, nameOnly, renderMedicine};
})();
