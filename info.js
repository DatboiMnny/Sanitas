/* Sanitas — welcome, sources & methodology, privacy policy, about. */
(function(){
'use strict';
const VERSION = '1.0.0';
const CONTACT = 'YOUR-SUPPORT-EMAIL@example.com'; // ← REPLACE with your real support email before submitting
const S = (t, items) => `<h3 style="font-size:15px;margin:16px 0 6px">${t}</h3><ul class="plain">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const L = (txt, url) => `<a href="${url}" target="_blank" rel="noopener">${txt}</a>`;

const SOURCES = `
  <p class="muted">Sanitas combines open product databases with published guidance from health and regulatory bodies. Scores are general information, not medical advice. Where research is mixed, the app says so.</p>
  ${S('Product data', [
    `${L('Open Food Facts', 'https://world.openfoodfacts.org')}, ${L('Open Beauty Facts', 'https://world.openbeautyfacts.org')}, ${L('Open Pet Food Facts', 'https://world.openpetfoodfacts.org')}, ${L('Open Products Facts', 'https://world.openproductsfacts.org')} — crowd-sourced, Open Database Licence (ODbL).`,
    `${L('USDA FoodData Central', 'https://fdc.nal.usda.gov')} — US government branded food data.`,
    `Loose fruit & veg codes — ${L('International Federation for Produce Standards (IFPS) PLU codes', 'https://www.ifpsglobal.com')}. Typical nutrition values per 100g.`,
    `Barcode country — GS1 company prefixes (shows where a barcode was registered, not necessarily where it was made).`
  ])}
  ${S('Nutrition', [
    `% Daily Intake — FSANZ Food Standards Code, Standard 1.2.8 reference values (8700 kJ adult diet). ${L('foodstandards.gov.au', 'https://www.foodstandards.gov.au')}`,
    `Traffic lights — UK Food Standards Agency front-of-pack thresholds per 100g / 100ml.`,
    `Added sugar — World Health Organization guideline (free sugars under 10% of energy, ideally 5%). ${L('who.int', 'https://www.who.int/publications/i/item/9789241549028')}`,
    `Sodium target — NHMRC Nutrient Reference Values (suggested dietary target 2000 mg/day).`,
    `Nutri-Score (when available from the database) and the NOVA food-processing classification (Monteiro et al., University of São Paulo).`
  ])}
  ${S('Supplements', [
    `Upper limits — NHMRC Nutrient Reference Values for Australia and New Zealand (adults). ${L('eatforhealth.gov.au', 'https://www.eatforhealth.gov.au/nutrient-reference-values')}`,
    `AUST L / AUST R numbers — Therapeutic Goods Administration (TGA) listing and registration.`
  ])}
  ${S('Alcohol', [
    `Standard drink = 10 g of alcohol; guideline of no more than 10 standard drinks a week and 4 in any one day — NHMRC Australian Guidelines to Reduce Health Risks from Drinking Alcohol (2020). ${L('nhmrc.gov.au', 'https://www.nhmrc.gov.au/health-advice/alcohol')}`,
    `Alcohol as a Group 1 carcinogen — International Agency for Research on Cancer (IARC).`
  ])}
  ${S('Additives, ingredients & chemicals', [
    `Additive concern levels — positions of the European Food Safety Authority (EFSA), FSANZ and IARC classifications (e.g. aspartame 2B, processed meat Group 1).`,
    `Cosmetic ingredients — EU Scientific Committee on Consumer Safety (SCCS) opinions and EU cosmetics regulation (e.g. restricted parabens, MI/MCI, titanium dioxide), IARC (talc 2A, formaldehyde Group 1).`,
    `Infant formula & baby food — FSANZ Standards 2.9.1 and 2.9.2.`,
    `Heavy metals — FSANZ mercury-in-fish advice and published independent testing of rice, cocoa and plant proteins. Ratings are estimates from ingredients, not lab tests.`,
    `Pesticide residues for fresh produce — US residue testing summarised in the Environmental Working Group "Dirty Dozen / Clean Fifteen" lists (US data). Estimates only.`,
    `Microplastics — estimated from packaging and fibre type, based on published research. Not a measurement.`
  ])}
  ${S('Animal welfare & environment', [
    `Cruelty-free — ${L('Cruelty Free International (Leaping Bunny / Choose Cruelty Free)', 'https://crueltyfreeinternational.org')}, PETA Beauty Without Bunnies.`,
    `Farming labels — RSPCA Approved, free-range and organic certifications; seafood — MSC / ASC; palm oil — RSPO.`,
    `Environmental grade — Open Food Facts Green-Score where available; otherwise an estimate from main ingredients and packaging.`,
    `Clothing — GOTS, OCS, OEKO-TEX, bluesign, GRS, RWS, RDS, FSC certification criteria.`
  ])}
  ${S('Limits', [
    'Scores depend on the data available — crowd-sourced entries can be incomplete or wrong. Always check the label.',
    'Sanitas does not diagnose, treat or prevent any condition. Talk to a doctor, pharmacist or dietitian about your own health, allergies, pregnancy or medications.'
  ])}`;

const PRIVACY = `
  <p class="muted">Last updated 13 November 2026 · Sanitas version ${VERSION}</p>
  ${S('The short version', [
    'No account, no sign-in, no ads, no tracking, no analytics.',
    'Your settings, history and the products you add are stored only on your device.',
    'When you look up a product, its barcode or search words are sent to the public product databases listed below — nothing else about you.'
  ])}
  ${S('What stays on your device', [
    'Your goals, diet, skin and allergy settings.',
    'Your scan history and products you add or complete.',
    'Photos you take of barcodes and labels are read on your device and are not uploaded or stored by Sanitas.',
    'Deleting the app (or clearing its data) removes all of this. You can also clear history and your added products in Settings.'
  ])}
  ${S('What is sent, and to whom', [
    'Barcodes and search terms → Open Food Facts, Open Beauty Facts, Open Pet Food Facts and Open Products Facts (run by the non-profit Open Food Facts association, France).',
    'Barcodes not found there → USDA FoodData Central (US Department of Agriculture), using a shared demo key or your own key if you add one.',
    'The first time you read a label in a language other than English, the language data file is downloaded from the jsDelivr content network.',
    'These services may record standard technical data such as your IP address as part of normal web traffic, under their own privacy policies. Sanitas does not send your name, location, health settings or history to anyone.'
  ])}
  ${S('Camera and photos', [
    'The camera is used only to scan barcodes and read labels while you\'re scanning. Video is processed on your device and never recorded or uploaded.',
    'If you choose a photo from your library, only that photo is read, on your device.'
  ])}
  ${S('Sharing your list', ['Exporting or sharing "My products" creates a file you choose where to send. Sanitas never uploads it.'])}
  ${S('Children', ['Sanitas is not directed at children under 13 and does not knowingly collect any personal information.'])}
  ${S('Contact', [`Questions about privacy: <a href="mailto:${CONTACT}">${CONTACT}</a>`])}`;

const ABOUT = `
  <p>Sanitas scores food, drinks, supplements, personal care, pet food, household products and clothing from 0–100, based on what's actually in them — additives, ingredients, processing, nutrition, and estimated pesticide, heavy-metal and microplastic exposure — plus optional animal-welfare and environmental checks.</p>
  <p class="muted" style="margin-top:10px">Version ${VERSION}. Product data © Open Food Facts contributors, available under the Open Database Licence.</p>
  <p class="muted" style="margin-top:10px">Sanitas provides general information only and is not medical advice.</p>`;

const WELCOME = `
  <div style="font-size:44px;text-align:center">🌿</div>
  <h2 style="text-align:center;margin:6px 0 4px">Welcome to Sanitas</h2>
  <p class="muted" style="text-align:center;margin-bottom:12px">Scan it. Score it. Swap it.</p>
  <ul class="plain">
    <li>📷 Scan food, drinks, skincare, pet food, cleaning products — or a clothing care label</li>
    <li>📊 Get a 0–100 score with the reasons, and healthier swaps</li>
    <li>🙋 Set your goals, diet and allergies in Settings to personalise it</li>
    <li>🔒 No account, no tracking — your data stays on your phone</li>
  </ul>
  <div class="note" style="margin-top:12px">Sanitas gives general information, not medical advice. Product data is crowd-sourced and can be incomplete — always check the label, and talk to a health professional about your own needs.</div>`;

function sheet(title, html, btn){
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="sheet">${title ? `<h2 style="margin-bottom:8px">${title}</h2>` : ''}<div class="infobody">${html}</div><button class="btn primary" id="sheetOk" style="margin-top:16px">${btn || 'Done'}</button></div>`;
  m.classList.remove('hidden');
  return new Promise(res => { document.getElementById('sheetOk').onclick = () => { m.classList.add('hidden'); m.innerHTML = ''; res(); }; });
}
window.FSInfo = {
  VERSION, CONTACT, PRIVACY, SOURCES,
  sources: () => sheet('📚 Sources & methodology', SOURCES),
  privacy: () => sheet('🔒 Privacy policy', PRIVACY),
  about: () => sheet('ℹ️ About Sanitas', ABOUT),
  welcome(){
    let seen = false; try{ seen = !!localStorage.getItem('fs_welcome'); }catch(e){}
    if (seen) return;
    sheet('', WELCOME, 'Get started').then(() => { try{ localStorage.setItem('fs_welcome', '1'); }catch(e){} });
  }
};
})();
