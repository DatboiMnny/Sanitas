/* Sanitas — native iOS/Android extras when running inside the Capacitor app (no-ops on the web). */
(function(){
'use strict';
const C = window.Capacitor;
const native = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
const plugin = n => { if (!native) return null; try{ return (C.Plugins && C.Plugins[n]) || (C.registerPlugin ? C.registerPlugin(n) : null); }catch(e){ return null; } };
window.FSNative = {
  native,
  haptic(kind){ try{ const h = plugin('Haptics'); if (h) (kind === 'success' && h.notification ? h.notification({type: 'SUCCESS'}) : h.impact({style: 'MEDIUM'})); }catch(e){} },
  async shareFile(name, text, title){
    const fs = plugin('Filesystem'), sh = plugin('Share'); if (!fs || !sh) return false;
    const w = await fs.writeFile({path: name, data: text, directory: 'CACHE', encoding: 'utf8'});
    await sh.share({title, files: [w.uri]}); return true;
  },
  async shareText(title, text){ const sh = plugin('Share'); if (!sh) return false; await sh.share({title, text}); return true; }
};
})();
