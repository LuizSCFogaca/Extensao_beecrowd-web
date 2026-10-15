/**
 * Módulo para injeção de código na página oficial de submissão do Beecrowd
 */

export async function injectCodeIntoBeecrowd(
  code: string,
  language: string
): Promise<{ success: boolean; message: string }> {
  // Sempre copia para a área de transferência como garantia
  try {
    await navigator.clipboard.writeText(code);
  } catch (e) {
    console.warn('Falha ao copiar para clipboard:', e);
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    return {
      success: true,
      message: 'Código copiado para a área de transferência!',
    };
  }

  // Verifica se a aba atual é do Beecrowd
  const isBeecrowd = tab.url.includes('beecrowd.com') || tab.url.includes('urionlinejudge.com');
  if (!isBeecrowd) {
    return {
      success: true,
      message: 'Código copiado! Abra o Beecrowd para colar diretamente.',
    };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: (codeToInject: string, langKey: string) => {
        let injected = false;

        // 1. Tenta injetar no Ace Editor oficial do Beecrowd
        const aceEl = document.querySelector('.ace_editor') as HTMLElement;
        if (aceEl && (window as any).ace) {
          try {
            const editorInstance = (window as any).ace.edit(aceEl);
            if (editorInstance) {
              editorInstance.setValue(codeToInject, 1);
              injected = true;
            }
          } catch (e) {
            console.warn('[Beecrowd Companion] Falha ao acessar ace.edit:', e);
          }
        }

        // 2. Tenta preencher inputs e textareas convencionais/ocultos
        const textareas = Array.from(
          document.querySelectorAll<HTMLTextAreaElement>(
            '#source-code, textarea[name="source_code"], #code, textarea.code-input, textarea.ace_text-input'
          )
        );

        for (const textarea of textareas) {
          textarea.value = codeToInject;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          injected = true;
        }

        // 3. Tenta selecionar a linguagem correspondente no dropdown
        const select = document.querySelector<HTMLSelectElement>(
          'select[name="language_id"], #language-id, select.language-select, select[id*="lang"]'
        );

        if (select) {
          const options = Array.from(select.options);
          let targetOpt: HTMLOptionElement | undefined;

          if (langKey === 'c') {
            targetOpt = options.find(
              (o) => /\bC\b|\bGCC\b/i.test(o.text) && !o.text.includes('++') && !o.text.includes('#')
            );
          } else if (langKey === 'cpp') {
            targetOpt = options.find((o) => o.text.includes('C++') || o.text.includes('g++'));
          } else if (langKey === 'python') {
            targetOpt = options.find((o) => o.text.includes('Python 3') || o.text.includes('Python'));
          } else if (langKey === 'java') {
            targetOpt = options.find((o) => o.text.includes('Java'));
          } else if (langKey === 'csharp') {
            targetOpt = options.find((o) => o.text.includes('C#'));
          } else if (langKey === 'javascript') {
            targetOpt = options.find(
              (o) => o.text.includes('JavaScript') || o.text.includes('Node')
            );
          }

          if (targetOpt) {
            select.value = targetOpt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // 4. Faz rolagem suave até a área de submissão
        const targetElement =
          document.querySelector('.ace_editor') ||
          document.querySelector('form#form-submit, form[action*="submit"]');

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        return injected;
      },
      args: [code, language],
    });

    const wasInjected = results?.[0]?.result;
    if (wasInjected) {
      return {
        success: true,
        message: 'Código colado e linguagem selecionada no Beecrowd!',
      };
    } else {
      return {
        success: true,
        message: 'Código copiado! Role a página do Beecrowd e pressione Ctrl+V.',
      };
    }
  } catch (error: any) {
    console.warn('Erro ao executar injeção:', error);
    return {
      success: true,
      message: 'Código copiado para a área de transferência!',
    };
  }
}
