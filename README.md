# PaletScan 📦🔍

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/github-yxfyqmrp)

Uma solução moderna e intuitiva de escaneamento de códigos de barras, projetada especialmente para o controle de validades e endereçamento de paletes em câmaras frias do setor de perecíveis.

---

## 🎯 Proposta, Estratégia & Autoria

O **PaletScan** não nasceu em uma sala de reuniões corporativas, mas sim no cotidiano logístico do chão de fábrica. O projeto foi idealizado e inteiramente desenvolvido por **Jean Barbosa**, Operador de Empilhadeira do setor de Perecíveis na **Loja 410 do Fort Atacadista (Florianópolis - SC)** — uma unidade desta rede de atacarejo —, em parceria inteligente com o **Agente Antigravity** (IA da Google DeepMind). A aplicação une o conhecimento prático da rotina de armazenagem com soluções modernas de tecnologia para eliminar o atrito no controle de validades e no endereçamento.

A armazenagem e a gestão de estoque em câmaras frias exigem foco operacional e eficiência máxima. A estratégia principal do **PaletScan** baseia-se em dois pilares fundamentais:

*   **Foco no Impacto e Prevenção de Perdas:** O objetivo do sistema não é manter uma base de cadastro para a totalidade dos produtos da loja. Em vez disso, o foco está direcionado àqueles itens onde a dor operacional e financeira da perda por vencimento seria mais forte.
*   **Agilização de Alto Giro:** Facilitar a identificação, o controle de validades e o fluxo de saída rápida de produtos de alto giro, otimizando o espaço das câmaras frias e reduzindo rupturas de estoque.

---

## ✨ Funcionalidades Atuais

O **PaletScan** foi projetado com uma interface altamente otimizada para o operador do chão de fábrica, reduzindo cliques e maximizando a acurácia dos dados. Suas principais funcionalidades incluem:

*   **Leitor Multiformato via Câmera Traseira:** Escaneamento ágil com mira laser animada e interface em tempo real utilizando a câmera do dispositivo móvel.
*   **Envio de Imagem & Recorte Inteligente (Crop):** Em ambientes frios, reflexos no plástico filme do palete ou iluminação deficiente podem dificultar a leitura automática. O app permite subir fotos da galeria e fornece uma janela de enquadramento interativo (`react-zoom-pan-pinch`) para que o operador isole e decodifique manualmente o código de barras ou Data Matrix.
*   **Decodificador Inteligente (Regex Industrial):** Lógica avançada em [regex.ts](file:///root/meus-repos/PaletScan/lib/regex.ts) para interpretar strings industriais complexas:
    *   **GS1-128 / Data Matrix Bruto:** Extração direta do padrão `01` (GTIN-14) e `17` (data de validade no formato `YYMMDD`).
    *   **Cálculo Automático de Validade:** Se o Data Matrix contiver apenas a data de fabricação, o sistema proativamente calcula e sugere a data de validade adicionando **+365 dias**.
    *   **EAN-13, EAN-8 e DUN-14:** Suporte a caixas de embarque e produtos individuais.
    *   **Normalização de EANs:** Tratamento para preenchimento de zeros à esquerda (ex: produtos Friboi), garantindo o carregamento correto de imagens e dados.
    *   **Suporte a Pesagem Customizada:** Reconhecimento dinâmico de produtos que necessitam de pesagem física (ex: indicativo `(pesar)` para marcas específicas, como Lar).
*   **Banco de Dados Integrado com Google Sheets:** Sincronização em tempo real das operações de cadastro e consulta utilizando a API do Google Sheets (`googleapis`), gerando planilhas compartilhadas acessíveis corporativamente.
*   **Radar de Validade & Watchlist:** Alerta visual e sonoro imediato se o operador escanear um produto que está sob observação especial na lista de atenção (Watchlist), disparando animações comemorativas (`canvas-confetti`) na localização do item para motivar o time.
*   **Prevenção de Ocupação Duplicada:** Verificação inteligente em tempo real que impede a alocação de mais de um palete ativo no mesmo endereço físico da câmara, bloqueando o botão de confirmação e exibindo um aviso destacado.
*   **Exportação Inteligente de Relatórios:** Geração de relatórios tabulares adequados às diretrizes do sistema operacional Android (veja a seção [Ambiente Móvel](#-ambiente-de-desenvolvimento-e-produção-móvel)).
*   **Painel e Histórico de Cadastros:** Tela dedicada para visualizar todos os paletes registrados, permitindo filtros de busca e vinculação manual rápida de DUN-14 diretamente nos detalhes do produto.
*   **Geração Externa de QR Codes de Estoque:** Capacidade de gerar QR Codes para leitura direta do estoque no sistema da loja, eliminando a necessidade de o operador acessar o outro sistema de retaguarda de forma direta.
*   **Suporte Multi-idioma (Espanhol):** Possui a opção integrada de tradução completa da interface para o idioma espanhol, ampliando a acessibilidade para equipes internacionais ou operacionais diversas.

---

## 🗺️ Lógica de Endereçamento de Paletes

A armazenagem em câmaras frias exige um endereçamento preciso e de fácil visualização para os operadores de empilhadeira. O sistema de vagas deste aplicativo foi estruturado com base nas referências físicas do layout do depósito, descritas nos seguintes documentos de planejamento:

*   [Visualização Física do Endereço (PAS_VAGAS_ENDERECO.jpeg)](https://drive.google.com/file/d/10ZuKOpKvAz85GU8wtilXAFVf2z9ltmEO/view?usp=drivesdk)
*   [Planilha de Zoneamento de Vagas (Matriz_PAS.pdf)](https://drive.google.com/file/d/1dYnfBErtCrACiNqTub2XfxXhBhbW0knX/view?usp=drivesdk)

### 📌 Composição do Código de Vaga

O código de endereçamento físico segue o padrão Rack, Módulo, Gaveta e Vaga, totalizando 4 caracteres contínuos (ex: A10D ou B53E). Cada elemento indica uma coordenada exata no depósito:

| Elemento | Significado | Valores Possíveis | Descrição |
| :--- | :--- | :--- | :--- |
| **Rack** | Corredor | `A` (Direita) \| `B` (Esquerda) | Define o lado da estrutura porta-palete em relação ao corredor de entrada central. |
| **Módulo** | Coluna | `1`, `2`, `3`, `4`, `5` | Indica a posição horizontal (montante) a partir da entrada da câmara (1) até o fundo (5). |
| **Gaveta** | Altura (Nível) | `0` (Chão) \| `1` (Inferior) \| `2` (Central) \| `3` (Superior) | O nível vertical de armazenagem. `0` é o palete blocado no solo; `1`, `2` e `3` são as prateleiras elevadas. |
| **Vaga** | Posição Lateral | `D` (Direita) \| `E` (Esquerda) | A posição exata do palete na gaveta em questão. |

#### Exemplo de Leitura do Código:
> `A11E` = **Rack A** (lado direito), **Módulo 1** (primeira coluna na entrada), **Gaveta 1** (primeiro nível acima do chão), **Vaga E** (palete da esquerda).

---

### 🔄 Fluxo de Identificação e Controle Físico

Para garantir a acuracidade da localização de cada lote estocado nas câmaras (**Resfriados 1, Resfriados 2, Congelados 1 e Congelados 2**), o processo segue o fluxo operacional abaixo:

1. **Gravação dos Dados:** O operador realiza a leitura e o cadastro dos dados do palete no aplicativo (associando o produto à câmara e vaga correspondentes).
2. **Marcação e Colagem das Etiquetas:** Para a sinalização física, é utilizada a **etiqueta adesiva da impressora da balança**, colada diretamente no papelão da caixa do produto (no **primeiro lastro do palete**, de baixo para cima e por baixo do plástico filme). O operador escreve à mão a identificação (o código de endereçamento mais as iniciais da câmara, ex: `R1-A32E` ou `C2-B20D`) utilizando um **canetão de cor vermelha**. São coladas duas etiquetas por palete: **uma na frente e outra atrás**.
3. **Resiliência de Controle:** Mesmo que, por alguma eventualidade operacional, o palete não seja colocado exatamente na vaga correta dentro da câmara, o controle do estoque é mantido com sucesso. Isso é garantido pois o palete carrega a sinalização física legível de sua vaga planejada e o número de variações do código de endereçamento é finito para cada câmara.

---

## 📱 Ambiente de Desenvolvimento e Produção Móvel

Um dos maiores diferenciais técnicos do **PaletScan** é a sua integração com o ecossistema móvel no qual o operador atua diariamente. O projeto foi estruturado para suportar o desenvolvimento e a execução direta no dispositivo físico:

*   **Desenvolvimento Mobile-First:** O app foi validado e otimizado diretamente em celulares Android com emulador de terminal **Termux** rodando um contêiner Ubuntu completo.
*   **Parceria Inteligente:** Integração ativa com o assistente de desenvolvimento **Antigravity** (IA da Google DeepMind), auxiliando no diagnóstico rápido, controle de git, automação e deploy.
*   **Exportação de Planilhas CSV para Dispositivos Móveis:**
    *   **Codificação CP1252 (Windows-1252) e Delimitador Ponto e Vírgula (`;`):** Ao exportar os dados tabulares do banco para download e abertura direta em ferramentas como Excel e Google Sheets no celular Android, o app utiliza a codificação Windows-1252. Isso garante a perfeita renderização de acentos, ç, ã e caracteres especiais sem erros de formatação.
    *   **Indexação Instantânea de Arquivos no Android (Media Scan):** Imediatamente após a gravação de arquivos exportados na pasta de downloads do celular (`/sdcard/Download/`), o sistema invoca o comando `termux-media-scan /sdcard/Download/nome_do_arquivo.ext`. Isso força o Android a indexar e registrar a mídia de imediato na biblioteca do sistema operacional, tornando o arquivo visível sem atrasos nos gerenciadores de arquivos locais.

---

## 🛠️ Stack Tecnológica

*   **Framework:** [Next.js](https://nextjs.org/) (Pages Router)
*   **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
*   **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
*   **Leitor de Imagens/Câmera:** [@zxing/library](https://github.com/zxing-js/library) & Barcode Detector API nativa
*   **Banco de Dados & Integração:** Google Sheets API (`googleapis`)
*   **Manipulação de Imagem:** `react-zoom-pan-pinch` (para zoom e recorte de alta precisão)
*   **Deploy:** Hospedagem nativa na [Vercel](https://vercel.com/) ou [Netlify](https://www.netlify.com/)

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
Acesse [http://localhost:3000](http://localhost:3000) no seu navegador ou use o IP local do computador para acessar do celular conectado na mesma rede.

### 5. Compilar para produção
```bash
npm run build
npm run start
```
