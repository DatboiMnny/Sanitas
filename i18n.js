/* Sanitas — app languages.
   The app is written in English. This file translates what's on screen into the chosen language
   (text, placeholders and labels), including content that appears later (results, pop-ups, toasts).
   Dictionary + patterns live in i18n-dict.js. Anything without a translation stays in English. */
(function(){
'use strict';
const LANGS = [
  ['en', 'English'], ['es', 'Español'], ['zh', '简体中文'], ['ja', '日本語'], ['ko', '한국어'], ['vi', 'Tiếng Việt']
];
const COL = {es: 0, zh: 1, ja: 2, ko: 3, vi: 4};          // column in the dictionary arrays
const HTML_LANG = {en: 'en', es: 'es', zh: 'zh-Hans', ja: 'ja', ko: 'ko', vi: 'vi'};
const DICT = window.FS_I18N_DICT || {};
const PATTERNS = window.FS_I18N_PATTERNS || [];

function detect(){
  try{ const s = localStorage.getItem('fs_lang'); if (s && LANGS.some(l => l[0] === s)) return s; }catch(e){}
  const n = (navigator.language || 'en').toLowerCase().slice(0, 2);
  return COL[n] != null ? n : 'en';
}
let lang = detect();

// ---------- string translation ----------
const cache = {};
let rev = null, revLang = null;               // translated → English, to recover originals from copied text
function reverse(){
  if (revLang === lang) return rev;
  rev = new Map(); revLang = lang;
  if (lang === 'en') return rev;
  const c = COL[lang];
  for (const k in DICT){ const v = DICT[k][c]; if (v && !rev.has(v)) rev.set(v, k); }
  return rev;
}
function look(s){
  const row = DICT[s]; if (row && row[COL[lang]]) return row[COL[lang]];
  // same phrase with a capital (factor names appear lower-case inside sentences)
  const capd = s.charAt(0).toUpperCase() + s.slice(1);
  if (capd !== s){ const r2 = DICT[capd]; if (r2 && r2[COL[lang]]){ const t = r2[COL[lang]]; return (lang === 'es' || lang === 'vi') ? t.charAt(0).toLowerCase() + t.slice(1) : t; } }
  const low = s.charAt(0).toLowerCase() + s.slice(1);
  if (low !== s){ const r3 = DICT[low]; if (r3 && r3[COL[lang]]){ const t = r3[COL[lang]]; return t.charAt(0).toUpperCase() + t.slice(1); } }
  return null;
}
function pat(s){
  const multi = /[.!?]\s+\S/.test(s);           // several sentences: only patterns written for that
  for (const p of PATTERNS){
    if (multi && !p[0].source.includes('\\. ')) continue;
    const m = s.match(p[0]); if (!m) continue;
    const tpl = p[1][lang]; if (tpl == null) continue;
    let out = tpl.replace(/\{(t?)(\d)\}/g, (_, t, i) => { const v = m[+i] == null ? '' : m[+i]; return t ? tr(v) : v; });
    if (/^[A-Z]/.test(s) && /^[a-zà-ỹ]/.test(out)) out = out.charAt(0).toUpperCase() + out.slice(1);
    return out;
  }
  return null;
}
const END = {zh: '。', ja: '。'};
function stop(){ return END[lang] || '.'; }
// translate one clean phrase (no leading emoji / bullets)
function core(s){
  if (!s) return s;
  let t = look(s); if (t) return t;
  if (/[.!?]$/.test(s)){                       // same phrase without its full stop
    const b = s.slice(0, -1); t = look(b) || pat(b);
    if (t) return /[.!?。！？]$/.test(t) ? t : t + (s.endsWith('.') ? stop() : s.slice(-1));
  }
  return pat(s);
}
const EMO = '(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator}|[\\uFE0F\\u200D\\u20E3\\u2190-\\u21FF✓✕✗])';
const PRE = new RegExp('^(\\s*(?:[·•.,:;—–-]\\s*)?(?:' + EMO + '+\\s*)?)', 'u');
const POST = new RegExp('(\\s*(?:' + EMO + '+\\s*)?)$', 'u');
function tr(str){
  if (lang === 'en' || !str) return str;
  const k = lang + '\u0001' + str; if (k in cache) return cache[k];
  let out = str;
  const pre = str.match(PRE)[1], rest = str.slice(pre.length);
  const post = rest.match(POST)[1], mid = rest.slice(0, rest.length - post.length);
  if (mid){
    let t = core(mid);
    if (t == null){
      // several sentences — translate each one we know, keep the rest
      const parts = mid.split(/(?<=[.!?])\s+(?=[A-Z0-9≈✓⚠"(]|\p{Extended_Pictographic})/u);
      if (parts.length > 1){
        let any = false;
        const tp = parts.map(x => { const y = tr(x); if (y !== x) any = true; return y; });
        if (any) t = tp.reduce((a, y) => !a ? y : a + ((lang === 'zh' || lang === 'ja') && /[。！？]$/.test(a) ? '' : ' ') + y, '');
      }
    }
    if (t == null){
      // lists like "Seed oils; ✓ short, simple ingredient list" or "high sugar (28g/100g), good protein (12g)"
      for (const sep of [' · ', '; ', ', ']){
        if (!mid.includes(sep)) continue;
        const end = /[.]$/.test(mid) ? '.' : '';
        const parts = (end ? mid.slice(0, -1) : mid).split(sep);
        const tp = parts.map(x => { const y = tr(x); return y; });
        if (tp.every((y, i) => y !== parts[i] || !/[a-z]{3}/i.test(parts[i]))){
          const j = sep === ' · ' ? sep : lang === 'zh' || lang === 'ja' ? (sep === '; ' ? '；' : '、') : sep;
          t = tp.join(j) + (end ? stop() : ''); break;
        }
      }
    }
    if (t != null) out = pre + t + post;
  }
  cache[k] = out; return out;
}

// ---------- DOM ----------
const SKIP = 'script,style,textarea,code,.notr,[contenteditable="true"]';
const TXT = new WeakMap();          // text node → [original, shown]
const ATTRS = ['placeholder', 'aria-label', 'title'];
function origOf(v){
  if (lang === 'en') return v;
  const r = reverse(); return r.get(v.trim()) ? v.replace(v.trim(), r.get(v.trim())) : v;
}
function doText(n){
  const v = n.nodeValue; if (!v || !/\S/.test(v)) return;
  const p = n.parentElement; if (!p || p.closest(SKIP)) return;
  let rec = TXT.get(n);
  if (!rec || v !== rec[1]) rec = [origOf(v), null];
  const out = tr(rec[0]); rec[1] = out; TXT.set(n, rec);
  if (v !== out) n.nodeValue = out;
}
function doAttrs(el){
  if (el.closest && el.closest(SKIP)) return;
  for (const a of ATTRS){
    if (!el.hasAttribute(a)) continue;
    const v = el.getAttribute(a); el.__i18n = el.__i18n || {};
    let rec = el.__i18n[a]; if (!rec || v !== rec[1]) rec = [v, null];
    const out = tr(rec[0]); rec[1] = out; el.__i18n[a] = rec;
    if (v !== out) el.setAttribute(a, out);
  }
}
function walk(root){
  if (!root) return;
  if (root.nodeType === 3){ doText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1){ if (root.closest(SKIP)) return; doAttrs(root); }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = w.nextNode())){ n.nodeType === 3 ? doText(n) : doAttrs(n); }
}
let busy = false;
const mo = new MutationObserver(recs => {
  if (busy) return; busy = true;
  try{
    for (const r of recs){
      if (r.type === 'characterData') doText(r.target);
      else if (r.type === 'attributes') doAttrs(r.target);
      else r.addedNodes.forEach(walk);
    }
    mo.takeRecords();
  } finally { busy = false; }
});
function start(){
  document.documentElement.lang = HTML_LANG[lang] || 'en';
  walk(document.body);
  mo.observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS});
}
// original (English) text of an element, for code that checks headings
function origText(el){
  if (!el) return '';
  let s = ''; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())){ const rec = TXT.get(n); s += rec && rec[1] === n.nodeValue ? rec[0] : origOf(n.nodeValue); }
  return s;
}
function set(l){
  if (!LANGS.some(x => x[0] === l)) return;
  lang = l; try{ localStorage.setItem('fs_lang', l); }catch(e){}
  document.documentElement.lang = HTML_LANG[l] || 'en';
  busy = true; try{ walk(document.body); mo.takeRecords(); } finally { busy = false; }
  document.dispatchEvent(new CustomEvent('fs-lang', {detail: l}));
}
// Settings card: tap a language
function picker(el){
  if (!el) return;
  el.innerHTML = LANGS.map(([c, n]) => `<span class="chip notr ${c === lang ? 'on' : ''}" data-l="${c}">${n}</span>`).join('');
  el.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    set(c.dataset.l);
    el.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
  });
}
window.FSI18N = {LANGS, get lang(){ return lang; }, set, t: s => tr(s), origText, picker};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
