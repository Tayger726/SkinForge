// AEROX v20.1 — reliable detail page selection by exact market hash
(() => {
  const params = () => new URLSearchParams(location.search);
  const getRequestedId = () => params().get('id') || '';
  const getRequestedHash = () => params().get('hash') || '';

  const getSelected = () => {
    const id = getRequestedId();
    const hash = getRequestedHash();
    const live = Array.isArray(window.LIVE_SKINS) ? window.LIVE_SKINS : [];
    if (hash) {
      const exact = live.find(s => s && (String(s.marketHash||'') === hash || String(s.hash||'') === hash));
      if (exact) return exact;
    }
    return live.find(s => s && s.id === id) || null;
  };

  function prepareSelected() {
    const s = getSelected();
    if (!s) return null;
    if (!s.hash && s.marketHash) s.hash = s.marketHash;
    return s;
  }

  function showCorrectDetail() {
    const root = document.getElementById('skinDetail');
    if (!root) return;
    const s = prepareSelected();
    if (!s) return;
    requestAnimationFrame(() => {
      root.style.visibility = 'visible';
      root.style.opacity = '1';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('skinDetail');
    if (root) {
      root.style.visibility = 'hidden';
      root.style.opacity = '0';
      root.style.transition = 'opacity .12s ease';
    }
  });

  document.addEventListener('skinforge-live-ready', () => {
    const s = prepareSelected();
    if (!s) return;
    if (s.img && !String(s.img).includes('specs.gg/assets/img/cs2_skins/')) showCorrectDetail();
  });

  document.addEventListener('skinforge-images-ready', () => {
    prepareSelected();
    requestAnimationFrame(() => requestAnimationFrame(showCorrectDetail));
  });

  setTimeout(() => {
    const root = document.getElementById('skinDetail');
    if (root && prepareSelected()) {
      root.style.visibility = 'visible';
      root.style.opacity = '1';
    }
  }, 5000);
})();