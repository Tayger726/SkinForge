// SkinForge v16.6 — catalog categories + reliable skin images
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
  const IMAGE_SOURCE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';
  let imageHydrated = false;
  let imageHydrating = false;

  function normalizeImageKey(name='') {
    return String(name)
      .replace(/^Souvenir\s+/i,'')
      .replace(/^★\s*StatTrak™\s+/i,'★ ')
      .replace(/^StatTrak™\s+/i,'')
      .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/i,'')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }

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

  async function hydrateSkinImages() {
    if (imageHydrated || imageHydrating) return;
    const live = Array.isArray(window.LIVE_SKINS) ? window.LIVE_SKINS : [];
    if (!live.length) return;
    imageHydrating = true;
    try {
      const response = await fetch(IMAGE_SOURCE, {cache:'force-cache'});
      if (!response.ok) throw new Error('image catalog '+response.status);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('bad image catalog');

      const exact = new Map();
      const normalized = new Map();
      for (const row of rows) {
        if (!row || !row.image) continue;
        if (row.market_hash_name) exact.set(String(row.market_hash_name).trim(), row.image);
        const key = normalizeImageKey(row.market_hash_name || row.name || '');
        if (key && !normalized.has(key)) normalized.set(key, row.image);
      }

      let matched = 0;
      for (const skin of live) {
        const exactImg = exact.get(String(skin.marketHash || skin.hash || '').trim());
        const fallbackImg = normalized.get(normalizeImageKey(skin.marketHash || skin.name || ''));
        const image = exactImg || fallbackImg;
        if (image) {
          skin.img = image;
          matched++;
        }
      }
      if (Array.isArray(window.CLEAN_SKINS)) {
        for (const skin of window.CLEAN_SKINS) {
          const exactImg = exact.get(String(skin.marketHash || skin.hash || '').trim());
          const fallbackImg = normalized.get(normalizeImageKey(skin.marketHash || skin.name || ''));
          const image = exactImg || fallbackImg;
          if (image) skin.img = image;
        }
      }
      imageHydrated = true;
      console.log(`SkinForge v16.6: images matched ${matched}/${live.length}`);
      document.dispatchEvent(new Event('skinforge-images-ready'));
      document.dispatchEvent(new Event('skinforge-live-ready'));
    } catch (e) {
      console.warn('SkinForge image catalog unavailable', e);
    } finally {
      imageHydrating = false;
    }
  }

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
    hydrateSkinImages();
  });

  document.addEventListener('skinforge-live-ready', hydrateSkinImages);

  document.addEventListener('error', e => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.closest('.skin-card,.card,.result-card')) return;
    const skinName = img.alt || img.getAttribute('data-name') || '';
    const live = Array.isArray(window.LIVE_SKINS) ? window.LIVE_SKINS : [];
    const skin = live.find(s => String(s.name||'') === skinName || String(s.marketHash||'') === skinName);
    if (skin && skin.img && img.src !== skin.img) {
      img.src = skin.img;
      img.style.opacity = '1';
      return;
    }
    img.style.opacity = '0';
  }, true);
})();
