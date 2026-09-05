// SkinForge v16.5 — catalog category + live skin fix
(() => {
  const WEAPONS = [
    'AK-47','AUG','AWP','Bayonet','Bowie Knife','Butterfly Knife','Classic Knife','CZ75-Auto',
    'Desert Eagle','Dual Berettas','FAMAS','Five-SeveN','Flip Knife','G3SG1','Galil AR','Glock-18',
    'Gut Knife','Huntsman Knife','Karambit','Kukri Knife','M249','M4A1-S','M4A4','M9 Bayonet','MAC-10',
    'MAG-7','MP5-SD','MP7','MP9','Navaja Knife','Negev','Nomad Knife','Nova','P2000','P250',
    'P90','Paracord Knife','PP-Bizon','R8 Revolver','Sawed-Off','SCAR-20','SG 553','Shadow Daggers',
    'Skeleton Knife','SSG 08','Stiletto Knife','Survival Knife','Talon Knife','Tec-9','UMP-45',
    'Ursus Knife','USP-S','XM1014','Bloodhound Gloves','Broken Fang Gloves','Driver Gloves','Hand Wraps',
    'Hydra Gloves','Moto Gloves','Specialist Gloves','Sport Gloves'
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
    const cleaned = raw.replace(/^Souvenir\s+/i,'').replace(/^StatTrak™\s*/i,'').replace(/^★\s*/,'').trim();
    const weapon = cleaned.split('|')[0].trim();
    return WEAPON_SET.has(weapon.toLowerCase()) ? 'skin' : 'other';
  };

  window.isUsableLiveSkin = function(s) {
    if (!s || s.marketType !== 'skin') return false;
    if (!Number.isFinite(Number(s.price)) || Number(s.price) <= 0) return false;
    if (!s.weapon || !s.finish) return false;
    const weapon = String(s.weapon).replace(/^★\s*/,'').trim().toLowerCase();
    return WEAPON_SET.has(weapon);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const category = document.getElementById('category');
    if (category) {
      const map = {'Винтовки':'rifle','AWP':'sniper','Снайперские':'sniper','Пистолеты':'pistol','ПП':'smg','Ножи':'knife'};
      [...category.options].forEach(o => { if (map[o.value]) o.value = map[o.value]; });
      if (map[category.value]) category.value = map[category.value];
    }

    document.querySelectorAll('#marketTabs .market-tab').forEach(btn => {
      const map = {'Ножи':'knife','Пистолеты':'pistol','ПП':'smg','Винтовки':'rifle','AWP':'sniper','Снайперские':'sniper'};
      if (btn.dataset.cat && map[btn.dataset.cat]) btn.dataset.cat = map[btn.dataset.cat];
    });

    if (category) category.dispatchEvent(new Event('input',{bubbles:true}));
  });

  document.addEventListener('error', e => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.closest('.skin-card,.card,.result-card')) img.style.opacity = '0';
  }, true);
})();
