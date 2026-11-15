/* Sanitas — quick tutorial. Five swipeable cards, shown once after the welcome screen,
   and again any time from Settings → "Show the tutorial". */
(function(){
'use strict';
const ART = {
  scan: `<svg viewBox="0 0 120 80" aria-hidden="true"><rect x="6" y="6" width="108" height="68" rx="10" fill="none" stroke="currentColor" stroke-width="4"/><g fill="currentColor">${[16,22,27,35,40,46,53,58,66,71,78,84,90,97,102].map((x, i) => `<rect x="${x}" y="18" width="${i % 3 ? 2.5 : 4}" height="44"/>`).join('')}</g><rect x="10" y="38" width="100" height="4" fill="#ff5a5f"/></svg>`,
  score: `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="46" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="60" cy="60" r="46" fill="none" stroke="#1f9d55" stroke-width="12" stroke-linecap="round" stroke-dasharray="289" stroke-dashoffset="52" transform="rotate(-90 60 60)"/><text x="60" y="70" text-anchor="middle" font-size="34" font-weight="800" fill="currentColor" font-family="Archivo,sans-serif">82</text></svg>`,
  why: `<svg viewBox="0 0 140 90" aria-hidden="true"><rect x="4" y="6" width="22" height="22" rx="5" fill="var(--brand-soft)"/><text x="15" y="23" text-anchor="middle" font-size="15" font-weight="800" fill="var(--brand)">✓</text><rect x="34" y="12" width="96" height="10" rx="5" fill="currentColor" opacity=".8"/><rect x="4" y="36" width="22" height="22" rx="5" fill="var(--brand-soft)"/><text x="15" y="53" text-anchor="middle" font-size="15" font-weight="800" fill="var(--brand)">✓</text><rect x="34" y="42" width="74" height="10" rx="5" fill="currentColor" opacity=".8"/><rect x="4" y="66" width="22" height="22" rx="5" fill="var(--warn-bg)"/><text x="15" y="83" text-anchor="middle" font-size="15" font-weight="800" fill="var(--warn-ink)">!</text><rect x="34" y="72" width="86" height="10" rx="5" fill="currentColor" opacity=".8"/></svg>`,
  swap: `<svg viewBox="0 0 140 80" aria-hidden="true"><rect x="4" y="18" width="46" height="46" rx="8" fill="#f26b1d"/><text x="27" y="49" text-anchor="middle" font-size="20" font-weight="800" fill="#fff" font-family="Archivo,sans-serif">31</text><path d="M60 41h22m-8-8 8 8-8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="90" y="18" width="46" height="46" rx="8" fill="#1f9d55" transform="rotate(-4 113 41)"/><text x="113" y="49" text-anchor="middle" font-size="20" font-weight="800" fill="#fff" font-family="Archivo,sans-serif">88</text></svg>`,
  you: `<svg viewBox="0 0 120 80" aria-hidden="true"><path d="M20 22h52M88 22h12M20 58h20M56 58h44" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="80" cy="22" r="9" fill="var(--card)" stroke="currentColor" stroke-width="5"/><circle cx="48" cy="58" r="9" fill="var(--card)" stroke="currentColor" stroke-width="5"/></svg>`
};
const STEPS = [
  ['scan', 'Scan anything', 'Point your camera at a barcode. Food, drinks, skincare, cleaning stuff, even pet food. No barcode? Type the name or the number on a fruit sticker.'],
  ['score', 'Get a score out of 100', 'It\'s based on what\'s actually inside — additives, processing, sneaky sugar, heavy metals, microplastics — not just calories.'],
  ['why', 'See what helped and what hurt', 'Green ticks are the good bits, red marks are the not-so-good. Tap any section to dig into the details.'],
  ['swap', 'Find a better swap', 'Score looking rough? Scroll down for similar products that score higher.'],
  ['you', 'Make it yours', 'Set your goals, diet and allergies in Settings. Can\'t find something? Snap the label and add it yourself — it\'s saved for next time.']
];
let i = 0, root = null;
function draw(){
  const [art, h, p] = STEPS[i];
  root.querySelector('.tut-art').innerHTML = ART[art];
  root.querySelector('.tut-h').textContent = h;
  root.querySelector('.tut-p').textContent = p;
  root.querySelectorAll('.tut-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  root.querySelector('.tut-next').textContent = i === STEPS.length - 1 ? 'Let\'s go' : 'Next';
  root.querySelector('.tut-back').style.visibility = i ? 'visible' : 'hidden';
}
function close(){
  try{ localStorage.setItem('fs_tut', '1'); }catch(e){}
  if (root){ root.remove(); root = null; }
}
function open(){
  if (root) return;
  i = 0;
  root = document.createElement('div');
  root.className = 'modal tut';
  root.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Tutorial">
    <button class="tut-skip" type="button">Skip</button>
    <div class="tut-art"></div><h2 class="tut-h"></h2><p class="tut-p"></p>
    <div class="tut-dots">${STEPS.map(() => '<i></i>').join('')}</div>
    <div class="row"><button class="btn plain tut-back" type="button">Back</button><button class="btn primary tut-next" type="button">Next</button></div></div>`;
  document.body.appendChild(root);
  root.querySelector('.tut-skip').onclick = close;
  root.querySelector('.tut-back').onclick = () => { if (i > 0){ i--; draw(); } };
  root.querySelector('.tut-next').onclick = () => { if (i < STEPS.length - 1){ i++; draw(); } else close(); };
  let x0 = null;
  root.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive: true});
  root.addEventListener('touchend', e => {
    if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -45 && i < STEPS.length - 1){ i++; draw(); } else if (dx > 45 && i > 0){ i--; draw(); }
  });
  draw();
}
function maybeFirstRun(){
  let seen = false; try{ seen = !!localStorage.getItem('fs_tut'); }catch(e){}
  if (seen) return;
  // wait for the welcome screen to be closed first
  const tick = () => {
    const m = document.getElementById('modal');
    if (m && !m.classList.contains('hidden') && m.innerHTML.trim()) return setTimeout(tick, 400);
    let w = false; try{ w = !!localStorage.getItem('fs_welcome'); }catch(e){}
    if (!w) return setTimeout(tick, 400);
    open();
  };
  setTimeout(tick, 600);
}
window.FSTut = {open, close};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeFirstRun); else maybeFirstRun();
})();
