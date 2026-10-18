// Background Service Worker / Event Page para o Beecrowd Companion (Chrome & Firefox)

const browserAPI = ((globalThis as any).browser || (globalThis as any).chrome) as typeof chrome & {
  sidebarAction?: {
    toggle: () => Promise<void>;
    open: () => Promise<void>;
  };
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Beecrowd Companion] Extensão instalada com sucesso!');

  // Chrome: Configura o painel lateral para abrir ao clicar no ícone da extensão
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
      console.warn('Erro ao configurar openPanelOnActionClick:', error);
    });
  }
});

// Firefox: Como o Firefox não usa sidePanel mas sim sidebarAction,
// alternamos a barra lateral ao clicar no ícone da extensão na barra de ferramentas
if (browserAPI?.action?.onClicked) {
  browserAPI.action.onClicked.addListener(async () => {
    if (browserAPI.sidebarAction?.toggle) {
      try {
        await browserAPI.sidebarAction.toggle();
      } catch {
        if (browserAPI.sidebarAction?.open) {
          await browserAPI.sidebarAction.open();
        }
      }
    } else if (browserAPI.sidebarAction?.open) {
      await browserAPI.sidebarAction.open();
    }
  });
}

// Listener para mensagens entre content script, background e sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Beecrowd Companion Background] Mensagem recebida:', message);

  if (message.type === 'PING') {
    sendResponse({ status: 'PONG' });
  }

  // Retorna true caso seja resposta assíncrona
  return true;
});
