# 📘 Relatório de Desenvolvimento e Decisões de Arquitetura
## Projeto: Beecrowd Companion (Extensão Google Chrome)

Este documento descreve detalhadamente as decisões de engenharia, os desafios técnicos enfrentados e o passo a passo da implementação da extensão **Beecrowd Companion**.

---

## 🧭 Sumário Executivo

O objetivo do projeto foi criar um ambiente de desenvolvimento integrado (IDE) dentro da própria página do **Beecrowd**, eliminando a necessidade de alternar janelas entre o VS Code e o navegador durante o treino de programação competitiva.

A solução entrega:
1. Painel lateral retrátil nativo do navegador com o **Monaco Editor** (o mesmo núcleo do VS Code).
2. Detecção e extração automatizada de enunciados e tabelas de casos de teste da página (incluindo `iframes`).
3. Compilação e execução remota de código em múltiplas linguagens (C, C++, Python, Java, C#, JS) via **Wandbox API**.
4. Validação automática contra saídas esperadas, com detecção específica de **Presentation Error (PE)** e exibição de diferenças (*diff*).
5. Injeção direta da solução no formulário de submissão oficial do Beecrowd.

---

## 🏛️ Arquitetura Geral do Sistema

A extensão foi construída sob o padrão **Manifest V3** utilizando **TypeScript** e empacotada com **Vite**:

```
                              ┌────────────────────────────────────────┐
                              │       Aba Ativa do Beecrowd            │
                              │  - Página do problema ou iframes      │
                              │  - Tabela de Exemplos (Entrada/Saída) │
                              │  - Formulário / Ace Editor Oficial     │
                              └──────────────────┬─────────────────────┘
                                                 │
                                 Content Script (content.js)
                                 - Scraper de DOM (all_frames: true)
                                 - Injeção em world: 'MAIN'
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │ (chrome.runtime.sendMessage│ e chrome.storage.local)     │
                    ▼                                                         ▼
       ┌─────────────────────────┐                               ┌─────────────────────────┐
       │   Background Worker     │                               │    Side Panel Nativo    │
       │     (background.js)     │                               │     (sidepanel.html)    │
       │ - Gerencia abertura ao  │                               │ - Monaco Editor (VSCode)│
       │   clicar no ícone       │                               │ - Seletor de linguagens │
       └─────────────────────────┘                               │ - Bateria de testes     │
                                                                 │ - Runner & Validador    │
                                                                 └────────────┬────────────┘
                                                                              │
                                                                       Requisição HTTP
                                                                              │
                                                                              ▼
                                                                 ┌─────────────────────────┐
                                                                 │       Wandbox API       │
                                                                 │  - GCC 13.2 (C / C++20) │
                                                                 │  - CPython 3.12         │
                                                                 │  - OpenJDK 21           │
                                                                 │  - Mono 6 (C#)          │
                                                                 │  - Node.js 20           │
                                                                 └─────────────────────────┘
```

---

## 🛠️ Passo a Passo Detalhado e Decisões Técnicas

---

### Passo 1: Fundação, Manifesto V3 e Monaco Editor

#### 1.1. Decisão: Chrome Side Panel API vs Injeção na DOM
* **Alternativa A (Descartada)**: Injetar um `<iframe>` ou `<aside>` com Shadow DOM diretamente dentro do HTML do Beecrowd.
  * *Problema*: Conflitos de CSS/z-index, quebra do layout responsivo do Beecrowd, perda de foco ao navegar entre problemas ou recarregar a página.
* **Alternativa B (Adotada)**: Utilizar a nova **Chrome Side Panel API** (`chrome.sidePanel`), disponível no Manifest V3.
  * *Vantagens*: Interface lateral nativa do navegador, desacoplada da folha de estilos do Beecrowd, com persistência entre abas e excelente fluidez de uso.

#### 1.2. Decisão: Monaco Editor no Vite
* O Monaco Editor utiliza múltiplos *Web Workers* para realizar análise de sintaxe em segundo plano sem travar a interface (`editor.worker`, `ts.worker`, etc.).
* **Implementação**:
  - Configuramos o Vite para carregar os workers utilizando a sintaxe `import worker from 'module?worker'`.
  - Criamos o arquivo de tipagem `src/vite-env.d.ts` para que o compilador do TypeScript reconhecesse as queries de worker do Vite sem erros.
  - Otimizamos a experiência desativando o minimapa (`minimap: { enabled: false }`) para economizar largura útil no painel lateral.

#### 1.3. Persistência de Código e Modelos Iniciais
* Alunos frequentemente perdem seu código ao atualizar uma página sem querer.
* **Solução**: Implementamos um ouvinte com *debounce* de 500ms salvando continuamente o código e a linguagem selecionada no `chrome.storage.local`.
* Adicionamos códigos iniciais (*boilerplate*) para cada linguagem já formatados com a leitura de `stdin` (leitura com `cin`, `scanf`, `sys.stdin.read()`, `Scanner`, etc.).

---

### Passo 2: Extrator Inteligente do Beecrowd (Content Script)

#### 2.1. O Desafio dos Iframes no Beecrowd
* No Beecrowd, o enunciado do problema frequentemente não fica na página principal, mas sim dentro de um `iframe` carregado de subdomínios (ex: `resources.beecrowd.com/repository/UOJ_1001.html`).
* **Decisão**: Configuramos `"all_frames": true` no `manifest.json`. Isso permite que o content script execute automaticamente dentro de qualquer frame da página, garantindo que o enunciado seja lido independentemente de onde esteja aninhado.

#### 2.2. Tratamento de Formatação e Quebras de Linha
* No HTML do Beecrowd, quebras de linha em entradas multilinhas costumam ser renderizadas com `<br>`, `<p>` ou nós de texto crus dentro de `<table class="division">`.
* Se extraído com um simples `.innerText` ou `.textContent`, os caracteres de controle podem se perder ou gerar espaços duplicados.
* **Solução**: Criamos uma função de clonagem do nó DOM que converte explicitamente `<br>` e quebras de bloco para o caractere `\n` real, além de normalizar finais de linha CRLF (`\r\n`) para LF (`\n`).

#### 2.3. Resiliência a Idiomas e Estruturas
* O scraper não depende de IDs estáticos. Ele busca cabeçalhos que contenham palavras-chave em três idiomas:
  - Português: *"Exemplo de Entrada"*, *"Exemplo de Saída"*
  - Inglês: *"Input Sample"*, *"Output Sample"*
  - Espanhol: *"Ejemplo de Entrada"*, *"Ejemplo de Salida"*
* Adicionamos também suporte a testes personalizados criados pelo usuário no botão **"➕ Adicionar Teste Personalizado"**.

---

### Passo 3: Motor de Execução Remoto e Validação Automática

#### 3.1. O Desafio da Execução e a Transição Piston ➔ Wandbox
* O navegador web é uma sandbox que não possui compiladores de C, C++ ou Java embutidos.
* **Investigação Inicial**: O plano era usar a API pública do Piston (`emkc.org`).
* **Problema Encontrado**: Ao testar a API do Piston durante a execução, descobrimos que em fevereiro de 2026 a API pública do Piston foi alterada para modo restrito (*whitelist-only*).
* **Decisão & Resolução Rápida**: Identificamos e homologamos a **Wandbox API** (`https://wandbox.org/api/compile.json`), uma API pública consolidada, sem necessidade de chaves de API, com suporte a compiladores modernos:
  - C++: `gcc-13.2.0` com `-std=c++20 -O2`
  - C: `gcc-13.2.0-c` com `-std=c17 -O2`
  - Python: `cpython-3.12.7`
  - Java: `openjdk-jdk-21+35`
  - C#: `mono-6.12.0.199`
  - JavaScript: `nodejs-20.17.0`

#### 3.2. Normalização de Código para Java
* No Beecrowd, submissões em Java exigem que a classe principal se chame `public class Main`. No entanto, compiladores remotos geralmente nomeiam o arquivo temporário de trabalho como `prog.java`, gerando o erro de compilação: *"class Main is public, should be declared in a file named Main.java"*.
* **Solução Elegante**: O runner intercepta códigos em Java e converte transparentemente `public class Main` para `class Main` antes do envio, permitindo que o aluno escreva no padrão estrito do Beecrowd sem erros.

#### 3.3. Classificação de Vereditos e Alerta de Presentation Error (PE)
* Uma das maiores frustrações no Beecrowd é o **Presentation Error**: o algoritmo calcula o valor correto, mas o juiz rejeita por causa de um espaço em branco a mais ou ausência do `\n` final.
* O motor avalia as saídas com a seguinte hierarquia:
  1. **Match Exato (`AC`)**: Conteúdo e formatação idênticos.
  2. **Presentation Error (`PE`)**: `actual.trim() === expected.trim()`. O sistema avisa com um banner amarelo destacando a questão de quebra de linha ou espaçamento.
  3. **Wrong Answer (`WA`)**: Valores divergentes; renderiza a caixa em vermelho lado a lado.
  4. **Compilation Error (`CE`) / Runtime Error (`RE`)**: Extrai a mensagem de erro do compilador/interpretador.

#### 3.4. Execução em Lote e Aba de Entrada Manual
* O botão **"▶ Rodar Testes"** executa todos os exemplos de teste em paralelo via `Promise.all`, atualizando cada card visualmente em tempo real.
* A aba **"Entrada Manual"** permite digitar qualquer entrada arbitrária no `stdin` e ver a saída gerada no `stdout`.

---

### Passo 4: Integração com a Submissão Oficial do Beecrowd

#### 4.1. O Desafio do Isolamento de Contexto (Isolated World vs Main World)
* As extensões do Chrome executam content scripts em um "mundo isolado" (*Isolated World*). Isso significa que variáveis JavaScript da página (como a instância global `window.ace` do Ace Editor do Beecrowd) não são acessíveis por scripts de conteúdo comuns.
* **Solução**:
  - Utilizamos a API `chrome.scripting.executeScript` com a propriedade `world: 'MAIN'`.
  - Isso executa a função de injeção diretamente no contexto da página do Beecrowd, obtendo acesso nativo a `window.ace.edit(...)`.

#### 4.2. Estratégia de Injeção em Camadas
1. **Camada 1 (Ace Editor)**: Localiza o elemento `.ace_editor` e aplica `editor.setValue(code, 1)`.
2. **Camada 2 (Formulários/Textareas)**: Caso o Beecrowd utilize textareas convencionais (`#source-code`, `textarea[name="source_code"]`), preenche o valor e dispara eventos `input` e `change` para que o framework da página detecte a modificação.
3. **Camada 3 (Sincronização de Linguagem)**: Analisa as opções do `<select name="language_id">` e seleciona automaticamente a linguagem correspondente (evitando conflitos comuns, como selecionar C++ quando o usuário escolheu C puro).
4. **Camada 4 (Rolagem & Clipboard)**: Rola a página suavemente até o formulário e salva o código no `clipboard` com um Toast elegante.

---

### Refinamentos Visuais e Extração Completa

1. **Alinhamento e Formatação das Linhas de Teste**:
   - Correção do espaçamento interno das células do Beecrowd através de sanitização linha a linha (`.split('\n').map(l => l.trim()).join('\n')`), evitando que quebras multilinhas desloquem a segunda linha para o canto direito ao alargar a janela.
   - Aplicação de `text-align: left; display: block; word-break: break-word;` no `.code-box` e `.test-case-col`.
2. **Design Minimalista sem Emojis e Ícones SVG**:
   - Substituição do botão atualizar por um ícone SVG nativo com animação de rotação suave (`.btn-icon-only`).
   - Remoção de emojis em botões e vereditos ("Passou", "Falhou", "Presentation Error", "Executando", "Enviar ao Beecrowd", "Rodar Testes").
3. **Varredura Completa de Todos os Casos de Teste**:
   - Algoritmo aprimorado com `getScrapingDocuments()` para varrer todas as linhas de dados (`<tr>`), tabelas subsequentes (`table.division`) e documentos aninhados em iframes.
   - Extração sequencial de todos os exemplos de teste presentes na questão (Exemplo #1, #2, #3, etc.) para teste simultâneo.

---

## 📊 Matriz de Decisões e Alternativas

| Desafio | Abordagem Escolhida | Por que foi escolhida? |
| :--- | :--- | :--- |
| **Interface do Editor** | Chrome Side Panel API (`chrome.sidePanel`) | Não interfere no DOM/CSS do Beecrowd; mantém o layout do site intacto. |
| **Motor do Editor** | Monaco Editor | Oferece a mesma experiência, atalhos e comodidade visual do VS Code. |
| **Execução de Código** | Wandbox API | Gratuita, moderna, sem necessidade de tokens e com suporte a C++20, Java 21, Python 3.12, C# e JS. |
| **Captura de Testes** | Content Script com `all_frames: true` | O Beecrowd renderiza enunciados dentro de iframes; `all_frames` garante leitura universal. |
| **Diferença de Saída** | Comparador Semântico + Trim Check | Identifica *Presentation Errors* antes que o aluno submeta e perca pontuação. |
| **Injeção de Código** | `chrome.scripting` em `world: 'MAIN'` | Acesso direto ao objeto `window.ace` da página para colar o código no editor oficial. |

---

## 🎯 Conclusão

A extensão **Beecrowd Companion** transformou a experiência de resolver problemas no Beecrowd em um fluxo contínuo e integrado:
1. O aluno abre a questão no Beecrowd.
2. O painel lateral carrega automaticamente o enunciado, o título e todos os casos de teste.
3. O aluno digita sua solução no Monaco Editor (com autocomplete e realce do VS Code).
4. Clica em **"Rodar Testes"** e recebe feedback instantâneo sobre acerto, erro ou falha de apresentação.
5. Clica em **"Enviar ao Beecrowd"** para ter o código colado e a linguagem selecionada no formulário de submissão.
