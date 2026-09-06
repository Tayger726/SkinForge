// AEROX v20.2 — reliable detail selection without image-gated blank screen
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

  function reveal() {
    const root = document.getElementById('skinDetail');
    if (!root) return;
    root.style.visibility = 'visible';
    root.style.opacity = '1';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('skinDetail');
    if (!root) return;
    root.style.visibility = 'visible';
    root.style.opacity = '1';
    root.style.transition = 'opacity .12s ease';
  });

  document.addEventListener('skinforge-live-ready', () => {
    prepareSelected();
    reveal();
  });
  document.addEventListener('skinforge-images-ready', reveal);
  document.addEventListener('skinforge-history-ready', reveal);
  setTimeout(reveal, 600);
})();