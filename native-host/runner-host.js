import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';

/**
 * Log de depuração (escreve no stderr para NUNCA corromper o stdout binário do Chrome)
 */
function debugLog(...args) {
  process.stderr.write(`[Host] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
}

/**
 * Busca caminhos de executáveis no sistema evitando stubs (como WindowsApps do Python)
 */
function findExecutable(name, preferredPaths = []) {
  for (const p of preferredPaths) {
    if (p && fs.existsSync(p)) return p;
  }
  try {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? `where.exe ${name}` : `which ${name}`;
    const res = execSync(checkCmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const lines = res
      .trim()
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (isWin) {
      // Ignora stubs do WindowsApps (que abrem a loja da Microsoft em vez de rodar)
      const valid = lines.filter(l => !l.toLowerCase().includes('windowsapps'));
      if (valid.length > 0) return valid[0];
    }
    if (lines.length > 0) return lines[0];
  } catch {
    // Não encontrado
  }
  return null;
}

/**
 * Dicionário com caminhos dos compiladores/interpretadores detectados
 */
function detectCompilers() {
  const isWin = process.platform === 'win32';
  const msysUcrt = isWin ? 'C:\\msys64\\ucrt64\\bin' : '';
  const msysMingw = isWin ? 'C:\\msys64\\mingw64\\bin' : '';

  const preferredPython = isWin
    ? [
        path.join(msysUcrt, 'python.exe'),
        path.join(msysMingw, 'python.exe'),
        'C:\\Python312\\python.exe',
        'C:\\Python311\\python.exe',
        'C:\\Python310\\python.exe',
      ]
    : ['/usr/bin/python3', '/usr/bin/python'];

  return {
    cpp: findExecutable('g++', isWin ? [path.join(msysUcrt, 'g++.exe'), path.join(msysMingw, 'g++.exe')] : ['/usr/bin/g++']),
    c: findExecutable('gcc', isWin ? [path.join(msysUcrt, 'gcc.exe'), path.join(msysMingw, 'gcc.exe')] : ['/usr/bin/gcc']),
    python: findExecutable('python3', preferredPython) || findExecutable('python', preferredPython),
    javascript: process.execPath || findExecutable('node'),
    java: {
      javac: findExecutable('javac', isWin ? [] : ['/usr/bin/javac']),
      java: findExecutable('java', isWin ? [] : ['/usr/bin/java']),
    },
    csharp: findExecutable('dotnet') || findExecutable('csc'),
  };
}

/**
 * Compila o código fonte se necessário (C++, C, Java)
 */
function compileCode(language, srcFile, exeFile, compilers) {
  const startTime = performance.now();

  if (language === 'cpp') {
    const gpp = compilers.cpp;
    if (!gpp) {
      return { success: false, error: 'Compilador C++ (g++) não encontrado no computador.' };
    }
    const res = spawnSync(gpp, ['-std=c++20', '-O2', srcFile, '-o', exeFile], {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    });
    const compileTime = Math.round(performance.now() - startTime);
    if (res.status !== 0) {
      return { success: false, error: res.stderr || res.stdout || 'Erro de compilação desconhecido.', compileTime };
    }
    return { success: true, compileTime };
  }

  if (language === 'c') {
    const gcc = compilers.c;
    if (!gcc) {
      return { success: false, error: 'Compilador C (gcc) não encontrado no computador.' };
    }
    const res = spawnSync(gcc, ['-std=c17', '-O2', srcFile, '-o', exeFile], {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    });
    const compileTime = Math.round(performance.now() - startTime);
    if (res.status !== 0) {
      return { success: false, error: res.stderr || res.stdout || 'Erro de compilação desconhecido.', compileTime };
    }
    return { success: true, compileTime };
  }

  if (language === 'java') {
    const javac = compilers.java?.javac;
    if (!javac) {
      return { success: false, error: 'JDK Java (javac) não encontrado no computador.' };
    }
    const res = spawnSync(javac, [srcFile], {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    });
    const compileTime = Math.round(performance.now() - startTime);
    if (res.status !== 0) {
      return { success: false, error: res.stderr || res.stdout || 'Erro de compilação Java.', compileTime };
    }
    return { success: true, compileTime };
  }

  return { success: true, compileTime: 0 };
}

/**
 * Executa um único teste com o arquivo compilado ou script
 */
function runSingleCase(language, tempDir, exeFile, srcFile, stdin, compilers, timeoutMs = 3000) {
  let command = '';
  let args = [];
  let cwd = tempDir;

  if (language === 'cpp' || language === 'c') {
    command = exeFile;
    args = [];
  } else if (language === 'python') {
    if (!compilers.python) {
      return {
        stdout: '',
        stderr: 'Interpretador Python não encontrado no computador.',
        exitCode: 1,
        executionTime: 0,
      };
    }
    command = compilers.python;
    args = ['-u', srcFile];
  } else if (language === 'javascript') {
    command = compilers.javascript;
    args = [srcFile];
  } else if (language === 'java') {
    if (!compilers.java?.java) {
      return {
        stdout: '',
        stderr: 'Runtime Java (java) não encontrado no computador.',
        exitCode: 1,
        executionTime: 0,
      };
    }
    command = compilers.java.java;
    args = ['-cp', tempDir, 'Main'];
  } else {
    return {
      stdout: '',
      stderr: `Linguagem '${language}' não suportada para execução local.`,
      exitCode: 1,
      executionTime: 0,
    };
  }

  const startTime = performance.now();
  const res = spawnSync(command, args, {
    input: stdin || '',
    encoding: 'utf8',
    timeout: timeoutMs,
    cwd,
    windowsHide: true,
  });
  const endTime = performance.now();
  const executionTime = Math.round(endTime - startTime);

  if (res.error) {
    if (res.error.code === 'ETIMEDOUT') {
      return {
        stdout: res.stdout || '',
        stderr: `Tempo limite excedido (${timeoutMs}ms). Verifique se o código possui loops infinitos.`,
        exitCode: 124,
        executionTime,
      };
    }
    return {
      stdout: res.stdout || '',
      stderr: `Erro de execução: ${res.error.message}`,
      exitCode: 1,
      executionTime,
    };
  }

  return {
    stdout: res.stdout || '',
    stderr: (res.stderr || '').trim(),
    exitCode: res.status !== null ? res.status : 0,
    executionTime,
  };
}

/**
 * Processa a execução de código (única ou lote)
 */
function handleExecution(msg) {
  const { language, code, testCases, stdin, action } = msg;
  const compilers = detectCompilers();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beecrowd-run-'));
  const extMap = { cpp: '.cpp', c: '.c', python: '.py', javascript: '.js', java: '.java', csharp: '.cs' };
  const ext = extMap[language] || '.txt';

  const srcFile = path.join(tempDir, language === 'java' ? 'Main.java' : `solution${ext}`);
  const exeFile = path.join(tempDir, process.platform === 'win32' ? 'solution.exe' : 'solution');

  try {
    fs.writeFileSync(srcFile, code || '', 'utf8');

    // Compilação prévia se for C/C++/Java
    if (language === 'cpp' || language === 'c' || language === 'java') {
      const compResult = compileCode(language, srcFile, exeFile, compilers);
      if (!compResult.success) {
        return {
          success: false,
          isCompileError: true,
          compileError: compResult.error,
          compileTime: compResult.compileTime || 0,
        };
      }
    }

    // Modo 1: Bateria de testes em lote (Ultra Rápido)
    if (action === 'execute_batch' && Array.isArray(testCases)) {
      const results = testCases.map((tc) => {
        const runRes = runSingleCase(language, tempDir, exeFile, srcFile, tc.input, compilers);
        return {
          id: tc.id,
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTime: runRes.executionTime,
        };
      });

      return {
        success: true,
        isCompileError: false,
        results,
      };
    }

    // Modo 2: Execução única (Aba Entrada Manual)
    const runRes = runSingleCase(language, tempDir, exeFile, srcFile, stdin || '', compilers);
    return {
      success: runRes.exitCode === 0,
      isCompileError: false,
      stdout: runRes.stdout,
      stderr: runRes.stderr,
      exitCode: runRes.exitCode,
      executionTime: runRes.executionTime,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignora erro de limpeza
    }
  }
}

/**
 * Envia uma mensagem de resposta para o Chrome via stdout com header de 4 bytes
 */
function sendNativeMessage(msg) {
  const jsonStr = JSON.stringify(msg);
  const msgBuf = Buffer.from(jsonStr, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(msgBuf.length, 0);

  process.stdout.write(lenBuf);
  process.stdout.write(msgBuf);
}

/**
 * Loop principal de leitura do protocolo stdio do Chrome Native Messaging
 */
function startNativeMessaging() {
  let chunks = [];
  let totalLength = 0;
  let expectedLength = null;

  process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
      chunks.push(chunk);
      totalLength += chunk.length;

      while (true) {
        if (expectedLength === null) {
          if (totalLength < 4) break;
          const header = Buffer.concat(chunks);
          expectedLength = header.readUInt32LE(0);
          const remaining = header.subarray(4);
          chunks = remaining.length > 0 ? [remaining] : [];
          totalLength = remaining.length;
        }

        if (expectedLength !== null) {
          if (totalLength < expectedLength) break;
          const fullBuf = Buffer.concat(chunks);
          const msgBuf = fullBuf.subarray(0, expectedLength);
          const remainder = fullBuf.subarray(expectedLength);

          chunks = remainder.length > 0 ? [remainder] : [];
          totalLength = remainder.length;
          expectedLength = null;

          try {
            const message = JSON.parse(msgBuf.toString('utf8'));
            handleMessage(message);
          } catch (err) {
            debugLog('Erro ao processar JSON da mensagem:', err.message);
            sendNativeMessage({ success: false, error: `JSON inválido: ${err.message}` });
          }
        }
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

/**
 * Processador de mensagens recebidas
 */
function handleMessage(msg) {
  if (msg.action === 'ping') {
    const compilers = detectCompilers();
    sendNativeMessage({
      success: true,
      compilers: {
        cpp: !!compilers.cpp,
        c: !!compilers.c,
        python: !!compilers.python,
        javascript: !!compilers.javascript,
        java: !!compilers.java?.javac,
        csharp: !!compilers.csharp,
      },
      paths: {
        cpp: compilers.cpp,
        c: compilers.c,
        python: compilers.python,
        javascript: compilers.javascript,
      },
    });
    return;
  }

  if (msg.action === 'execute' || msg.action === 'execute_batch') {
    const result = handleExecution(msg);
    sendNativeMessage(result);
    return;
  }

  sendNativeMessage({ success: false, error: `Ação desconhecida: ${msg.action}` });
}

// Modo de auto-teste no terminal (`node native-host/runner-host.js --test`)
if (process.argv.includes('--test')) {
  console.log('=== TESTE DE DIAGNÓSTICO DO RUNNER NATIVO ===');
  const compilers = detectCompilers();
  console.log('Compiladores detectados:');
  console.log(' - C++ (g++):', compilers.cpp || 'NÃO ENCONTRADO');
  console.log(' - C (gcc):', compilers.c || 'NÃO ENCONTRADO');
  console.log(' - Python:', compilers.python || 'NÃO ENCONTRADO');
  console.log(' - Node.js:', compilers.javascript || 'NÃO ENCONTRADO');
  console.log(' - Java (javac):', compilers.java?.javac || 'NÃO ENCONTRADO');

  if (compilers.cpp) {
    console.log('\nTestando compilação e execução C++...');
    const cppRes = handleExecution({
      action: 'execute_batch',
      language: 'cpp',
      code: '#include <iostream>\nusing namespace std;\nint main(){ int a, b; if (cin >> a >> b) cout << "X = " << a+b << endl; return 0; }',
      testCases: [
        { id: 1, input: '10 9\n' },
        { id: 2, input: '-10 4\n' },
      ],
    });
    console.log('Resultado C++:', JSON.stringify(cppRes, null, 2));
  }

  if (compilers.python) {
    console.log('\nTestando execução Python...');
    const pyRes = handleExecution({
      action: 'execute_batch',
      language: 'python',
      code: 'a, b = map(int, input().split())\nprint(f"X = {a+b}")',
      testCases: [
        { id: 1, input: '10 9\n' },
        { id: 2, input: '-10 4\n' },
      ],
    });
    console.log('Resultado Python:', JSON.stringify(pyRes, null, 2));
  }

  process.exit(0);
}

// Inicia em modo Chrome Native Messaging
startNativeMessaging();
