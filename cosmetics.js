/* Sanitas — personal care & cosmetics analysis
   Data: Open Beauty Facts (https://world.openbeautyfacts.org). Concern levels follow regulator positions
   (EU SCCS, TGA, IARC) and published research; "mixed evidence" is noted where relevant. */
(function(){
'use strict';
// [regex, label, group, level, note]
// groups: hormone | irritant | concern | plastic | comedo | preg | good | nonvegan | acid
const R = [
  // Hormone disruptors
  [/propylparaben|butylparaben|isobutylparaben|isopropylparaben/, 'Long-chain paraben', 'hormone', 'high', 'Weak oestrogen-like activity. EU restricts propyl/butylparaben and bans isopropyl/isobutyl.'],
  [/methylparaben|ethylparaben/, 'Short-chain paraben', 'hormone', 'low', 'Considered safe at permitted levels by the EU safety committee.'],
  [/benzophenone-3|oxybenzone/, 'Oxybenzone', 'hormone', 'high', 'UV filter absorbed through skin with hormone activity in studies. Also harms coral reefs.'],
  [/ethylhexyl methoxycinnamate|octinoxate/, 'Octinoxate', 'hormone', 'moderate', 'UV filter with hormone activity in animal studies.'],
  [/homosalate/, 'Homosalate', 'hormone', 'moderate', 'UV filter. EU cut its allowed level to 7.34% over hormone concerns.'],
  [/octocrylene/, 'Octocrylene', 'hormone', 'moderate', 'UV filter that can break down into benzophenone over time.'],
  [/triclosan|triclocarban/, 'Triclosan', 'hormone', 'high', 'Antibacterial with hormone-disruption concerns. Banned from hand soaps in the US.'],
  [/phthalate/, 'Phthalate', 'hormone', 'high', 'Linked to hormone disruption, especially in pregnancy.'],
  [/cyclotetrasiloxane|cyclopentasiloxane/, 'Cyclic silicone (D4/D5)', 'hormone', 'moderate', 'EU restricted in wash-off products; D4 is a suspected hormone disruptor and both persist in the environment.'],
  [/butylated hydroxyanisole/, 'BHA (antioxidant)', 'hormone', 'high', 'IARC "possibly carcinogenic" (2B) and a suspected hormone disruptor.'],
  [/resorcinol/, 'Resorcinol', 'hormone', 'moderate', 'Hair-dye ingredient that may affect the thyroid.'],
  // Irritants & allergens
  [/\bparfum\b|\bfragrance\b|\baroma\b/, 'Fragrance', 'irritant', 'moderate', 'The top cause of cosmetic skin allergies. The actual blend isn\'t disclosed.'],
  [/methylchloroisothiazolinone|methylisothiazolinone/, 'MI / MCI preservative', 'irritant', 'high', 'Caused a wave of skin allergies — banned in EU leave-on products.'],
  [/dmdm hydantoin|quaternium-15|imidazolidinyl urea|diazolidinyl urea|bronopol|2-bromo-2-nitropropane|sodium hydroxymethylglycinate/, 'Formaldehyde releaser', 'irritant', 'high', 'Preservative that slowly releases formaldehyde — a skin sensitiser and known carcinogen.'],
  [/p-phenylenediamine/, 'PPD (hair dye)', 'irritant', 'high', 'Strong allergen — can cause severe reactions.'],
  [/sodium lauryl sulfate/, 'SLS', 'irritant', 'moderate', 'Harsh cleanser that can strip and irritate skin.'],
  [/alcohol denat|sd alcohol|denatured alcohol/, 'Drying alcohol', 'irritant', 'moderate', 'Can dry out and irritate skin, especially high up the list.'],
  [/sodium laureth sulfate|ammonium lauryl sulfate|ammonium laureth sulfate/, 'Sulfate cleanser', 'irritant', 'low', 'Milder than SLS but can still dry skin.'],
  [/\blimonene|\blinalool|citronellol|geraniol|eugenol|coumarin|\bcitral\b|hexyl cinnamal|benzyl salicylate|benzyl benzoate|cinnamal|farnesol|hydroxycitronellal|amyl cinnamal|alpha-isomethyl ionone|butylphenyl methylpropional/, 'Fragrance allergen', 'irritant', 'low', 'One of the fragrance allergens the EU requires on labels.'],
  [/cocamidopropyl betaine/, 'Cocamidopropyl betaine', 'irritant', 'low', 'Mild cleanser; occasional allergy.'],
  [/propylene glycol/, 'Propylene glycol', 'irritant', 'low', 'Humectant that can irritate very sensitive skin.'],
  // Other health concerns
  [/formaldehyde|methylene glycol/, 'Formaldehyde', 'concern', 'high', 'Known human carcinogen (IARC Group 1). Found in some hair-straightening treatments.'],
  [/polytetrafluoroethylene|\bptfe\b|perfluoro|polyfluoro/, 'PFAS ("forever chemicals")', 'concern', 'high', 'Build up in the body; linked to immune, liver and hormone effects.'],
  [/\btalc\b/, 'Talc', 'concern', 'moderate', 'IARC classed it "probably carcinogenic" (2A) in 2024 — concern is mainly asbestos contamination and inhaling powder.'],
  [/hydroquinone/, 'Hydroquinone', 'concern', 'high', 'Skin lightener — prescription-only in Australia above 2%, banned in EU cosmetics.'],
  [/coal tar/, 'Coal tar', 'concern', 'high', 'Known carcinogen used in some dandruff shampoos.'],
  [/triethanolamine|diethanolamine|cocamide dea|lauramide dea|cocamide mea/, 'Ethanolamine (DEA/TEA/MEA)', 'concern', 'moderate', 'Can react to form nitrosamines, which are possible carcinogens.'],
  [/\bpeg-\d+|polyethylene glycol|ceteareth-\d+|laureth-\d+|polysorbate/, 'PEG / ethoxylated ingredient', 'concern', 'low', 'May carry traces of 1,4-dioxane (a possible carcinogen) from manufacturing.'],
  [/\bbutane\b|\bisobutane\b|\bpropane\b/, 'Aerosol propellant', 'concern', 'moderate', 'Some aerosol dry shampoos and antiperspirants have been recalled for benzene contamination.'],
  [/alumin(i)?um chlorohydrate|alumin(i)?um zirconium|alumin(i)?um chloride|alumin(i)?um sesquichlorohydrate/, 'Aluminium salt (antiperspirant)', 'concern', 'low', 'Blocks sweat. Large reviews found no proven link to breast cancer or Alzheimer\'s; can irritate some skin.'],
  [/clobetasol|betamethasone|dexamethasone|fluocinolone|mometasone/, 'Prescription steroid', 'concern', 'high', 'Not allowed in cosmetics. Found in some imported skin-lightening creams — thins skin and can cause lasting damage.'],
  [/galena|lead sulfide|lead sulphide/, 'Lead (kohl/surma)', 'concern', 'high', 'Some traditional kohl/surma eyeliners contain lead — banned in Australia.'],
  [/lead acetate|thimerosal|mercur/, 'Heavy metal compound', 'concern', 'high', 'Heavy metal — builds up in the body.'],
  [/paraffinum liquidum|mineral oil|petrolatum/, 'Mineral oil / petrolatum', 'concern', 'low', 'Cosmetic grade is highly refined and considered safe; very occlusive.'],
  // Microplastics
  [/\bpolyethylene\b(?! glycol)|nylon-\d+|polymethyl methacrylate|\bpolypropylene\b|polyethylene terephthalate|polystyrene|polyurethane-\d+|acrylates copolymer|acrylates\/c10-30|\bglitter\b|polymethylsilsesquioxane/, 'Plastic polymer', 'plastic', 'moderate', 'Solid or synthetic polymer that can wash down the drain as microplastic.'],
  // Pore-clogging (only counts if acne-prone)
  [/cocos nucifera oil|coconut oil|isopropyl myristate|isopropyl palmitate|theobroma cacao seed butter|cocoa butter|lanolin|laureth-4|algae extract|myristyl myristate|ethylhexyl palmitate|triticum vulgare germ oil|wheat germ oil/, 'Pore-clogging ingredient', 'comedo', 'low', 'Rated comedogenic — can clog pores in acne-prone skin.'],
  // Pregnancy
  [/retinol|retinyl|retinal\b|retinaldehyde|tretinoin|adapalene|hydroxypinacolone retinoate/, 'Retinoid', 'preg', 'moderate', 'Vitamin A derivative — usually advised to avoid during pregnancy. Can irritate and make skin sun-sensitive.'],
  // Exfoliating acids
  [/glycolic acid|lactic acid|mandelic acid|salicylic acid/, 'Exfoliating acid', 'acid', 'low', 'Exfoliates and unclogs pores; can sting sensitive skin and increase sun sensitivity.'],
  // Good stuff
  [/niacinamide/, 'Niacinamide', 'good', 'good', 'Calms redness, strengthens the skin barrier, helps oil control.'],
  [/ceramide/, 'Ceramides', 'good', 'good', 'Repairs the skin barrier and locks in moisture.'],
  [/sodium hyaluronate|hyaluronic acid/, 'Hyaluronic acid', 'good', 'good', 'Pulls water into skin for hydration.'],
  [/\bglycerin\b/, 'Glycerin', 'good', 'good', 'Gentle, proven moisturiser.'],
  [/panthenol/, 'Panthenol (B5)', 'good', 'good', 'Soothes and hydrates skin and hair.'],
  [/squalane/, 'Squalane', 'good', 'good', 'Lightweight, non-greasy moisturiser.'],
  [/zinc oxide/, 'Zinc oxide', 'good', 'good', 'Gentle mineral UV filter, good for sensitive skin.'],
  [/centella asiatica|madecassoside/, 'Centella', 'good', 'good', 'Soothes irritated skin.'],
  [/allantoin/, 'Allantoin', 'good', 'good', 'Soothing and skin-softening.'],
  [/colloidal oatmeal|avena sativa/, 'Oat', 'good', 'good', 'Soothes itchy, dry or eczema-prone skin.'],
  [/butyrospermum parkii|shea butter/, 'Shea butter', 'good', 'good', 'Rich moisturiser.'],
  [/aloe barbadensis/, 'Aloe vera', 'good', 'good', 'Soothing and hydrating.'],
  [/bisabolol/, 'Bisabolol', 'good', 'good', 'Calming, from chamomile.'],
  [/\burea\b/, 'Urea', 'good', 'good', 'Hydrates and softens rough, dry skin.'],
  // Animal-derived
  [/beeswax|cera alba|lanolin|carmine|ci 75470|collagen|keratin|\bmel\b|\bhoney\b|squalene\b|tallow|snail secretion|serica|silk/, 'Animal-derived', 'nonvegan', 'low', 'Comes from animals.']
];

function splitIngredients(p){
  const en = i => i && i.id && /^en:/.test(i.id) ? i.id.slice(3).replace(/-/g, ' ') : '';
  const list = (p.ingredients || []).filter(i => i.text).map(i => { const e = en(i); return e && e.toLowerCase() !== i.text.toLowerCase() ? `${i.text} (${e})` : i.text; });
  if (list.length) return list;
  const t = (p.ingredients_text_en || p.ingredients_text || '').replace(/^ingredients?\s*[:\-]\s*/i, '');
  return t.split(/[,•·]|\s\/\s|\.\s/).map(s => s.trim()).filter(s => s.length > 1);
}

window.FSCos = {
  analyse(p, me, helpers){
    const {clamp, cap, nameOf} = helpers;
    const skin = me.skin || [];
    const sk = x => skin.includes(x);
    const ings = splitIngredients(p);
    const full = ings.join(', ').toLowerCase();
    const cats = (p.categories_tags || []).join(' ').toLowerCase() + ' ' + (p.categories || '').toLowerCase() + ' ' + nameOf(p).toLowerCase();
    const packaging = ((p.packaging_tags || []).join(' ') + ' ' + (p.packaging || '')).toLowerCase();

    const hits = [];      // {label, group, level, note}
    const seen = new Set();
    for (const r of R){
      if (r[0].test(full) && !seen.has(r[1])){ seen.add(r[1]); hits.push({label:r[1], group:r[2], level:r[3], note:r[4]}); }
    }
    const g = (grp, lvl) => hits.filter(h => h.group === grp && (!lvl || h.level === lvl));
    const lvlCount = grp => ({high: g(grp,'high').length, moderate: g(grp,'moderate').length, low: g(grp,'low').length});

    const breakdown = [], warnings = [], flags = [];
    if (!ings.length){
      return {cosmetic:true, noIngredients:true, code:p.code, name:nameOf(p), brand:p.brands || '', qty:p.quantity || '', img:p.image_front_url || p.image_front_small_url || ''};
    }

    // 1. Hormone disruptors (20)
    const h = lvlCount('hormone');
    const hormPts = clamp(Math.round(20 - h.high * 8 - h.moderate * 4 - h.low * 1), 0, 20);
    breakdown.push({factor:'Hormone disruptors', points:hormPts, max:20,
      note: g('hormone').length ? g('hormone').map(x => x.label).join(', ') + '.' : 'None found. 👍'});

    // 2. Irritants & allergens (20)
    const i = lvlCount('irritant');
    const allergenCount = hits.filter(x => x.label === 'Fragrance allergen').length;
    const irrPts = clamp(Math.round(20 - i.high * 6 - i.moderate * 3 - Math.min(i.low, 4) * 1), 0, 20);
    breakdown.push({factor:'Irritants & allergens', points:irrPts, max:20,
      note: g('irritant').length ? g('irritant').map(x => x.label).join(', ') + '.' : 'None found — gentle formula. 👍'});

    // 3. Other health concerns (25)
    const c = lvlCount('concern');
    const pegLow = Math.min(g('concern','low').length, 3);
    const aerosol = /aerosol|spray-can/.test(packaging) || g('concern').some(x => x.label === 'Aerosol propellant');
    const fRel = hits.some(x => x.label === 'Formaldehyde releaser');
    const conPts = clamp(Math.round(25 - c.high * 10 - c.moderate * 5 - pegLow * 1 - (fRel ? 8 : 0)), 0, 25);
    breakdown.push({factor:'Other health concerns', points:conPts, max:25,
      note: (g('concern').length || fRel) ? [...g('concern').map(x => x.label), ...(fRel ? ['Formaldehyde releaser (carcinogen risk)'] : [])].join(', ') + '.' : 'No carcinogen, PFAS or contamination flags. 👍'});

    // 4. Microplastics & packaging (10)
    let mp = 10; const mpWhy = [];
    const pl = g('plastic').length;
    if (pl){ mp -= Math.min(pl * 4, 8); mpWhy.push(`${pl} plastic polymer ingredient${pl > 1 ? 's' : ''}`); }
    if (/plastic|\bpet\b|hdpe|\bpp\b|\bpe\b|tube|pump/.test(packaging)){ mp -= 2; mpWhy.push('plastic packaging'); }
    if (aerosol){ mp -= 1; mpWhy.push('aerosol can'); }
    mp = clamp(mp, 0, 10);
    breakdown.push({factor:'Microplastics & packaging', points:mp, max:10, note: mpWhy.length ? cap(mpWhy.join(', ')) + '.' : 'No microplastic ingredients found. 👍'});

    // 5. Skin benefits & fit for you (25)
    let fit = 18; const fitWhy = [];
    const good = g('good');
    if (good.length){ fit += Math.min(good.length * 2, 6); fitWhy.push(`good ingredients: ${good.slice(0,4).map(x => x.label.toLowerCase()).join(', ')}`); }
    const hasFrag = hits.some(x => x.label === 'Fragrance');
    if ((me.skinFragFree || sk('Fragrance-free')) && (hasFrag || allergenCount)){ fit -= 8; flags.push('Contains fragrance'); }
    if (sk('Sensitive skin')){
      if (hasFrag){ fit -= 4; fitWhy.push('fragrance can upset sensitive skin'); }
      if (g('irritant','moderate').length + g('irritant','high').length > (hasFrag ? 1 : 0)){ fit -= 3; fitWhy.push('has irritants'); }
      if (g('acid').length){ fit -= 2; fitWhy.push('exfoliating acids can sting'); }
    }
    if (sk('Dry skin') && hits.some(x => /SLS|Drying alcohol|Sulfate/.test(x.label))){ fit -= 4; fitWhy.push('drying cleansers/alcohol'); }
    if (sk('Oily skin') && /mineral oil|petrolatum|cocoa butter|shea butter|coconut oil/.test(full)){ fit -= 2; fitWhy.push('heavy oils/butters'); }
    if (sk('Acne-prone')){
      const cm = (full.match(/cocos nucifera oil|coconut oil|isopropyl myristate|isopropyl palmitate|theobroma cacao seed butter|cocoa butter|lanolin|laureth-4|algae extract|myristyl myristate|ethylhexyl palmitate|wheat germ oil/g) || []).length;
      if (cm){ fit -= Math.min(cm * 4, 8); fitWhy.push(`${cm} pore-clogging ingredient${cm > 1 ? 's' : ''}`); }
      if (/salicylic acid|niacinamide|benzoyl peroxide|azelaic/.test(full)){ fit += 2; fitWhy.push('has acne-fighting ingredients'); }
    }
    if (sk('Eczema-prone')){
      if (hasFrag || g('irritant','high').length){ fit -= 6; fitWhy.push('fragrance/strong preservatives can flare eczema'); }
      if (/colloidal oatmeal|avena sativa|ceramide/.test(full)){ fit += 2; fitWhy.push('eczema-friendly ingredients'); }
    }
    if (sk('Pregnant / breastfeeding')){
      if (g('preg').length || /hydroquinone/.test(full)){ fit = 0; warnings.push('Contains a retinoid or hydroquinone — usually advised to avoid in pregnancy. Check with your doctor.'); }
      if (g('hormone','high').length){ fit -= 4; fitWhy.push('hormone disruptors are worth avoiding in pregnancy'); }
    }
    const nonVegan = g('nonvegan').length || (p.ingredients_analysis_tags || []).includes('en:non-vegan');
    if ((me.diets || []).includes('Vegan') && nonVegan){ fit -= 6; fitWhy.push('contains animal-derived ingredients'); }
    const avoid = (me.avoid || '').toLowerCase().split(/[,;]+/).map(s => s.trim()).filter(s => s.length > 2);
    for (const a of avoid){ if (full.includes(a.replace(/s$/, ''))){ fit = 0; warnings.push(`Contains ${a} — on your avoid list.`); } }
    fit = clamp(Math.round(fit), 0, 25);
    breakdown.push({factor:'Skin benefits & fit for you', points:fit, max:25,
      note: warnings.length ? warnings.join(' ') : fitWhy.length ? cap(fitWhy.join('; ')) + '.' : 'No conflicts with your skin profile.'});

    let score = clamp(breakdown.reduce((a, b) => a + b.points, 0), 0, 100);
    const animal = window.FSAnimal ? FSAnimal.cosmetic(p, full, me) : null;
    const animalCount = (me.animal || []).includes('Count animal welfare in the score') || (me.animal || []).includes('Cruelty-free only');
    if (animal && animalCount && animal.penalty) score = clamp(score - animal.penalty, 0, 100);
    if (animal && !animal.certified && (me.animal || []).includes('Cruelty-free only')) flags.push('Not certified cruelty-free');
    const caps = [];
    if (hits.some(x => ['Formaldehyde','PFAS ("forever chemicals")','Coal tar','Heavy metal compound','Prescription steroid','Lead (kohl/surma)'].includes(x.label)) && score > 39){ score = 39; caps.push('Capped at 39 because it contains a serious-concern ingredient.'); }
    else if (hits.some(x => x.level === 'high' && x.group !== 'good') && score > 59){ score = 59; caps.push('Capped at 59 because of a high-concern ingredient.'); }
    if (warnings.length && score > 30){ score = 30; caps.push('Capped at 30 because it clashes with your profile.'); }

    const bad = hits.filter(x => ['high','moderate'].includes(x.level) && !['good','comedo','acid','nonvegan'].includes(x.group));
    const effects = [];
    bad.slice(0, 5).forEach(x => effects.push(`⚠️ ${x.label}: ${x.note}`));
    good.slice(0, 3).forEach(x => effects.push(`✅ ${x.label}: ${x.note}`));
    if (g('preg').length) effects.push(`ℹ️ Retinoid: ${g('preg')[0].note}`);
    if (g('acid').length) effects.push(`ℹ️ Exfoliating acid: ${g('acid')[0].note} Wear sunscreen.`);
    if (/sunscreen|sun-protection|spf/.test(cats)) effects.push('☀️ In Australia sunscreens are TGA-regulated — look for an AUST L number and reapply every 2 hours.');
    if (!effects.length) effects.push('Nothing stands out — a pretty clean formula.');

    // per-ingredient flags
    const ingredients = ings.slice(0, 40).map(t => {
      const l = t.toLowerCase();
      const r = R.find(r => r[0].test(l));
      if (!r) return {name:t, flag:'neutral', note:''};
      const flag = r[2] === 'good' ? 'good' : r[3] === 'high' ? 'avoid' : r[3] === 'moderate' ? 'caution' : (r[2] === 'comedo' && !sk('Acne-prone')) || r[2] === 'nonvegan' ? 'neutral' : 'caution';
      return {name:t, flag, note: r[1] + ' — ' + r[4]};
    });

    const worst = breakdown.slice().sort((a, b) => a.points / a.max - b.points / b.max)[0];
    const best = breakdown.slice().sort((a, b) => b.points / b.max - a.points / a.max)[0];
    const label = s => s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Mediocre' : s >= 20 ? 'Poor' : 'Bad';
    const summary = `${label(score)} pick. Strongest on ${best.factor.toLowerCase()}, weakest on ${worst.factor.toLowerCase()}.` + (caps.length ? ' ' + caps[caps.length - 1] : '') + (warnings.length ? ' ⚠️ ' + warnings[0] : '');

    return {cosmetic:true, code:p.code, name:nameOf(p), brand:p.brands || '', qty:p.quantity || '', img:p.image_front_url || p.image_front_small_url || '',
      score, breakdown, warnings, flags, effects, ingredients, summary, hits,
      animal, animalPenalty: animal && animalCount ? animal.penalty : 0, concerns: bad, goodList: good, fragrance: hasFrag, cats: p.categories_tags || []};
  }
};
})();
