/* Sanitas — label reading (OCR) + text parsing helpers.
   OCR runs on the phone with Tesseract.js, loaded only when first needed. */
(function(){
'use strict';
const LOCAL = !!window.FS_LOCAL_OCR;
const TESS = LOCAL ? 'ocr/tesseract.min.js' : 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
let tessLoading = null; const workers = {};

function loadTesseract(){
  if (window.Tesseract) return Promise.resolve();
  if (!tessLoading) tessLoading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = TESS; s.onload = res;
    s.onerror = () => { tessLoading = null; rej(new Error('Couldn\'t load the label reader — check your internet.')); };
    document.head.appendChild(s);
  });
  return tessLoading;
}

// Grayscale + upscale + contrast stretch: noticeably better OCR on shiny packets.
async function prep(file){
  const bmp = await createImageBitmap(file);
  const target = 2200, s = Math.min(2.5, target / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  let lo = 255, hi = 0; const g = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++){ const v = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) | 0; g[j] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < d.length; i += 4, j++){ const v = ((g[j] - lo) * 255 / span) | 0; d[i] = d[i+1] = d[i+2] = v; }
  ctx.putImageData(img, 0, 0);
  return c;
}

async function ocr(file, onProgress, lang){
  lang = lang || 'eng';
  await loadTesseract();
  if (!workers[lang]){
    const abs = p => new URL(p, location.href).href;
    const localPaths = LOCAL ? Object.assign({workerPath: abs('ocr/worker.min.js'), corePath: abs('ocr/'), workerBlobURL: false}, lang === 'eng' ? {langPath: abs('ocr/lang')} : {}) : {};
    workers[lang] = await Tesseract.createWorker(lang.split('+'), 1, Object.assign({}, localPaths, window.FSLabelPaths || {}, {
      logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)); }
    }));
  }
  const canvas = await prep(file);
  const { data } = await workers[lang].recognize(canvas);
  return data.text || '';
}

function extractIngredients(text){
  let t = text.replace(/\r/g, '');
  const m = t.match(/(ingredientes|ingred[il1]ents?|原材料名|原材料|원재료명|원재료|配料表|配料|成分)\s*[:;.\-：]?\s*/i);
  if (m) t = t.slice(m.index + m[0].length);
  const stop = t.search(/\b(contains|allergen|may contain|may be present|nutrition information|nutrition facts|storage|store in|made in|manufactured|packed in|product of|best before|contiene|información nutricional|consumir preferentemente)\b|内容量|賞味期限|アレルギー|栄養成分|알레르기|영양정보|내용량|过敏|营养成分|保质期|净含量/i);
  if (stop > 20) t = t.slice(0, stop);
  t = t.replace(/\bfiour\b/gi, 'flour').replace(/\blodised\b/g, 'iodised').replace(/\bLodised\b/g, 'Iodised').replace(/\b0il\b/g, 'oil').replace(/\bsa1t\b/gi, 'salt');
  return t.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.)])/g, '$1').trim().replace(/[.\s]+$/, '');
}

// Australian/NZ panels: "Avg qty per serve | %DI | per 100g" → take the last non-% number.
// US panels (per serve only) → single number, which we take as-is.
function parseNutrition(text){
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.replace(/[|]/g, ' ').replace(/(\d+\.\d)9\b/g, '$1g').replace(/(\d)\s?q\b/g, '$1g').replace(/k\]/g, 'kJ').replace(/(\d),(\d)/g, '$1.$2').replace(/(\d)[Oo]/g, (m, d) => d + '0').replace(/[Oo](\d)/g, (m, d) => '0' + d));
  const out = {}; let multi = 0, single = 0;
  const nums = l => (l.match(/\d+(?:\.\d+)?\s*(?:%|kj|kJ|KJ|cal|Cal|kcal|mg|g|mcg|µg)?/g) || [])
      .map(x => x.trim()).filter(x => !x.endsWith('%')).map(x => ({v: parseFloat(x), u: (x.match(/[a-zµ]+$/i) || [''])[0].toLowerCase()}));
  // AU/NZ rows have 2+ amounts (per serve … per 100g) → last one is per 100g. US rows have one.
  const pick = arr => { if (!arr.length) return null; if (arr.length >= 2){ multi++; return arr[arr.length - 1]; } single++; return arr[0]; };
  const rows = [
    ['kj', /^\s*energy|calories|energ[ií]a|エネルギー|熱量|열량|能量/i],
    ['protein', /protein|prote[ií]nas?|たんぱく質|蛋白質|단백질|蛋白质/i],
    ['sat', /saturated|sat\.?\s*fat|saturad|飽和脂肪|포화지방|饱和脂肪/i],
    ['fat', /(^|\s)(fat|total fat|fat,? total)\b|grasas?( totales)?|脂質|지방|脂肪/i],
    ['sugar', /sugars?\b|az[uú]cares|糖類|당류|^\s*-?\s*糖\b/i],
    ['carbs', /carbohydrate|carbs|hidratos|carbohidratos|炭水化物|탄수화물|碳水化合物/i],
    ['fibre', /fib(re|er)|fibra|食物繊維|식이섬유|膳食纤维/i],
    ['sodium', /sodium|sodio|ナトリウム|나트륨|钠/i],
    ['salt', /食塩相当量|salt equivalent|^\s*sal\b/i]
  ];
  for (const line of lines){
    for (const [k, re] of rows){
      if (out[k] != null || !re.test(line)) continue;
      if (k === 'fat' && /saturated|trans|mono|poly|saturad|飽和|포화|饱和|트랜스|反式/i.test(line)) continue;
      if (k === 'carbs' && /sugar|az[uú]car|糖類|당류/i.test(line)) continue;
      const n = pick(nums(line.replace(re, ' ')));
      if (!n || isNaN(n.v)) continue;
      if (k === 'salt'){ if (out.sodium == null) out.sodium = Math.round(n.v * 393); continue; }
      if (k === 'kj'){ out.kj = (/cal/.test(n.u) || /calories|kcal/i.test(line)) ? Math.round(n.v * 4.184) : n.v; }
      else if (k === 'sodium'){ out.sodium = n.u === 'g' ? n.v * 1000 : n.v; }
      else out[k] = n.v;
      break;
    }
  }
  out.per100 = multi >= single && multi > 0;
  return out;
}

// Additives written the Australian way ("emulsifiers (481, 472e)") or by name ("sodium benzoate").
const CLASS_RE = /(emulsifiers?|preservatives?|colou?rs?|colou?rings?|flavou?r enhancers?|thickeners?|acidity regulators?|antioxidants?|raising agents?|sweeteners?|stabil[iz]sers?|humectants?|mineral salts?|food acids?|firming agents?|gelling agents?|anti-?caking agents?|glazing agents?|flour treatment agents?|bulking agents?|vegetable gums?|gums?)\s*\(([^)]*)\)/gi;
const NAME_MAP = [
  [/tartrazine|yellow 5\b|fd&c yellow #?5/, 'e102'], [/sunset yellow|yellow 6\b|fd&c yellow #?6/, 'e110'], [/allura red|red 40\b|fd&c red #?40/, 'e129'],
  [/ponceau/, 'e124'], [/carmoisine|azorubine/, 'e122'], [/quinoline yellow/, 'e104'], [/brilliant blue|blue 1\b/, 'e133'],
  [/titanium dioxide/, 'e171'], [/caramel colou?r/, 'e150c'], [/sodium benzoate/, 'e211'], [/sulphur dioxide|sulfur dioxide/, 'e220'],
  [/sodium metabisulphite|sodium metabisulfite/, 'e223'], [/sodium nitrite/, 'e250'], [/sodium nitrate/, 'e251'], [/potassium nitrate/, 'e252'],
  [/calcium propionate/, 'e282'], [/\btbhq\b|tert-?butylhydroquinone/, 'e319'], [/\bbha\b|butylated hydroxyanisole/, 'e320'], [/\bbht\b|butylated hydroxytoluene/, 'e321'],
  [/phosphoric acid/, 'e338'], [/carrageenan/, 'e407'], [/polysorbate 80/, 'e433'], [/carboxymethyl ?cellulose|cellulose gum/, 'e466'],
  [/mono-? ?and diglycerides|monoglycerides/, 'e471'], [/monosodium glutamate|\bmsg\b/, 'e621'], [/acesulfame/, 'e950'], [/aspartame/, 'e951'],
  [/sucralose/, 'e955'], [/steviol|stevia/, 'e960'], [/erythritol/, 'e968'], [/sodium stearoyl lactylate/, 'e481'], [/datem/, 'e472e'],
  [/sodium phosphate|disodium phosphate/, 'e339'],
  [/potassium bromate|bromated flour/, 'e924'], [/azodicarbonamide/, 'e927a'], [/brominated vegetable oil/, 'e443'], [/erythrosine|red 3\b|fd&c red #?3\b/, 'e127'], [/propyl gallate/, 'e310'], [/\bedta\b/, 'e385'], [/xanthan/, 'e415'], [/guar gum/, 'e412'], [/soy lecithin|soya lecithin|sunflower lecithin|lecithin/, 'e322']
];
function additivesFromText(text){
  const t = (text || '').toLowerCase(), out = new Set();
  (t.match(/\be-?\s?(\d{3,4}[a-z]?)\b/g) || []).forEach(m => out.add('en:e' + m.replace(/[^0-9a-z]/g, '').replace(/^e/, '')));
  for (const m of t.matchAll(CLASS_RE)){
    (m[2].match(/\b\d{3,4}[a-z]?\b/g) || []).forEach(n => { const v = parseInt(n); if (v >= 100 && v <= 1599) out.add('en:e' + n); });
  }
  for (const [re, code] of NAME_MAP) if (re.test(t)) out.add('en:' + code);
  return [...out];
}

window.FSLabel = { ocr, extractIngredients, parseNutrition, additivesFromText, loadTesseract };
})();
