import { ExecutionResponse, Verdict } from '../types';

interface CompilerConfig {
  compiler: string;
  options?: string;
  compilerOptions?: string;
}

const COMPILER_MAP: Record<string, CompilerConfig> = {
  cpp: {
    compiler: 'gcc-13.2.0',
    options: '-std=c++20 -O2',
  },
  c: {
    compiler: 'gcc-13.2.0-c',
    options: '-std=c17 -O2',
  },
  python: {
    compiler: 'cpython-3.12.7',
  },
  java: {
    compiler: 'openjdk-jdk-21+35',
  },
  csharp: {
    compiler: 'mono-6.12.0.199',
  },
  javascript: {
    compiler: 'nodejs-20.17.0',
  },
};

/**
 * Executa o código remotamente via Wandbox API
 */
export async function executeCode(
  language: string,
  code: string,
  stdin: string
): Promise<ExecutionResponse> {
  const config = COMPILER_MAP[language] || COMPILER_MAP.cpp;
  const startTime = performance.now();

  try {
    const payload: Record<string, any> = {
      compiler: config.compiler,
      code,
      stdin,
    };

    if (config.options) {
      payload.options = config.options;
    }

    const response = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const endTime = performance.now();
    const executionTime = Math.round(endTime - startTime);

    const stdout = data.program_output || '';
    const stderr = (data.compiler_error || '') + (data.program_error || '');
    const exitCode = data.status !== undefined ? parseInt(data.status, 10) : 0;

    return {
      success: exitCode === 0 && !data.compiler_error,
      stdout,
      stderr: stderr.trim(),
      exitCode,
      executionTime,
    };
  } catch (error: any) {
    const endTime = performance.now();
    return {
      success: false,
      stdout: '',
      stderr: `Erro de conexão com o executor: ${error?.message || error}`,
      exitCode: -1,
      executionTime: Math.round(endTime - startTime),
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
    if (stderr.toLowerCase().includes('error:') || stderr.toLowerCase().includes('syntaxerror')) {
      return { verdict: 'CE', message: 'Erro de Compilação' };
    }
    return { verdict: 'RE', message: 'Erro em Tempo de Execução' };
  }

  // Normalização de quebras de linha
  const normActual = actual.replace(/\r\n/g, '\n');
  const normExpected = expected.replace(/\r\n/g, '\n');

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
