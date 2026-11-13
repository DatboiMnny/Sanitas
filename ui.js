/* Sanitas — interface clean-up.
   Headings and buttons are written with a leading emoji in the code; the design is type-led instead,
   so this removes that emoji wherever it appears (including content that's drawn later). */
(function(){
'use strict';
const LEAD = /^\s*(?:(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[️‍⃣])+\s*)+/u;
const SEL = 'h2, summary, .btn, label.btn, .sec-title h3, .modal .sheet h2, .fab, .pill';
function clean(el){
  if (!el || el.closest('nav') || el.closest('.keep-emoji') || el.matches('.hero h3')) return;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())){
    if (!/\S/.test(n.nodeValue)) continue;
    const v = n.nodeValue, out = v.replace(LEAD, '');
    if (out !== v && out.trim()) n.nodeValue = out;
    break;                                    // only the first words of the element
  }
}
function scan(root){
  if (!root || root.nodeType !== 1) return;
  if (root.matches(SEL)) clean(root);
  root.querySelectorAll(SEL).forEach(clean);
}
const mo = new MutationObserver(recs => {
  for (const r of recs){
    if (r.type === 'characterData'){ const e = r.target.parentElement && r.target.parentElement.closest(SEL); if (e) clean(e); }
    else r.addedNodes.forEach(n => n.nodeType === 1 ? scan(n) : (n.parentElement && n.parentElement.closest(SEL) && clean(n.parentElement.closest(SEL))));
  }
});
function start(){ scan(document.body); mo.observe(document.body, {childList: true, subtree: true, characterData: true}); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
