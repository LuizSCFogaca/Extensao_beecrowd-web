(async () => {
  try {
    const src = chrome.runtime.getURL('content.js');
    await import(src);
  } catch (err) {
    console.error('[Beecrowd Companion] Falha ao carregar content script:', err);
  }
})();
