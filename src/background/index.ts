// Background Service Worker para o Beecrowd Companion

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Beecrowd Companion] Extensão instalada com sucesso!');

  // Configura o painel lateral para abrir ao clicar no ícone da extensão
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
      console.warn('Erro ao configurar openPanelOnActionClick:', error);
    });
  }
});

// Listener para mensagens entre content script, background e sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Beecrowd Companion Background] Mensagem recebida:', message);

  if (message.type === 'PING') {
    sendResponse({ status: 'PONG' });
  }

  // Retorna true caso seja resposta assíncrona
  return true;
});
