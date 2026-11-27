// Notas de versão empacotadas com a interface (a CSP não libera domínio externo e
// o app funciona offline). Uma entrada por versão publicada, a mais nova primeiro.
// Antes de criar a tag, a versão nova entra aqui (ver docs/release.md).
// Texto sempre {pt, en}: o tipo `TextDto` não aceita idioma faltando.
import type { ReleaseNotes } from '../domain/releaseNotes'
// GIF só da versão mais recente (orçamento no catalog.test.ts). Gravado do modo
// demonstração por `scripts/record-readme-media.mjs` (cenários `rn-*`).
import b8ReleaseNotes from './media/0.1.0-beta.8/rn-release-notes.gif'

export const RELEASE_NOTES: ReleaseNotes[] = [
  {
    version: '0.1.0-beta.8',
    date: '2026-11-27',
    headline: { pt: 'Notas de versão no app', en: 'In-app release notes' },
    summary: {
      pt: 'Depois de atualizar, um aviso discreto mostra o que mudou, com GIF, correções e problemas conhecidos, em português e inglês.',
      en: 'After an update, a discreet notice shows what changed, with GIFs, fixes and known issues, in Portuguese and English.',
    },
    items: [
      {
        id: 'b8-notes',
        kind: 'new',
        area: { pt: 'Barra de status › Novidades', en: 'Status bar › What’s new' },
        title: { pt: 'O que mudou, depois de cada atualização', en: 'What changed, after every update' },
        body: {
          pt: 'Um aviso acima da barra de status abre uma gaveta com novidades, correções (antes e agora) e problemas conhecidos. Aparece uma vez por versão, sem interromper; versões puladas entram juntas.',
          en: 'A notice above the status bar opens a drawer with new features, fixes (before and now) and known issues. It shows once per version, without interrupting; skipped versions come together.',
        },
        media: {
          src: b8ReleaseNotes,
          alt: {
            pt: 'O aviso acima da barra de status abre a gaveta; a aba da versão anterior mostra as correções com antes e agora.',
            en: 'The notice above the status bar opens the drawer; the previous version tab shows the fixes with before and now.',
          },
        },
      },
      {
        id: 'b8-history',
        kind: 'new',
        route: 'settings',
        area: { pt: 'Configurações › Atualizações', en: 'Settings › Updates' },
        title: { pt: 'Histórico de versões', en: 'Version history' },
        body: {
          pt: 'As notas de cada versão ficam em Configurações, com a opção de não mostrar o aviso depois de atualizar.',
          en: 'Each version’s notes stay in Settings, with an option to skip the notice after updating.',
        },
      },
      {
        id: 'b8-known-first',
        kind: 'known',
        area: { pt: 'Notas de versão', en: 'Release notes' },
        title: { pt: 'Vindo de uma versão anterior, só aparecem as notas desta', en: 'Coming from an earlier version, only these notes show' },
        body: {
          pt: 'Versões anteriores não registravam a última versão vista. As notas delas estão no histórico de versões, em Configurações.',
          en: 'Earlier versions did not record the last version seen. Their notes are in the version history, in Settings.',
        },
      },
      {
        id: 'b8-known-update',
        kind: 'known',
        area: { pt: 'Atualização automática', en: 'Automatic update' },
        title: { pt: 'Atualização automática não verificada fora do Windows', en: 'Automatic update not verified outside Windows' },
        body: {
          pt: 'AppImage, deb/rpm e macOS ainda não foram testados numa máquina real. Se falhar, baixe o pacote na página da versão no GitHub.',
          en: 'AppImage, deb/rpm and macOS have not been tested on a real machine yet. If it fails, download the package from the release page on GitHub.',
        },
      },
      {
        id: 'b8-known-cli',
        kind: 'known',
        area: { pt: 'Linha de comando', en: 'Command line' },
        title: { pt: 'A CLI ainda não vem nos pacotes', en: 'The CLI is not in the packages yet' },
        body: {
          pt: 'disk-cleanup-cli (survey, classify, execute com aprovação explícita) só compila a partir do código.',
          en: 'disk-cleanup-cli (survey, classify, execute with explicit approval) only builds from source.',
        },
      },
    ],
  },
  {
    version: '0.1.0-beta.7',
    date: '2026-11-27',
    headline: { pt: 'Lixeira, mapa do volume e duplicados', en: 'Recycle Bin, volume map and duplicates' },
    summary: {
      pt: 'Escolha por tier entre remoção definitiva e Lixeira, veja onde o espaço está e encontre cópias confirmadas byte a byte.',
      en: 'Choose per tier between permanent removal and the Recycle Bin, see where the space is and find copies confirmed byte by byte.',
    },
    items: [
      {
        id: 'b7-trash',
        kind: 'new',
        area: { pt: 'Plano › Destino', en: 'Plan › Destination' },
        title: { pt: 'Lixeira como destino, tier a tier', en: 'Recycle Bin as a destination, tier by tier' },
        body: {
          pt: 'Na aprovação, cada tier vai para Definitivo ou Lixeira. O relatório mostra o que está na Lixeira à parte do liberado: só libera ao esvaziar.',
          en: 'At approval, each tier goes to Permanent or Recycle Bin. The report shows what is in the Recycle Bin apart from freed space: it is freed only when emptied.',
        },
      },
      {
        id: 'b7-treemap',
        kind: 'new',
        route: 'survey',
        area: { pt: 'Varredura › Mapa do volume', en: 'Survey › Volume map' },
        title: { pt: 'Mapa do volume', en: 'Volume map' },
        body: {
          pt: 'Depois da varredura, o volume vira um mapa: clique numa pasta para descer um nível.',
          en: 'After the survey, the volume becomes a map: click a folder to drill down one level.',
        },
      },
      {
        id: 'b7-duplicates',
        kind: 'new',
        area: { pt: 'Classificação › Duplicados', en: 'Classification › Duplicates' },
        title: { pt: 'Duplicados, confirmados byte a byte', en: 'Duplicates, confirmed byte by byte' },
        body: {
          pt: 'Sob demanda, no perfil: mesmo tamanho → mesmo trecho → mesmo conteúdo → byte a byte. A cópia mais antiga de cada grupo fica fora do plano.',
          en: 'On demand, in your profile: same size → same sample → same content → byte by byte. The oldest copy in each group stays out of the plan.',
        },
      },
      {
        id: 'b7-projects',
        kind: 'new',
        area: { pt: 'Classificação › Tier C', en: 'Classification › Tier C' },
        title: { pt: 'Artefatos de projeto por idade', en: 'Project artifacts by age' },
        body: {
          pt: 'node_modules, target e afins entram no tier C. Projeto com atividade recente aparece, mas começa desmarcado.',
          en: 'node_modules, target and the like join tier C. Projects with recent activity show up but start unchecked.',
        },
      },
      {
        id: 'b7-large-files',
        kind: 'new',
        area: { pt: 'Classificação › Tier D', en: 'Classification › Tier D' },
        title: { pt: 'Maiores arquivos do perfil', en: 'Largest files in your profile' },
        body: {
          pt: 'Grande e antigo não quer dizer descartável: nada vem marcado e o padrão é a Lixeira.',
          en: 'Large and old does not mean disposable: nothing is checked and the default is the Recycle Bin.',
        },
      },
      {
        id: 'b7-rules',
        kind: 'new',
        route: 'settings',
        area: { pt: 'Configurações › Regras próprias', en: 'Settings › Own rules' },
        title: { pt: 'Regras próprias e perfis de projeto', en: 'Own rules and project profiles' },
        body: {
          pt: 'Pastas que você sabe que são descartáveis. Passam pelas mesmas exclusões e guardas do catálogo: só ampliam, nunca removem uma proteção.',
          en: 'Folders you know are disposable. They go through the same exclusions and guards as the catalog: they only widen, never remove a protection.',
        },
      },
      {
        id: 'b7-monitor',
        kind: 'new',
        route: 'settings',
        area: { pt: 'Configurações › Monitoramento', en: 'Settings › Monitoring' },
        title: { pt: 'Bandeja, aviso de pouco espaço e varredura agendada', en: 'Tray, low-space alert and scheduled scan' },
        body: {
          pt: 'Só lê: mede o espaço livre e agenda varreduras. Nenhuma limpeza roda sem a sua aprovação.',
          en: 'Read-only: measures free space and schedules scans. No cleanup runs without your approval.',
        },
      },
      {
        id: 'b7-orphans',
        kind: 'new',
        experimental: true,
        route: 'settings',
        area: { pt: 'Configurações › Sobras de apps', en: 'Settings › App leftovers' },
        title: { pt: 'Sobras de apps desinstalados', en: 'Leftovers of uninstalled apps' },
        body: {
          pt: 'Só no Windows e desligado por padrão: pasta em AppData sem programa no registro de desinstalação e parada há 90+ dias.',
          en: 'Windows only and off by default: AppData folder with no program in the uninstall registry and idle for 90+ days.',
        },
      },
      {
        id: 'b7-fix-exclusion',
        kind: 'fixed',
        area: { pt: 'Plano e Classificação', en: 'Plan and Classification' },
        title: { pt: 'Alvo que contém uma exclusão agora é recusado', en: 'A target that contains an exclusion is now refused' },
        body: {
          pt: 'Antes só se via alvo dentro de uma exclusão. Nenhuma regra embutida dos três catálogos foi afetada.',
          en: 'Before, only targets inside an exclusion were caught. No built-in rule in the three catalogs is affected.',
        },
        fix: {
          target: 'C:\\Windows',
          detail: 'C:\\Windows\\Installer',
          before: { pt: 'Aceito no plano, embora contenha a exclusão', en: 'Accepted in the plan, although it contains the exclusion' },
          after: { pt: 'Recusado: toca a exclusão', en: 'Refused: touches the exclusion' },
        },
      },
      {
        id: 'b7-fix-guard',
        kind: 'fixed',
        area: { pt: 'Execução › guarda final', en: 'Execution › final guard' },
        title: { pt: 'A guarda final recusa alvo que contém pasta protegida', en: 'The final guard refuses a target that contains a protected folder' },
        body: {
          pt: 'Antes só recusava alvo igual à pasta protegida. Alvo dentro dela (como AppData\\Local\\npm-cache) continua permitido.',
          en: 'Before, it only refused a target equal to the protected folder. Targets inside it (such as AppData\\Local\\npm-cache) are still allowed.',
        },
        fix: {
          target: '%USERPROFILE%\\AppData',
          detail: 'AppData\\Local',
          before: { pt: 'Passava pela guarda antes da remoção', en: 'Passed the guard right before removal' },
          after: { pt: 'Recusado: contém a pasta protegida', en: 'Refused: contains the protected folder' },
        },
      },
      {
        id: 'b7-known-orphans',
        kind: 'known',
        area: { pt: 'Sobras de apps', en: 'App leftovers' },
        title: { pt: 'Sobras têm falsos positivos', en: 'Leftovers have false positives' },
        body: {
          pt: 'Saves de jogos e apps que não se registram podem aparecer. Por isso nada vem marcado e o padrão é a Lixeira.',
          en: 'Game saves and apps that do not register may show up. That is why nothing is checked and the default is the Recycle Bin.',
        },
      },
      {
        id: 'b7-known-update',
        kind: 'known',
        area: { pt: 'Atualização automática', en: 'Automatic update' },
        title: { pt: 'Atualização automática não verificada fora do Windows', en: 'Automatic update not verified outside Windows' },
        body: {
          pt: 'AppImage, deb/rpm e macOS ainda não foram testados numa máquina real. Se falhar, baixe o pacote na página da versão no GitHub.',
          en: 'AppImage, deb/rpm and macOS have not been tested on a real machine yet. If it fails, download the package from the release page on GitHub.',
        },
      },
      {
        id: 'b7-known-cli',
        kind: 'known',
        area: { pt: 'Linha de comando', en: 'Command line' },
        title: { pt: 'A CLI ainda não vem nos pacotes', en: 'The CLI is not in the packages yet' },
        body: {
          pt: 'disk-cleanup-cli (survey, classify, execute com aprovação explícita) só compila a partir do código nesta versão.',
          en: 'disk-cleanup-cli (survey, classify, execute with explicit approval) only builds from source in this version.',
        },
      },
    ],
  },
  {
    version: '0.1.0-beta.6',
    date: '2026-11-26',
    headline: { pt: 'Barra de status e fluxo passo a passo', en: 'Status bar and step-by-step flow' },
    summary: {
      pt: 'Aprovação colada no botão, execução guiada e estado vivo no rodapé.',
      en: 'Approval next to the button, guided execution and live state in the footer.',
    },
    items: [
      {
        id: 'b6-statusbar',
        kind: 'new',
        area: { pt: 'Janela', en: 'Window' },
        title: { pt: 'Barra de status no rodapé', en: 'Status bar in the footer' },
        body: { pt: 'Estado vivo, volume, modo e versão; a barra lateral fica só com seções.', en: 'Live state, volume, mode and version; the sidebar keeps only sections.' },
      },
      {
        id: 'b6-plan',
        kind: 'new',
        area: { pt: 'Plano', en: 'Plan' },
        title: { pt: 'Aprovação colada no botão Aprovar', en: 'Approval right under the Approve button' },
        body: { pt: 'Itens por tier recolhidos e plan.json numa gaveta.', en: 'Items grouped by tier, collapsed, and plan.json in a drawer.' },
      },
      {
        id: 'b6-execute',
        kind: 'new',
        area: { pt: 'Execução', en: 'Execution' },
        title: { pt: 'Execução guiada passo a passo', en: 'Step-by-step guided execution' },
        body: { pt: '“Passo k de n” e linha do tempo por tier.', en: '“Step k of n” and a timeline per tier.' },
      },
      {
        id: 'b6-survey',
        kind: 'new',
        route: 'survey',
        area: { pt: 'Varredura', en: 'Survey' },
        title: { pt: 'Cartão ao vivo da varredura', en: 'Live survey card' },
        body: { pt: 'Contadores, tempo e ritmo; sem percentual inventado.', en: 'Counters, time and rate; no made-up percentage.' },
      },
      {
        id: 'b6-theme',
        kind: 'new',
        route: 'settings',
        area: { pt: 'Configurações', en: 'Settings' },
        title: { pt: 'Troca de tema em círculo', en: 'Circular theme reveal' },
        body: { pt: 'A troca de tema se revela a partir do clique.', en: 'The theme change reveals itself from the click.' },
      },
    ],
  },
]
