import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isWindows = process.platform === 'win32';
const homeDir = os.homedir();

// IDs conhecidos da extensão para Chrome / Chromium
const knownIds = new Set([
  'ghoilpfpdconipgmfcpfcjgmeabadkoe', // ID padrão gerado pela "key" do manifest.json
  'boenloljgjbdfcfljmlobcgeoolkncff',
]);

const customId = process.argv[2];
if (customId) {
  knownIds.add(customId.trim());
}

// ID fixo da extensão no Firefox (conforme browser_specific_settings.gecko.id no manifest.json)
const FIREFOX_EXTENSION_ID = 'beecrowd-companion@local';

// Auto-detecta IDs de extensões instaladas no Chrome/Edge/Chromium se existirem
function autoDetectExtensionIds() {
  const browserDataDirs = isWindows
    ? [
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
      ]
    : [
        path.join(homeDir, '.config', 'google-chrome'),
        path.join(homeDir, '.config', 'chromium'),
        path.join(homeDir, '.config', 'BraveSoftware', 'Brave-Browser'),
      ];

  for (const baseDir of browserDataDirs) {
    if (!fs.existsSync(baseDir)) continue;

    const profileDirs = ['Default', 'Profile 1', 'Profile 2', 'Profile 3'];
    for (const pDir of profileDirs) {
      const spPath = path.join(baseDir, pDir, 'Secure Preferences');
      const prefPath = path.join(baseDir, pDir, 'Preferences');
      for (const filePath of [spPath, prefPath]) {
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            const settings = data.extensions?.settings || {};
            for (const [id, val] of Object.entries(settings)) {
              const p = (val && val.path) || '';
              if (typeof p === 'string' && p.toLowerCase().includes('beecrowd')) {
                knownIds.add(id);
              }
            }
          } catch {
            // Ignora erro de parsing
          }
        }
      }
    }
  }
}

autoDetectExtensionIds();

const allowedOrigins = Array.from(knownIds).map((id) => `chrome-extension://${id}/`);

// Define o script executável conforme o sistema operacional
const hostScriptPath = isWindows
  ? path.resolve(__dirname, 'runner-host.bat')
  : path.resolve(__dirname, 'runner-host.sh');

// No Linux, garante permissão de execução
if (!isWindows) {
  try {
    fs.chmodSync(hostScriptPath, 0o755);
    fs.chmodSync(path.resolve(__dirname, 'runner-host.js'), 0o755);
  } catch (err) {
    console.warn('Aviso ao ajustar permissões de execução:', err);
  }
}

// Manifestos específicos
const chromeManifest = {
  name: 'com.beecrowd.runner',
  description: 'Beecrowd Companion Native Runner Host',
  path: hostScriptPath,
  type: 'stdio',
  allowed_origins: allowedOrigins,
};

const firefoxManifest = {
  name: 'com.beecrowd.runner',
  description: 'Beecrowd Companion Native Runner Host',
  path: hostScriptPath,
  type: 'stdio',
  allowed_extensions: [FIREFOX_EXTENSION_ID],
};

// Manifesto local de referência na própria pasta native-host
const localManifestPath = path.resolve(__dirname, 'com.beecrowd.runner.json');
fs.writeFileSync(
  localManifestPath,
  JSON.stringify(
    {
      ...chromeManifest,
      allowed_extensions: [FIREFOX_EXTENSION_ID],
    },
    null,
    2
  ),
  'utf8'
);
console.log(`[1] Manifesto local gerado em: ${localManifestPath}`);

if (isWindows) {
  // Salva manifesto específico para Firefox no Windows
  const firefoxManifestPath = path.resolve(__dirname, 'com.beecrowd.runner.firefox.json');
  fs.writeFileSync(firefoxManifestPath, JSON.stringify(firefoxManifest, null, 2), 'utf8');

  // Registra no Registro do Windows para Google Chrome
  try {
    execSync(
      `reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.beecrowd.runner" /ve /t REG_SZ /d "${localManifestPath}" /f`,
      { stdio: 'inherit' }
    );
    console.log('[2/4] Registrado com sucesso no Google Chrome (HKCU).');
  } catch (err) {
    console.error('Falha ao registrar no Google Chrome:', err.message);
  }

  // Registra no Registro do Windows para Microsoft Edge
  try {
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.beecrowd.runner" /ve /t REG_SZ /d "${localManifestPath}" /f`,
      { stdio: 'inherit' }
    );
    console.log('[3/4] Registrado com sucesso no Microsoft Edge (HKCU).');
  } catch (err) {
    console.error('Falha ao registrar no Microsoft Edge:', err.message);
  }

  // Registra no Registro do Windows para Mozilla Firefox
  try {
    execSync(
      `reg add "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.beecrowd.runner" /ve /t REG_SZ /d "${firefoxManifestPath}" /f`,
      { stdio: 'inherit' }
    );
    console.log('[4/4] Registrado com sucesso no Mozilla Firefox (HKCU).');
  } catch (err) {
    console.error('Falha ao registrar no Mozilla Firefox:', err.message);
  }
} else {
  // Linux / Unix
  const registerTargets = [
    {
      name: 'Mozilla Firefox',
      dir: path.join(homeDir, '.mozilla', 'native-messaging-hosts'),
      manifest: firefoxManifest,
    },
    {
      name: 'Google Chrome',
      dir: path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts'),
      manifest: chromeManifest,
    },
    {
      name: 'Chromium',
      dir: path.join(homeDir, '.config', 'chromium', 'NativeMessagingHosts'),
      manifest: chromeManifest,
    },
    {
      name: 'Brave Browser',
      dir: path.join(homeDir, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
      manifest: chromeManifest,
    },
  ];

  let step = 2;
  for (const target of registerTargets) {
    try {
      fs.mkdirSync(target.dir, { recursive: true });
      const destFile = path.join(target.dir, 'com.beecrowd.runner.json');
      fs.writeFileSync(destFile, JSON.stringify(target.manifest, null, 2), 'utf8');
      console.log(`[${step}] Registrado para ${target.name}: ${destFile}`);
    } catch (err) {
      console.warn(`[${step}] Não foi possível registrar para ${target.name}:`, err.message);
    }
    step++;
  }
}

console.log('\n======================================================');
console.log('✅ Host Nativo instalado e pronto para uso!');
console.log(`Script configurado: ${hostScriptPath}`);
console.log('Firefox Extension ID:', FIREFOX_EXTENSION_ID);
console.log('Chrome Origins autorizados:');
for (const origin of allowedOrigins) {
  console.log(` - ${origin}`);
}
console.log('======================================================\n');
