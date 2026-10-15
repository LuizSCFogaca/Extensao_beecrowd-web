import { ExecutionResponse, Verdict, NativeHostStatus, BatchExecutionResponse, TestCase } from '../types';

const NATIVE_HOST_NAME = 'com.beecrowd.runner';

/**
 * Envia uma mensagem nativa para o host local via Chrome Native Messaging
 */
function sendNativeMessage<T = any>(message: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendNativeMessage) {
      reject(new Error('A API chrome.runtime.sendNativeMessage não está disponível neste contexto.'));
      return;
    }

    chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message || 'Erro ao conectar ao Host Nativo.'));
        return;
      }
      resolve(response as T);
    });
  });
}

/**
 * Verifica se o Host Nativo está instalado e registrado no Windows
 */
export async function checkNativeHost(): Promise<NativeHostStatus> {
  try {
    const res = await sendNativeMessage<{
      success: boolean;
      compilers: {
        cpp: boolean;
        c: boolean;
        python: boolean;
        javascript: boolean;
        java: boolean;
        csharp: boolean;
      };
      paths?: Record<string, string | null>;
    }>({ action: 'ping' });

    if (res?.success) {
      return {
        available: true,
        compilers: res.compilers,
        paths: res.paths,
      };
    }
    return {
      available: false,
      error: 'Host nativo respondeu com erro.',
    };
  } catch (err: any) {
    return {
      available: false,
      error: err?.message || 'Host nativo não encontrado.',
    };
  }
}

/**
 * Executa um caso de teste individual localmente via Host Nativo
 */
export async function executeCode(
  language: string,
  code: string,
  stdin: string
): Promise<ExecutionResponse> {
  const startTime = performance.now();

  try {
    const res = await sendNativeMessage<{
      success: boolean;
      isCompileError?: boolean;
      compileError?: string;
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      executionTime?: number;
      error?: string;
    }>({
      action: 'execute',
      language,
      code,
      stdin,
    });

    const endTime = performance.now();
    const executionTime = res.executionTime !== undefined ? res.executionTime : Math.round(endTime - startTime);

    if (res.isCompileError) {
      return {
        success: false,
        stdout: '',
        stderr: res.compileError || 'Erro de compilação',
        exitCode: 1,
        executionTime,
      };
    }

    if (res.error) {
      return {
        success: false,
        stdout: '',
        stderr: res.error,
        exitCode: 1,
        executionTime,
      };
    }

    return {
      success: res.exitCode === 0,
      stdout: res.stdout || '',
      stderr: res.stderr || '',
      exitCode: res.exitCode || 0,
      executionTime,
    };
  } catch (err: any) {
    const endTime = performance.now();
    return {
      success: false,
      stdout: '',
      stderr: `Erro de comunicação com o Host Nativo local: ${err?.message || err}\n\nCertifique-se de ter executado 'registrar-host.bat' na pasta da extensão.`,
      exitCode: -1,
      executionTime: Math.round(endTime - startTime),
    };
  }
}

/**
 * Executa uma bateria completa de testes localmente de uma só vez (Compila 1x e roda todos em ms)
 */
export async function executeBatchTests(
  language: string,
  code: string,
  testCases: TestCase[]
): Promise<BatchExecutionResponse> {
  try {
    const minimalCases = testCases.map((tc) => ({
      id: tc.id,
      input: tc.input,
    }));

    const res = await sendNativeMessage<BatchExecutionResponse>({
      action: 'execute_batch',
      language,
      code,
      testCases: minimalCases,
    });

    return res;
  } catch (err: any) {
    return {
      success: false,
      isCompileError: false,
      error: `Erro ao comunicar com o Host Nativo: ${err?.message || err}. Execute 'registrar-host.bat'.`,
    };
  }
}

/**
 * Avalia o resultado obtido comparando com a saída esperada
 */
export function evaluateOutput(
  actual: string,
  expected: string,
  stderr: string,
  exitCode: number
): { verdict: Verdict; message: string } {
  // Erro de compilação
  if (exitCode !== 0 && !actual && stderr) {
    const lower = stderr.toLowerCase();
    if (lower.includes('error:') || lower.includes('syntaxerror') || lower.includes('fatal error:')) {
      return { verdict: 'CE', message: 'Erro de Compilação' };
    }
    return { verdict: 'RE', message: 'Erro em Tempo de Execução' };
  }

  // Normalização de quebras de linha
  const normActual = (actual || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const normExpected = (expected || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Match exato
  if (normActual === normExpected || normActual === `${normExpected}\n`) {
    return { verdict: 'AC', message: 'Passou!' };
  }

  // Checagem de Presentation Error (comum no Beecrowd)
  if (normActual.trim() === normExpected.trim()) {
    return {
      verdict: 'PE',
      message: 'Presentation Error: Valores corretos, mas faltou ou sobrou quebra de linha/espaço!',
    };
  }

  // Resposta Incorreta
  return { verdict: 'WA', message: 'Resposta Errada (Divergência)' };
}
