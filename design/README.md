# System design

Protótipos HTML que definiram a interface do app (visual inspirado na orca.dev: neutros puros,
primário monocromático, cor só para estado e categoria; Inter + JetBrains Mono).

| Arquivo | Tela |
|---|---|
| `prototypes/01-survey.html` | Survey do volume |
| `prototypes/02-classificacao.html` | Classificação por tier |
| `prototypes/03-plano.html` | Plano e aprovação |
| `prototypes/04-execucao.html` | Execução por tier |
| `prototypes/05-relatorio.html` | Relatório |
| `prototypes/06-historico.html` | Histórico de varreduras (análise) |

Abrir `prototypes/index.html` no navegador (funciona via `file://`, sem servidor). Tema claro/escuro
no botão da barra lateral. Dados de exemplo.

Os tokens (`prototypes/assets/app.css`) são a fonte do CSS do app em
`apps/desktop/src/styles/app.css`. A paleta dos tiers foi validada para daltonismo nos dois temas.

## Navegação

- **Barra lateral = seções**: Limpeza, Histórico, Configurações. Ambiente e tema embaixo.
- **Limpeza = fluxo em abas** no topo do conteúdo (`.flow`), só nas etapas 1–5. Cada aba é liberada
  pelo pré-requisito dela; aba trancada não é link (`aria-disabled`, cadeado, `title` dizendo o que
  concluir). Concluída ganha check verde.

| Aba | Liberada quando |
|---|---|
| Survey | sempre |
| Classificação | varredura concluída |
| Plano | classificação com ao menos 1 item selecionável marcado |
| Execução | plano aprovado |
| Relatório | ao menos um tier executado |

**Nova análise** (cabeçalho do Relatório): volta ao Survey vazio e tranca as abas 2–5 de novo — limpa
o estado de varredura, classificação, plano, execução, relatório e exportação na interface. O
histórico de varreduras e as Configurações ficam. Sem confirmação: nada no disco muda, e o aviso ao
lado do botão lembra de exportar antes.

**Avançar fica no topo.** A ação que leva à próxima etapa é a única primária e fica no cabeçalho
da etapa (`.page-head .actions`, à direita), nunca no rodapé: o usuário não precisa rolar a página para
seguir. Desabilitada enquanto o pré-requisito falta, com o motivo visível perto do controle que o
resolve (ex.: Plano → "Confirme a revisão do plano para aprovar" no card de aprovação, que é o
primeiro da coluna lateral). Ações da própria etapa (executar um tier, exportar) ficam secundárias.

| Etapa | Ação primária no cabeçalho |
|---|---|
| Survey | Classificar candidatos (após a varredura; antes dela, Iniciar varredura) |
| Classificação | Montar plano |
| Plano | Aprovar |
| Execução | Ver relatório (ao terminar) |
| Relatório | Nova análise |

Os pré-requisitos são independentes, não em cadeia: rever o Plano descarta a aprovação (tranca a
Execução), mas o Relatório dos tiers já executados continua acessível.

## Histórico de varreduras

Toda varredura concluída é salva automaticamente. A tela responde a três perguntas:

1. **Quanto mudou?** KPIs: nº de varreduras, usado na última, variação desde a anterior, variação no
   período (primeira → última).
2. **Como evoluiu?** Gráfico de linha do espaço usado, uma marca por varredura.
3. **O que mudou?** Comparação entre duas varreduras escolhidas (padrão: penúltima → última), por
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

### Survey

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
