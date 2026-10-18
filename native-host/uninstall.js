import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const homeDir = os.homedir();

if (isWindows) {
  console.log('Removendo registros do Host Nativo no Windows...');

  try {
    execSync(
      'reg delete "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.beecrowd.runner" /f',
      { stdio: 'inherit' }
    );
    console.log('Removido do Google Chrome.');
  } catch {
    console.log('Chave do Chrome não encontrada ou já removida.');
  }

  try {
    execSync(
      'reg delete "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.beecrowd.runner" /f',
      { stdio: 'inherit' }
    );
    console.log('Removido do Microsoft Edge.');
  } catch {
    console.log('Chave do Edge não encontrada ou já removida.');
  }

  try {
    execSync(
      'reg delete "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.beecrowd.runner" /f',
      { stdio: 'inherit' }
    );
    console.log('Removido do Mozilla Firefox.');
  } catch {
    console.log('Chave do Firefox não encontrada ou já removida.');
  }
} else {
  console.log('Removendo manifestos do Host Nativo no Linux...');

  const manifestPaths = [
    path.join(homeDir, '.mozilla', 'native-messaging-hosts', 'com.beecrowd.runner.json'),
    path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts', 'com.beecrowd.runner.json'),
    path.join(homeDir, '.config', 'chromium', 'NativeMessagingHosts', 'com.beecrowd.runner.json'),
    path.join(homeDir, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts', 'com.beecrowd.runner.json'),
  ];

  for (const mPath of manifestPaths) {
    if (fs.existsSync(mPath)) {
      try {
        fs.unlinkSync(mPath);
        console.log(`Removido: ${mPath}`);
      } catch (err) {
        console.warn(`Erro ao remover ${mPath}:`, err.message);
      }
    }
  }
}

console.log('Host nativo desregistrado.');
