# Meu Scanner 📦🔍

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/github-yxfyqmrp)

Uma solução moderna e intuitiva de escaneamento de códigos de barras, projetada especialmente para o controle de validades e endereçamento de paletes em câmaras frias do setor de perecíveis.

---

## 💡 A Origem do Projeto: Do Chão de Fábrica à Tecnologia

Este projeto não nasceu em uma sala de reuniões corporativa, mas sim na vivência diária de quem opera e compreende as reais dificuldades logísticas no chão de fábrica. 

A aplicação foi idealizada e desenvolvida por um **Operador de Empilhadeira do setor de Perecíveis**, aliando o conhecimento prático e profundo da rotina operacional de armazenagem com um sólido background em tecnologia e melhoria contínua de processos. O objetivo principal foi criar uma ferramenta de alta usabilidade para dispositivos móveis que eliminasse o atrito do controle de validades, garantindo acuracidade operacional com o menor número de toques possível.

---

## 🗺️ Lógica de Endereçamento de Vagas (PAS)

A armazenagem em câmaras frias de perecíveis exige um endereçamento cirúrgico e de fácil visualização para os operadores de empilhadeira. O sistema de vagas deste aplicativo foi estruturado com base nas referências físicas do layout do depósito, descritas nos seguintes documentos de planejamento:

*   [Visualização Física do Endereço (PAS_VAGAS_ENDERECO.jpeg)](https://drive.google.com/file/d/10ZuKOpKvAz85GU8wtilXAFVf2z9ltmEO/view?usp=drivesdk)
*   [Planilha de Zoneamento de Vagas (Matriz_PAS.pdf)](https://drive.google.com/file/d/1dYnfBErtCrACiNqTub2XfxXhBhbW0knX/view?usp=drivesdk)

### 📌 Estrutura do Endereço Físico

O código de endereçamento físico colado nas estantes (porta-paletes) segue o padrão **`Hack-Módulo-Gaveta-Vaga`**, totalizando 7 caracteres separados por hifens (ex: `A-1-0-D` ou `B-5-3-E`). Cada elemento indica uma coordenada exata no depósito:

| Elemento | Significado | Valores Possíveis | Descrição |
| :--- | :--- | :--- | :--- |
| **Hack (Rack)** | Corredor | `A` (Direita) \| `B` (Esquerda) | Define o lado da estrutura porta-palete em relação ao corredor de entrada central. |
| **Módulo** | Coluna | `1`, `2`, `3`, `4`, `5` | Indica a posição horizontal (montante) a partir da entrada da câmara (1) até o fundo (5). |
| **Gaveta** | Altura (Nível) | `0` (Chão) \| `1` (Inferior) \| `2` (Central) \| `3` (Superior) | O nível vertical de armazenagem. `0` é o palete blocado no solo; `1`, `2` e `3` são as prateleiras elevadas. |
| **Vaga** | Posição Lateral | `D` (Direita) \| `E` (Esquerda) | A posição exata do palete na gaveta em questão. |

#### Exemplo de Leitura Física:
> `A-1-1-E` = **Hack A** (lado direito), **Módulo 1** (primeira coluna na entrada), **Gaveta 1** (primeira prateleira acima do chão), **Vaga E** (palete da esquerda).

---

### 📱 Tradução Digital: O Formato Compacto (Sem Hifens)

> [!NOTE]
> Para tornar o uso em celulares e coletores rápido e eficiente, o aplicativo traduz o endereço físico de 7 caracteres para um formato compacto de **4 caracteres sem hifens** (ex: **`A11E`**).
> 
> *   **Endereço Físico:** `A-1-1-E` ➡️ **Endereço no App:** `A11E`
> *   **Endereço Físico:** `B-5-0-D` ➡️ **Endereço no App:** `B50D`

Isso economiza espaço na tela do dispositivo do operador, acelera buscas rápidas e reduz o tempo de digitação manual de vagas em caso de falha de leitura, otimizando o fluxo de trabalho sob baixas temperaturas.

---

### 🛡️ Prevenção de Ocupação Duplicada

Para garantir a confiabilidade dos registros de estoque nas câmaras (**Resfriados 1, Resfriados 2, Congelados 1 e Congelados 2**), o sistema implementa uma camada inteligente de prevenção de erros:
1. Ao iniciar uma sessão de trabalho, o operador seleciona o destino (Câmara e Vaga).
2. O aplicativo faz uma consulta em tempo real à planilha de controle (`/api/vagas-ocupadas`).
3. Se a vaga selecionada já estiver associada a algum produto ativo no sistema, o botão de confirmação é bloqueado e um alerta vermelho é exibido na tela, impedindo que dois produtos diferentes sejam alocados na mesma vaga física por engano.

---

## ✨ Funcionalidades Principais

*   **Leitor Multiformato via Câmera:** Escaneamento ágil com mira laser animada e interface em tempo real utilizando a câmera traseira do celular.
*   **Envio de Imagem & Crop Inteligente:** Permite subir fotos de códigos da galeria do celular. Se a leitura automática falhar devido a reflexos comuns em câmaras frias, o app abre uma janela de enquadramento interativo (`react-zoom-pan-pinch`) para que o operador isole o código (Data Matrix ou código de barras) de forma manual.
*   **Decodificador Inteligente (Regex):** Lógica avançada em [regex.ts](file:///root/meus-repos/meu-scanner/lib/regex.ts) para interpretar strings industriais complexas:
    *   **GS1-128 / Data Matrix Bruto:** Identifica o padrão `01` (GTIN de 14 dígitos) e `17` (data de validade no formato `YYMMDD`).
    *   **Cálculo Automático de Validade:** Se o Data Matrix contiver a data de fabricação, o sistema calcula e sugere automaticamente a validade adicionando **+365 dias**.
    *   **DUN-14, EAN-13 e EAN-8:** Suporte para identificação de caixas fechadas de embarque (DUN-14) e itens individuais (EAN-13/EAN-8).
*   **Google Sheets como Banco de Dados:** Conexão direta com a API do Google Sheets (`googleapis`), salvando e consultando dados diretamente em planilhas compartilhadas no Drive corporativo sem necessidade de servidores de banco de dados pesados e caros.
*   **Radar de Validade / Watchlist:** Sistema de alerta integrado que avisa o operador se o produto escaneado faz parte de uma lista sob observação especial (watchlist), disparando efeitos visuais de comemoração (`canvas-confetti`) na localização do item.
*   **Interface Premium com Dark Mode:** Desenvolvido com foco na estética moderna e conforto visual em ambientes escuros de câmaras frias.

---

## 🛠️ Stack Tecnológica

*   **Framework:** [Next.js](https://nextjs.org/) (Pages Router)
*   **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
*   **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
*   **Leitor de Imagens:** [@zxing/library](https://github.com/zxing-js/library) & Barcode Detector API nativa do navegador
*   **Banco de Dados & Integração:** Google Sheets API (`googleapis`)
*   **Manipulação de Imagem:** `react-zoom-pan-pinch` (para zoom e recorte móvel)
*   **Deploy:** Otimizado para hospedagem na [Vercel](https://vercel.com/) ou [Netlify](https://www.netlify.com/)

---

## ⚙️ Instalação e Execução Local

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/meu-scanner.git
cd meu-scanner
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as Variáveis de Ambiente (`.env.local`)
Crie um arquivo `.env.local` na raiz do projeto e configure as chaves de acesso à API do Google:

```env
# Configurações do Google Cloud Service Account
GOOGLE_SERVICE_ACCOUNT_EMAIL=seu-email-da-service-account@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_AQUI\n-----END PRIVATE KEY-----\n"

# ID das Planilhas do Google Sheets (Bancos de Dados)
BANCO_CADASTRO_SHEET_ID=id_da_planilha_onde_serao_gravados_os_scans
BANCO_VALIDA_SHEET_ID=id_da_planilha_contendo_a_base_de_produtos_validos
```

### 4. Rodar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000) no seu navegador ou acesse pelo celular na mesma rede local utilizando o IP do computador.

### 5. Compilar para produção
```bash
npm run build
npm run start
```
