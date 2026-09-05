// SkinForge v16.1 — catalog cleanup
(() => {
  const WEAPONS = [
    'AK-47','AUG','AWP','Bayonet','Bowie Knife','Butterfly Knife','Classic Knife','CZ75-Auto',
    'Desert Eagle','Dual Berettas','FAMAS','Five-SeveN','Flip Knife','G3SG1','Galil AR','Glock-18',
    'Gut Knife','Huntsman Knife','Karambit','Kukri Knife','M249','M4A1-S','M4A4','M9 Bayonet','MAC-10',
    'MAG-7','MP5-SD','MP7','MP9','Navaja Knife','Negev','Nomad Knife','Nova','P2000','P250',
    'P90','Paracord Knife','PP-Bizon','R8 Revolver','Sawed-Off','SCAR-20','SG 553','Shadow Daggers',
    'Skeleton Knife','SSG 08','Stiletto Knife','Survival Knife','Talon Knife','Tec-9','UMP-45',
    'Ursus Knife','USP-S','XM1014'
  ];
  const WEAPON_SET = new Set(WEAPONS.map(x => x.toLowerCase()));

  window.classifyMarketItemName = function(name='') {
    const raw = String(name).trim();
    const n = raw.toLowerCase();
    if (/sticker\s*\|/.test(n)) return 'sticker';
    if (/case$|case\s*\|/.test(n) || /weapon case/.test(n)) return 'case';
    if (/capsule|package|souvenir package/.test(n)) return 'container';
    if (/patch\s*\|/.test(n)) return 'patch';
    if (/charm\s*\|/.test(n)) return 'charm';
    if (/music kit\s*\|/.test(n)) return 'music';
    if (/graffiti\s*\|/.test(n)) return 'graffiti';
    if (/agent\s*\|/.test(n)) return 'agent';

    const cleaned = raw.replace(/^StatTrak™\s*/i,'').replace(/^Souvenir\s+/i,'').trim();
    const weapon = cleaned.split('|')[0].trim().replace(/^★\s*/,'');
    return WEAPON_SET.has(weapon.toLowerCase()) ? 'skin' : 'other';
  };

  window.isUsableLiveSkin = function(s) {
    if (!s || s.marketType !== 'skin') return false;
    if (!Number.isFinite(Number(s.price)) || Number(s.price) <= 0) return false;
    if (!s.weapon || !s.finish) return false;
    const weapon = String(s.weapon).replace(/^★\s*/,'').trim().toLowerCase();
    if (!WEAPON_SET.has(weapon)) return false;
    return true;
  };

  // Hide broken image icons cleanly instead of showing an empty/broken symbol.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.closest('.skin-card,.card,.result-card')) {
      img.style.opacity = '0';
    }
  }, true);
})();
