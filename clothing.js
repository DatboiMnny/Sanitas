/* Sanitas — clothing, scored from the care label (fibre %), certifications and finishes. */
(function(){
'use strict';
// fibre key: [display, group, env points /20, microplastic share 0–1, notes]
const F = {
  'organic cotton': ['Organic cotton','plant',18,0,'Grown without synthetic pesticides or fertilisers.'],
  'recycled cotton': ['Recycled cotton','plant',18,0,'Made from reused cotton — very low impact.'],
  cotton: ['Cotton','plant',10,0,'Breathable and soft, but conventional cotton uses lots of water and pesticides.'],
  linen: ['Linen','plant',19,0,'Flax needs little water or pesticide — one of the lowest-impact fibres.'],
  hemp: ['Hemp','plant',20,0,'Grows fast with little water and no pesticides.'],
  lyocell: ['Lyocell (Tencel)','semi',18,0,'Wood-based fibre made in a closed-loop process — breathable and low impact.'],
  modal: ['Modal','semi',14,0,'Wood-based and soft; impact depends on the maker (TENCEL™ Modal is best).'],
  viscose: ['Viscose / rayon','semi',9,0,'Made from wood pulp with harsh chemicals; can drive deforestation unless FSC/EcoVero.'],
  bamboo: ['Bamboo (viscose)','semi',9,0,'Usually bamboo viscose — made with the same harsh chemical process as rayon.'],
  'recycled polyester': ['Recycled polyester','synthetic',12,1,'Made from plastic bottles — better than virgin, but still sheds microplastics.'],
  polyester: ['Polyester','synthetic',6,1,'Plastic made from oil — sheds microplastics in every wash and traps odour.'],
  'recycled nylon': ['Recycled nylon','synthetic',12,1,'Often from fishing nets — better than virgin, still sheds microfibres.'],
  nylon: ['Nylon / polyamide','synthetic',6,1,'Oil-based plastic fibre — strong, but sheds microplastics.'],
  acrylic: ['Acrylic','synthetic',4,1,'Sheds the most microfibres of any fabric and pills easily.'],
  elastane: ['Elastane (spandex)','synthetic',6,0.7,'Adds stretch; small amounts are common. Makes recycling hard.'],
  polypropylene: ['Polypropylene','synthetic',6,1,'Oil-based plastic fibre.'],
  polyurethane: ['Polyurethane (PU)','synthetic',5,0.5,'Plastic coating, e.g. faux leather.'],
  merino: ['Merino wool','animal',12,0,'Warm, breathable, odour-resistant, biodegradable.'],
  wool: ['Wool','animal',12,0,'Warm, breathable and biodegradable; can itch sensitive skin.'],
  cashmere: ['Cashmere','animal',6,0,'Luxurious, but goat grazing drives land degradation.'],
  alpaca: ['Alpaca','animal',14,0,'Soft, warm, lower impact than cashmere.'],
  mohair: ['Mohair','animal',8,0,'From angora goats — welfare concerns in some supply chains.'],
  angora: ['Angora','animal',4,0,'From angora rabbits — serious welfare concerns.'],
  silk: ['Silk','animal',11,0,'Natural and breathable; silkworms are usually killed in production.'],
  leather: ['Leather','animal',6,0,'Durable, but tanning often uses chromium; animal-derived.'],
  down: ['Down / feathers','animal',10,0,'Very warm; check for RDS (no live-plucking).'],
  fur: ['Fur','animal',3,0,'Serious animal welfare concerns.']
};
// multilingual names → key (order matters: specific first)
const NAMES = [
  [/organic\s+cotton|coton\s+bio(logique)?|algod[oó]n\s+org[aá]nico|bio-?baumwolle|cotone\s+biologico/i, 'organic cotton'],
  [/recycled\s+cotton|algod[oó]n\s+reciclado|coton\s+recycl[ée]/i, 'recycled cotton'],
  [/recycled\s+poly(ester)?|rpet|poli[eé]ster\s+reciclado|polyester\s+recycl[ée]/i, 'recycled polyester'],
  [/recycled\s+(nylon|polyamide)|econyl|poliamida\s+reciclada/i, 'recycled nylon'],
  [/cotton|coton|algod[oó]n|baumwolle|cotone|katoen/i, 'cotton'],
  [/linen|\blin\b|lino|leinen|flax/i, 'linen'],
  [/hemp|chanvre|c[aá][nñ]amo|hanf|canapa/i, 'hemp'],
  [/lyocell|tencel/i, 'lyocell'],
  [/modal/i, 'modal'],
  [/bamboo|bamb[uú]|bambou/i, 'bamboo'],
  [/viscose|viscosa|rayon|vis[ck]ose/i, 'viscose'],
  [/polyester|poli[eé]ster|polyest/i, 'polyester'],
  [/nylon|polyamide|poliamida|polyamid|poliammide/i, 'nylon'],
  [/acrylic|acrylique|acr[ií]lico|acryl|acrilico/i, 'acrylic'],
  [/elastane|spandex|lycra|elastano|[eé]lasthanne|elasthan/i, 'elastane'],
  [/polypropylene|polipropileno/i, 'polypropylene'],
  [/polyurethane|poliuretano|\bpu\b/i, 'polyurethane'],
  [/merino/i, 'merino'],
  [/cashmere|cachemire|cachemira|kaschmir/i, 'cashmere'],
  [/alpaca|alpaga/i, 'alpaca'],
  [/mohair/i, 'mohair'],
  [/angora/i, 'angora'],
  [/wool|laine|lana|wolle|\bwol\b/i, 'wool'],
  [/silk|soie|seda|seide|seta/i, 'silk'],
  [/leather|cuir|cuero|leder|pelle/i, 'leather'],
  [/\bdown\b|duvet|plum[oó]n|daunen|feather|plumas/i, 'down'],
  [/\bfur\b|fourrure|piel natural|pelz/i, 'fur']
];
const CERTS = [
  ['GOTS', /\bgots\b|global organic textile/i, 'Global Organic Textile Standard — organic fibre + strict chemical & social rules.'],
  ['OCS', /\bocs\b|organic content standard/i, 'Organic Content Standard — verifies the organic fibre content.'],
  ['OEKO-TEX', /oeko-?tex|standard 100/i, 'Tested for harmful substances (formaldehyde, heavy metals, banned dyes).'],
  ['bluesign', /bluesign/i, 'Safer chemicals and cleaner production.'],
  ['GRS', /\bgrs\b|global recycled standard/i, 'Verifies recycled content.'],
  ['Fairtrade', /fair\s?trade/i, 'Fairer pay for cotton farmers.'],
  ['Better Cotton', /better cotton|\bbci\b/i, 'Better farming practices for conventional cotton.'],
  ['RWS', /\brws\b|responsible wool|non-?mulesed|mulesing.?free/i, 'Responsible Wool Standard — no mulesing, better sheep welfare.'],
  ['RDS', /\brds\b|responsible down/i, 'Responsible Down Standard — no live-plucking or force-feeding.'],
  ['FSC', /\bfsc\b|ecovero/i, 'Wood pulp from responsibly managed forests.']
];
const TREAT = [
  ['Water-repellent / waterproof', /water.?(repellent|proof|resistant)|\bdwr\b|imperm[eé]able/i, 'high', 'Often made with PFAS ("forever chemicals") unless labelled PFC-free.'],
  ['Wrinkle-free / non-iron', /wrinkle.?(free|resist)|non.?iron|easy.?care|no.?iron|crease.?resist/i, 'high', 'Usually done with formaldehyde-based resins, which can irritate skin.'],
  ['Antibacterial / anti-odour', /anti.?(bacterial|microbial|odou?r)|silver|polygiene|triclosan/i, 'moderate', 'Silver or other biocides wash out into waterways; triclosan disrupts hormones.'],
  ['Stain-resistant', /stain.?(resist|repel)|teflon|scotchgard/i, 'high', 'Often PFAS-based.'],
  ['Flame-retardant', /flame.?(retard|resist)|fire.?retard/i, 'high', 'Some flame retardants are hormone disruptors. Kids\' sleepwear in Australia is low-fire-danger by fabric/design instead.']
];

function parseLabel(text){
  const t = String(text || '').replace(/\r/g, ' ').replace(/[|]/g, ' ');
  const seen = {}; // fibre -> list of readings (care labels repeat the same mix in several languages)
  const take = (pct, name) => {
    const hit = NAMES.find(n => n[0].test(name)); if (!hit) return;
    let v = parseFloat(String(pct).replace(',', '.'));
    if (v > 100 && /9$/.test(String(Math.round(v)))) v = Math.floor(v / 10);   // OCR often reads "%" as "9%"
    if (!(v > 0 && v <= 100)) return;
    (seen[hit[1]] = seen[hit[1]] || []).push(Math.round(v));
  };
  for (const line of t.split('\n')){
    for (const m of line.matchAll(/(\d{1,3}(?:[.,]\d)?)[ \t]?%[ \t]*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \t\-]{1,30})/g)) take(m[1], m[2]);
    for (const m of line.matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \t\-]{1,30}?)[ \t]*[:\-]?[ \t]*(\d{1,3}(?:[.,]\d)?)[ \t]?%/g)) take(m[2], m[1]);
  }
  const mode = arr => { const c = {}; arr.forEach(v => c[v] = (c[v] || 0) + 1); return +Object.entries(c).sort((a, b) => b[1] - a[1] || arr.indexOf(+a[0]) - arr.indexOf(+b[0]))[0][0]; };
  const found = {}; for (const [k, arr] of Object.entries(seen)) found[k] = mode(arr);
  if (!Object.keys(found).length){ const one = NAMES.find(n => n[0].test(t) && /100|pure|all/i.test(t)); if (one) found[one[1]] = 100; }
  const fibres = Object.entries(found).map(([fibre, pct]) => ({fibre, pct})).sort((a, b) => b.pct - a.pct);
  const certs = CERTS.filter(c => c[1].test(t)).map(c => c[0]);
  const treatments = TREAT.filter(x => x[1].test(t)).map(x => x[0]);
  return {fibres, certs, treatments, pfcFree: /pfc.?free|pfas.?free|fluorocarbon.?free/i.test(t)};
}

function analyse(item, me){
  const fibres = (item.fibres || []).filter(f => F[f.fibre] && f.pct > 0);
  const tot = fibres.reduce((a, f) => a + f.pct, 0) || 1;
  const share = f => f.pct / tot;
  const certs = item.certs || [], treat = item.treatments || [];
  const skin = me.skin || [];
  const has = c => certs.includes(c);
  const r = {cosmetic: true, kindLabel: '👕 Clothing', code: item.code, name: item.product_name || 'Clothing item', brand: item.brands || '', qty: item.size || '', img: '', cats: ['clothing']};
  if (!fibres.length){ r.noIngredients = true; return r; }
  const warnings = [], concerns = [], good = [], effects = [];
  const synth = fibres.reduce((a, f) => a + share(f) * F[f.fibre][3], 0);
  const organicShare = fibres.filter(f => /organic|recycled cotton/.test(f.fibre)).reduce((a, f) => a + share(f), 0);
  const animal = fibres.filter(f => F[f.fibre][1] === 'animal');

  // 1. Organic & certified (10)
  let org = Math.round(organicShare * 7);
  if (has('GOTS')) org = Math.max(org, 9); if (has('OCS')) org = Math.max(org, 7);
  if (has('Fairtrade')) org += 2; if (has('Better Cotton')) org += 1; if (has('GRS') || has('bluesign')) org += 2; if (has('FSC')) org += 1;
  org = Math.min(10, org);
  // 2. Chemicals & finishes (25)
  let chem = 20; const chemNotes = [];
  if (has('OEKO-TEX') || has('GOTS') || has('bluesign')){ chem += 5; chemNotes.push('✓ tested for harmful substances'); }
  for (const t of treat){
    const x = TREAT.find(y => y[0] === t); if (!x) continue;
    if (/PFAS/.test(x[3]) && item.pfcFree){ chemNotes.push(`${t} (PFC-free ✓)`); continue; }
    chem -= x[2] === 'high' ? 8 : 5; concerns.push({label: t, level: x[2], note: x[3]}); chemNotes.push(t.toLowerCase());
  }
  if (fibres.some(f => /viscose|bamboo|modal/.test(f.fibre)) && !has('FSC')) chemNotes.push('viscose-type fibres are made with harsh solvents');
  chem = Math.max(0, Math.min(25, chem));
  // 3. Microplastics (20)
  const mp = Math.round(20 * (1 - synth));
  // 4. Environment (20)
  let env = fibres.reduce((a, f) => a + share(f) * F[f.fibre][2], 0);
  if (has('bluesign') || has('GRS')) env += 1; if (has('FSC') && fibres.some(f => /viscose|modal|bamboo/.test(f.fibre))) env += 2;
  env = Math.max(0, Math.min(20, Math.round(env)));
  // 5. Skin fit (25)
  let fit = 20; const fitNotes = [];
  const natural = fibres.filter(f => F[f.fibre][1] !== 'synthetic').reduce((a, f) => a + share(f), 0);
  if (natural >= 0.9){ fit += 3; fitNotes.push('breathable natural fibres'); }
  if (synth > 0.5){ fit -= 4; fitNotes.push('mostly synthetic — traps heat and odour'); }
  if (skin.includes('Sensitive skin') || skin.includes('Eczema-prone')){
    if (fibres.some(f => /wool|mohair|angora/.test(f.fibre) && f.fibre !== 'merino')){ fit -= 6; fitNotes.push('wool can itch and flare eczema'); }
    if (synth > 0.5){ fit -= 4; fitNotes.push('synthetics can irritate sensitive skin'); }
    if (treat.some(t => /Wrinkle|Antibacterial/.test(t))){ fit -= 5; fitNotes.push('chemical finishes can irritate'); }
    if (fibres.some(f => /cotton|silk|lyocell/.test(f.fibre)) && synth < 0.3){ fit += 2; fitNotes.push('soft, skin-friendly fibres'); }
  }
  if ((me.diets || []).includes('Vegan') && animal.length){ fit -= 8; fitNotes.push('contains animal fibres'); }
  if ((skin.includes('Pregnant / breastfeeding')) && treat.some(t => /Wrinkle|Stain|Water|Flame/.test(t))) fitNotes.push('finishes worth avoiding in pregnancy');
  fit = Math.max(0, Math.min(25, fit));

  const fmt = fibres.map(f => `${f.pct}% ${F[f.fibre][0].toLowerCase()}`).join(', ');
  const breakdown = [
    {factor: 'Organic & certified', points: org, max: 10, note: organicShare ? `${Math.round(organicShare * 100)}% organic or recycled cotton.` + (certs.length ? ` ✓ ${certs.join(', ')}.` : '') : certs.length ? `✓ ${certs.join(', ')}. Not organic.` : 'Not organic and no certifications listed. Plain "cotton" isn\'t organic.'},
    {factor: 'Chemicals & finishes', points: chem, max: 25, note: chemNotes.length ? chemNotes[0][0].toUpperCase() + chemNotes.join('; ').slice(1) + '.' : 'No chemical finishes listed.'},
    {factor: 'Microplastics', points: mp, max: 20, note: synth > 0.05 ? `About ${Math.round(synth * 100)}% plastic fibres — these shed microfibres in every wash.` : 'No plastic fibres — no microfibre shedding. 👍'},
    {factor: 'Environment', points: env, max: 20, note: fibres.slice(0, 3).map(f => F[f.fibre][0]).join(', ') + ' — ' + (env >= 16 ? 'low-impact fibres.' : env >= 10 ? 'moderate impact.' : 'high-impact fibres.')},
    {factor: 'Skin & comfort', points: fit, max: 25, note: fitNotes.length ? fitNotes[0][0].toUpperCase() + fitNotes.join('; ').slice(1) + '.' : 'No issues for your skin settings.'}
  ];

  // animal welfare
  const aw = {points: [], penalty: 0, level: 'none'};
  for (const f of animal){
    if (/wool|merino/.test(f.fibre)){ if (has('RWS')) aw.points.push('🐑 RWS / mulesing-free wool ✓'); else { aw.points.push('🐑 Wool with no RWS or mulesing-free label — in Australia many merino sheep are still mulesed (skin cut from around the tail without pain relief in some cases).'); aw.penalty = Math.max(aw.penalty, 5); } }
    if (f.fibre === 'down'){ if (has('RDS')) aw.points.push('🦆 RDS-certified down ✓'); else { aw.points.push('🦆 Down without RDS — risk of live-plucking.'); aw.penalty = Math.max(aw.penalty, 5); } }
    if (f.fibre === 'silk'){ aw.points.push('🐛 Silk — silkworms are usually boiled in their cocoons.'); aw.penalty = Math.max(aw.penalty, 3); }
    if (f.fibre === 'leather'){ aw.points.push('🐄 Leather — a by-product of the meat industry; tanning often uses chromium.'); aw.penalty = Math.max(aw.penalty, 5); }
    if (/angora|fur/.test(f.fibre)){ aw.points.push(`🐇 ${F[f.fibre][0]} — serious animal welfare concerns.`); aw.penalty = 10; }
    if (/cashmere|mohair/.test(f.fibre)){ aw.points.push(`🐐 ${F[f.fibre][0]} — goat welfare and overgrazing concerns.`); aw.penalty = Math.max(aw.penalty, 5); }
  }
  aw.level = aw.penalty >= 10 ? 'high' : aw.penalty >= 5 ? 'some' : animal.length ? 'low' : 'none';
  if (!aw.points.length) aw.points.push('🌱 No animal fibres.');
  aw.badge = {none:'🐾 No animal fibres', low:'🐾 Low welfare concern', some:'🐾 Some welfare concerns', high:'🐾 High welfare concern'}[aw.level];
  aw.main = aw.points[0];
  const awCount = (me.animal || []).includes('Count animal welfare in the score');

  let score = breakdown.reduce((a, b) => a + b.points, 0);
  if (awCount) score -= aw.penalty;
  score = Math.max(0, Math.min(100, score));
  // environment grade
  const eIdx = env >= 17 ? 0 : env >= 13 ? 1 : env >= 9 ? 2 : env >= 6 ? 3 : 4;
  const envPoints = fibres.slice(0, 4).map(f => `${f.pct}% ${F[f.fibre][0]}: ${F[f.fibre][4]}`);
  if (synth > 0.05) envPoints.push('🧺 Cut microfibres: wash cold, use full loads, line-dry, or use a microfibre-catching wash bag.');

  effects.push(...fibres.slice(0, 4).map(f => `${F[f.fibre][1] === 'synthetic' ? '⚠️' : '✅'} ${F[f.fibre][0]}: ${F[f.fibre][4]}`));
  concerns.filter(c => c.level !== 'low').forEach(c => effects.push(`⚠️ ${c.label}: ${c.note}`));
  if (!certs.includes('OEKO-TEX') && !certs.includes('GOTS')) effects.push('🧼 Wash new clothes before wearing — it removes leftover dyes and finishing chemicals.');
  if (synth > 0.05) effects.push('🧺 Wash cold, use full loads and line-dry to shed fewer microfibres.');
  certs.forEach(c => { const x = CERTS.find(y => y[0] === c); if (x) good.push({label: c, note: x[2]}); });
  if (synth > 0.6) concerns.push({label: 'Mostly plastic fibres', level: 'moderate', note: 'Sheds microplastics and isn\'t biodegradable.'});

  const label = s => s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Mediocre' : s >= 20 ? 'Poor' : 'Bad';
  const worst = breakdown.slice().sort((a, b) => a.points / a.max - b.points / b.max)[0];
  Object.assign(r, {
    score, breakdown, warnings, flags: [], effects, concerns, goodList: good,
    summary: `${label(score)} pick. ${fmt}. ${organicShare >= 0.7 ? 'Mostly organic. 🌿 ' : ''}Weakest on ${worst.factor.toLowerCase()}.`,
    ingredients: fibres.map(f => ({name: `${f.pct}% ${F[f.fibre][0]}`, flag: F[f.fibre][1] === 'synthetic' ? 'caution' : /organic|recycled|linen|hemp|lyocell/.test(f.fibre) ? 'good' : /angora|fur/.test(f.fibre) ? 'avoid' : 'neutral', note: F[f.fibre][4]})),
    animal: {level: aw.level === 'none' ? 'none' : aw.level, points: aw.points, penalty: aw.penalty, badge: aw.badge, main: aw.main, certified: false},
    animalPenalty: awCount ? aw.penalty : 0,
    env: {grade: 'ABCDE'[eIdx], source: 'Estimated', points: envPoints, idx: eIdx, penalty: 0},
    fibres, organicShare, synth
  });
  return r;
}

window.FSCloth = { F, NAMES, CERTS, TREAT, parseLabel, analyse };
})();
