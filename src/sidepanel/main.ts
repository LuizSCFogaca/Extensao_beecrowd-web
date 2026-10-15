import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { ProblemInfo, TestCase } from '../types';
import { executeCode, evaluateOutput, executeBatchTests, checkNativeHost } from './runner';
import { injectCodeIntoBeecrowd } from './injector';

// Configuração dos workers do Monaco Editor
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

// Modelos iniciais por linguagem
const STARTER_CODE: Record<string, string> = {
  cpp: `#include <iostream>

using namespace std;

int main() {
    int a, b;
    if (cin >> a >> b) {
        int x = a + b;
        cout << "X = " << x << endl;
    }
    return 0;
}
`,
  c: `#include <stdio.h>

int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) == 2) {
        int x = a + b;
        printf("X = %d\\n", x);
    }
    return 0;
}
`,
  python: `import sys

def main():
    lines = sys.stdin.read().split()
    if len(lines) >= 2:
        a = int(lines[0])
        b = int(lines[1])
        x = a + b
        print(f"X = {x}")

if __name__ == "__main__":
    main()
`,
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int a = sc.nextInt();
            int b = sc.nextInt();
            int x = a + b;
            System.out.println("X = " + x);
        }
        sc.close();
    }
}
`,
  csharp: `using System;

class URI {
    static void Main(string[] args) {
        string input1 = Console.ReadLine();
        string input2 = Console.ReadLine();
        if (input1 != null && input2 != null) {
            int a = int.Parse(input1);
            int b = int.Parse(input2);
            int x = a + b;
            Console.WriteLine($"X = {x}");
        }
    }
}
`,
  javascript: `const fs = require('fs');

const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length >= 2) {
    const a = parseInt(input[0], 10);
    const b = parseInt(input[1], 10);
    const x = a + b;
    console.log(\`X = \${x}\`);
}
`,
};

const MONACO_LANG_MAP: Record<string, string> = {
  cpp: 'cpp',
  c: 'c',
  python: 'python',
  java: 'java',
  csharp: 'csharp',
  javascript: 'javascript',
};

// Estado da aplicação
let editor: monaco.editor.IStandaloneCodeEditor;
let currentProblem: ProblemInfo | null = null;
let activeTabName: 'tests' | 'custom' = 'tests';

function initEditor() {
  const container = document.getElementById('editor-container')!;
  const langSelect = document.getElementById('language-select') as HTMLSelectElement;
  const initialLang = langSelect.value || 'cpp';

  editor = monaco.editor.create(container, {
    value: STARTER_CODE[initialLang] || '',
    language: MONACO_LANG_MAP[initialLang] || 'cpp',
    theme: 'vs-dark',
    fontSize: 13,
    fontFamily: "'Consolas', 'Courier New', monospace",
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    tabSize: 4,
    insertSpaces: true,
    wordWrap: 'on',
    lineNumbersMinChars: 3,
  });

  // Listener para troca de linguagem
  langSelect.addEventListener('change', () => {
    const newLang = langSelect.value;
    const monacoLang = MONACO_LANG_MAP[newLang] || 'plaintext';
    const currentCode = editor.getValue().trim();

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, monacoLang);
    }

    const isDefault = Object.values(STARTER_CODE).some((sc) => sc.trim() === currentCode);
    if (!currentCode || isDefault) {
      editor.setValue(STARTER_CODE[newLang] || '');
    }
  });

  // Salvar código no storage local periodicamente (debounced)
  let saveTimeout: number;
  editor.onDidChangeModelContent(() => {
    clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      chrome.storage?.local?.set({
        savedCode: editor.getValue(),
        savedLanguage: langSelect.value,
      });
    }, 500);
  });

  // Recupera código salvo caso exista
  chrome.storage?.local?.get(['savedCode', 'savedLanguage'], (result) => {
    if (result.savedLanguage) {
      langSelect.value = result.savedLanguage;
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, MONACO_LANG_MAP[result.savedLanguage] || 'plaintext');
      }
    }
    if (result.savedCode) {
      editor.setValue(result.savedCode);
    }
  });
}

function showToast(message: string, isSuccess = true) {
  const toast = document.getElementById('toast')!;
  toast.textContent = message;
  toast.className = `toast ${isSuccess ? 'success' : ''}`;
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

/**
 * Normaliza o código para envio (ex: adapta Java public class Main para Wandbox)
 */
function prepareCodeForExecution(code: string, language: string): string {
  if (language === 'java') {
    return code.replace(/\bpublic\s+class\s+Main\b/, 'class Main');
  }
  return code;
}

/**
 * Limpa espaços em branco e indentações de cada linha para exibição perfeitamente alinhada
 */
function cleanDisplay(str: string): string {
  if (!str) return '';
  return str
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Renderiza os casos de teste com status de execução e veredito
 */
function renderTestCases(testCases: TestCase[]) {
  const container = document.getElementById('test-cases-list')!;
  const testCountEl = document.getElementById('test-count')!;
  testCountEl.textContent = testCases.length.toString();

  if (testCases.length === 0) {
    container.innerHTML = `
      <p class="placeholder-text">
        Nenhum caso de teste encontrado nesta página.
      </p>
    `;
    return;
  }

  container.innerHTML = '';

  testCases.forEach((tc) => {
    const card = document.createElement('div');
    card.className = 'test-case-card';
    card.id = `test-card-${tc.id}`;

    let statusBadge = '<span class="status-badge pending">Não testado</span>';
    let bannerHtml = '';

    if (tc.verdict === 'RUNNING') {
      statusBadge = '<span class="status-badge running">Executando...</span>';
    } else if (tc.verdict === 'AC') {
      statusBadge = `<span class="status-badge ac">Passou <span class="execution-time">${tc.executionTime}ms</span></span>`;
    } else if (tc.verdict === 'WA') {
      statusBadge = `<span class="status-badge wa">Falhou <span class="execution-time">${tc.executionTime}ms</span></span>`;
    } else if (tc.verdict === 'PE') {
      statusBadge = `<span class="status-badge pe">Presentation Error <span class="execution-time">${tc.executionTime}ms</span></span>`;
      bannerHtml = `<div class="verdict-banner pe">Aviso de apresentação: os valores bateram, mas há divergência de quebras de linha ou espaços!</div>`;
    } else if (tc.verdict === 'CE') {
      statusBadge = '<span class="status-badge ce">Erro de Compilação</span>';
      bannerHtml = `<div class="verdict-banner ce">${escapeHtml(tc.error || 'Erro de compilação')}</div>`;
    } else if (tc.verdict === 'RE') {
      statusBadge = '<span class="status-badge re">Erro de Execução</span>';
      bannerHtml = `<div class="verdict-banner re">${escapeHtml(tc.error || 'Erro em tempo de execução')}</div>`;
    }

    const hasActual = tc.actualOutput !== undefined || tc.verdict === 'RUNNING';
    const gridClass = hasActual ? 'test-case-grid three-cols' : 'test-case-grid';

    let actualBoxClass = 'code-box';
    if (tc.verdict === 'AC') actualBoxClass += ' pass';
    if (tc.verdict === 'WA' || tc.verdict === 'CE' || tc.verdict === 'RE') actualBoxClass += ' fail';

    card.innerHTML = `
      <div class="test-case-header">
        <div class="test-case-actions">
          <span>Caso #${tc.id}</span>
          <button class="btn-icon btn-copy" title="Copiar entrada">Copiar</button>
        </div>
        ${statusBadge}
      </div>
      <div class="${gridClass}">
        <div class="test-case-col">
          <label>Entrada (stdin):</label>
          <pre class="code-box">${escapeHtml(cleanDisplay(tc.input) || '(vazio)')}</pre>
        </div>
        <div class="test-case-col">
          <label>Saída Esperada:</label>
          <pre class="code-box">${escapeHtml(cleanDisplay(tc.expectedOutput) || '(vazio)')}</pre>
        </div>
        ${
          hasActual
            ? `
          <div class="test-case-col">
            <label>Saída Obtida:</label>
            <pre class="${actualBoxClass}">${escapeHtml(cleanDisplay(tc.actualOutput || '') || (tc.verdict === 'RUNNING' ? 'Rodando...' : ''))}</pre>
          </div>
        `
            : ''
        }
      </div>
      ${bannerHtml}
    `;

    // Botão de copiar entrada
    const copyBtn = card.querySelector('.btn-copy');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(tc.input);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copiado!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1500);
    });

    container.appendChild(card);
  });

  // Botão para adicionar teste manual
  const addBtnContainer = document.createElement('div');
  addBtnContainer.className = 'add-test-container';
  addBtnContainer.innerHTML = `
    <button id="btn-add-test" class="btn btn-secondary">
      Adicionar Teste Personalizado
    </button>
  `;
  container.appendChild(addBtnContainer);

  document.getElementById('btn-add-test')?.addEventListener('click', () => {
    const input = prompt('Digite o input (stdin) para o novo caso de teste:');
    if (input !== null) {
      const expectedOutput = prompt('Digite o output esperado (opcional):') || '';
      const newTestCase: TestCase = {
        id: testCases.length + 1,
        input,
        expectedOutput,
      };
      testCases.push(newTestCase);
      renderTestCases(testCases);
    }
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Atualiza as informações do problema na barra superior
function updateProblemUI(problem: ProblemInfo) {
  currentProblem = problem;
  const idEl = document.getElementById('problem-id')!;
  const titleEl = document.getElementById('problem-title')!;

  idEl.textContent = problem.id ? `#${problem.id}` : 'Beecrowd';
  titleEl.textContent = problem.title || 'Problema sem título';
  titleEl.title = `${problem.title} (${problem.timeLimit || '1s'})`;

  renderTestCases(problem.testCases);
}

// Configuração dos botões de execução e submissão
function setupControls() {
  const runBtn = document.getElementById('btn-run') as HTMLButtonElement;
  const submitBtn = document.getElementById('btn-submit-beecrowd') as HTMLButtonElement;
  const langSelect = document.getElementById('language-select') as HTMLSelectElement;

  // Botão Enviar ao Beecrowd
  submitBtn.addEventListener('click', async () => {
    const code = editor.getValue();
    const language = langSelect.value;

    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Injetando...';
    submitBtn.disabled = true;

    try {
      const result = await injectCodeIntoBeecrowd(code, language);
      showToast(result.message, result.success);
    } catch (err: any) {
      showToast(`Erro ao injetar: ${err?.message || err}`, false);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // Botão Rodar Testes
  runBtn.addEventListener('click', async () => {
    const rawCode = editor.getValue();
    const language = langSelect.value;
    const code = prepareCodeForExecution(rawCode, language);

    // Se estiver na aba de Entrada Manual
    if (activeTabName === 'custom') {
      const stdinEl = document.getElementById('custom-stdin') as HTMLTextAreaElement;
      const stdoutEl = document.getElementById('custom-stdout') as HTMLElement;

      runBtn.disabled = true;
      runBtn.textContent = 'Rodando...';
      stdoutEl.classList.remove('placeholder');
      stdoutEl.textContent = 'Executando código...';

      try {
        const result = await executeCode(language, code, stdinEl.value);
        if (result.stdout) {
          stdoutEl.textContent = result.stdout;
        } else if (result.stderr) {
          stdoutEl.textContent = `[Erro]:\n${result.stderr}`;
        } else {
          stdoutEl.textContent = '(Execução concluída sem saída)';
        }
      } catch (err: any) {
        stdoutEl.textContent = `Erro: ${err?.message || err}`;
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = 'Rodar Testes';
      }
      return;
    }

    // Se estiver na aba de Exemplos do Beecrowd
    if (!currentProblem || currentProblem.testCases.length === 0) {
      showToast('Nenhum caso de teste carregado para rodar.', false);
      return;
    }

    runBtn.disabled = true;
    runBtn.textContent = 'Rodando Testes...';

    // Marca todos os casos como RUNNING
    currentProblem.testCases.forEach((tc) => {
      tc.verdict = 'RUNNING';
    });
    renderTestCases(currentProblem.testCases);

    try {
      const batchRes = await executeBatchTests(language, code, currentProblem.testCases);

      if (batchRes.isCompileError) {
        // Erro de compilação geral: propaga para todos os casos
        currentProblem.testCases.forEach((tc) => {
          tc.verdict = 'CE';
          tc.error = batchRes.compileError || 'Erro de Compilação';
          tc.actualOutput = '';
          tc.executionTime = batchRes.compileTime || 0;
        });
      } else if (batchRes.error) {
        showToast(batchRes.error, false);
        currentProblem.testCases.forEach((tc) => {
          tc.verdict = 'RE';
          tc.error = batchRes.error;
          tc.actualOutput = '';
        });
      } else if (batchRes.results) {
        const resultMap = new Map(batchRes.results.map((r) => [r.id, r]));

        currentProblem.testCases.forEach((tc) => {
          const res = resultMap.get(tc.id);
          if (res) {
            const evaluation = evaluateOutput(res.stdout, tc.expectedOutput, res.stderr, res.exitCode);
            tc.verdict = evaluation.verdict;
            tc.actualOutput = res.stdout || res.stderr;
            tc.error = res.stderr;
            tc.executionTime = res.executionTime;
          }
        });
      }
    } catch (err: any) {
      console.error('Erro na bateria de testes:', err);
      showToast(`Erro na execução: ${err?.message || err}`, false);
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = 'Rodar Testes';
      renderTestCases(currentProblem.testCases);
    }
  });
}

// Configuração das Abas (Exemplos vs Manual)
function setupTabs() {
  const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const tabContents = document.querySelectorAll<HTMLDivElement>('.tab-content');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.dataset.tab as 'tests' | 'custom';
      activeTabName = tabId;

      const target = document.getElementById(`${tabId}-view`);
      if (target) {
        target.classList.add('active');
      }
    });
  });
}

// Sincronização manual com a aba ativa do Beecrowd
function setupSyncButton() {
  const syncBtn = document.getElementById('btn-sync');
  syncBtn?.addEventListener('click', async () => {
    syncBtn.classList.add('spinning');
    await fetchProblemFromActiveTab();
    setTimeout(() => {
      syncBtn.classList.remove('spinning');
    }, 800);
  });
}

async function fetchProblemFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PROBLEM_INFO' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[SidePanel] Conteúdo não disponível na aba ativa.');
          return;
        }
        if (response?.problem && response.problem.testCases?.length > 0) {
          updateProblemUI(response.problem);
        }
      });
    }
  } catch (err) {
    console.warn('[SidePanel] Falha ao consultar aba:', err);
  }
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PROBLEM_LOADED' && message.data) {
      console.log('[SidePanel] Novo problema recebido via broadcast:', message.data);
      updateProblemUI(message.data);
    }
  });
}

function loadCachedProblem() {
  chrome.storage?.local?.get(['lastProblem'], (result) => {
    if (result.lastProblem && !currentProblem) {
      updateProblemUI(result.lastProblem);
    }
  });
}

async function initHostStatus() {
  const hostEl = document.getElementById('host-status');
  if (!hostEl) return;

  hostEl.textContent = 'Verificando...';
  hostEl.className = 'badge-host badge-host-checking';

  const status = await checkNativeHost();
  if (status.available) {
    hostEl.textContent = '⚡ Local (PC)';
    hostEl.className = 'badge-host badge-host-online';
    hostEl.title = 'Host Nativo Conectado! Seus códigos compilam e rodam no seu computador com velocidade máxima.';
  } else {
    hostEl.textContent = '🔴 Host Offline';
    hostEl.className = 'badge-host badge-host-offline';
    hostEl.title = `Host Nativo offline (${status.error || 'não registrado'}). Clique para ver instruções de ativação.`;
  }

  hostEl.onclick = async () => {
    hostEl.textContent = 'Verificando...';
    hostEl.className = 'badge-host badge-host-checking';

    const latestStatus = await checkNativeHost();
    if (latestStatus.available) {
      hostEl.textContent = '⚡ Local (PC)';
      hostEl.className = 'badge-host badge-host-online';
      hostEl.title = 'Host Nativo Conectado! Seus códigos compilam e rodam no seu computador com velocidade máxima.';
      const langs = latestStatus.compilers
        ? Object.entries(latestStatus.compilers)
            .filter(([_, v]) => v)
            .map(([k]) => k)
            .join(', ')
        : 'C++, C, Python, JS';
      showToast(`⚡ Host Nativo Conectado! Compiladores: ${langs}`);
    } else {
      hostEl.textContent = '🔴 Host Offline';
      hostEl.className = 'badge-host badge-host-offline';
      hostEl.title = `Host Nativo offline (${latestStatus.error || 'não registrado'}). Clique para tentar novamente.`;
      alert(
        `Host Nativo ainda não respondeu.\n\n` +
        `• Mensagem do Chrome: "${latestStatus.error || 'Host não encontrado'}"\n` +
        `• ID desta extensão: "${chrome.runtime.id}"\n\n` +
        `Para resolver:\n` +
        `1. Recarregue a extensão em chrome://extensions/ (botão 🔄)\n` +
        `2. Clique novamente aqui para conectar!`
      );
    }
  };
}

// Inicialização geral
document.addEventListener('DOMContentLoaded', () => {
  initEditor();
  setupTabs();
  setupSyncButton();
  setupControls();
  setupMessageListener();
  loadCachedProblem();
  fetchProblemFromActiveTab();
  initHostStatus();
  console.log('[Beecrowd Companion] Side panel pronto com submissão direta e Host Nativo!');
});

