/* Sanitas — environmental impact + barcode country (GS1 prefixes). */
(function(){
'use strict';
// ---------- GS1 prefix → country the barcode was registered in (not always where it's made) ----------
const GS1 = [
  [0,19,'USA / Canada'],[20,29,'In-store code'],[30,39,'USA'],[40,49,'In-store code'],[50,59,'Coupon'],[60,139,'USA / Canada'],[200,299,'In-store code'],
  [300,379,'France'],[380,380,'Bulgaria'],[383,383,'Slovenia'],[385,385,'Croatia'],[387,387,'Bosnia & Herzegovina'],[389,389,'Montenegro'],
  [400,440,'Germany'],[450,459,'Japan'],[460,469,'Russia'],[470,470,'Kyrgyzstan'],[471,471,'Taiwan'],[474,474,'Estonia'],[475,475,'Latvia'],
  [476,476,'Azerbaijan'],[477,477,'Lithuania'],[478,478,'Uzbekistan'],[479,479,'Sri Lanka'],[480,480,'Philippines'],[481,481,'Belarus'],
  [482,482,'Ukraine'],[484,484,'Moldova'],[485,485,'Armenia'],[486,486,'Georgia'],[487,487,'Kazakhstan'],[489,489,'Hong Kong'],[490,499,'Japan'],
  [500,509,'UK'],[520,521,'Greece'],[528,528,'Lebanon'],[529,529,'Cyprus'],[530,530,'Albania'],[531,531,'North Macedonia'],[535,535,'Malta'],
  [539,539,'Ireland'],[540,549,'Belgium / Luxembourg'],[560,560,'Portugal'],[569,569,'Iceland'],[570,579,'Denmark'],[590,590,'Poland'],
  [594,594,'Romania'],[599,599,'Hungary'],[600,601,'South Africa'],[603,603,'Ghana'],[608,608,'Bahrain'],[609,609,'Mauritius'],[611,611,'Morocco'],
  [613,613,'Algeria'],[615,615,'Nigeria'],[616,616,'Kenya'],[619,619,'Tunisia'],[621,621,'Syria'],[622,622,'Egypt'],[624,624,'Libya'],
  [625,625,'Jordan'],[626,626,'Iran'],[627,627,'Kuwait'],[628,628,'Saudi Arabia'],[629,629,'UAE'],[630,630,'Qatar'],[640,649,'Finland'],
  [680,681,'China'],[690,699,'China'],[700,709,'Norway'],[729,729,'Israel'],[730,739,'Sweden'],[740,740,'Guatemala'],[741,741,'El Salvador'],
  [742,742,'Honduras'],[743,743,'Nicaragua'],[744,744,'Costa Rica'],[745,745,'Panama'],[746,746,'Dominican Republic'],[750,750,'Mexico'],
  [754,755,'Canada'],[759,759,'Venezuela'],[760,769,'Switzerland'],[770,771,'Colombia'],[773,773,'Uruguay'],[775,775,'Peru'],[777,777,'Bolivia'],
  [778,779,'Argentina'],[780,780,'Chile'],[784,784,'Paraguay'],[786,786,'Ecuador'],[789,790,'Brazil'],[800,839,'Italy'],[840,849,'Spain'],
  [850,850,'Cuba'],[858,858,'Slovakia'],[859,859,'Czechia'],[860,860,'Serbia'],[865,865,'Mongolia'],[867,867,'North Korea'],[868,869,'Turkey'],
  [870,879,'Netherlands'],[880,880,'South Korea'],[883,883,'Myanmar'],[884,884,'Cambodia'],[885,885,'Thailand'],[888,888,'Singapore'],
  [890,890,'India'],[893,893,'Vietnam'],[896,896,'Pakistan'],[899,899,'Indonesia'],[900,919,'Austria'],[930,939,'Australia'],[940,949,'New Zealand'],
  [955,955,'Malaysia'],[958,958,'Macau'],[977,977,'Magazine (ISSN)'],[978,979,'Book (ISBN)']
];
function barcodeCountry(code){
  const s = String(code || '');
  if (!/^\d+$/.test(s) || s.length < 8) return null;
  if (s.length <= 5) return null;
  if (s.length === 8) return null; // EAN-8 prefixes aren't reliable
  const e13 = s.length === 12 ? '0' + s : s.length === 14 ? s.slice(1) : s;
  const pre = parseInt(e13.slice(0, 3));
  const hit = GS1.find(r => pre >= r[0] && pre <= r[1]);
  const ownBrand = e13.startsWith('9300633') ? 'Woolworths' : e13.startsWith('9300601') ? 'Coles' : null;
  return hit ? {country: hit[2], prefix: e13.slice(0, 3), ownBrand} : null;
}

// ---------- Environmental impact ----------
const GRADE_TXT = {'a-plus':'A+', a:'A', b:'B', c:'C', d:'D', e:'E', f:'F'};
function food(p, ingText, extra){
  const n = String(p.environmental_score_grade || p.ecoscore_grade || '').toLowerCase();
  const labels = (p.labels_tags || []).join(' ');
  const pack = ((p.packaging_tags || []).join(' ') + ' ' + (p.packaging || '')).toLowerCase();
  const t = (ingText || '').split(' | ')[0];
  const cats = (p.categories_tags || []).join(' ');
  const points = [];
  let grade = GRADE_TXT[n] || null, source = grade ? 'Green-Score (Open Food Facts)' : 'Estimated';
  // what drives impact
  const first3 = t.split(/,(?![^(]*\))/).slice(0, 3).join(',');
  if (/\bbeef\b|\blamb\b|mutton|\bveal\b/.test(first3) || /en:beef|en:lamb/.test(cats)) points.push('🐄 Beef and lamb have the highest climate impact of any food (methane, land use).');
  else if (/cheese|butter|cream\b/.test(first3) || /en:cheeses|en:butters/.test(cats)) points.push('🧀 Cheese and butter take a lot of milk to make — high footprint.');
  else if (/\bpork\b|bacon|\bham\b|chicken|poultry|turkey|\begg/.test(first3)) points.push('🐔 Pork, chicken and eggs: medium footprint (feed and land use).');
  else if (/\bfish\b|tuna|salmon|prawn|shrimp/.test(first3)) points.push('🐟 Seafood impact depends on how it was caught or farmed.');
  else if (/coco[ao]|chocolate|coffee/.test(first3) || /chocolate|coffees/.test(cats)) points.push('🍫 Cocoa and coffee are linked to tropical deforestation.');
  else if (/\brice\b/.test(first3)) points.push('🍚 Rice paddies release methane — moderate footprint.');
  else if (t || p._produce) points.push('🌱 Mostly plant-based ingredients — lower climate impact.');
  if (/\bpalm\b/.test(t) && !/rspo|sustainable-palm/.test(labels)) points.push('🦧 Palm oil without RSPO certification — deforestation risk.');
  if (/organic/.test(labels)) points.push('🌿 Organic — fewer synthetic pesticides and fertilisers.');
  if (/air-freight|by-plane|transported-by-plane/.test(labels)) points.push('✈️ Air-freighted — high transport emissions.');
  if (extra && extra.imported) points.push(`🚢 ${extra.imported}`);
  if (p._produce) points.push('🛒 Loose — no packaging.');
  else if (/plastic|pet\b|polystyrene|film|tray|pouch/.test(pack)) points.push('🧴 Plastic packaging — check whether it\'s recyclable in your area (REDcycle / kerbside).');
  else if (/glass|metal|can\b|aluminium|carton|paper|cardboard/.test(pack)) points.push('♻️ Glass, metal, carton or paper packaging — widely recyclable.');
  if (!grade){
    // simple estimate from the main ingredients
    let s = 2; // 0=A … 4=E
    if (p._produce) s = 0;
    else if (/\bbeef\b|\blamb\b|mutton|\bveal\b/.test(first3) || /en:beef|en:lamb/.test(cats)) s = 4;
    else if (/cheese|butter/.test(first3) || /en:cheeses|en:butters/.test(cats)) s = 3;
    else if (/\bpork\b|bacon|\bham\b|chicken|poultry|coco[ao]|chocolate|coffee|\bfish\b|tuna|salmon|prawn/.test(first3)) s = 3;
    else if (/milk|yoghurt|yogurt|\begg|\brice\b/.test(first3)) s = 2;
    else if (t && !/milk|cream|whey|cheese|egg|meat|chicken|beef|pork|fish|gelatin/.test(t)) s = 1;
    if (/\bpalm\b/.test(t) && !/rspo/.test(labels)) s = Math.min(4, s + 1);
    if (/plastic|polystyrene/.test(pack) && s < 4 && !p._produce) s = Math.min(4, s + (s <= 1 ? 1 : 0));
    if (/organic/.test(labels) && s > 0) s -= 0; // organic noted but not upgraded (evidence on climate is mixed)
    grade = 'ABCDE'[s];
  }
  return finish(grade, source, points);
}
function nonFood(p, kind, ingText){
  const labels = (p.labels_tags || []).join(' ');
  const pack = ((p.packaging_tags || []).join(' ') + ' ' + (p.packaging || '')).toLowerCase();
  const t = (ingText || '').toLowerCase();
  const points = []; let s = 2;
  if (/eu-ecolabel|nordic-swan|good-environmental-choice|geca|ecocert|cradle-to-cradle|safer-choice|natrue|cosmos/.test(labels)){ s -= 1; points.push('🌿 Has an independent eco-label.'); }
  if (/polyethylene\b|nylon-\d|acrylates copolymer|polymethyl methacrylate|glitter|polystyrene/.test(t)){ s += 1; points.push('🧴 Contains plastic polymers that wash down the drain.'); }
  if (/phosphate/.test(t) && kind === 'household'){ s += 1; points.push('💧 Phosphates feed algal blooms in waterways.'); }
  if (/nonylphenol|triclosan|optical brightener|stilbene|perfluoro|ptfe/.test(t)){ s += 1; points.push('🐟 Has ingredients that persist or harm aquatic life.'); }
  if (/cyclopentasiloxane|cyclotetrasiloxane/.test(t)){ s += 1; points.push('🐟 D4/D5 silicones persist in the environment.'); }
  if (/\bpalm\b|palmitate|sodium palm/.test(t) && !/rspo/.test(labels)) points.push('🦧 May contain palm-derived ingredients without RSPO certification.');
  if (/aerosol|spray-can/.test(pack) || /\bbutane\b|\bpropane\b/.test(t)){ s += 1; points.push('💨 Aerosol — propellants add emissions and cans are harder to recycle.'); }
  if (/refill|concentrate/.test(labels + ' ' + (p.product_name || '').toLowerCase())){ s -= 1; points.push('♻️ Refill or concentrate — less packaging.'); }
  if (/plastic|pet\b|hdpe|pump|tube/.test(pack)) points.push('🧴 Plastic packaging.');
  if (/glass|aluminium|metal|cardboard|paper/.test(pack)) points.push('♻️ Recyclable glass, metal or paper packaging.');
  if (kind === 'pet' && /\bbeef\b|\blamb\b|kangaroo/.test(t.split(',').slice(0, 2).join(','))) { s += 1; points.push('🐄 Red-meat based — higher climate impact.'); }
  if (!points.length) points.push('Not enough information to judge — estimate based on the product type.');
  return finish('ABCDE'[Math.max(0, Math.min(4, s))], 'Estimated', points);
}
function finish(grade, source, points){
  const idx = {'A+':0, A:0, B:1, C:2, D:3, E:4, F:4}[grade] ?? 2;
  return {grade, source, points, idx, penalty: [0, 0, 0, 3, 6][idx]};
}
window.FSEnv = { food, nonFood, barcodeCountry };
})();
