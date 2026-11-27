/* Notas de versão — kit comum aos 3 protótipos.
   - Conteúdo {pt, en} no mesmo formato do LocalizedText do núcleo (en obrigatório).
   - Clipes: cenas em loop montadas com os componentes reais; no app, cada clipe é o GIF gravado
     por scripts/record-readme-media.mjs a partir do DemoGateway.
   - Regra de exibição (simulada): mostra uma vez quando a versão instalada é maior que a última vista. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Ícones (mesmo traçado do menu-kit.js) ---------- */
  var P = {
    disk: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 14h18"/>',
    diskdot: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 14h18"/><circle cx="17" cy="17" r="0.8"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>', chevdown: '<path d="M6 9l6 6 6-6"/>', left: '<path d="M15 6l-6 6 6 6"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
    warn: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    check: '<path d="M5 12l5 5L20 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
    term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    rule: '<path d="M4 6h16M4 12h10M4 18h6"/><path d="M17 15l2 2 3-3"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
    bug: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 7V4M9 4l1 3M15 4l-1 3M4 11h4M16 11h4M4 17h4M16 17h4"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    play: '<path d="M8 5v14l11-7z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    map: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h10M13 3v18M13 16h8"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'
  };
  function icon(n, s, w) { return '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>'; }
  function hydrate(s) { (s || document).querySelectorAll('[data-icon]:empty').forEach(function (el) { el.innerHTML = icon(el.getAttribute('data-icon'), +el.getAttribute('data-size') || 16); }); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------- Idioma ---------- */
  var lang = 'pt';
  try { lang = localStorage.getItem('dc-rn-lang') || 'pt'; } catch (e) { /* sem storage */ }
  function t(o) { return o == null ? '' : typeof o === 'string' ? o : (o[lang] != null ? o[lang] : o.pt); }
  function setLang(l) {
    lang = l; document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
    try { localStorage.setItem('dc-rn-lang', l); } catch (e) { /* sem storage */ }
    document.dispatchEvent(new CustomEvent('rn:lang'));
  }
  function fmtDate(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }

  /* Textos da interface (no app: chaves novas em src/i18n/messages.ts, bloco `releaseNotes`). */
  var UI = {
    cleanup: { pt: 'Limpeza', en: 'Cleanup' }, history: { pt: 'Histórico', en: 'History' }, settings: { pt: 'Configurações', en: 'Settings' },
    tagline: { pt: 'Limpeza com aprovação', en: 'Cleanup with approval' },
    ready: { pt: 'Pronto', en: 'Ready' }, explicit: { pt: 'Aprovação explícita', en: 'Explicit approval' },
    steps: [{ pt: 'Varredura', en: 'Survey' }, { pt: 'Classificação', en: 'Classification' }, { pt: 'Plano', en: 'Plan' }, { pt: 'Execução', en: 'Execution' }, { pt: 'Relatório', en: 'Report' }],
    surveyEyebrow: { pt: 'Etapa 1 de 5 · somente leitura', en: 'Step 1 of 5 · read-only' },
    surveyTitle: { pt: 'Varredura do volume', en: 'Volume survey' },
    start: { pt: 'Iniciar varredura', en: 'Start scan' },
    depth: { pt: 'Profundidade', en: 'Depth' },
    lastScan: { pt: 'Última varredura', en: 'Last scan' },
    used: { pt: 'Usado', en: 'Used' }, free: { pt: 'Livre', en: 'Free' }, cap: { pt: 'Capacidade', en: 'Capacity' },
    emptyHint: { pt: 'A varredura só lê: nada muda no disco até um plano aprovado.', en: 'The survey only reads: nothing changes on disk until a plan is approved.' },
    whatsNew: { pt: 'Novidades', en: 'What’s new' },
    updatedTo: { pt: 'Atualizado para', en: 'Updated to' },
    from: { pt: 'vindo da', en: 'from' },
    kinds: { new: { pt: 'Novo', en: 'New' }, fixed: { pt: 'Corrigido', en: 'Fixed' }, known: { pt: 'Conhecido', en: 'Known issue' }, exp: { pt: 'Experimental', en: 'Experimental' } },
    groups: { new: { pt: 'Novidades', en: 'New' }, fixed: { pt: 'Correções', en: 'Fixes' }, known: { pt: 'Problemas conhecidos', en: 'Known issues' } },
    where: { pt: 'Onde', en: 'Where' },
    open: { pt: 'Abrir', en: 'Open' },
    before: { pt: 'Antes', en: 'Before' }, after: { pt: 'Agora', en: 'Now' },
    later: { pt: 'Ver depois', en: 'Later' }, next: { pt: 'Próxima', en: 'Next' }, prev: { pt: 'Anterior', en: 'Previous' }, done: { pt: 'Concluir', en: 'Done' },
    close: { pt: 'Fechar', en: 'Close' },
    allVersions: { pt: 'Todas as versões', en: 'All versions' },
    clipNote: { pt: 'GIF', en: 'GIF' },
    pause: { pt: 'Pausar', en: 'Pause' }, play: { pt: 'Reproduzir', en: 'Play' },
    skipped: { pt: 'Você pulou {n} versão — as novidades dela também estão aqui.', en: 'You skipped {n} version — its changes are here too.' },
    skippedN: { pt: 'Você pulou {n} versões — as novidades delas também estão aqui.', en: 'You skipped {n} versions — their changes are here too.' },
    newsChip: { pt: 'Novidades da {v}', en: 'What’s new in {v}' },
    version: { pt: 'Versão instalada · atualizações em Configurações', en: 'Installed version · updates in Settings' },
    updates: { pt: 'Atualizações', en: 'Updates' },
    autoUpdate: { pt: 'Atualizar automaticamente', en: 'Update automatically' },
    autoUpdateHint: { pt: 'Baixa em segundo plano; instalar só com o seu clique.', en: 'Downloads in the background; installs only on your click.' },
    beta: { pt: 'Receber versões beta', en: 'Receive beta versions' },
    showNotes: { pt: 'Mostrar novidades depois de atualizar', en: 'Show what’s new after updating' },
    showNotesHint: { pt: 'Uma vez por versão. Desligado, as notas continuam aqui e na barra de status.', en: 'Once per version. When off, notes stay here and in the status bar.' },
    versionHistory: { pt: 'Histórico de versões', en: 'Version history' },
    installed: { pt: 'instalada', en: 'installed' },
    seeNotes: { pt: 'Ver notas', en: 'See notes' },
    onGithub: { pt: 'Página da versão', en: 'Release page' },
    githubHint: { pt: 'abre no navegador', en: 'opens in the browser' },
    settingsEyebrow: { pt: 'Preferências', en: 'Preferences' },
    nItems: { pt: '{n} itens', en: '{n} items' }
  };
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }

  /* ---------- Notas (exemplo real: o que entrou na v0.1.0-beta.7 e na beta.6) ----------
     No app: um arquivo por versão empacotado com a interface (CSP sem domínio externo, offline).
     `kind`: new | fixed | known. `exp`: experimental. `route`: onde a novidade mora. */
  var RELEASES = [
    {
      v: '0.1.0-beta.7', date: '2026-11-27',
      headline: { pt: 'Lixeira, mapa do volume e duplicados', en: 'Recycle Bin, volume map and duplicates' },
      summary: { pt: 'Escolha por tier entre remoção definitiva e Lixeira, veja onde o espaço está e encontre cópias confirmadas byte a byte.', en: 'Choose per tier between permanent removal and the Recycle Bin, see where the space is and find copies confirmed byte by byte.' },
      items: [
        { id: 'trash', kind: 'new', scene: 'trash', route: 'plan', area: { pt: 'Plano › Destino', en: 'Plan › Destination' },
          title: { pt: 'Lixeira como destino, tier a tier', en: 'Recycle Bin as a destination, tier by tier' },
          body: { pt: 'Na aprovação, cada tier vai para Definitivo ou Lixeira. O relatório mostra o que está na Lixeira à parte do liberado: só libera ao esvaziar.', en: 'At approval, each tier goes to Permanent or Recycle Bin. The report shows what is in the Recycle Bin apart from freed space: it is freed only when emptied.' } },
        { id: 'treemap', kind: 'new', scene: 'treemap', route: 'survey', area: { pt: 'Varredura › Mapa do volume', en: 'Survey › Volume map' },
          title: { pt: 'Mapa do volume', en: 'Volume map' },
          body: { pt: 'Depois da varredura, o volume vira um mapa: clique numa pasta para descer e veja os candidatos na cor do tier.', en: 'After the survey, the volume becomes a map: click a folder to drill down and see candidates in their tier color.' } },
        { id: 'dup', kind: 'new', scene: 'dup', route: 'classify', area: { pt: 'Classificação › Duplicados', en: 'Classification › Duplicates' },
          title: { pt: 'Duplicados, confirmados byte a byte', en: 'Duplicates, confirmed byte by byte' },
          body: { pt: 'Sob demanda, no perfil: mesmo tamanho → mesmo trecho → mesmo conteúdo → byte a byte. A cópia mais antiga de cada grupo fica fora do plano.', en: 'On demand, in your profile: same size → same sample → same content → byte by byte. The oldest copy in each group stays out of the plan.' } },
        { id: 'projects', kind: 'new', scene: 'projects', route: 'classify', area: { pt: 'Classificação › Tier C', en: 'Classification › Tier C' },
          title: { pt: 'Artefatos de projeto por idade', en: 'Project artifacts by age' },
          body: { pt: 'node_modules, target e afins entram no tier C. Projeto com atividade recente aparece, mas começa desmarcado.', en: 'node_modules, target and the like join tier C. Projects with recent activity show up but start unchecked.' } },
        { id: 'big', kind: 'new', scene: 'big', route: 'classify', area: { pt: 'Classificação › Tier D', en: 'Classification › Tier D' },
          title: { pt: 'Maiores arquivos do perfil', en: 'Largest files in your profile' },
          body: { pt: 'Grande e antigo não quer dizer descartável: nada vem marcado e o padrão é a Lixeira.', en: 'Large and old does not mean disposable: nothing is checked and the default is the Recycle Bin.' } },
        { id: 'rules', kind: 'new', scene: 'rules', route: 'settings', area: { pt: 'Configurações › Regras próprias', en: 'Settings › Own rules' },
          title: { pt: 'Regras próprias e perfis de projeto', en: 'Own rules and project profiles' },
          body: { pt: 'Pastas que você sabe que são descartáveis. Passam pelas mesmas exclusões e guardas do catálogo: só ampliam, nunca removem uma proteção.', en: 'Folders you know are disposable. They go through the same exclusions and guards as the catalog: they only widen, never remove a protection.' } },
        { id: 'monitor', kind: 'new', scene: 'monitor', route: 'settings', area: { pt: 'Configurações › Monitoramento', en: 'Settings › Monitoring' },
          title: { pt: 'Bandeja, aviso de pouco espaço e varredura agendada', en: 'Tray, low-space alert and scheduled scan' },
          body: { pt: 'Só lê: mede o espaço livre e agenda varreduras. Nenhuma limpeza roda sem a sua aprovação.', en: 'Read-only: measures free space and schedules scans. No cleanup runs without your approval.' } },
        { id: 'orphans', kind: 'new', exp: true, scene: 'orphans', route: 'settings', area: { pt: 'Configurações › Sobras de apps', en: 'Settings › App leftovers' },
          title: { pt: 'Sobras de apps desinstalados', en: 'Leftovers of uninstalled apps' },
          body: { pt: 'Só no Windows e desligado por padrão: pasta em AppData sem programa no registro de desinstalação e parada há 90+ dias.', en: 'Windows only and off by default: AppData folder with no program in the uninstall registry and idle for 90+ days.' } },
        { id: 'fix-excl', kind: 'fixed', route: 'plan', area: { pt: 'Plano e Classificação', en: 'Plan and Classification' },
          title: { pt: 'Alvo que contém uma exclusão agora é recusado', en: 'A target that contains an exclusion is now refused' },
          body: { pt: 'Antes só se via alvo dentro de uma exclusão. Nenhuma regra embutida dos três catálogos foi afetada.', en: 'Before, only targets inside an exclusion were caught. No built-in rule in the three catalogs is affected.' },
          ba: { path: 'C:\\Windows', detail: 'C:\\Windows\\Installer',
            before: { pt: 'Aceito no plano, embora contenha a exclusão', en: 'Accepted in the plan, although it contains the exclusion' },
            after: { pt: 'Recusado: toca a exclusão', en: 'Refused: touches the exclusion' } } },
        { id: 'fix-guard', kind: 'fixed', route: 'execute', area: { pt: 'Execução › SafetyGuard', en: 'Execution › SafetyGuard' },
          title: { pt: 'A guarda final recusa alvo que contém pasta protegida', en: 'The final guard refuses a target that contains a protected folder' },
          body: { pt: 'Antes só recusava alvo igual à pasta protegida. Alvo dentro dela continua permitido.', en: 'Before, it only refused a target equal to the protected folder. Targets inside it are still allowed.' },
          ba: { path: '%USERPROFILE%\\AppData', detail: 'AppData\\Local',
            before: { pt: 'Passava pela guarda antes da remoção', en: 'Passed the guard right before removal' },
            after: { pt: 'Recusado: contém a pasta protegida', en: 'Refused: contains the protected folder' },
            still: { path: '%LOCALAPPDATA%\\npm-cache', txt: { pt: 'dentro da protegida: continua permitido', en: 'inside the protected folder: still allowed' } } } },
        { id: 'k-orphans', kind: 'known', route: 'settings', area: { pt: 'Sobras de apps', en: 'App leftovers' },
          title: { pt: 'Sobras têm falsos positivos', en: 'Leftovers have false positives' },
          body: { pt: 'Saves de jogos e apps que não se registram podem aparecer. Por isso nada vem marcado e o padrão é a Lixeira.', en: 'Game saves and apps that do not register may show up. That is why nothing is checked and the default is the Recycle Bin.' } },
        { id: 'k-update', kind: 'known', route: 'settings', area: { pt: 'Atualização automática', en: 'Automatic update' },
          title: { pt: 'Atualização automática não verificada fora do Windows', en: 'Automatic update not verified outside Windows' },
          body: { pt: 'AppImage, deb/rpm e macOS ainda não foram testados numa máquina real. Se falhar, baixe o pacote na página da versão.', en: 'AppImage, deb/rpm and macOS have not been tested on a real machine yet. If it fails, download the package from the release page.' } },
        { id: 'k-cli', kind: 'known', route: null, area: { pt: 'Linha de comando', en: 'Command line' },
          title: { pt: 'A CLI ainda não vem nos pacotes', en: 'The CLI is not in the packages yet' },
          body: { pt: 'disk-cleanup-cli (survey, classify, execute com aprovação explícita) só compila a partir do código nesta versão.', en: 'disk-cleanup-cli (survey, classify, execute with explicit approval) only builds from source in this version.' } }
      ]
    },
    {
      v: '0.1.0-beta.6', date: '2026-11-26',
      headline: { pt: 'Barra de status e fluxo passo a passo', en: 'Status bar and step-by-step flow' },
      summary: { pt: 'Aprovação colada no botão, execução guiada e estado vivo no rodapé.', en: 'Approval next to the button, guided execution and live state in the footer.' },
      items: [
        { id: 'b6-sb', kind: 'new', route: 'survey', area: { pt: 'Janela', en: 'Window' }, title: { pt: 'Barra de status no rodapé', en: 'Status bar in the footer' }, body: { pt: 'Estado vivo, volume, modo e versão; a barra lateral fica só com seções.', en: 'Live state, volume, mode and version; the sidebar keeps only sections.' } },
        { id: 'b6-plan', kind: 'new', route: 'plan', area: { pt: 'Plano', en: 'Plan' }, title: { pt: 'Aprovação colada no botão Aprovar', en: 'Approval right under the Approve button' }, body: { pt: 'Itens por tier recolhidos e plan.json numa gaveta.', en: 'Items grouped by tier, collapsed, and plan.json in a drawer.' } },
        { id: 'b6-exec', kind: 'new', route: 'execute', area: { pt: 'Execução', en: 'Execution' }, title: { pt: 'Execução guiada passo a passo', en: 'Step-by-step guided execution' }, body: { pt: '“Passo k de n” e linha do tempo por tier.', en: '“Step k of n” and a timeline per tier.' } },
        { id: 'b6-scan', kind: 'new', route: 'survey', area: { pt: 'Varredura', en: 'Survey' }, title: { pt: 'Cartão ao vivo da varredura', en: 'Live survey card' }, body: { pt: 'Contadores, tempo e ritmo; sem percentual inventado.', en: 'Counters, time and rate; no made-up percentage.' } },
        { id: 'b6-theme', kind: 'new', route: 'settings', area: { pt: 'Configurações', en: 'Settings' }, title: { pt: 'Troca de tema em círculo', en: 'Circular theme reveal' }, body: { pt: 'A troca se revela a partir do clique.', en: 'The change reveals itself from the click.' } }
      ]
    }
  ];
  var CURRENT = RELEASES[0].v;
  var ALL_VERSIONS = ['0.1.0-beta.7', '0.1.0-beta.6', '0.1.0-beta.5', '0.1.0-beta.4', '0.1.0-beta.3', '0.1.0-beta.2', '0.1.0-beta.1'];
  var DATES = { '0.1.0-beta.5': '2026-11-25' };
  function release(v) { return RELEASES.filter(function (r) { return r.v === v; })[0] || null; }
  function short(v) { return v.replace('0.1.0-', ''); }
  /* Versões entre a última vista (exclusiva) e a instalada (inclusiva), mais nova primeiro. */
  function since(seen) { var i = ALL_VERSIONS.indexOf(seen); return ALL_VERSIONS.slice(0, i < 0 ? 1 : i).map(release).filter(Boolean); }
  function byKind(rel, k) { return rel.items.filter(function (x) { return x.kind === k; }); }

  /* Cenário simulado: de qual versão a pessoa veio. */
  var seen = '0.1.0-beta.6';
  try { seen = sessionStorage.getItem('dc-rn-from') || seen; } catch (e) { /* sem storage */ }
  function setFrom(v) { seen = v; try { sessionStorage.setItem('dc-rn-from', v); } catch (e) { /* sem storage */ } }

  /* ---------- Clipes (o lugar do GIF) ---------- */
  var CURSOR = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.6L10 19z" fill="#0A0A0A" stroke="#FAFAFA" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  var SCENES = {};

  function clip(name, opts) {
    var sc = SCENES[name];
    var el = document.createElement('div');
    el.className = 'clip';
    el.setAttribute('role', 'img');
    if (!sc) { el.innerHTML = '<div class="clip-stage" style="place-content:center;align-items:center;color:var(--muted)">—</div>'; return el; }
    el.setAttribute('aria-label', t(sc.alt));
    el.innerHTML = '<span class="clip-meta">' + icon('play', 9, 2.4) + t(UI.clipNote) + ' · ' + Math.round(sc.dur / 1000) + ' s</span>' +
      '<button type="button" class="clip-btn" aria-label="' + t(UI.pause) + '">' + icon('pause', 12, 2.2) + '</button>' +
      '<div class="clip-view"><div class="clip-stage"></div><span class="cursor">' + CURSOR + '</span></div><span class="clip-time"><i></i></span>';
    var view = el.querySelector('.clip-view'), stage = el.querySelector('.clip-stage'), cur = el.querySelector('.cursor'), bar = el.querySelector('.clip-time > i'), btn = el.querySelector('.clip-btn');
    var timers = [], t0 = 0, raf = 0, paused = false, elapsed = 0;
    var api = {
      stage: stage,
      at: function (x, y) { cur.style.left = x + '%'; cur.style.top = y + '%'; },
      click: function () {
        cur.classList.add('down'); setTimeout(function () { cur.classList.remove('down'); }, 140);
        var r = document.createElement('span'); r.className = 'c-ripple'; r.style.left = cur.style.left; r.style.top = cur.style.top; view.appendChild(r);
        setTimeout(function () { r.remove(); }, 520);
      },
      q: function (s) { return stage.querySelector(s); },
      qa: function (s) { return stage.querySelectorAll(s); }
    };
    function clear() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); }
    function run(from) {
      clear();
      if (from === 0) { stage.innerHTML = sc.build(api); hydrate(stage); cur.style.transition = 'none'; api.at(sc.start[0], sc.start[1]); void cur.offsetWidth; cur.style.transition = ''; }
      sc.steps.forEach(function (s) { if (s[0] >= from) timers.push(setTimeout(function () { if (el.isConnected) s[1](api); }, s[0] - from)); });
      t0 = performance.now() - from;
      (function tick() {
        if (!el.isConnected) { clear(); return; }
        elapsed = performance.now() - t0;
        bar.style.width = Math.min(100, elapsed / sc.dur * 100) + '%';
        if (elapsed >= sc.dur) { run(0); return; }
        raf = requestAnimationFrame(tick);
      })();
    }
    btn.addEventListener('click', function () {
      paused = !paused; el.classList.toggle('paused', paused);
      btn.innerHTML = icon(paused ? 'play' : 'pause', 12, 2.2);
      btn.setAttribute('aria-label', t(paused ? UI.play : UI.pause));
      if (paused) clear(); else run(elapsed);
    });
    if (reduce || (opts && opts.still)) {
      // Sem movimento: o último quadro, parado (no app, o primeiro quadro do GIF vira pôster).
      stage.innerHTML = sc.build(api); hydrate(stage);
      sc.steps.forEach(function (s) { s[1](api); });
      cur.hidden = true; btn.hidden = true; bar.style.width = '100%';
    } else {
      requestAnimationFrame(function () { run(0); });
    }
    return el;
  }

  function tierSq(tc) { return '<span class="tier t' + tc + '"><span class="sq"></span>' + tc + '</span>'; }
  function L(pt, en) { return lang === 'pt' ? pt : en; }

  SCENES.treemap = {
    dur: 7600, start: [80, 80],
    alt: { pt: 'O mapa do volume: clicar em Users desce um nível e destaca candidatos na cor do tier.', en: 'The volume map: clicking Users drills down and highlights candidates in their tier color.' },
    build: function () {
      return '<div class="mini-head"><b>' + L('Mapa do volume', 'Volume map') + '</b><span class="crumbs" data-c>C:\\</span></div>' +
        '<div class="mtm" data-m>' +
        cell(0, 0, 58, 100, 'Users', '182 GB') + cell(58, 0, 42, 46, 'Program Files', '41 GB') + cell(58, 46, 24, 54, 'Windows', '38 GB') +
        cell(82, 46, 18, 30, 'ProgramData', '12 GB') + cell(82, 76, 18, 24, '…', '9 GB') + '</div>';
    },
    steps: [
      [700, function (a) { a.at(26, 50); }],
      [1500, function (a) { a.q('.mtm i').classList.add('hot'); }],
      [1900, function (a) { a.click(); }],
      [2200, function (a) {
        a.q('[data-c]').innerHTML = 'C:\\ › <b>Users › usuario</b>';
        a.q('[data-m]').innerHTML = cell(0, 0, 44, 62, 'dev', '48 GB', 'C') + cell(0, 62, 44, 38, 'AppData', '64 GB', 'A') +
          cell(44, 0, 30, 55, 'Videos', '30 GB') + cell(44, 55, 30, 45, 'Downloads', '22 GB', 'D') + cell(74, 0, 26, 100, '…', '18 GB');
      }],
      [3400, function (a) { a.at(20, 40); }],
      [4300, function (a) { var c = a.q('.mtm i'); c.classList.add('hot'); c.querySelector('span').textContent = L('48 GB · node_modules, target', '48 GB · node_modules, target'); }],
      [5600, function (a) { a.at(55, 82); }],
      [6100, function (a) { a.qa('.mtm i')[3].classList.add('hot'); }]
    ]
  };
  function cell(x, y, w, h, name, size, tc) {
    return '<i class="' + (tc ? 'cand' : '') + '" style="left:' + x + '%;top:' + y + '%;width:' + w + '%;height:' + h + '%' + (tc ? ';--tc:var(--t' + tc + ')' : '') + '"><b>' + esc(name) + (tc ? ' · ' + tc : '') + '</b><span>' + size + '</span></i>';
  }

  SCENES.trash = {
    dur: 8200, start: [86, 86],
    alt: { pt: 'No Plano, o tier C passa de Definitivo para Lixeira; no Relatório, o que foi para a Lixeira aparece à parte do liberado.', en: 'In the Plan, tier C changes from Permanent to Recycle Bin; in the Report, what went to the Recycle Bin shows apart from freed space.' },
    build: function () {
      function row(tc, n, gb, on, cmds) {
        return '<div class="mini-row" data-t="' + tc + '">' + tierSq(tc) + '<span class="small muted" style="flex:1">' + n + ' · ' + gb + '</span>' +
          (cmds ? '<span class="small muted">' + L('só comandos', 'commands only') + '</span>' :
            '<span class="mdest"><span class="' + (on === 'perm' ? 'on' : '') + '">' + L('Definitivo', 'Permanent') + '</span><span class="' + (on === 'trash' ? 'on' : '') + '">' + L('Lixeira', 'Recycle Bin') + '</span></span>') + '</div>';
      }
      return '<div class="mini-head"><b>' + L('Plano de limpeza', 'Cleanup plan') + '</b><span class="mini-btn pri">' + L('Aprovar plano', 'Approve plan') + '</span></div>' +
        '<div class="mini-card" data-plan><span class="label-caps">' + L('Destino', 'Destination') + '</span>' +
        row('A', L('3 itens', '3 items'), '13,1 GB', null, true) + row('C', L('2 itens', '2 items'), '21,0 GB', 'perm') + row('D', L('1 item', '1 item'), '4,9 GB', 'trash') + '</div>' +
        '<div class="mini-kpis" data-rep style="opacity:0"><div class="mini-kpi"><span class="small muted">' + L('Liberado', 'Freed') + '</span><span class="v">13,1 GB</span></div>' +
        '<div class="mini-kpi" data-k2><span class="small muted">' + L('Na Lixeira', 'In the Recycle Bin') + '</span><span class="v">25,9 GB</span><span class="small muted">' + L('libera ao esvaziar', 'freed when emptied') + '</span></div></div>';
    },
    steps: [
      [800, function (a) { a.at(80, 47); }],
      [1700, function (a) { a.click(); var s = a.q('[data-t="C"] .mdest').children; s[0].classList.remove('on'); s[1].classList.add('on'); }],
      [2600, function (a) { a.at(84, 8); }],
      [3400, function (a) { a.click(); }],
      [3800, function (a) { var r = a.q('[data-rep]'); r.style.opacity = '1'; r.classList.add('fade-up'); a.q('[data-plan]').style.opacity = '0.45'; }],
      [4900, function (a) { a.at(76, 84); a.q('[data-k2]').classList.add('hl'); }]
    ]
  };

  SCENES.dup = {
    dur: 8400, start: [30, 90],
    alt: { pt: 'Procurar duplicados: as quatro etapas filtram de 312 arquivos até 18 confirmados byte a byte.', en: 'Find duplicates: the four stages narrow 312 files down to 18 confirmed byte by byte.' },
    build: function () {
      function st(lbl) { return '<div><span class="muted">' + lbl + '</span><span class="v">—</span></div>'; }
      return '<div class="mini-head"><b>' + L('Duplicados no perfil', 'Duplicates in your profile') + '</b><span class="mini-btn" data-b>' + L('Procurar duplicados', 'Find duplicates') + '</span></div>' +
        '<div class="mpipe" data-p>' + st(L('mesmo tamanho', 'same size')) + st(L('mesmo trecho', 'same sample')) + st(L('mesmo conteúdo', 'same content')) + st(L('byte a byte', 'byte by byte')) + '</div>' +
        '<div class="mini-card" data-g style="opacity:0"><div class="mini-row"><span data-icon="file" data-size="13"></span><span class="gi-name"><span>IMG_2041.jpg · ' + L('3 cópias', '3 copies') + '</span><span class="gi-path">Pictures\\2024 · Downloads · Desktop</span></span><span class="num small" style="margin-left:auto">48 MB</span></div>' +
        '<div class="mini-row"><span data-icon="file" data-size="13"></span><span class="gi-name"><span>setup-tools.zip · ' + L('2 cópias', '2 copies') + '</span><span class="gi-path">' + L('a mais antiga fica fora do plano', 'the oldest stays out of the plan') + '</span></span><span class="num small" style="margin-left:auto">1,2 GB</span></div></div>';
    },
    steps: [
      [600, function (a) { a.at(82, 6); }],
      [1300, function (a) { a.click(); var b = a.q('[data-b]'); b.textContent = L('Comparando…', 'Comparing…'); b.classList.add('pri'); }],
      [1700, function (a) { stage(a, 0, '312'); }], [2600, function (a) { stage(a, 1, '41'); }],
      [3500, function (a) { stage(a, 2, '18'); }], [4400, function (a) { stage(a, 3, '18'); }],
      [5000, function (a) { var b = a.q('[data-b]'); b.textContent = L('Procurar duplicados', 'Find duplicates'); b.classList.remove('pri'); var g = a.q('[data-g]'); g.style.opacity = '1'; g.classList.add('fade-up'); }]
    ]
  };
  function stage(a, i, v) {
    var d = a.q('[data-p]').children;
    if (i > 0) { d[i - 1].classList.remove('on'); d[i - 1].classList.add('ok'); }
    d[i].classList.add('on'); var e = d[i].querySelector('.v'); e.innerHTML = '<span class="tick">' + v + '</span>';
    if (i === 3) setTimeout(function () { d[3].classList.remove('on'); d[3].classList.add('ok'); }, 500);
  }

  SCENES.projects = {
    dur: 7000, start: [60, 90],
    alt: { pt: 'Tier C com artefatos de projeto: inativos há 90+ dias vêm marcados; o projeto ativo aparece desmarcado.', en: 'Tier C with project artifacts: idle 90+ days come checked; the active project shows up unchecked.' },
    build: function () {
      function r(name, proj, age, gb, on, hint) {
        return '<div class="mini-row" style="opacity:0"><input type="checkbox" tabindex="-1"' + (on ? ' checked' : '') + '><span class="gi-name"><span>' + name + ' · <b>' + proj + '</b></span><span class="gi-path">' + age + (hint ? ' · ' + hint : '') + '</span></span><span class="num small" style="margin-left:auto">' + gb + '</span></div>';
      }
      return '<div class="mini-head"><b>' + L('Classificação', 'Classification') + '</b>' + tierSq('C') + '</div>' +
        '<div class="mini-card">' + r('node_modules', 'loja-web', L('211 dias sem atividade', 'idle 211 days'), '1,8 GB', true) +
        r('target', 'api-rust', L('142 dias sem atividade', 'idle 142 days'), '3,4 GB', true) +
        r('node_modules', 'app-atual', L('6 dias', '6 days'), '0,9 GB', false, L('atividade recente', 'recent activity')) +
        r('.gradle', 'android-old', L('380 dias sem atividade', 'idle 380 days'), '2,2 GB', true) + '</div>' +
        '<span class="small muted">' + L('Projetos com atividade recente aparecem, mas começam desmarcados.', 'Projects with recent activity show up but start unchecked.') + '</span>';
    },
    steps: [
      [400, function (a) { show(a, 0); }], [800, function (a) { show(a, 1); }], [1200, function (a) { show(a, 2); }], [1600, function (a) { show(a, 3); }],
      [2600, function (a) { a.at(12, 56); }],
      [3700, function (a) { var r = a.qa('.mini-row')[2]; r.style.background = 'var(--hover)'; }]
    ]
  };
  function show(a, i) { var r = a.qa('.mini-row')[i]; r.style.opacity = '1'; r.classList.add('fade-up'); }

  SCENES.big = {
    dur: 6400, start: [90, 90],
    alt: { pt: 'Tier D com os maiores arquivos do perfil: nada vem marcado e o destino padrão é a Lixeira.', en: 'Tier D with the largest profile files: nothing is checked and the default destination is the Recycle Bin.' },
    build: function () {
      function r(n, p, gb, w) { return '<div class="mini-row" style="opacity:0"><input type="checkbox" tabindex="-1"><span class="gi-name" style="flex:0 1 46%"><span>' + n + '</span><span class="gi-path">' + p + '</span></span><span class="mbar"><i style="width:' + w + '%;background:var(--tD)"></i></span><span class="num small">' + gb + '</span></div>'; }
      return '<div class="mini-head"><b>' + L('Maiores arquivos', 'Largest files') + '</b><span class="pill neutral">' + icon('trash', 12) + L('padrão: Lixeira', 'default: Recycle Bin') + '</span></div>' +
        '<div class="mini-card">' + r('ubuntu-22.04.iso', 'Downloads', '4,9 GB', 100) + r('backup-2023.zip', 'Documents', '3,1 GB', 63) + r('gravacao.mkv', 'Videos', '2,4 GB', 49) + r('vm-disk.vhdx', 'VMs', '1,9 GB', 39) + '</div>' +
        '<span class="small muted">' + L('Grande e antigo não quer dizer descartável: nada vem marcado.', 'Large and old does not mean disposable: nothing is checked.') + '</span>';
    },
    steps: [[300, function (a) { show(a, 0); }], [650, function (a) { show(a, 1); }], [1000, function (a) { show(a, 2); }], [1350, function (a) { show(a, 3); }],
      [2600, function (a) { a.at(12, 33); }], [3400, function (a) { a.click(); a.qa('.mini-row input')[0].checked = true; }]]
  };

  SCENES.rules = {
    dur: 8600, start: [80, 90],
    alt: { pt: 'Regras próprias: uma pasta comum é aceita; uma que contém pasta protegida é recusada com o motivo.', en: 'Own rules: a regular folder is accepted; one that contains a protected folder is refused with the reason.' },
    build: function () {
      return '<div class="mini-head"><b>' + L('Regras próprias', 'Own rules') + '</b><span class="small muted">' + L('só ampliam, nunca removem proteção', 'only widen, never remove a protection') + '</span></div>' +
        '<div class="mini-card"><div style="display:flex;gap:6px;align-items:center"><span class="mini-btn" style="flex:1;justify-content:flex-start;font-family:var(--font-mono);font-weight:400" data-in><span class="muted">' + L('Pasta (aceita %VARIAVEL% e ~)', 'Folder (accepts %VARIABLE% and ~)') + '</span></span><span class="mini-btn pri" data-add>' + L('Adicionar', 'Add') + '</span></div>' +
        '<div data-list></div><div data-err></div></div>';
    },
    steps: [
      [500, function (a) { a.at(30, 30); }],
      [1000, function (a) { type(a, 'D:\\render-cache'); }],
      [2300, function (a) { a.at(88, 30); }], [2900, function (a) { a.click(); addRule(a, 'D:\\render-cache'); }],
      [3900, function (a) { a.at(30, 30); }],
      [4300, function (a) { type(a, '%USERPROFILE%\\AppData'); }],
      [5700, function (a) { a.at(88, 30); }], [6200, function (a) { a.click(); a.q('[data-err]').innerHTML = '<div class="ba-line err fade-up" style="font-size:11px;padding-top:6px">' + icon('warn', 13) + '<span>' + L('Contém ou é a pasta protegida ', 'Contains or is the protected folder ') + '<span class="mono">%LOCALAPPDATA%</span>.</span></div>'; }]
    ]
  };
  function type(a, txt) {
    var el = a.q('[data-in]'); el.innerHTML = '<span class="caret"></span>'; var i = 0;
    (function k() { if (!el.isConnected) return; i++; el.innerHTML = esc(txt.slice(0, i)) + '<span class="caret"></span>'; if (i < txt.length) setTimeout(k, 45); })();
  }
  function addRule(a, p) {
    a.q('[data-in]').innerHTML = '<span class="muted">' + L('Pasta (aceita %VARIAVEL% e ~)', 'Folder (accepts %VARIABLE% and ~)') + '</span>';
    a.q('[data-list]').insertAdjacentHTML('beforeend', '<div class="mini-row fade-up">' + tierSq('A') + '<span class="mono small" style="flex:1">' + esc(p) + '</span><span class="pill ok"><span class="dot"></span>OK</span></div>');
  }

  SCENES.monitor = {
    dur: 7800, start: [90, 90],
    alt: { pt: 'Monitoramento: bandeja ligada, aviso abaixo de 15 GB e varredura semanal; o sistema mostra o aviso de pouco espaço.', en: 'Monitoring: tray on, alert below 15 GB and weekly scan; the system shows the low-space alert.' },
    build: function () {
      function r(lbl, ctl) { return '<div class="mini-row"><span style="flex:1">' + lbl + '</span>' + ctl + '</div>'; }
      return '<div class="mini-head"><b>' + L('Monitoramento', 'Monitoring') + '</b><span class="small muted">' + L('só lê', 'read-only') + '</span></div>' +
        '<div class="mini-card" style="width:70%">' + r(L('Ícone na bandeja', 'Tray icon'), '<span class="mini-switch" data-s1></span>') +
        r(L('Avisar com o livre abaixo de', 'Alert when free space is below'), '<span class="mini-btn" data-s2>' + L('Desligado', 'Off') + '</span>') +
        r(L('Varredura agendada', 'Scheduled scan'), '<span class="mini-btn" data-s3>' + L('Desligada', 'Off') + '</span>') +
        r('<span class="muted">' + L('Executar limpeza automaticamente: nunca.', 'Run cleanup automatically: never.') + '</span>', '') + '</div><div data-n></div>';
    },
    steps: [
      [600, function (a) { a.at(64, 22); }], [1200, function (a) { a.click(); a.q('[data-s1]').classList.add('on'); }],
      [1900, function (a) { a.at(62, 36); }], [2500, function (a) { a.click(); a.q('[data-s2]').textContent = '15 GB'; }],
      [3200, function (a) { a.at(62, 50); }], [3800, function (a) { a.click(); a.q('[data-s3]').textContent = L('Semanal', 'Weekly'); }],
      [4700, function (a) {
        a.at(96, 96);
        a.q('[data-n]').innerHTML = '<div class="os-pop"><span class="ico">' + icon('warn', 16) + '</span><span class="gi-name"><b style="font-size:12px">' + L('Pouco espaço em C:\\', 'Low disk space on C:\\') + '</b><span class="small muted">' + L('12,4 GB livres (limite 15 GB). Abra o Disk Cleanup para varrer e classificar.', '12.4 GB free (limit 15 GB). Open Disk Cleanup to scan and classify.') + '</span></span></div>';
      }]
    ]
  };

  SCENES.orphans = {
    dur: 6800, start: [90, 90],
    alt: { pt: 'Sobras de apps: começa desligado; ligado, as pastas aparecem desmarcadas e com destino Lixeira.', en: 'App leftovers: off by default; when on, folders show up unchecked with the Recycle Bin as destination.' },
    build: function () {
      return '<div class="mini-head"><b>' + L('Sobras de apps desinstalados', 'Leftovers of uninstalled apps') + '</b><span class="kind exp">' + L('Experimental', 'Experimental') + '</span></div>' +
        '<div class="mini-card"><div class="mini-row"><span style="flex:1">' + L('Procurar sobras (só Windows)', 'Look for leftovers (Windows only)') + '</span><span class="mini-switch" data-s></span></div><div data-l></div></div>' +
        '<span class="small muted">' + L('Há falsos positivos (saves de jogos): nada vem marcado.', 'There are false positives (game saves): nothing is checked.') + '</span>';
    },
    steps: [
      [700, function (a) { a.at(91, 22); }], [1400, function (a) { a.click(); a.q('[data-s]').classList.add('on'); }],
      [1900, function (a) {
        a.q('[data-l]').innerHTML = ['OldEditor · 1,4 GB · ' + L('parada há 402 dias', 'idle 402 days'), 'TrialSuite · 860 MB · ' + L('parada há 190 dias', 'idle 190 days')].map(function (s, i) {
          return '<div class="mini-row fade-up" style="animation-delay:' + (i * 0.12) + 's"><input type="checkbox" tabindex="-1"><span class="gi-name"><span>' + s + '</span><span class="gi-path">%APPDATA%\\' + s.split(' ')[0] + '</span></span><span class="pill neutral" style="margin-left:auto">' + L('Lixeira', 'Recycle Bin') + '</span></div>';
        }).join('');
      }]
    ]
  };

  /* ---------- Peças de conteúdo ---------- */
  function kind(it) {
    return '<span class="kind ' + it.kind + '">' + t(UI.kinds[it.kind]) + '</span>' + (it.exp ? ' <span class="kind exp">' + t(UI.kinds.exp) + '</span>' : '');
  }
  function where(it) { return '<span class="where">' + icon('arrow', 12, 2) + '<b>' + esc(t(it.area)) + '</b></span>'; }
  /* Antes/agora para correções: o mesmo alvo, o resultado de cada versão. */
  function beforeAfter(it) {
    var b = it.ba; if (!b) return '';
    return '<div class="ba">' +
      '<div class="ba-side before"><span class="label-caps">' + icon('bug', 12) + t(UI.before) + ' · ' + esc(short(prevOf(it))) + '</span>' +
      '<div class="ba-line"><span class="mono t">' + esc(b.path) + '</span></div>' +
      '<div class="ba-line err">' + icon('x', 13, 2.2) + '<span>' + esc(t(b.before)) + ' <span class="mono">' + esc(b.detail) + '</span></span></div></div>' +
      '<div class="ba-side after"><span class="label-caps">' + icon('check', 12, 2.4) + t(UI.after) + ' · ' + esc(short(CURRENT)) + '</span>' +
      '<div class="ba-line"><span class="mono t">' + esc(b.path) + '</span></div>' +
      '<div class="ba-line ok">' + icon('check', 13, 2.4) + '<span>' + esc(t(b.after)) + ' <span class="mono">' + esc(b.detail) + '</span></span></div>' +
      (b.still ? '<div class="ba-line muted">' + icon('info', 13) + '<span><span class="mono">' + esc(b.still.path) + '</span> — ' + esc(t(b.still.txt)) + '</span></div>' : '') +
      '</div></div>';
  }
  function prevOf() { return ALL_VERSIONS[ALL_VERSIONS.indexOf(CURRENT) + 1]; }

  /* ---------- Moldura comum: barra lateral, abas, Varredura vazia, barra de status ---------- */
  function shell(o) {
    o = o || {};
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="layout"><aside class="sidebar"><div class="brand"><span class="brand-mark"><span data-icon="diskdot" data-size="18"></span></span>' +
      '<div class="brand-text"><span class="brand-name">Disk Cleanup</span><span class="small muted" data-t="tagline"></span></div></div>' +
      '<nav class="nav" id="nav" aria-label="Seções"><a href="#" data-sec="cleanup" aria-current="page"><span data-icon="disk"></span><span data-t="cleanup"></span></a>' +
      '<a href="#" data-sec="history"><span data-icon="history"></span><span data-t="history"></span></a>' +
      '<a href="#" data-sec="settings"><span data-icon="gear"></span><span data-t="settings"></span></a></nav></aside>' +
      '<main class="main"><div class="container page-stack" id="page"></div></main></div>' +
      '<footer class="statusbar" id="sb" aria-label="Barra de status"><span class="sb-item" role="status" aria-live="polite"><span class="sb-dot" aria-hidden="true"></span><span data-t="ready"></span></span>' +
      '<span class="sb-sep"></span><span class="sb-item"><span data-icon="disk" data-size="13"></span><span class="mono">C:\\</span></span>' +
      '<span class="sb-item"><span data-icon="cpu" data-size="13"></span>windows</span>' +
      '<span class="sb-item"><span data-icon="shield" data-size="13" style="color:var(--ok)"></span><span data-t="explicit"></span></span>' +
      '<span class="sb-right"><span id="sb-news"></span><button type="button" class="sb-item" id="sb-ver"><span class="mono">v' + CURRENT + '</span></button></span></footer>');
    hydrate();
  }
  function paintStatic() {
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(UI[el.getAttribute('data-t')]); });
    var v = document.getElementById('sb-ver'); if (v) v.title = t(UI.version);
  }
  function flow(newSteps) {
    newSteps = newSteps || {};
    return '<nav class="flow" aria-label="Etapas">' + UI.steps.map(function (s, i) {
      var cur = i === 0;
      return (i ? '<span class="flow-sep" aria-hidden="true"></span>' : '') +
        '<span class="flow-step' + (cur ? '' : ' locked') + '" data-step="' + i + '"' + (cur ? ' aria-current="page"' : ' aria-disabled="true"') + ' style="position:relative">' +
        '<span class="step-num">' + (cur ? '1' : icon('lock', 11, 2.2)) + '</span>' + t(s) + (newSteps[i] ? ' <span class="tag-new">' + t(UI.kinds.new) + '</span>' : '') + '</span>';
    }).join('') + '</nav>';
  }
  function surveyPage(o) {
    o = o || {};
    return flow(o.newSteps) + (o.top || '') +
      '<header class="page-head"><div class="titles"><span class="label-caps">' + t(UI.surveyEyebrow) + '</span><h1>' + t(UI.surveyTitle) + '</h1></div>' +
      '<div class="actions"><label class="field muted">' + t(UI.depth) + ' <select class="select"><option>2</option><option>1</option></select></label>' +
      '<button type="button" class="btn btn-primary" id="start">' + t(UI.start) + '</button></div></header>' + (o.afterHead || '') +
      '<section class="kpis" id="kpis"><div class="kpi"><span class="small muted">' + t(UI.used) + '</span><span class="value">' + L('371,4', '371.4') + ' GB</span><span class="small muted">' + t(UI.lastScan) + ' · ' + fmtDate('2026-11-24') + '</span></div>' +
      '<div class="kpi"><span class="small muted">' + t(UI.free) + '</span><span class="value">' + L('105,5', '105.5') + ' GB</span></div>' +
      '<div class="kpi"><span class="small muted">' + t(UI.cap) + '</span><span class="value">' + L('476,9', '476.9') + ' GB</span></div></section>' +
      '<div class="note" id="hint">' + icon('info') + '<span>' + t(UI.emptyHint) + '</span></div>';
  }
  /* Configurações › Atualizações com a preferência e o histórico de versões. */
  function updatesCard(onNotes, opts) {
    opts = opts || {};
    var sw = function (on, id) { return '<span class="switch"><input type="checkbox"' + (on ? ' checked' : '') + (id ? ' id="' + id + '"' : '') + '><i></i></span>'; };
    var hist = ALL_VERSIONS.slice(0, 4).map(function (v, i) {
      var r = release(v), d = r ? r.date : DATES[v];
      return '<div class="set-row"><span class="gi-name"><span><span class="ver-chip">v' + v + '</span>' + (i === 0 ? ' <span class="pill ok"><span class="dot"></span>' + t(UI.installed) + '</span>' : '') + '</span>' +
        '<span class="small muted">' + (d ? fmtDate(d) : '') + (r ? ' · ' + esc(t(r.headline)) : '') + '</span></span>' +
        (r ? '<button type="button" class="btn" data-notes="' + v + '" style="min-height:32px">' + t(UI.seeNotes) + '</button>' :
          '<span class="small muted" title="' + t(UI.githubHint) + '">' + t(UI.onGithub) + ' ' + icon('ext', 12) + '</span>') + '</div>';
    }).join('');
    var html = '<section class="card"><div class="card-head"><h2>' + t(UI.updates) + '</h2></div>' +
      '<div><div class="set-row"><span class="gi-name"><span>' + t(UI.autoUpdate) + '</span><span class="small muted">' + t(UI.autoUpdateHint) + '</span></span>' + sw(true) + '</div>' +
      '<div class="set-row"><span class="gi-name"><span>' + t(UI.beta) + '</span></span>' + sw(true) + '</div>' +
      '<div class="set-row"><span class="gi-name"><span>' + t(UI.showNotes) + (opts.newTag ? ' <span class="tag-new">' + t(UI.kinds.new) + '</span>' : '') + '</span><span class="small muted">' + t(UI.showNotesHint) + '</span></span>' + sw(true, 'show-notes') + '</div></div>' +
      '<span class="label-caps">' + t(UI.versionHistory) + '</span><div>' + hist + '</div></section>';
    return html;
  }
  function settingsPage(onNotes, opts) {
    var p = document.getElementById('page');
    p.innerHTML = '<header class="page-head"><div class="titles"><span class="label-caps">' + t(UI.settingsEyebrow) + '</span><h1>' + t(UI.settings) + '</h1></div></header>' + (opts && opts.before || '') + updatesCard(onNotes, opts);
    p.querySelectorAll('[data-notes]').forEach(function (b) { b.addEventListener('click', function () { onNotes(b.getAttribute('data-notes')); }); });
  }

  /* Barra do protótipo: idioma, tema, de qual versão veio e reinício do cenário. */
  function protoBar(o) {
    var bar = document.createElement('div'); bar.className = 'proto-bar';
    bar.innerHTML = '<span class="t">' + esc(o.title) + '</span><span class="sep"></span>' +
      '<button type="button" data-l="pt">PT</button><button type="button" data-l="en">EN</button><span class="sep"></span>' +
      '<button type="button" data-th title="Tema">' + icon('spark', 13) + '<span class="lbl">Tema</span></button><span class="sep"></span>' +
      '<button type="button" data-f="0.1.0-beta.6" title="Instalado vindo da beta.6">beta.6 → 7</button><button type="button" data-f="0.1.0-beta.5" title="Pulou a beta.6">beta.5 → 7</button><span class="sep"></span>' +
      '<button type="button" data-r>' + icon('history', 13) + '<span class="lbl">Reiniciar</span></button><a href="index.html">' + icon('grid', 13) + '</a>';
    document.body.appendChild(bar);
    function mark() {
      bar.querySelectorAll('[data-l]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-l') === lang)); });
      bar.querySelectorAll('[data-f]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === seen)); });
    }
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-l')) setLang(b.getAttribute('data-l'));
      if (b.hasAttribute('data-th')) { var r = document.documentElement, d = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; r.setAttribute('data-theme', d); try { localStorage.setItem('dc-theme-mode', d); } catch (x) { /* sem storage */ } }
      if (b.hasAttribute('data-f')) { setFrom(b.getAttribute('data-f')); o.restart(); }
      if (b.hasAttribute('data-r')) o.restart();
      mark();
    });
    document.addEventListener('rn:lang', mark);
    mark();
  }
  function toast(msg) {
    var old = document.querySelector('.proto-toast'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'proto-toast'; el.textContent = msg; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2300);
  }
  function spec(html) { return '<details class="proto-spec"><summary>Sobre esta proposta</summary>' + html + '</details>'; }
  function trapFocus(root, onEsc) {
    function h(e) {
      if (e.key === 'Escape') { onEsc(); return; }
      if (e.key !== 'Tab') return;
      var f = root.querySelectorAll('button:not([hidden]), [href], input, [tabindex]:not([tabindex="-1"])');
      f = Array.prototype.filter.call(f, function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    document.addEventListener('keydown', h);
    return function () { document.removeEventListener('keydown', h); };
  }

  setLang(lang);
  window.RN = {
    icon: icon, hydrate: hydrate, esc: esc, t: t, L: L, fill: fill, UI: UI, lang: function () { return lang; }, setLang: setLang,
    RELEASES: RELEASES, CURRENT: CURRENT, release: release, since: since, byKind: byKind, short: short, fmtDate: fmtDate,
    seen: function () { return seen; }, clip: clip, SCENES: SCENES, kind: kind, where: where, beforeAfter: beforeAfter,
    shell: shell, paintStatic: paintStatic, surveyPage: surveyPage, flow: flow, settingsPage: settingsPage, protoBar: protoBar,
    toast: toast, spec: spec, trapFocus: trapFocus, reduce: reduce
  };
})();
