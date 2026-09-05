// SkinForge v16.7 — detail page loading + live image fix
(() => {
  const getRequestedId = () => new URLSearchParams(location.search).get('id') || '';
  const getSelected = () => {
    const id = getRequestedId();
    const live = Array.isArray(window.LIVE_SKINS) ? window.LIVE_SKINS : [];
    return live.find(s => s && s.id === id) || null;
  };

  function prepareSelected() {
    const s = getSelected();
    if (!s) return null;
    // Older detail/Steam code expects `hash`, while live Skinport objects use `marketHash`.
    if (!s.hash && s.marketHash) s.hash = s.marketHash;
    return s;
  }

  function showCorrectDetail() {
    const root = document.getElementById('skinDetail');
    if (!root) return;
    const s = prepareSelected();
    if (!s) return;

    // renderSkin() already redraws on skinforge-live-ready. At this point the
    // correct live item is selected; reveal only after that redraw, preventing
    // the temporary fallback AK-47 Redline flash.
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

  // First live event selects the requested Skinport item. catalog-fix.js then
  // hydrates its real CS2 image and emits another live event.
  document.addEventListener('skinforge-live-ready', () => {
    const s = prepareSelected();
    if (!s) return;
    // If an image has already been hydrated, the redraw is ready to reveal.
    if (s.img && !String(s.img).includes('specs.gg/assets/img/cs2_skins/')) showCorrectDetail();
  });

  document.addEventListener('skinforge-images-ready', () => {
    prepareSelected();
    // catalog-fix.js emits skinforge-live-ready immediately after this event;
    // reveal on the next frame so app.js has redrawn with the hydrated image.
    requestAnimationFrame(() => requestAnimationFrame(showCorrectDetail));
  });

  // Safety fallback: never leave the page hidden if the external image catalog
  // is temporarily unavailable. The correct live knife still remains selected.
  setTimeout(() => {
    const root = document.getElementById('skinDetail');
    if (root && prepareSelected()) {
      root.style.visibility = 'visible';
      root.style.opacity = '1';
    }
  }, 5000);
})();
