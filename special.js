/* Sanitas — special product handling:
   alcohol, healthy fats, baby food & formula, supplement doses, plain drinks, and ingredient translation. */
(function(){
'use strict';

// ---------- Ingredient translation (key terms only) ----------
// Maps common label words in Japanese, Korean, Chinese and Spanish to English so the checks can read them.
const DICT = [
  // sugars
  ['high fructose corn syrup', /ぶどう糖果糖液糖|果糖ぶどう糖液糖|異性化糖|액상과당|果葡糖浆|jarabe de ma[ií]z de alta fructosa|jarabe de alta fructosa/],
  ['glucose syrup', /水あめ|水飴|물엿|葡萄糖浆|麦芽糖浆|jarabe de glucosa/],
  ['maltodextrin', /デキストリン|말토덱스트린|麦芽糊精|maltodextrina/],
  ['sugar', /砂糖|上白糖|グラニュー糖|설탕|백설탕|白砂糖|白糖|蔗糖|az[uú]car/],
  ['dextrose', /ぶどう糖|포도당|葡萄糖|dextrosa/],
  ['honey', /はちみつ|蜂蜜|꿀|\bmiel\b/],
  // fats & oils
  ['hydrogenated fat', /硬化油|ショートニング|쇼트닝|경화유|氢化|起酥油|hidrogenad/],
  ['palm oil', /パーム油|팜유|棕榈油|棕櫚油|aceite de palma|palma/],
  ['canola oil', /菜種油|なたね油|카놀라유|유채유|菜籽油|菜油|aceite de canola|aceite de colza/],
  ['soybean oil', /大豆油|대두유|aceite de soya|aceite de soja/],
  ['sunflower oil', /ひまわり油|해바라기유|葵花籽油|aceite de girasol/],
  ['corn oil', /コーン油|옥수수유|玉米油|aceite de ma[ií]z/],
  ['rice bran oil', /米油|こめ油|미강유|米糠油/],
  ['vegetable oil', /植物油脂|植物油|식물성유지|식물성유|aceite vegetal|grasa vegetal/],
  ['margarine', /マーガリン|마가린|人造黄油|margarina/],
  ['olive oil', /オリーブ油|オリーブオイル|올리브유|橄榄油|aceite de oliva/],
  // European languages — French, German, Italian, Dutch, Portuguese, Polish
  ['glucose-fructose syrup', /sirop de glucose-fructose|glukose-fruktose-sirup|sciroppo di glucosio-fruttosio|glucose-fructosestroop|xarope de glucose-frutose|syrop glukozowo-fruktozowy/],
  ['glucose syrup', /sirop de glucose|glukosesirup|sciroppo di glucosio|glucosestroop|xarope de glucose|syrop glukozowy/],
  ['sugar', /\bsucre\b|\bzucker\b|\bzucchero\b|\bsuiker\b|\ba[çc][úu]car\b|\bcukier\b|\bsukker\b|\bsocker\b/],
  ['dextrose', /dextrose|destrosio|dekstroza/], ['honey', /\bmiel\b|\bhonig\b|\bmiele\b|\bhoning\b|\bmel\b|\bmi[óo]d\b/],
  ['palm oil', /huile de palme|palm[öo]l|olio di palma|palmolie|[óo]leo de palma|olej palmowy|graisse de palme|palmfett/],
  ['rapeseed oil', /huile de colza|raps[öo]l|olio di colza|koolzaadolie|[óo]leo de colza|olej rzepakowy/],
  ['sunflower oil', /huile de tournesol|sonnenblumen[öo]l|olio di (semi di )?girasole|zonnebloemolie|[óo]leo de girassol|olej s[łl]onecznikowy/],
  ['olive oil', /huile d'olive|oliven[öo]l|olio (extra vergine )?di oliva|olijfolie|azeite/],
  ['vegetable oil', /huiles? v[ée]g[ée]tales?|pflanzen[öo]l|pflanzenfett|oli(o|i) vegetal[ei]|plantaardige olie|[óo]leos? vegeta(l|is)|olej ro[śs]linny|t[łl]uszcz ro[śs]linny/],
  ['hydrogenated fat', /hydrog[ée]n[ée]|geh[äa]rtet|idrogenat|gehard|hidrogenad|utwardzon/],
  ['wheat flour', /farine de bl[ée]|weizenmehl|farina di (grano|frumento)|tarwebloem|tarwemeel|farinha de trigo|m[ąa]ka pszenna/],
  ['whole grain', /compl[èe]te|vollkorn|integrale|volkoren|integral|pe[łl]noziarnist/],
  ['salt', /\bsel\b|\bsalz\b|\bsale\b|\bzout\b|\bs[óo]l\b/],
  ['milk', /\blait\b|\bmilch|\blatte\b|\bmelk\b|\bleite\b|\bmleko\b|lait en poudre|vollmilchpulver|latte in polvere|melkpoeder/],
  ['butter', /\bbeurre\b|\bbutter\b|\bburro\b|\bboter\b|\bmanteiga\b|\bmas[łl]o\b/],
  ['cream', /\bcr[èe]me\b|\bsahne\b|\bpanna\b|\broom\b|\bnata\b|\bnatas\b|\bsmietan/],
  ['egg', /\b(oeufs?|œufs?|eier?|uova|uovo|eieren|ovos?|jaja?)\b/],
  ['cocoa', /\bcacao\b|\bkakao\b|\bcacau\b/],
  ['water', /\beau\b|\bwasser\b|\bacqua\b|\bwater\b|\b[áa]gua\b|\bwoda\b/],
  ['flavouring', /ar[ôo]mes?|aromen|aromi|aroma's|aromas?|aromat/],
  ['sweetener', /[ée]dulcorants?|s[üu][ßs]stoff|edulcorant[ei]|zoetstof|edulcorantes?|substancja s[łl]odz[ąa]ca/],
  ['emulsifier', /[ée]mulsifiants?|emulgator|emulsionant[ei]|emulgator(en)?|emulsionantes?/],
  ['maltodextrin', /maltodextrine|maltodextrin|maltodestrin/],
  ['modified starch', /amidon modifi[ée]|modifizierte st[äa]rke|amido modificato|gemodificeerd zetmeel|amido modificado|skrobia modyfikowana/],
  ['colour', /colorants?|farbstoff|coloranti|kleurstof|corantes?|barwnik/],
  ['preservative', /conservateurs?|konservierungsstoff|conservanti|conserveermiddel|conservantes?|konserwant/],
  ['yeast', /levure|hefe|lievito|\bgist\b|levedura|dro[żz]d[żz]e/],
  ['oats', /flocons d'avoine|haferflocken|fiocchi d'avena|havervlokken|flocos de aveia|p[łl]atki owsiane|\bavoine\b|\bhafer\b|\bavena\b|\bhaver\b|\baveia\b|\bowies\b/],
  ['potatoes', /pommes de terre|kartoffeln|patate|aardappel(en)?|batatas?|ziemniaki/],
  ['tomato', /tomates?|tomaten|pomodor[oi]|tomaat|pomidor/],
  ['chicken', /\bpoulet\b|h[äa]hnchen|huhn|\bpollo\b|\bkip\b|frango|kurczak/], ['pork', /\bporc\b|schweinefleisch|\bmaiale\b|varkensvlees|\bporco\b|wieprzow/], ['beef', /\bb[œoe]uf\b|rindfleisch|manzo|rundvlees|\bvaca\b|wo[łl]ow/],
  // Colombia (Spanish)
  ['cane sugar (panela)', /\bpanela\b/],
  ['lard', /manteca de cerdo/], ['shortening', /\bmanteca\b(?! de cacao)/],
  ['wheat flour', /harina de trigo/], ['corn flour', /harina de ma[ií]z/],
  ['artificial flavouring', /sabor(izante)? artificial|saborizantes?/], ['sweetener', /edulcorantes?/],
  ['preservative', /conservantes?|preservantes?/], ['colouring', /colorantes?/],
  ['whole milk powder', /leche entera en polvo/], ['milk powder', /leche en polvo/],
  // India (Hindi)
  ['sugar', /चीनी|शक्कर/], ['jaggery (sugar)', /गुड़/], ['refined wheat flour', /मैदा/], ['whole wheat flour', /गेहूं का आटा|आटा/],
  ['salt', /नमक/], ['palm oil', /पाम तेल|पामोलिन/], ['hydrogenated vegetable fat', /वनस्पति/], ['milk', /दूध/], ['ghee', /घी/], ['water', /पानी/],
  // additives
  ['monosodium glutamate', /調味料（アミノ酸等）|調味料\(アミノ酸等\)|グルタミン酸ナトリウム|L-글루타민산나트륨|글루타민산나트륨|谷氨酸钠|味精|glutamato monos[oó]dico/],
  ['sodium nitrite', /亜硝酸ナトリウム|아질산나트륨|亚硝酸钠|nitrito de sodio/],
  ['aspartame', /アスパルテーム|아스파탐|阿斯巴甜|aspartamo/],
  ['sucralose', /スクラロース|수크랄로스|三氯蔗糖|sucralosa/],
  ['acesulfame', /アセスルファム|아세설팜|安赛蜜|acesulfame|acesulfamo/],
  ['sweetener', /甘味料|감미료|甜味剂|edulcorante/],
  ['flavour', /香料|향료|香精|saborizante|aroma\b|sabor artificial/],
  ['colour', /着色料|색소|着色剂|色素|colorante/],
  ['emulsifier', /乳化剤|유화제|乳化剂|emulsionante|emulsificante/],
  ['preservative', /保存料|보존료|防腐剂|conservador|conservante/],
  ['thickener', /増粘剤|増粘多糖類|증점제|增稠剂|espesante/],
  ['antioxidant', /酸化防止剤|산화방지제|抗氧化剂|antioxidante/],
  ['caramel colour', /カラメル色素|캐러멜색소|焦糖色|color caramelo/],
  // main ingredients
  ['wheat flour', /小麦粉|밀가루|harina de trigo/],
  ['rice', /(^|[、,，\s（(])米([、,，\s）)]|$)|うるち米|白米|玄米|쌀|大米|\barroz\b/],
  ['egg', /鶏卵|卵|계란|달걀|鸡蛋|\bhuevos?\b/],
  ['chicken', /鶏肉|チキン|닭고기|鸡肉|\bpollo\b/],
  ['pork', /豚肉|ポーク|돼지고기|猪肉|\bcerdo\b|\bpuerco\b/],
  ['beef', /牛肉|비프|쇠고기|소고기|carne de res/],
  ['gelatine', /ゼラチン|젤라틴|明胶|gelatina/],
  ['milk', /乳成分|牛乳|脱脂粉乳|全粉乳|우유|탈지분유|牛奶|乳粉|奶粉|\bleche\b/],
  ['cocoa', /カカオ|ココア|코코아|카카오|可可|\bcacao\b/],
  ['fish', /魚|さかな|생선|鱼|\bpescado\b/],
  ['tuna', /まぐろ|マグロ|ツナ|참치|金枪鱼|\bat[uú]n\b/],
  ['salt', /食塩|塩|정제소금|소금|食用盐|食盐|\bsal\b/],
  ['seaweed', /海苔|のり|昆布|わかめ|김|미역|다시마|海带|紫菜|alga/],
  ['soy', /大豆|대두|大豆|\bsoya\b|\bsoja\b/],
  ['oats', /オーツ|귀리|燕麦|avena/]
];
function translate(text){
  if (!text) return '';
  const out = [];
  const low = text.toLowerCase();
  for (const [en, re] of DICT){ if ((re.test(text) || re.test(low)) && !out.includes(en)) out.push(en); }
  return out.join(', ');
}
const EU_WORDS = /\b(sucre|farine|huile|lait|sel|zucker|mehl|[öo]l|milch|salz|zucchero|farina|olio|latte|sale|suiker|bloem|olie|melk|zout|a[çc][úu]car|farinha|[óo]leo|leite|cukier|m[ąa]ka|olej|mleko|s[óo]l)\b/i;
const looksForeign = t => /[぀-ヿ㐀-鿿가-힯]/.test(t) || (/[\u0900-\u097F]{3}/.test(t) && !/[a-z]{4,}\s[a-z]{4,}/i.test(t)) || (EU_WORDS.test(t) && !/\b(sugar|flour|oil|milk|salt)\b/i.test(t)) || (/\b(az[uú]car|harina|aceite|leche|huevo|sal|agua)\b/i.test(t) && !/\b(sugar|flour|oil|milk|water|salt)\b/i.test(t));

// ---------- Regional label words written in English text (India, Philippines, Colombia) ----------
// Adds the plain-English meaning next to the local word, so the normal checks pick it up.
const REGIONAL = [
  [/\bmaida\b/gi, 'refined wheat flour'], [/\bvanaspati\b|\bdalda\b/gi, 'hydrogenated vegetable fat'],
  [/\bpalm ?olein\b/gi, 'palm oil'], [/\b(jaggery|gur|khandsari|shakkar|bura)\b/gi, 'cane sugar'],
  [/\b(chakki )?atta\b/gi, 'whole wheat flour'], [/\bbesan\b/gi, 'chickpea flour'], [/\b(sooji|suji|rava)\b/gi, 'semolina'],
  [/\b(asukal|azucar)\b/gi, 'sugar'], [/\basin\b/gi, 'salt'], [/\bharina\b/gi, 'wheat flour'], [/\bmantika\b/gi, 'lard'],
  [/\bvetsin\b/gi, 'monosodium glutamate'], [/\bgata\b/gi, 'coconut milk'], [/\btoyo\b/gi, 'soy sauce'], [/\bpatis\b/gi, 'fish sauce'],
  [/\bgatas\b/gi, 'milk'], [/\bitlog\b/gi, 'egg'], [/\btubig\b/gi, 'water'], [/\blangis ng niyog\b/gi, 'coconut oil'], [/\blangis\b/gi, 'oil'],
  [/\bpanela\b/gi, 'cane sugar']
];
function regional(text){
  if (!text) return text;
  let t = text;
  for (const [re, en] of REGIONAL) t = t.replace(re, m => new RegExp('\\b' + en + '\\b', 'i').test(t) ? m : `${m} (${en})`);
  return t;
}

// ---------- Colombia's front-of-pack warning seals (Resolución 2492 de 2022, corrected by 254 de 2023) ----------
// Sodium ≥ 1 mg per kcal or ≥ 300 mg/100 g (drinks with no energy: ≥ 40 mg/100 mL); free sugars, saturated fat ≥ 10% of energy;
// trans fat ≥ 1% of energy; any sweetener. Only for processed foods with added salt, sugar, fat or sweetener.
const SWEET = /\be9(5\d|6\d)\b|sucralose|aspartame|acesulfame|stevia|steviol|saccharin|cyclamate|sorbitol|xylitol|erythritol|maltitol|monk fruit|sweetener/;
function colombiaSeals(N, n, ingText, additives, isDrink){
  const t = String(ingText || '').toLowerCase();
  if (!t) return [];
  const kcal = N.kj != null ? N.kj / 4.184 : null;
  const addedSugar = /\b(sugar|cane sugar|panela|syrup|glucose|fructose|dextrose|honey|maltose|invert|molasses|jaggery|az[uú]car|jarabe)\b/.test(t);
  const addedSalt = /\bsalt\b|\bsal\b|sodium|sodio|msg|e621|soy sauce|fish sauce/.test(t);
  const addedFat = /\boil\b|\bfat\b|butter|lard|shortening|margarine|ghee|aceite|grasa|manteca|cream/.test(t);
  const sweet = SWEET.test(t) || (additives || []).some(a => /^E9(5\d|6\d)/i.test(a.code || ''));
  const out = [];
  if (addedSalt && N.sodium != null && ((kcal && N.sodium / kcal >= 1) || (!isDrink && N.sodium >= 300) || (isDrink && (!kcal || kcal < 1) && N.sodium >= 40))) out.push('SODIUM');
  if (addedSugar && N.sugar != null && kcal && (N.sugar * 4) / kcal >= 0.10) out.push('SUGARS');
  if (addedFat && N.sat != null && kcal && (N.sat * 9) / kcal >= 0.10) out.push('SATURATED FAT');
  const trans = n && n['trans-fat_100g'] != null ? Number(n['trans-fat_100g']) : null;
  if (trans != null && kcal && (trans * 9) / kcal >= 0.01) out.push('TRANS FAT');
  if (sweet) out.push('SWEETENERS');
  return out;
}

// ---------- Product kinds ----------
function kind(p, N, cats, ingText){
  const name = ((p.product_name_en || p.product_name || '') + ' ' + (p.generic_name || '')).toLowerCase();
  const all = cats + ' ' + name;
  const abv = alcoholPct(p);
  if ((abv != null && abv >= 0.5) || /alcoholic-beverages|en:beers|en:wines|en:spirits|en:ciders|en:liqueurs|premixed|ready-to-drink-alcohol|hard-seltzer/.test(cats)) {
    if (!(abv != null && abv < 0.5) && !/non-alcoholic|alcohol-free|zero-alcohol|en:non-alcoholic/.test(all)) return 'alcohol';
  }
  if (/infant-formula|infant-milk|baby-milks|en:infant|follow-on|stage-1|stage-2/.test(cats) || /\binfant formula\b|\bfollow-?on formula\b/.test(name)) return 'formula';
  if (/toddler-milk|growing-up-milk|en:toddler/.test(cats) || /toddler (milk|formula)|growing.?up milk|stage 3|stage 4/.test(name)) return 'toddlermilk';
  if (/baby-food|baby-cereal|en:baby|babies|puree-for-babies|for-babies/.test(cats) || /\b(baby|bebe|bébé|infant)\b.*\b(food|puree|pouch|cereal|rusk|snack)\b|\b\d+\+?\s?months?\b/.test(name)) return 'babyfood';
  const plain = (N.sugar == null || N.sugar <= 1) && (N.kj == null || N.kj <= 60);
  if (/en:waters|mineral-water|spring-water|sparkling-water|en:unsweetened-beverages.*water/.test(cats) && plain) return 'water';
  if (/en:coffees|coffee-beans|ground-coffee|instant-coffee|coffee-capsules|coffee-pods/.test(cats) || (/\bcoffee\b/.test(name) && /^\s*(100%\s*)?(arabica|coffee)/.test(ingText))) return plain || N.kj == null ? 'coffee' : null;
  if (/en:teas|tea-bags|green-teas|black-teas|herbal-teas|infusions/.test(cats)) return plain || N.kj == null ? 'tea' : null;
  // healthy fats: nuts, seeds, olive/avocado oil, oily fish — whole foods, not crisps or sweet spreads
  const hf = /olive-oils|extra-virgin|avocado-oils|en:nuts|almonds|walnuts|cashew|pistachio|macadamia|hazelnut|peanuts|en:seeds|chia|flax|linseed|pumpkin-seeds|nut-butters|peanut-butters|almond-butters|avocados|sardines|mackerel|salmons|anchovies/.test(cats)
          || /^\s*(extra virgin olive oil|olive oil|almonds?|walnuts?|cashews?|peanuts?|macadamias?|pistachios?|hazelnuts?|chia seeds?|pumpkin seeds?|sunflower seeds?|avocado|salmon|sardines?|mackerel)\b/.test(ingText);
  const notJunk = !/crisps|chips|snacks-sweet|confectioner|chocolate|biscuits|cakes/.test(cats) && (N.sugar == null || N.sugar <= 12) && num(p.nova_group) !== 4;
  if (hf && notJunk) return 'healthyfat';
  if (/en:cheeses/.test(cats)) return 'cheese';
  return null;
}
const num = v => (v === undefined || v === null || v === '' || isNaN(+v)) ? null : +v;

// ---------- Alcohol ----------
function alcoholPct(p){
  const n = p.nutriments || {};
  let v = num(n.alcohol_100g) ?? num(n.alcohol_value) ?? num(n.alcohol);
  if (v == null){
    const m = ((p.product_name || '') + ' ' + (p.quantity || '') + ' ' + (p.generic_name || '')).match(/(\d{1,2}(?:[.,]\d)?)\s?%\s?(?:abv|alc|vol)?/i);
    if (m) v = parseFloat(m[1].replace(',', '.'));
  }
  return v;
}
function volumeMl(q){
  if (!q) return null;
  const s = String(q).toLowerCase().replace(',', '.');
  const multi = s.match(/(\d+)\s?[x×]\s?(\d+(?:\.\d+)?)\s?(ml|cl|l)\b/);
  const one = multi ? [null, multi[2], multi[3]] : s.match(/(\d+(?:\.\d+)?)\s?(ml|cl|l)\b/);
  if (!one) return null;
  const v = parseFloat(one[1]); const u = one[2];
  return {ml: u === 'l' ? v * 1000 : u === 'cl' ? v * 10 : v, pack: multi ? parseInt(multi[1]) : 1};
}
function alcohol(p){
  const abv = alcoholPct(p);
  const vol = volumeMl(p.quantity);
  const info = {abv, volMl: vol ? vol.ml : null, pack: vol ? vol.pack : 1, sd: null, points: [], level: 'unknown', penalty: 0};
  if (abv == null){
    info.points.push('Alcohol content not listed in the database — check the label for % alc/vol.');
    info.penalty = 20; info.level = 'unknown';
    return info;
  }
  if (vol){
    // Australian standard drink = 10 g of pure alcohol. Ethanol density 0.789 g/ml.
    info.sd = Math.round(vol.ml * (abv / 100) * 0.789 / 10 * 10) / 10;
  }
  const per100 = Math.round(100 * (abv / 100) * 0.789 * 10) / 10;
  info.gPer100 = per100;
  info.kjFromAlcohol = Math.round(per100 * 29);
  // rating per container
  const sd = info.sd;
  info.level = sd == null ? (abv >= 12 ? 'high' : abv >= 5 ? 'some' : 'low') : sd > 2 ? 'very high' : sd > 1.2 ? 'high' : sd > 0.6 ? 'some' : 'low';
  info.penalty = Math.min(35, 15 + Math.max(0, Math.round(abv - 5)) + (sd != null && sd > 1.5 ? 5 : 0));
  info.points.push(`${abv}% alcohol by volume${sd != null ? ` — ${sd} standard drink${sd === 1 ? '' : 's'} per ${Math.round(vol.ml)}ml${vol.pack > 1 ? ` (${Math.round(sd * vol.pack * 10) / 10} in the ${vol.pack}-pack)` : ''}` : ''}.`);
  info.points.push(`About ${info.kjFromAlcohol} kJ per 100ml comes from the alcohol alone — kilojoules with no nutrients.`);
  info.points.push('Australian guidelines: no more than 10 standard drinks a week and no more than 4 on any one day. The less you drink, the lower your risk.');
  info.points.push('Alcohol is a Group 1 carcinogen (IARC) — linked to at least 7 cancers including breast and bowel — and raises blood pressure. Not safe in pregnancy.');
  return info;
}

// ---------- Supplement doses vs Australian upper limits (adults, NHMRC NRVs) ----------
// [label, nutriment key, unit, UL in that unit, note]
const ULS = [
  ['Vitamin A', 'vitamin-a', 'µg', 3000, 'Too much can harm the liver and bones, and cause birth defects.'],
  ['Vitamin D', 'vitamin-d', 'µg', 80, 'Too much raises blood calcium — nausea, kidney stones.'],
  ['Vitamin E', 'vitamin-e', 'mg', 300, 'High doses can increase bleeding risk.'],
  ['Vitamin B6', 'vitamin-b6', 'mg', 50, 'Long-term high doses can cause nerve damage (tingling, numbness). Some people react at much lower doses.'],
  ['Niacin (B3)', 'vitamin-pp', 'mg', 35, 'The upper limit is for nicotinic acid — causes flushing; very high doses can affect the liver.'],
  ['Folic acid', 'vitamin-b9', 'µg', 1000, 'High doses can mask B12 deficiency.'],
  ['Iron', 'iron', 'mg', 45, 'Causes stomach upset; overdose is dangerous for children — keep out of reach.'],
  ['Zinc', 'zinc', 'mg', 40, 'Long-term excess causes copper deficiency.'],
  ['Selenium', 'selenium', 'µg', 400, 'Too much causes hair and nail loss.'],
  ['Iodine', 'iodine', 'µg', 1100, 'Too much can upset thyroid function.'],
  ['Calcium', 'calcium', 'mg', 2500, 'Too much raises kidney stone risk.'],
  ['Magnesium', 'magnesium', 'mg', 350, 'From supplements, more than this often causes diarrhoea.'],
  ['Vitamin C', 'vitamin-c', 'mg', 2000, 'No official Australian limit — above ~2000mg often causes diarrhoea.']
];
const FACTOR = {'µg': 1e6, 'mg': 1e3};
function doses(p){
  const n = p.nutriments || {};
  const serveG = (() => { const m = String(p.serving_size || '').match(/(\d+(?:\.\d+)?)\s?(g|mg)\b/i); return m ? parseFloat(m[1]) / (m[2].toLowerCase() === 'mg' ? 1000 : 1) : null; })();
  const items = [];
  for (const [label, key, unit, ul, note] of ULS){
    let g = num(n[key + '_serving']);
    if (g == null && serveG != null && num(n[key + '_100g']) != null) g = n[key + '_100g'] * serveG / 100;
    if (g == null) continue;
    const amt = Math.round(g * FACTOR[unit] * 10) / 10;
    if (!amt) continue;
    const pct = Math.round(amt / ul * 100);
    items.push({label, amt, unit, ul, pct, note, status: pct > 200 ? 'way over' : pct > 100 ? 'over' : pct >= 70 ? 'near' : 'ok'});
  }
  return items;
}

window.FSSpecial = {regional, colombiaSeals,  translate, looksForeign, kind, alcohol, alcoholPct, volumeMl, doses };
})();
