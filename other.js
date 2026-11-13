/* Sanitas — pet food (Open Pet Food Facts) and household products (Open Products Facts). */
(function(){
'use strict';
const label = s => s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Mediocre' : s >= 20 ? 'Poor' : 'Bad';
function ingList(p){
  const en = i => i && i.id && /^en:/.test(i.id) ? i.id.slice(3).replace(/-/g, ' ') : '';
  const list = (p.ingredients || []).filter(i => i.text).map(i => { const e = en(i); return e && e.toLowerCase() !== i.text.toLowerCase() ? `${i.text} (${e})` : i.text; });
  if (list.length) return list;
  const t = (p.ingredients_text_en || p.ingredients_text || '').replace(/^(ingredients?|composition)\s*[:\-]\s*/i, '');
  return t.split(/,(?![^(]*\))|;/).map(s => s.trim()).filter(s => s.length > 1);
}
function base(p, nameOf){
  return {code: p.code, name: nameOf(p), brand: p.brands || '', qty: p.quantity || '', img: p.image_front_url || p.image_front_small_url || '', cats: p.categories_tags || []};
}
function finish(r, breakdown, caps, warnings){
  let score = Math.max(0, Math.min(100, breakdown.reduce((a, b) => a + b.points, 0)));
  for (const [cond, max, why] of caps) if (cond && score > max){ score = max; r.capNote = why; }
  const worst = breakdown.slice().sort((a, b) => a.points / a.max - b.points / b.max)[0];
  const best = breakdown.slice().sort((a, b) => b.points / b.max - a.points / a.max)[0];
  r.score = score; r.breakdown = breakdown; r.warnings = warnings;
  r.summary = `${label(score)} pick. Strongest on ${best.factor.toLowerCase()}, weakest on ${worst.factor.toLowerCase()}.` + (r.capNote ? ' ' + r.capNote : '') + (warnings.length ? ' ⚠️ ' + warnings[0] : '');
  return r;
}

// ---------------- PET FOOD ----------------
const PET_TOXIC = [
  [/xylitol|birch sugar/, 'Xylitol', 'both', 'Extremely toxic to dogs — causes a dangerous drop in blood sugar and liver failure.'],
  [/\bgrapes?\b|raisins?|sultanas?|currants?/, 'Grapes / raisins', 'dog', 'Can cause sudden kidney failure in dogs.'],
  [/chocolate|coco[ao]\b|cacao|theobromine/, 'Chocolate / cocoa', 'both', 'Theobromine is toxic to dogs and cats.'],
  [/\bonions?\b|onion powder/, 'Onion', 'both', 'Damages red blood cells (anaemia) in dogs and cats.'],
  [/macadamia/, 'Macadamia nuts', 'dog', 'Causes weakness, vomiting and tremors in dogs.'],
  [/caffeine|coffee|guarana/, 'Caffeine', 'both', 'Toxic to pets.'],
  [/propylene glycol/, 'Propylene glycol', 'cat', 'Damages cats\' red blood cells — banned in cat food in the US.'],
  [/\balcohol\b|ethanol|\bhops\b/, 'Alcohol / hops', 'both', 'Toxic to pets; hops can cause dangerous overheating in dogs.']
];
const PET_PRESERV = [
  [/ethoxyquin|e324\b/, 'Ethoxyquin', 'high', 'Synthetic preservative not permitted in EU pet food; health concerns in animal studies.'],
  [/\bbha\b|butylated hydroxyanisole|e320\b/, 'BHA', 'high', 'IARC "possibly carcinogenic"; avoidable in pet food.'],
  [/\bbht\b|butylated hydroxytoluene|e321\b/, 'BHT', 'moderate', 'Synthetic preservative with mixed evidence.'],
  [/propyl gallate|e310\b/, 'Propyl gallate', 'moderate', 'Synthetic antioxidant.'],
  [/sodium nitrite|e250\b/, 'Sodium nitrite', 'high', 'Forms nitrosamines; used in some meaty treats.'],
  [/\bcolou?rs?\b|colou?rants?|e1[0-6]\d\b|tartrazine|allura|sunset yellow|brilliant blue|titanium dioxide|caramel colou?r/, 'Artificial colours', 'moderate', 'Pets don\'t care what colour food is — colours are only there for the owner.'],
  [/\bsugar\b|sucrose|corn syrup|glucose syrup|molasses|caramel\b|dextrose/, 'Added sugar', 'moderate', 'Unnecessary for pets; adds empty calories and dental risk.'],
  [/\bsalt\b|sodium chloride/, 'Added salt', 'low', 'Needed in small amounts; high levels aren\'t ideal.']
];
function pet(p, me, h){
  const r = base(p, h.nameOf); r.cosmetic = true; r.kindLabel = '🐾 Pet food';
  const ings = ingList(p); const t = ings.join(', ').toLowerCase(); const first3 = ings.slice(0, 3).join(', ').toLowerCase();
  const allTxt = ((p.categories_tags || []).join(' ') + ' ' + h.nameOf(p)).toLowerCase();
  const species = /\bcat\b|cats|kitten|feline|en:cat-food/.test(allTxt) ? 'cat' : /\bdog\b|dogs|puppy|canine|en:dog-food/.test(allTxt) ? 'dog' : 'pet';
  r.kindLabel = species === 'cat' ? '🐱 Cat food' : species === 'dog' ? '🐶 Dog food' : '🐾 Pet food';
  if (!ings.length){ r.noIngredients = true; return r; }
  const warnings = [], concerns = [], good = [], effects = [];
  // 1. Pet safety (25)
  let safety = 25; let toxic = false;
  for (const [re, name, who, note] of PET_TOXIC){
    if (!re.test(t)) continue;
    if (who !== 'both' && species !== 'pet' && who !== species) continue;
    const severe = !/onion/.test(name) || /\bonions?\b/.test(first3);
    safety -= severe ? 25 : 10; toxic = toxic || severe;
    concerns.push({label: name, level: 'high', note}); warnings.push(`${name} — ${note}`);
  }
  if (/garlic/.test(t)){ safety -= 6; concerns.push({label: 'Garlic', level: 'moderate', note: 'Toxic to dogs and cats in larger amounts; small amounts in pet food are debated.'}); }
  safety = Math.max(0, safety);
  // 2. Ingredient quality (35)
  let iq = 25; const iqNotes = [];
  const named = /^(fresh |deboned |dried )?(chicken|beef|lamb|turkey|salmon|tuna|kangaroo|duck|venison|fish|ocean fish|white fish|pork|rabbit|sardine|mackerel|whitebait)\b/;
  if (named.test((ings[0] || '').toLowerCase())){ iq += 8; good.push({label: 'Named meat first', note: `${ings[0]} is the main ingredient.`}); iqNotes.push('named meat is the main ingredient'); }
  else if (/meat|animal|poultry|fish/.test((ings[0] || '').toLowerCase())){ iq += 2; iqNotes.push('unnamed meat source first'); }
  else { iq -= 5; iqNotes.push('not meat-first'); }
  if (/by-?products?|derivatives?|animal digest|meat and animal|meat meal|poultry meal|offal/.test(t)){ iq -= 7; concerns.push({label: 'By-products / derivatives', level: 'moderate', note: 'Unnamed animal parts — quality varies a lot and you can\'t tell what\'s in it.'}); iqNotes.push('by-products / derivatives'); }
  const fillers = (first3.match(/\b(corn|maize|wheat|soy|soya|cereals?|grain|rice|wheat flour|corn gluten)\b/g) || []).length;
  if (fillers){ iq -= Math.min(fillers * 4, 8); iqNotes.push(`${fillers} cheap grain filler${fillers > 1 ? 's' : ''} in the top 3`); }
  if (species === 'cat' && !named.test((ings[0] || '').toLowerCase())){ iq -= 4; iqNotes.push('cats are carnivores and need meat-first food'); }
  if (/mixed tocopherols|rosemary extract|vitamin e/.test(t)){ iq += 2; good.push({label: 'Natural preservatives', note: 'Mixed tocopherols (vitamin E) or rosemary.'}); }
  if (/taurine/.test(t) && species === 'cat') good.push({label: 'Taurine', note: 'Essential for cats\' heart and eyes.'});
  iq = Math.max(0, Math.min(35, iq));
  // 3. Additives & preservatives (30)
  let add = 30;
  for (const [re, name, level, note] of PET_PRESERV){ if (re.test(t)){ add -= level === 'high' ? 12 : level === 'moderate' ? 6 : 2; concerns.push({label: name, level, note}); } }
  add = Math.max(0, add);
  // 4. Nutrition (10)
  const n = p.nutriments || {}; const prot = n.proteins_100g, fat = n.fat_100g, moist = n['moisture_100g'];
  let nut = 6, nutNote = 'No nutrition data in the database.';
  if (prot != null){
    const dry = moist != null ? prot / (1 - moist / 100) : (prot > 15 ? prot : prot / 0.22);
    const need = species === 'cat' ? 30 : 22;
    nut = dry >= need + 8 ? 10 : dry >= need ? 8 : dry >= need - 6 ? 5 : 2;
    nutNote = `About ${Math.round(dry)}% protein (dry matter). ${species === 'cat' ? 'Cats' : 'Dogs'} generally need at least ${need}%.`;
  }
  const breakdown = [
    {factor: 'Pet safety', points: safety, max: 25, note: toxic ? 'Contains something toxic to pets!' : concerns.some(c => c.label === 'Garlic') ? 'Contains garlic.' : 'No ingredients known to be toxic to pets. 👍'},
    {factor: 'Ingredient quality', points: iq, max: 35, note: iqNotes.length ? iqNotes[0][0].toUpperCase() + iqNotes.join('; ').slice(1) + '.' : 'Decent ingredients.'},
    {factor: 'Additives & preservatives', points: add, max: 30, note: concerns.filter(c => PET_PRESERV.some(x => x[1] === c.label)).map(c => c.label).join(', ') || 'No artificial preservatives, colours or added sugar. 👍'},
    {factor: 'Nutrition', points: nut, max: 10, note: nutNote}
  ];
  if (/complete|balanced|aafco|pfiaa|as\s?4987/.test((t + ' ' + allTxt + ' ' + (p.labels_tags || []).join(' ')))) effects.push('✅ Labelled complete & balanced — it can be fed as the main diet.');
  else effects.push('ℹ️ No "complete & balanced" claim found — it may be a treat or complementary food, not a full diet.');
  if (species === 'cat') effects.push('🐱 Cats need meat-based food with taurine. Wet food helps their hydration.');
  if (species === 'dog') effects.push('🐶 Watch treats — they shouldn\'t be more than about 10% of daily calories.');
  concerns.filter(c => c.level !== 'low').slice(0, 4).forEach(c => effects.push(`⚠️ ${c.label}: ${c.note}`));
  r.concerns = concerns.filter(c => c.level !== 'low'); r.goodList = good; r.effects = effects; r.flags = [];
  r.ingredients = ings.slice(0, 40).map(i => {
    const l = i.toLowerCase();
    const tox = PET_TOXIC.find(x => x[0].test(l)); if (tox) return {name: i, flag: 'avoid', note: tox[3]};
    const pr = PET_PRESERV.find(x => x[0].test(l)); if (pr) return {name: i, flag: pr[2] === 'high' ? 'avoid' : 'caution', note: pr[3]};
    if (/by-?product|derivative|digest/.test(l)) return {name: i, flag: 'caution', note: 'Unnamed animal parts.'};
    if (named.test(l)) return {name: i, flag: 'good', note: ''};
    return {name: i, flag: 'neutral', note: ''};
  });
  r.ingText = t;
  return finish(r, breakdown, [[toxic, 20, 'Capped at 20 because it contains something toxic to pets.']], warnings);
}

// ---------------- HOUSEHOLD ----------------
const HH = [
  // [regex, label, group: health|irritant|env, level, note]
  [/sodium hypochlorite|\bbleach\b|chlorine/, 'Bleach (sodium hypochlorite)', 'health', 'high', 'Corrosive. Never mix with ammonia, vinegar or acids — creates toxic gas.'],
  [/\bammonia\b|ammonium hydroxide/, 'Ammonia', 'health', 'high', 'Irritates lungs and eyes. Never mix with bleach.'],
  [/hydrochloric acid|sulfuric acid|sulphuric acid|phosphoric acid|oxalic acid/, 'Strong acid', 'health', 'high', 'Corrosive — use gloves and ventilation.'],
  [/sodium hydroxide|potassium hydroxide|caustic/, 'Caustic (lye)', 'health', 'high', 'Corrosive — can burn skin and eyes.'],
  [/benzalkonium chloride|didecyldimethylammonium|alkyl dimethyl benzyl ammonium|quaternary ammonium|\bquats?\b/, 'Quats (disinfectant)', 'health', 'moderate', 'Linked to asthma with frequent use; harmful to aquatic life.'],
  [/2-butoxyethanol|butyl glycol|butoxydiglycol/, 'Glycol ether', 'health', 'moderate', 'Solvent that can irritate and be absorbed through skin.'],
  [/formaldehyde|dmdm hydantoin|quaternium-15|bronopol|imidazolidinyl urea/, 'Formaldehyde (or releaser)', 'health', 'high', 'Known carcinogen and skin sensitiser.'],
  [/phthalate/, 'Phthalates', 'health', 'high', 'Hormone disruptors, often hidden in fragrance.'],
  [/triclosan/, 'Triclosan', 'health', 'high', 'Antibacterial with hormone and resistance concerns.'],
  [/methylisothiazolinone|methylchloroisothiazolinone|benzisothiazolinone|octylisothiazolinone/, 'Isothiazolinone preservative', 'irritant', 'high', 'Common cause of skin allergy.'],
  [/\bparfum\b|\bfragrance\b|perfume/, 'Fragrance', 'irritant', 'moderate', 'Undisclosed blend — common cause of allergy and asthma triggers.'],
  [/sodium lauryl sulfate|sodium laureth sulfate/, 'Sulfate surfactant', 'irritant', 'low', 'Can dry and irritate skin.'],
  [/limonene|linalool|citronellol|geraniol|hexyl cinnamal|coumarin/, 'Fragrance allergen', 'irritant', 'low', 'Listed fragrance allergen.'],
  [/phosphate|tripolyphosphate/, 'Phosphates', 'env', 'moderate', 'Feed algal blooms in rivers and lakes.'],
  [/optical brightener|fluorescent brightener|stilbene|disodium distyrylbiphenyl/, 'Optical brighteners', 'env', 'moderate', 'Stay on clothes and wash into waterways; poorly biodegradable.'],
  [/nonylphenol|alkylphenol ethoxylate/, 'Nonylphenol ethoxylates', 'env', 'high', 'Hormone disruptor in fish — banned in EU detergents.'],
  [/polyethylene\b(?! glycol)|acrylates copolymer|polyacrylate|polystyrene|microbeads/, 'Plastic polymers', 'env', 'moderate', 'Synthetic polymers that wash down the drain.'],
  [/\bedta\b|tetrasodium edta|disodium edta/, 'EDTA', 'env', 'low', 'Persists in waterways and can mobilise heavy metals.'],
  [/perfluoro|polyfluoro|ptfe|pfas/, 'PFAS', 'env', 'high', '"Forever chemicals" that never break down.']
];
function household(p, me, h){
  const r = base(p, h.nameOf); r.cosmetic = true; r.kindLabel = '🧽 Household';
  const ings = ingList(p); const t = ings.join(', ').toLowerCase();
  const labels = (p.labels_tags || []).join(' ');
  const pack = ((p.packaging_tags || []).join(' ') + ' ' + (p.packaging || '')).toLowerCase();
  const allTxt = ((p.categories_tags || []).join(' ') + ' ' + h.nameOf(p)).toLowerCase();
  if (!ings.length){ r.noIngredients = true; return r; }
  const hits = HH.filter(x => x[0].test(t)).map(x => ({label: x[1], group: x[2], level: x[3], note: x[4]}));
  const cnt = (g, l) => hits.filter(x => x.group === g && x.level === l).length;
  const warnings = [];
  const health = Math.max(0, 35 - cnt('health', 'high') * 12 - cnt('health', 'moderate') * 6);
  const irr = Math.max(0, 20 - cnt('irritant', 'high') * 8 - cnt('irritant', 'moderate') * 4 - Math.min(cnt('irritant', 'low'), 3));
  let env = 30 - cnt('env', 'high') * 12 - cnt('env', 'moderate') * 6 - cnt('env', 'low') * 2;
  const eco = /eu-ecolabel|nordic-swan|good-environmental-choice|geca|ecocert|cradle-to-cradle|safer-choice/.test(labels);
  if (eco) env += 6;
  if (/biodegradable|plant-based/.test(labels + ' ' + allTxt)) env += 2;
  env = Math.max(0, Math.min(30, env));
  let pk = 15; const pkNotes = [];
  if (/aerosol|spray-can/.test(pack) || /\bbutane\b|\bpropane\b/.test(t)){ pk -= 6; pkNotes.push('aerosol can'); }
  if (/plastic|hdpe|\bpet\b|\bpp\b|pouch|trigger/.test(pack)){ pk -= 4; pkNotes.push('plastic packaging'); }
  if (/refill|concentrate/.test(labels + ' ' + allTxt)){ pk += 3; pkNotes.push('✓ refill / concentrate'); }
  if (/cardboard|paper|glass|aluminium/.test(pack)) pkNotes.push('✓ recyclable packaging');
  pk = Math.max(0, Math.min(15, pk));
  if (hits.some(x => x.label.startsWith('Bleach')) && hits.some(x => x.label === 'Ammonia')) warnings.push('Contains both bleach and ammonia — this combination releases toxic gas.');
  if (hits.some(x => x.group === 'health' && x.level === 'high')) warnings.push('Hazardous chemical — keep away from children and pets, use gloves and good ventilation.');
  const breakdown = [
    {factor: 'Health & safety', points: health, max: 35, note: hits.filter(x => x.group === 'health').map(x => x.label).join(', ') || 'No hazardous chemicals found. 👍'},
    {factor: 'Irritants & allergens', points: irr, max: 20, note: hits.filter(x => x.group === 'irritant').map(x => x.label).join(', ') || 'No common irritants. 👍'},
    {factor: 'Environment', points: env, max: 30, note: (hits.filter(x => x.group === 'env').map(x => x.label).join(', ') || 'No major waterway pollutants found') + (eco ? '. ✓ Eco-label.' : '.')},
    {factor: 'Packaging', points: pk, max: 15, note: pkNotes.length ? pkNotes[0][0].toUpperCase() + pkNotes.join(', ').slice(1) + '.' : 'No packaging info.'}
  ];
  r.concerns = hits.filter(x => x.level !== 'low'); r.goodList = eco ? [{label: 'Eco-label', note: 'Independently certified.'}] : [];
  r.effects = hits.filter(x => x.level !== 'low').slice(0, 5).map(x => `⚠️ ${x.label}: ${x.note}`);
  if (!r.effects.length) r.effects.push('Nothing of real concern found. 👍');
  r.effects.push('🧤 Store cleaning products up high, in their original bottles, away from food.');
  r.flags = [];
  r.ingredients = ings.slice(0, 40).map(i => { const x = HH.find(x => x[0].test(i.toLowerCase())); return x ? {name: i, flag: x[3] === 'high' ? 'avoid' : 'caution', note: `${x[1]} — ${x[4]}`} : {name: i, flag: 'neutral', note: ''}; });
  r.ingText = t;
  return finish(r, breakdown, [[hits.some(x => x.level === 'high' && x.group !== 'irritant'), 59, 'Capped at 59 because of a hazardous ingredient.']], warnings);
}

window.FSOther = { pet, household };
})();
