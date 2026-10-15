# 🐝 Beecrowd Companion - Extensão para o Google Chrome

Uma extensão completa e moderna para resolver problemas no **Beecrowd** (antigo URI Online Judge) diretamente no navegador, eliminando a necessidade de alternar entre o VS Code e a plataforma.

---

## 🚀 Principais Funcionalidades

1. **Aba Lateral com Monaco Editor (Núcleo do VS Code)**:
   - Interface com tema escuro idêntica ao VS Code.
   - Suporte completo e realce de sintaxe para: **C, C++ 17, Python 3, Java 21, C# e JavaScript (Node.js)**.
   - Modelos de código inicial (*templates*) com leitura de entrada padrão já configurada.
   - Salvamento automático contínuo (`chrome.storage.local`) para não perder nenhum código caso recarregue ou feche a aba.

2. **Leitura e Extração Automática de Problemas**:
   - Detecta automaticamente o ID da questão (ex: `#1001`), o título e o limite de tempo.
   - Raspa as tabelas de **Exemplo de Entrada** e **Exemplo de Saída** (inclusive dentro dos iframes do Beecrowd).
   - Suporte multilíngue (Português, Inglês e Espanhol).
   - Botão para adicionar casos de teste manuais personalizados.
   - Botão de cópia rápida (📋) para a entrada de cada teste.

3. **Execução Local Nativa com Desempenho Idêntico ao VS Code (⚡ Instantâneo)**:
   - Compila e roda os códigos **diretamente no seu processador** via **Chrome Native Messaging**.
   - Zero dependência de APIs externas lentas (Wandbox/Piston removidos).
   - Compilação inteligente única para C/C++: o binário é gerado 1x e reutilizado para rodar todos os casos de teste em milissegundos (~20ms a 60ms por teste).
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

## 🛠️ Como Instalar no Google Chrome

1. Abra o Google Chrome e acesse:
   ```
   chrome://extensions/
   ```
2. No canto superior direito, ative a chave **"Modo do desenvolvedor"**.
3. Clique no botão **"Carregar sem compactação"** (*Load unpacked*).
4. Selecione a pasta do projeto:
   ```
   C:\Users\Home\Desktop\BeecrowdWeb\dist
   ```
5. Fixe o ícone da extensão na barra de ferramentas do Chrome.
6. Na pasta do projeto, dê dois cliques no arquivo **`registrar-host.bat`** (ou execute `npm run register-host`) para autorizar a extensão a executar seus compiladores locais. Pronto!

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
* Após rodar `npm run build`, basta clicar no ícone de recarregar (🔄) na página de extensões do Chrome (`chrome://extensions/`).

---

## 📁 Estrutura de Arquivos

```
BeecrowdWeb/
├── dist/                      # Extensão compilada (pronta para carregar no Chrome)
├── public/
│   ├── manifest.json          # Manifesto V3 da extensão
│   └── content-loader.js      # Carregador dinâmico do Content Script
├── src/
│   ├── types.ts               # Tipos TypeScript compartilhados
│   ├── background/
│   │   └── index.ts           # Service Worker do Chrome (Side Panel behavior)
│   ├── content/
│   │   └── index.ts           # Extrator de enunciados e tabelas do Beecrowd
│   └── sidepanel/
│       ├── main.ts            # Lógica principal, Monaco Editor e interface
│       ├── runner.ts          # Motor de execução remota e validador de diff
│       ├── injector.ts        # Injetor de código no formulário do Beecrowd
│       └── style.css          # Estilização completa estilo VS Code
├── sidepanel.html             # HTML da interface do Side Panel
├── package.json               # Dependências do projeto
├── tsconfig.json              # Configurações TypeScript
└── vite.config.ts             # Configuração de build do Vite
```
