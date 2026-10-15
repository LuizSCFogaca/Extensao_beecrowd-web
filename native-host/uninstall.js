import { execSync } from 'node:child_process';

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

console.log('Host nativo desregistrado.');
