# System design

Protótipos HTML que definiram a interface do app (visual inspirado na orca.dev: neutros puros,
primário monocromático, cor só para estado e categoria; Inter + JetBrains Mono).

| Arquivo | Tela |
|---|---|
| `prototypes/01-survey.html` | Varredura do volume (nome antigo: Survey) |
| `prototypes/02-classificacao.html` | Classificação por tier |
| `prototypes/03-plano.html` | Plano e aprovação (layout anterior ao 08b) |
| `prototypes/04-execucao.html` | Execução por tier (layout anterior ao 08b) |
| `prototypes/05-relatorio.html` | Relatório |
| `prototypes/06-historico.html` | Histórico de varreduras (análise) |
| `prototypes/menu/index.html` | Propostas de menu (12), estados em andamento e o **08b**, a direção vigente |
| `prototypes/menu/08b-fluxo-otimizado.html` | **Referência atual**: barra de status, Plano e Execução otimizados |

Abrir no navegador (funciona via `file://`, sem servidor). Dados de exemplo.

**Fonte do CSS:** `apps/desktop/src/styles/app.css`. Os protótipos de `menu/` importam esse arquivo
direto; `prototypes/assets/app.css` é o retrato dos protótipos originais (01–06) e não é mais
atualizado. A paleta dos tiers foi validada para daltonismo nos dois temas.

## Navegação

- **Barra lateral = só seções**: marca e Limpeza, Histórico, Configurações. O item ativo tem um
  destaque que desliza entre os itens. Nada de ambiente, versão ou tema aqui.
- **Barra de status** (rodapé da janela, 30 px, padrão de IDE): estado vivo à esquerda (**Pronto**,
  **Varrendo C: · N arquivos**, **Classificando…**, **Executando tier X · n/m** com barra real por
  item); no meio volume, sistema (e o catálogo só quando difere do sistema) e o modo **Aprovação
  explícita**; à direita o aviso de atualização (Baixar / Reiniciar e atualizar) e a versão, que leva
  a Configurações.
- **Tema só em Configurações** (Sistema/Claro/Escuro). A troca se revela em círculo a partir do clique
  (View Transitions); sem suporte ou com movimento reduzido, é instantânea.
- **Limpeza = fluxo em abas** no topo do conteúdo (`.flow`), só nas etapas 1–5. Cada aba é liberada
  pelo pré-requisito dela; aba trancada não é link (`aria-disabled`, cadeado, `title` dizendo o que
  concluir). Concluída ganha check verde. O destaque da etapa atual desliza; a linha entre abas enche
  quando a seguinte destranca; a aba destrancada sobe e acende uma vez.

| Aba | Liberada quando |
|---|---|
| Varredura | sempre |
| Classificação | varredura concluída |
| Plano | classificação com ao menos 1 item selecionável marcado |
| Execução | plano aprovado |
| Relatório | ao menos um tier executado |

**Nova análise** (cabeçalho do Relatório): volta à Varredura vazia e tranca as abas 2–5 de novo — limpa
o estado de varredura, classificação, plano, execução, relatório e exportação na interface. O
histórico de varreduras e as Configurações ficam. Sem confirmação: nada no disco muda, e o aviso ao
lado do botão lembra de exportar antes.

**Avançar fica no topo, e o que libera o avanço fica colado nele.** A ação que leva adiante é a única
primária e fica no cabeçalho da etapa (`.page-head .actions`, à direita), nunca no rodapé. Quando
falta um pré-requisito, o controle que o resolve fica logo abaixo do botão, não numa coluna lateral
nem depois de uma tabela; o motivo aparece em texto ao lado do controle.

| Etapa | Ação primária no cabeçalho |
|---|---|
| Varredura | Classificar candidatos (após a varredura; antes dela, Iniciar varredura) |
| Classificação | Montar plano |
| Plano | Aprovar plano |
| Execução | Executar tier X (o da vez); ao terminar, Ver relatório |
| Relatório | Nova análise |

Os pré-requisitos são independentes, não em cadeia: rever o Plano descarta a aprovação (tranca a
Execução), mas o Relatório dos tiers já executados continua acessível.

## Plano

- **Cartão de aprovação logo abaixo do cabeçalho**: à esquerda o resumo do que vai rodar (itens,
  liberação estimada e, com varredura na sessão, o livre estimado depois); à direita os dois
  requisitos numerados — **1 · Tiers que vão rodar** (um botão por tier, na cor do tier, com itens e
  GB) e **2 · Confirmação** (tracejada enquanto pendente, verde quando marcada).
- **Aprovar usa `aria-disabled`, não `disabled`**: clicar antes da hora não fica mudo — o requisito
  que falta treme, ganha contorno âmbar por um instante e (se for a confirmação) recebe o foco.
- **Itens agrupados por tier e recolhidos** (barra e total por grupo, "Expandir todos"). Tier fora da
  aprovação aparece esmaecido com "fora desta execução". A tela cabe sem rolar.
- **`plan.json` numa gaveta lateral** (botão no cabeçalho, Esc fecha), com Copiar e a dica da skill.

## Execução

Um tier por vez, sempre (cada tier roda uma vez por aprovação e pede confirmação própria). O que muda
é deixar claro o passo a passo:

- **Executar tier X no cabeçalho.** Durante a execução vira "Executando tier X…" com indicador.
- **Guia do passo** logo abaixo: "Passo k de n", o que fazer agora ("Comece pelo tier A", "Próximo:
  tier C"), segmentos por tier na cor do tier (concluído cheio, atual com contorno pulsando, em
  execução enchendo por item) e a **confirmação no mesmo cartão**, com o botão destrutivo em vermelho
  sólido (`.btn-danger-solid`: fundo `--err`, texto `--primary-fg`). O aviso de irreversibilidade é
  uma linha do guia.
- **Linha do tempo**: uma linha por tier. O atual fica aberto com o dry-run; o em execução mostra os
  itens ao vivo (fila → rodando → ok/parcial/pulado/erro, liberado por item); os concluídos recolhem
  com check e "liberado / previsto", e o resultado abre com um clique; os seguintes aguardam
  esmaecidos.

## Estados em andamento

Regra: **o visual nunca promete o que o núcleo não mede.**

| Atividade | O núcleo informa | Interface |
|---|---|---|
| Varredura | `files`, `logicalBytes` (sem total nem caminho) | barra indeterminada, contadores vivos, tempo decorrido e ritmo (arquivos/s) com gráfico dos últimos 10 s, derivados em `domain/progress.ts` |
| Classificação | nada até terminar | esqueleto por tier (os tiers são fixos; os itens não) |
| Execução | `started`/`finished` por item | barra determinada (itens concluídos/total) e liberado somado ao vivo |
| Atualização | `percent` (pode ser nulo) | determinada com tamanho, texto sem percentual sem ele |

## Movimento

- Troca de página: sobe e esmaece (`.page`, 0,18 s). Cards, KPIs e linhas entram em cascata.
- Destaque deslizante (`useActiveIndicator`): um elemento só, movido por `transform`, remedido ao fim
  das transições dos itens; a primeira medida é instantânea.
- Grupos recolhíveis animam a altura real (`grid-template-rows: 0fr → 1fr`, 0,32 s).
- Pulso discreto (2×) no botão primário quando a próxima ação fica disponível.
- `prefers-reduced-motion`: nenhuma animação (regra global no fim do `app.css`).

## Histórico de varreduras

Toda varredura concluída é salva automaticamente. A tela responde a quatro perguntas:

1. **Quanto mudou?** KPIs: nº de varreduras, usado na última, variação desde a anterior, variação no
   período (primeira → última).
2. **Como evoluiu?** Gráfico de linha do espaço usado, uma marca por varredura.
3. **Como estava?** "Varredura selecionada": uma varredura só (padrão: a última) com usado, livre,
   capacidade, variação vs anterior, arquivos, ilegíveis, duração, profundidade e as 10 maiores pastas
   do volume e do perfil. Escolhida pelo seletor do card, pelo clique/Enter numa marca do gráfico (anel
   na marca) ou por "Ver" na tabela (linha marcada "em detalhe"). "Comparar com a anterior" leva o
   card "O que mudou" para anterior → selecionada.
4. **O que mudou?** Comparação entre duas varreduras escolhidas (padrão: penúltima → última), por
   raiz do volume e por pasta do perfil, ordenada pela maior variação absoluta (10 primeiras).

Regras de dados:

- Guarda `roots` e `profile` **completos** (1º nível, tamanho limitado) e não guarda `children`
  (2º nível, potencialmente milhares de entradas). Sem corte em top-N, uma pasta só aparece como
  "nova"/"sumiu" quando de fato não existia na outra varredura.
- Comparação do perfil só quando o caminho do perfil é o mesmo nas duas; senão, aviso e omissão.
- Variação abaixo de 0,05 GB não é listada.
- Os seletores De/para ficam visíveis com 2+ varreduras; a mesma varredura nos dois lados mostra
  "Escolha duas varreduras diferentes" (nunca esconde o controle que desfaz o estado).
- Limite de 100 varreduras; a mais antiga sai primeiro.
- Excluir uma varredura e limpar o histórico não tocam no disco; limpar pede confirmação em linha.

### Gráfico de linha

- Uma série, sem legenda (o título diz o que é). Cor `--bar` (neutro do sistema), linha 2px,
  área a 10%, marcas r=4 com anel de 2px na cor da superfície.
- Eixo Y de 0 à capacidade do volume, passos 1/2/2,5/5 × 10ⁿ (~4 divisões), com linha de referência "capacidade": a folga fica visível e a
  escala não exagera variações pequenas.
- Rótulo só no último ponto; desce quando colide com a linha de capacidade. Crosshair + tooltip (valor em destaque, data, variação vs anterior);
  navegável por teclado (←/→) no alvo focável. A tabela de varreduras é a visão em texto.

### Comparação divergente

Par divergente validado com `validate_palette.js` (ΔE CVD ≥ 23 nos dois temas, contraste ≥ 3:1):

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--grow` | `#C2452D` | `#E0664D` | pasta cresceu (barra à direita do eixo) |
| `--shrink` | `#2F6FD6` | `#5B93EE` | pasta reduziu (barra à esquerda do eixo) |

A polaridade vai também na direção da barra e no sinal do texto (`+`/`−`); a cor nunca está sozinha.
Texto fica sempre em tokens de texto, nunca na cor da série. Os tokens de status (`--ok`, `--warn`,
`--err`) não são reutilizados para polaridade.

### Varredura

O KPI "Usado" mostra a variação desde a varredura anterior (link para o Histórico).

## Exportação do relatório

Três saídas no cabeçalho do Relatório, cada uma com um papel:

| Ação | O que sai | Como |
|---|---|---|
| Copiar Markdown | relatório completo em texto | área de transferência (já existia) |
| Exportar PDF | relatório completo, paginado | diálogo de impressão nativo (`Webview::print`); o usuário escolhe "Salvar como PDF" |
| Salvar imagem | **cartão-resumo** PNG para compartilhar | SVG gerado dos dados → canvas → PNG; "Salvar como" nativo |

- **PDF = a própria tela** com folha `@media print`: sempre tema claro (tokens fixos), sem barra
  lateral, abas e botões; cards e itens não quebram entre páginas; margem de 14 mm.
- **Imagem ≠ captura da tela.** Capturar o DOM exige `foreignObject`, que o WebKit (macOS/Linux)
  bloqueia no canvas, e uma página longa vira imagem ilegível. O cartão (1200 px de largura, escala 2)
  traz: título, data e volume; Liberado, Livre agora, Ocupação e Pendências; liberado por tier com as
  cores dos tiers (barra + rótulo, nunca só cor); até 5 pendências pelo nome; rodapé com a versão.
  Sempre tema claro. Fonte do sistema (SVG como imagem não acessa webfonts).
- **Segurança:** a interface envia só os bytes (validados como PNG, ≤ 20 MB) e um nome sugerido; o
  caminho sai do diálogo nativo no Rust. A WebView não ganha escrita em disco.
- Caminhos longos em listas quebram dentro do card (antes estouravam a página na horizontal).
