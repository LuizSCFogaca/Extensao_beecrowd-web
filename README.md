# 🐝 Beecrowd Companion - Extensão para Google Chrome & Mozilla Firefox

Uma extensão completa e moderna para resolver problemas no **Beecrowd** (antigo URI Online Judge) diretamente no navegador, eliminando a necessidade de alternar entre o VS Code e a plataforma.

Agora **multiplataforma (Linux & Windows)** e **multinavegador (Firefox, Chrome, Brave, Chromium e Edge)**!

---

## 🚀 Principais Funcionalidades

1. **Aba Lateral com Monaco Editor (Núcleo do VS Code)**:
   - Interface idêntica ao VS Code com tema escuro.
   - Suporte completo e realce de sintaxe para: **C, C++ 17/20, Python 3, Java 21, C# e JavaScript (Node.js)**.
   - Modelos de código inicial (*templates*) com leitura de entrada padrão já configurada.
   - Salvamento automático contínuo (`chrome.storage.local` / `browser.storage.local`) para não perder nenhum código.

2. **Leitura e Extração Automática de Problemas**:
   - Detecta automaticamente o ID da questão (ex: `#1001`), o título e o limite de tempo.
   - Raspa as tabelas de **Exemplo de Entrada** e **Exemplo de Saída** (inclusive dentro dos iframes do Beecrowd).
   - Suporte multilíngue (Português, Inglês e Espanhol).
   - Botão para adicionar casos de teste manuais personalizados.
   - Botão de cópia rápida (📋) para a entrada de cada teste.

3. **Execução Local Nativa com Desempenho Instantâneo (⚡ 4ms a 60ms)**:
   - Compila e roda os códigos **diretamente no seu processador** via **WebExtensions / Chrome Native Messaging**.
   - Zero dependência de servidores remotos lentos.
   - Compilação inteligente única para C/C++: o binário é gerado 1x e reutilizado para rodar todos os casos de teste em milissegundos.
   - Execução em lote com feedback visual em tempo real para cada caso de teste.
   - **Vereditos inteligentes**:
     - 🟩 **Passou (`AC`)**: saída bate perfeitamente com a esperada (com indicação do tempo de resposta em ms).
     - 🟨 **Presentation Error (`PE`)**: detecta se o resultado matemático/lógico está certo, mas faltou ou sobrou quebra de linha (`\n`) ou espaço.
     - 🟥 **Resposta Incorreta (`WA`)**: exibe a saída obtida ao lado da saída esperada com destaque de erro.
     - 🟪 **Erro de Compilação / Execução (`CE` / `RE`)**: exibe o traceback ou mensagens detalhadas do compilador.
   - **Aba de Entrada Manual**: permite testar entradas personalizadas (`stdin`) livres e inspecionar a saída gerada (`stdout` / `stderr`).

4. **Integração com a Submissão do Beecrowd**:
   - Botão **"📥 Enviar ao Beecrowd"**:
     - Injeta o código diretamente no editor oficial do Beecrowd (Ace Editor / textarea).
     - Seleciona automaticamente a linguagem correspondente no dropdown do Beecrowd.
     - Rola a página suavemente até o formulário de envio.
     - Copia o código para a área de transferência (`clipboard`) com notificação Toast instantânea.

---

## 🧰 Pré-requisitos (Compiladores Locais)

Para executar os códigos no seu computador, certifique-se de ter os compiladores/interpretadores instalados:

### No Arch Linux
```bash
sudo pacman -S gcc python nodejs
# Opcional (para Java e C#):
sudo pacman -S jdk-openjdk dotnet-sdk
```

### No Ubuntu / Debian
```bash
sudo apt update && sudo apt install build-essential python3 nodejs
# Opcional:
sudo apt install default-jdk dotnet-sdk-8.0
```

### No Windows
- **C/C++**: [MSYS2](https://www.msys2.org/) (com pacote `mingw-w64-ucrt-x86_64-gcc`) adicionado ao PATH.
- **Python**: [python.org](https://www.python.org/) (marcar "Add Python to PATH" durante a instalação).
- **Node.js**: [nodejs.org](https://nodejs.org/).

---

## 🛠️ Como Instalar no Navegador

### 🦊 Opção A: Mozilla Firefox (Linux & Windows)

1. Abra o Firefox e acesse na barra de endereços:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. Clique no botão **"Carregar extensão temporária..."** (*Load Temporary Add-on...*).
3. Selecione o arquivo de manifesto gerado na pasta do projeto:
   ```
   dist/manifest.json
   ```
4. A extensão será carregada! A barra lateral abrirá ao clicar no ícone do Beecrowd Companion na barra de ferramentas ou através do menu de barras laterais do Firefox.
5. **Registrar o Runner Nativo**:
   - **No Linux (Arch)**: execute no terminal dentro da pasta do projeto:
     ```bash
     ./registrar-host.sh
     # ou: npm run register-host
     ```
   - **No Windows**: dê dois cliques no arquivo `registrar-host.bat` (ou execute `npm run register-host`).

---

### 🌐 Opção B: Google Chrome / Brave / Edge / Chromium (Linux & Windows)

1. Abra o Chrome e acesse:
   ```
   chrome://extensions/
   ```
2. No canto superior direito, ative a chave **"Modo do desenvolvedor"**.
3. Clique no botão **"Carregar sem compactação"** (*Load unpacked*).
4. Selecione a pasta **`dist/`** do projeto.
5. Fixe o ícone da extensão na barra de ferramentas.
6. **Registrar o Runner Nativo**:
   - **No Linux (Arch)**: execute no terminal `./registrar-host.sh` (ou `npm run register-host`).
   - **No Windows**: dê dois cliques no arquivo `registrar-host.bat` (ou execute `npm run register-host`).

---

## 🔍 Diagnóstico e Teste do Runner Nativo

Você pode verificar a qualquer momento se seus compiladores estão sendo detectados e testar a velocidade de compilação/execução local rodando:

```bash
npm run test-host
```

Exemplo de saída no Arch Linux:
```text
=== TESTE DE DIAGNÓSTICO DO RUNNER NATIVO ===
Compiladores detectados:
 - C++ (g++): /usr/bin/g++
 - C (gcc): /usr/bin/gcc
 - Python: /usr/bin/python3
 - Node.js: /usr/bin/node
 - Java (javac): NÃO ENCONTRADO

Testando compilação e execução C++...
Resultado C++: {
  "success": true,
  "isCompileError": false,
  "results": [
    { "id": 1, "stdout": "X = 19\n", "exitCode": 0, "executionTime": 4 },
    { "id": 2, "stdout": "X = -6\n", "exitCode": 0, "executionTime": 4 }
  ]
}
```

---

## 💻 Comandos de Desenvolvimento

Caso queira fazer alterações no código-fonte (`src/`):

* **Instalar dependências**:
  ```bash
  npm install
  ```
* **Gerar nova build de produção**:
  ```bash
  npm run build
  ```
* **Registrar Host Nativo**:
  ```bash
  npm run register-host
  ```
* **Desinstalar Host Nativo**:
  ```bash
  npm run unregister-host
  ```
* Após rodar `npm run build`, recarregue a extensão na página de extensões do seu navegador (🔄).

---

## 📁 Estrutura de Arquivos

```
BeecrowdWeb/
├── dist/                          # Extensão compilada (pronta para Chrome e Firefox)
├── public/
│   ├── manifest.json              # Manifesto V3 híbrido (Chrome side_panel + Firefox sidebar_action)
│   └── content-loader.js          # Carregador dinâmico do Content Script
├── native-host/
│   ├── runner-host.js             # Motor de execução stdio multiplataforma (C++, C, Python, JS, Java)
│   ├── runner-host.sh             # Wrapper executável para Linux / macOS
│   ├── runner-host.bat            # Wrapper executável para Windows
│   ├── install.js                 # Instalador automático de registros no Linux e Windows
│   ├── uninstall.js               # Desinstalador automático de registros
│   └── com.beecrowd.runner.json   # Modelo do manifesto nativo
├── registrar-host.sh              # Script de registro rápido para Linux
├── registrar-host.bat             # Script de registro rápido para Windows
├── src/
│   ├── types.ts                   # Tipos TypeScript compartilhados
│   ├── background/
│   │   └── index.ts               # Background Worker híbrido (Chrome sidePanel & Firefox sidebarAction)
│   ├── content/
│   │   └── index.ts               # Extrator de enunciados e tabelas do Beecrowd (suporte a iframes)
│   └── sidepanel/
│       ├── main.ts                # Lógica principal, Monaco Editor e interface
│       ├── runner.ts              # Cliente WebExtensions Native Messaging e validador de diff
│       ├── injector.ts            # Injetor de código no formulário oficial do Beecrowd
│       └── style.css              # Estilização completa estilo VS Code
├── sidepanel.html                 # Interface HTML do painel lateral
├── package.json                   # Dependências e scripts npm
├── tsconfig.json                  # Configurações do compilador TypeScript
└── vite.config.ts                 # Configuração de build do Vite
```
