import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IDs conhecidos da extensão
const knownIds = new Set([
  'ghoilpfpdconipgmfcpfcjgmeabadkoe',
  'boenloljgjbdfcfljmlobcgeoolkncff',
]);

const customId = process.argv[2];
if (customId) {
  knownIds.add(customId.trim());
}

// Auto-detecta IDs de extensões instaladas no Chrome e Edge
function autoDetectExtensionIds() {
  const browserDataDirs = [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
  ];

  for (const baseDir of browserDataDirs) {
    if (!fs.existsSync(baseDir)) continue;

    const profileDirs = ['Default', 'Profile 1', 'Profile 2', 'Profile 3'];
    for (const pDir of profileDirs) {
      const spPath = path.join(baseDir, pDir, 'Secure Preferences');
      if (fs.existsSync(spPath)) {
        try {
          const content = fs.readFileSync(spPath, 'utf8');
          const data = JSON.parse(content);
          const settings = data.extensions?.settings || {};
          for (const [id, val] of Object.entries(settings)) {
            const p = (val && val.path) || '';
            if (p.toLowerCase().includes('beecrowd')) {
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

autoDetectExtensionIds();

const allowedOrigins = Array.from(knownIds).map((id) => `chrome-extension://${id}/`);

const batPath = path.resolve(__dirname, 'runner-host.bat');
const manifestPath = path.resolve(__dirname, 'com.beecrowd.runner.json');

const hostManifest = {
  name: 'com.beecrowd.runner',
  description: 'Beecrowd Companion Native Runner Host',
  path: batPath,
  type: 'stdio',
  allowed_origins: allowedOrigins,
};

fs.writeFileSync(manifestPath, JSON.stringify(hostManifest, null, 2), 'utf8');
console.log(`[1/3] Arquivo de manifesto criado em: ${manifestPath}`);

// Registra no Registro do Windows para o Google Chrome
try {
  execSync(
    `reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.beecrowd.runner" /ve /t REG_SZ /d "${manifestPath}" /f`,
    { stdio: 'inherit' }
  );
  console.log('[2/3] Registrado com sucesso no Google Chrome (HKCU).');
} catch (err) {
  console.error('Falha ao registrar no Google Chrome:', err.message);
}

// Registra no Registro do Windows para o Microsoft Edge
try {
  execSync(
    `reg add "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.beecrowd.runner" /ve /t REG_SZ /d "${manifestPath}" /f`,
    { stdio: 'inherit' }
  );
  console.log('[3/3] Registrado com sucesso no Microsoft Edge (HKCU).');
} catch (err) {
  console.error('Falha ao registrar no Microsoft Edge:', err.message);
}

console.log('\n======================================================');
console.log('✅ Host Nativo instalado e pronto para uso!');
console.log('IDs autorizados no Chrome:');
for (const origin of allowedOrigins) {
  console.log(` - ${origin}`);
}
console.log('======================================================\n');
