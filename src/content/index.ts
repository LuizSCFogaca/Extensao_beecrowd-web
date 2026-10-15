import { ProblemInfo, TestCase } from '../types';

console.log('[Beecrowd Companion] Content script injetado em:', window.location.href);

/**
 * Converte o conteúdo de uma célula HTML em texto limpo com quebras de linha preservadas
 */
function extractCellContent(cell: HTMLElement): string {
  const clone = cell.cloneNode(true) as HTMLElement;

  // Substitui <br> e quebras de bloco por \n
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  clone.querySelectorAll('p, div').forEach((block) => block.append('\n'));

  let text = clone.textContent || '';
  // Normaliza quebras de linha Windows CRLF para LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Limpa indentações e espaços de cada linha individualmente
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Extrai o ID do problema a partir da URL ou do DOM
 */
function extractProblemId(): string {
  // Tenta extrair da URL (ex: /problems/view/1001 ou UOJ_1001.html)
  const urlMatch = window.location.href.match(/(?:problems\/view\/|UOJ_)(\d+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Tenta extrair do título da página
  const titleMatch = document.title.match(/(?:\||\b)(\d{4,5})\b/);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1];
  }

  // Tenta extrair de spans que contenham "beecrowd | 1001"
  const spans = Array.from(document.querySelectorAll('span, div, small'));
  for (const span of spans) {
    const text = span.textContent || '';
    const match = text.match(/beecrowd\s*\|\s*(\d+)/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
}

/**
 * Extrai o título do problema
 */
function extractProblemTitle(): string {
  // Procura por h1 ou classes comuns no Beecrowd
  const h1 = document.querySelector('.header h1, h1.problem-title, h1');
  if (h1 && h1.textContent?.trim()) {
    return h1.textContent.trim();
  }

  // Tenta extrair da tag <title> (ex: "beecrowd | 1001 - Extremamente Básico")
  const titleText = document.title;
  const parts = titleText.split(/[-–—|]/);
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }

  return document.title.trim() || 'Problema do Beecrowd';
}

/**
 * Extrai o limite de tempo (Timelimit)
 */
function extractTimeLimit(): string {
  const elements = Array.from(document.querySelectorAll('span, strong, div, p'));
  for (const el of elements) {
    const text = el.textContent || '';
    const match = text.match(/(?:Timelimit|Limite de tempo)\s*:\s*([\d.]+s?)/i);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '1s';
}

/**
 * Retorna todos os documentos acessíveis (documento principal e iframes same-origin)
 */
function getScrapingDocuments(): Document[] {
  const docs: Document[] = [document];
  const iframes = Array.from(document.querySelectorAll('iframe'));
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument) {
        docs.push(iframe.contentDocument);
      }
    } catch {
      // Iframes cross-origin são manipulados pelo content script rodando diretamente dentro deles
    }
  }
  return docs;
}

/**
 * Extrai todos os casos de teste de exemplo da página e dos iframes
 */
function extractTestCases(docs: Document[] = getScrapingDocuments()): TestCase[] {
  const testCases: TestCase[] = [];

  for (const doc of docs) {
    const tables = Array.from(doc.querySelectorAll('table'));

    for (const table of tables) {
      const isDivisionTable =
        table.classList.contains('division') ||
        table.querySelector('td.division, th.division') !== null;

      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length === 0) continue;

      let inputColIdx = -1;
      let outputColIdx = -1;
      let headerRowIdx = -1;

      // Procura por linha de cabeçalho na tabela
      for (let r = 0; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('th, td')).map((c) =>
          (c.textContent || '').trim().toLowerCase()
        );
        const inIdx = cells.findIndex((h) => h.includes('entrada') || h.includes('input'));
        const outIdx = cells.findIndex((h) => h.includes('saída') || h.includes('saida') || h.includes('output'));

        if (inIdx !== -1 && outIdx !== -1) {
          inputColIdx = inIdx;
          outputColIdx = outIdx;
          headerRowIdx = r;
          break;
        }
      }

      // Caso 1: Tabela com cabeçalho explícito de entrada/saída
      if (inputColIdx !== -1 && outputColIdx !== -1) {
        for (let r = 0; r < rows.length; r++) {
          if (r === headerRowIdx) continue; // pula o cabeçalho
          const row = rows[r];
          const cells = Array.from(row.querySelectorAll('td'));

          if (cells.length >= 2 && cells[inputColIdx] && cells[outputColIdx]) {
            const isHeaderDup = (cells[inputColIdx].textContent || '').toLowerCase().includes('entrada');
            if (isHeaderDup) continue;

            const input = extractCellContent(cells[inputColIdx]);
            const expectedOutput = extractCellContent(cells[outputColIdx]);

            if (input || expectedOutput) {
              const alreadyExists = testCases.some(
                (tc) => tc.input === input && tc.expectedOutput === expectedOutput
              );
              if (!alreadyExists) {
                testCases.push({
                  id: testCases.length + 1,
                  input,
                  expectedOutput,
                });
              }
            }
          }
        }
      } else if (isDivisionTable) {
        // Caso 2: Tabela com classe division sem cabeçalho repetido (tabelas subsequentes)
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 2) {
            const isHeader = (cells[0].textContent || '').toLowerCase().includes('entrada');
            if (isHeader) continue;

            const input = extractCellContent(cells[0]);
            const expectedOutput = extractCellContent(cells[1]);

            if (input || expectedOutput) {
              const alreadyExists = testCases.some(
                (tc) => tc.input === input && tc.expectedOutput === expectedOutput
              );
              if (!alreadyExists) {
                testCases.push({
                  id: testCases.length + 1,
                  input,
                  expectedOutput,
                });
              }
            }
          }
        }
      }
    }

    // Fallback: caso os exemplos estejam em tags pre ou code separadas
    if (testCases.length === 0) {
      const pres = Array.from(doc.querySelectorAll<HTMLElement>('pre, code'));
      for (let i = 0; i < pres.length; i += 2) {
        if (pres[i] && pres[i + 1]) {
          const input = extractCellContent(pres[i]);
          const expectedOutput = extractCellContent(pres[i + 1]);
          if (input || expectedOutput) {
            const alreadyExists = testCases.some(
              (tc) => tc.input === input && tc.expectedOutput === expectedOutput
            );
            if (!alreadyExists) {
              testCases.push({
                id: testCases.length + 1,
                input,
                expectedOutput,
              });
            }
          }
        }
      }
    }
  }

  return testCases;
}

/**
 * Função principal de raspagem
 */
export function scrapeProblem(): ProblemInfo | null {
  const id = extractProblemId();
  const testCases = extractTestCases();

  // Se não temos nem ID nem casos de teste, provavelmente não é uma página de questão válida
  if (!id && testCases.length === 0) {
    return null;
  }

  const title = extractProblemTitle();
  const timeLimit = extractTimeLimit();

  return {
    id: id || 'Desconhecido',
    title,
    timeLimit,
    url: window.location.href,
    testCases,
  };
}

/**
 * Notifica a extensão sobre o problema extraído
 */
function sendProblemInfo() {
  const problem = scrapeProblem();
  if (problem && problem.testCases.length > 0) {
    console.log('[Beecrowd Companion] Problema detectado com sucesso:', problem);
    // Salva no storage para persistência imediata
    chrome.storage?.local?.set({ lastProblem: problem });
    // Envia mensagem em tempo real para o Side Panel
    chrome.runtime?.sendMessage({
      type: 'PROBLEM_LOADED',
      data: problem,
    }).catch(() => {
      // Ignora erro caso o sidepanel ainda não esteja aberto para receber
    });
  }
}

// Execução inicial
sendProblemInfo();

// Observa mudanças dinâmicas no DOM (como carregamento tardio de iframes ou AJAX)
let scrapeAttempts = 0;
const interval = setInterval(() => {
  scrapeAttempts++;
  sendProblemInfo();
  if (scrapeAttempts >= 5) {
    clearInterval(interval);
  }
}, 1000);

// Responde a pedidos diretos do Side Panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PROBLEM_INFO') {
    const problem = scrapeProblem();
    sendResponse({ problem });
  }
  return true;
});
