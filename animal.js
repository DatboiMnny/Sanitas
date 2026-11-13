/* Sanitas — animal welfare & cruelty-free assessment.
   Cosmetics: animal testing certification (Leaping Bunny / Choose Cruelty Free / PETA) + animal-derived ingredients.
   Food: how animal ingredients are likely farmed, sustainable fishing, palm oil & wildlife. */
(function(){
'use strict';
// Small backup list of brand-wide certifications (checked Nov 2026). Database labels take priority.
const BRANDS = [
  [/\bgarnier\b/, 'Leaping Bunny', 'All Garnier products worldwide are Leaping Bunny approved.'],
  [/\bsukin\b/, 'Leaping Bunny', 'Sukin is Leaping Bunny approved.'],
  [/\bthe body shop\b/, 'Leaping Bunny', ''],
  [/\be\.?l\.?f\.?\b|\belf cosmetics\b/, 'Leaping Bunny', ''],
  [/\bdr\.? bronner/, 'Leaping Bunny', ''],
  [/\bdove\b/, 'PETA', 'PETA-approved. PETA doesn\'t audit suppliers the way Leaping Bunny does.']
];

function certsOf(labels){
  const c = [];
  if (/leaping-bunny|cruelty-free-international/.test(labels)) c.push('Leaping Bunny');
  if (/choose-cruelty-free/.test(labels)) c.push('Choose Cruelty Free');
  if (/peta/.test(labels)) c.push('PETA');
  if (/cruelty-free|not-tested-on-animals|no-animal-testing/.test(labels) && !c.length) c.push('Cruelty-free claim');
  return c;
}

function cosmetic(p, ingText, me){
  const labels = (p.labels_tags || []).join(' ').toLowerCase();
  const brand = (p.brands || '').toLowerCase();
  const cfOnly = (me.animal || []).includes('Cruelty-free only');
  const certs = certsOf(labels);
  let brandNote = '';
  if (!certs.length){ const b = BRANDS.find(x => x[0].test(brand)); if (b){ certs.push(b[1]); brandNote = b[2]; } }
  const vegan = /\bvegan\b/.test(labels);
  const t = ingText.toLowerCase();
  const animalIng = [];
  if (/carmine|ci 75470|cochineal/.test(t)) animalIng.push(['Carmine', 'Red colour made from crushed cochineal insects.']);
  if (/squalene\b/.test(t)) animalIng.push(['Squalene', 'Often from shark liver oil (plant-based squalane is the alternative).']);
  if (/snail secretion|snail mucin/.test(t)) animalIng.push(['Snail mucin', 'Collected from farmed snails.']);
  if (/lanolin/.test(t)) animalIng.push(['Lanolin', 'From sheep\'s wool grease.']);
  if (/beeswax|cera alba|\bhoney\b|\bmel\b|propolis|royal jelly/.test(t)) animalIng.push(['Bee products', 'Beeswax, honey or propolis.']);
  if (/collagen|keratin|elastin/.test(t)) animalIng.push(['Collagen / keratin', 'Usually from animal skin, hooves or feathers.']);
  if (/\bsilk\b|serica|sericin/.test(t)) animalIng.push(['Silk', 'Silkworms are usually killed to harvest it.']);
  if (/guanine/.test(t)) animalIng.push(['Guanine', 'Shimmer made from fish scales.']);
  if (/tallow|sodium tallowate/.test(t)) animalIng.push(['Tallow', 'Animal fat.']);

  const points = [];
  let level, penalty = 0, main = '';
  if (certs.length){
    level = certs[0] === 'PETA' || certs[0] === 'Cruelty-free claim' ? 'good' : 'great';
    points.push(`🐰 ${certs[0]}${certs[0] === 'Cruelty-free claim' ? ' on the pack (no named certifier)' : ' certified — not tested on animals'}.${brandNote ? ' ' + brandNote : ''}`);
  } else {
    level = 'unknown';
    points.push('No cruelty-free certification found. That doesn\'t prove it\'s tested on animals — look for the Leaping Bunny logo or check crueltyfreeinternational.org.');
    if (cfOnly){ penalty = 6; main = points[0]; }
  }
  if (vegan) points.push('🌱 Labelled vegan — no animal ingredients.');
  animalIng.forEach(a => points.push(`🐾 ${a[0]}: ${a[1]}`));
  if (animalIng.length && !vegan){
    penalty += Math.min(animalIng.length * 2, 4);
    if (!main) main = `🐾 ${animalIng[0][0]}: ${animalIng[0][1]}`;
    if (level === 'great') level = 'good';
  }
  if (/squalene\b/.test(t)){ penalty += 2; if (level !== 'unknown') level = 'some'; }
  const badge = certs.length ? (certs[0] === 'Cruelty-free claim' ? '🐰 Cruelty-free claim' : '🐰 Cruelty-free · ' + certs[0]) : '🐰 Not certified cruelty-free';
  return {level, points, penalty, badge, main: main || points[0], certified: certs.length > 0};
}

function food(p, ingText){
  const labels = (p.labels_tags || []).join(' ').toLowerCase();
  const t = ingText.toLowerCase();
  const ana = p.ingredients_analysis_tags || [];
  const vegan = ana.includes('en:vegan') || /\bvegan\b/.test(labels);
  const freeRange = /free-range|free range|pasture-raised|pastured/.test(labels);
  const organic = /organic|\bbio\b/.test(labels);
  const welfare = /rspca|certified-humane|humane|animal-welfare|better-chicken|global-animal-partnership|beter-leven/.test(labels);
  const cageFree = /cage-free|barn-laid|barn-eggs/.test(labels);
  const msc = /\bmsc\b|en:msc|\basc\b|marine-stewardship|aquaculture-stewardship|dolphin-safe|sustainable-fishing|best-aquaculture/.test(labels);
  const rspo = /rspo|sustainable-palm/.test(labels);
  const goodLabel = freeRange || organic || welfare;
  const points = []; let worst = 0, main = ''; // 0 none, 1 low, 2 some, 3 high
  const add = (lvl, txt) => { points.push(txt); if (lvl > worst || !main){ main = txt; } worst = Math.max(worst, lvl); };

  if (vegan && !/\b(egg|milk|honey|gelatin)/.test(t)){
    points.push('🌱 No animal ingredients.');
  } else {
    if (/\beggs?\b|egg yolk|egg white|whole egg|egg powder|albumen/.test(t)){
      if (freeRange || organic) add(1, '🥚 Free-range or organic eggs ✓.');
      else if (cageFree) add(1, '🥚 Cage-free / barn eggs — better than cages, but hens stay indoors.');
      else add(2, '🥚 Contains eggs with no free-range label — in processed foods these are often from caged hens.');
    }
    if (/chicken|poultry|turkey|\bduck\b/.test(t)){
      if (goodLabel) add(1, '🐔 Higher-welfare poultry (free-range / RSPCA / organic) ✓.');
      else add(3, '🐔 Chicken with no welfare label — most conventional meat chickens are fast-growing breeds raised in crowded sheds.');
    }
    if (/\bpork\b|\bham\b|bacon|prosciutto|salami|pancetta|chorizo|\bpig\b|\blard\b|gelatine?\b|gelatin/.test(t)){
      if (goodLabel) add(1, '🐖 Higher-welfare pork (free-range / outdoor-bred / organic) ✓.');
      else add(3, '🐖 Pork or gelatine with no welfare label — conventional pigs are usually kept indoors in crowded pens, and many sows spend time in farrowing crates.');
    }
    if (/\bveal\b/.test(t)) add(2, '🐄 Veal — calves raised for meat; welfare varies a lot by farming system.');
    else if (/\bbeef\b|\blamb\b|mutton|\bgoat\b/.test(t)) add(1, '🐄 Beef / lamb — in Australia mostly raised on pasture, though some beef is grain-finished in feedlots.');
    if (/\bmilk\b|cream|cheese|butter|whey|casein|yoghurt|yogurt|lactose|milk solids|\bghee\b/.test(t)){
      add(1, organic ? '🥛 Organic dairy ✓ — cows must have pasture access.' : '🥛 Dairy — main welfare issues are separating calves early and surplus "bobby" calves.');
    }
    if (/\bfish\b|tuna|salmon|prawn|shrimp|anchov|sardine|mackerel|\bcod\b|hoki|squid|\bcrab\b|mussel|oyster|fish oil|krill/.test(t)){
      if (msc) add(1, '🐟 Certified sustainable seafood (MSC / ASC / dolphin-safe) ✓.');
      else add(2, '🐟 Seafood with no sustainability label — risk of overfishing and bycatch (dolphins, turtles, sharks).');
    }
    if (/foie gras/.test(t)) add(3, '🦆 Foie gras — made by force-feeding ducks or geese (banned to produce in Australia).');
    if (/carmine|cochineal|\(\s*120\s*\)|\be120\b/.test(t)) add(1, '🐞 Carmine (120) — red colour made from crushed insects.');
    if (/shellac|\(\s*904\s*\)|\be904\b/.test(t)) add(1, '🐞 Shellac (904) — glaze made from lac insect secretions.');
    if (/\bhoney\b/.test(t)) points.push('🐝 Contains honey.');
  }
  if (/\bpalm\b/.test(t)){
    if (rspo) points.push('🦧 Certified sustainable palm oil (RSPO) ✓.');
    else add(2, '🦧 Palm oil with no sustainability label — linked to rainforest clearing and loss of orangutan habitat.');
  }
  if (!points.length) points.push('No animal ingredients spotted.');
  const level = ['none', 'low', 'some', 'high'][worst];
  const penalty = [0, 0, 5, 10][worst];
  const badge = level === 'none' ? '🐾 No animal welfare concerns' : level === 'low' ? '🐾 Low welfare concern' : level === 'some' ? '🐾 Some welfare concerns' : '🐾 High welfare concern';
  return {level, points, penalty, badge, main: main || points[0]};
}

window.FSAnimal = { cosmetic, food };
})();
