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

Abrir `prototypes/index.html` no navegador (funciona via `file://`, sem servidor). Tema claro/escuro
no botão da barra lateral. Dados de exemplo.

Os tokens (`prototypes/assets/app.css`) são a fonte do CSS do app em
`apps/desktop/src/styles/app.css`. A paleta dos tiers foi validada para daltonismo nos dois temas.
