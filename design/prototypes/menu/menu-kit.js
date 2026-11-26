/* Disk Cleanup — kit dos protótipos do menu. Funciona via file:// (sem fetch, sem módulos).
   Fornece: ícones (data-icon), as telas do app simuladas com estado real do fluxo
   (Varredura → Classificação → Plano → Execução → Relatório), Histórico interativo,
   Configurações, navegação (data-nav), tema com revelação circular, números animados
   e a moldura do protótipo. Dados de exemplo; regras de liberação iguais às do app. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MODE_KEY = 'dc-theme-mode';

  var PROTOS = [
    ['01-refinado.html', 'Refinado'],
    ['02-progresso.html', 'Progresso do fluxo'],
    ['03-trilho.html', 'Trilho recolhível'],
    ['04-status.html', 'Cartão de status'],
    ['05-volume.html', 'Volume em destaque'],
    ['06-grupos.html', 'Grupos e atalhos'],
    ['07-menu-marca.html', 'Menu na marca'],
    ['08-barra-status.html', 'Barra de status'],
    ['09-microinteracoes.html', 'Microinterações'],
    ['10-paleta.html', 'Paleta de comandos'],
    ['11-extra-vidro.html', 'Extra · Vidro e aurora'],
    ['12-extra-ilha.html', 'Extra · Ilha flutuante'],
    ['estados.html', 'Estados em andamento'],
    ['08b-fluxo-otimizado.html', '08b · Barra de status + fluxo otimizado']
  ];

  /* ================= Ícones ================= */
  var P = {
    disk: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 14h18"/>',
    diskdot: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 14h18"/><circle cx="17" cy="17" r="0.8"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevdown: '<path d="M6 9l6 6 6-6"/>',
    chevup: '<path d="M6 15l6-6 6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
    warn: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>'
  };
  function icon(name, size, sw) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  function hydrate(scope) {
    (scope || document).querySelectorAll('[data-icon]:empty').forEach(function (el) {
      el.innerHTML = icon(el.getAttribute('data-icon'), +el.getAttribute('data-size') || 16, +el.getAttribute('data-sw') || 1.8);
    });
  }
  var ARROW = icon('arrow', 16, 2);

  /* ================= Tema ================= */
  function getMode() { try { return localStorage.getItem(MODE_KEY) || 'system'; } catch (e) { return 'system'; } }
  function resolve(mode) {
    if (mode !== 'system') return mode;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function setMode(mode, x, y) {
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* storage bloqueado */ }
    var next = resolve(mode);
    var apply = function () { root.setAttribute('data-theme', next); };
    if (root.getAttribute('data-theme') === next) return syncThemeUi();
    if (document.startViewTransition && !reduce) {
      var cx = x == null ? innerWidth / 2 : x, cy = y == null ? innerHeight / 2 : y;
      root.style.setProperty('--vt-x', cx + 'px');
      root.style.setProperty('--vt-y', cy + 'px');
      root.style.setProperty('--vt-r', Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) + 'px');
      document.startViewTransition(apply);
    } else apply();
    syncThemeUi();
  }
  function toggleTheme(x, y) { setMode(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', x, y); }
  function syncThemeUi() {
    var mode = getMode();
    document.querySelectorAll('input[name="theme"]').forEach(function (i) { i.checked = i.value === mode; });
    var b = document.getElementById('proto-theme');
    if (b) b.innerHTML = icon(resolve(mode) === 'dark' ? 'sun' : 'moon', 14) + '<span class="lbl">Tema</span>';
  }

  /* ================= Formatação e números animados ================= */
  function fmt(v, dec) { return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function gb(v) { return fmt(v, 1) + ' GB'; }
  function sgb(v) { return (v < 0 ? '−' : '+') + fmt(Math.abs(v), 1) + ' GB'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /** Número que anima: do zero numa tela nova, do valor anterior numa atualização da mesma tela. */
  function tw(key, v, dec, suf, signed) {
    return '<span data-tw="' + key + '" data-v="' + v + '" data-dec="' + (dec || 0) + '" data-suf="' + (suf || '') + '"' + (signed ? ' data-signed="1"' : '') + '>' + twText(v, dec || 0, suf || '', signed) + '</span>';
  }
  function twText(v, dec, suf, signed) {
    var s = fmt(Math.abs(v), dec);
    if (signed) return (v < 0 ? '−' : '+') + s + suf;
    return (v < 0 ? '−' : '') + s + suf;
  }
  var lastVals = {};
  function animateNumbers(scope, soft) {
    scope.querySelectorAll('[data-tw]').forEach(function (el) {
      var key = el.getAttribute('data-tw'), end = +el.getAttribute('data-v'), dec = +el.getAttribute('data-dec');
      var suf = el.getAttribute('data-suf'), signed = el.hasAttribute('data-signed');
      var from = soft ? (key in lastVals ? lastVals[key] : end) : 0;
      lastVals[key] = end;
      if (reduce || from === end) { el.textContent = twText(end, dec, suf, signed); return; }
      if (soft) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      var t0 = performance.now(), dur = soft ? 450 : 900;
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = twText(from + (end - from) * e, dec, suf, signed);
        if (k < 1 && el.isConnected) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* ================= Dados de exemplo ================= */
  var TOTAL = 953.0, USED0 = 891.4;
  var TIERS = { A: 'Cache', B: 'Desinstalar', C: 'Regeneráveis', D: 'Sistema' };
  var TIER_HINT = {
    A: 'Cache regenerável. Risco: nenhum além do re-download.',
    B: 'Sempre pelo desinstalador. Remover a pasta deixa registro órfão.',
    C: 'Diretórios regeneráveis. Custo: re-download no próximo uso.',
    D: 'Operações de sistema. Última etapa; podem levar 10+ minutos.'
  };
  var RISK = { none: 'nenhum', low: 'baixo', redownload: 're-download', 'long-running': 'operação longa' };
  var CANDS = [
    { id: 'npm', t: 'A', label: 'npm cache', target: '%LOCALAPPDATA%\\npm-cache', gb: 6.4, kind: 'command', risk: 'none', note: 'npm cache clean --force' },
    { id: 'pip', t: 'A', label: 'pip cache', target: '%LOCALAPPDATA%\\pip\\cache', gb: 3.1, kind: 'command', risk: 'none', note: 'pip cache purge' },
    { id: 'nuget', t: 'A', label: 'NuGet packages', target: '%USERPROFILE%\\.nuget\\packages', gb: 4.2, kind: 'path', risk: 'redownload', note: 'restaurado no próximo build' },
    { id: 'temp', t: 'A', label: 'Temp (> 3 dias)', target: '%LOCALAPPDATA%\\Temp', gb: 7.9, kind: 'path', risk: 'low', note: 'arquivos em uso ficam' },
    { id: 'vsix', t: 'A', label: 'VS Code — VSIX em cache', target: '%APPDATA%\\Code\\CachedExtensionVSIXs', gb: 1.2, kind: 'path', risk: 'none', note: '—' },
    { id: 'bin', t: 'A', label: 'Lixeira', target: 'C:\\$Recycle.Bin', gb: 1.0, kind: 'command', risk: 'none', note: 'esvaziada pela API do shell' },
    { id: 'chatrtx', t: 'B', label: 'NVIDIA ChatRTX 0.5', target: 'C:\\Program Files\\NVIDIA Corporation\\ChatRTX', gb: 15.4, kind: 'uninstall', risk: 'low', note: 'desinstalador do fabricante' },
    { id: 'memu', t: 'B', label: 'MEmu', target: 'C:\\Program Files\\Microvirt', gb: 26.4, kind: 'uninstall', risk: 'low', note: 'VMs em image\\ incluídas' },
    { id: 'bt2019', t: 'B', label: 'VS BuildTools 2019', target: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools', gb: 6.8, kind: 'uninstall', risk: 'low', note: 'setup.exe uninstall' },
    { id: 'cuda', t: 'B', label: 'CUDA Toolkit 11.8', target: 'C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.8', gb: 2.6, kind: 'uninstall', risk: 'low', blocked: 'variável CUDA_PATH aponta para este caminho' },
    { id: 'gradle', t: 'C', label: 'Gradle caches', target: '%USERPROFILE%\\.gradle\\caches', gb: 14.2, kind: 'path', risk: 'redownload', note: 'pré: gradle --stop' },
    { id: 'm2', t: 'C', label: 'Maven repository', target: '%USERPROFILE%\\.m2\\repository', gb: 6.8, kind: 'path', risk: 'redownload', note: '—' },
    { id: 'sysimg', t: 'C', label: 'Android system-images', target: '%LOCALAPPDATA%\\Android\\Sdk\\system-images', gb: 9.4, kind: 'path', risk: 'redownload', note: 'emuladores baixam de novo' },
    { id: 'hf', t: 'C', label: 'HuggingFace cache', target: '%USERPROFILE%\\.cache\\huggingface', gb: 5.5, kind: 'path', risk: 'redownload', note: '—' },
    { id: 'dism', t: 'D', label: 'Limpeza do component store', target: 'C:\\Windows\\WinSxS', gb: 5.3, kind: 'command', risk: 'long-running', note: 'DISM /StartComponentCleanup' }
  ];
  /* Resultado simulado por item: [status, fração do estimado liberada, causa] */
  var OUTCOME = { temp: ['partial', 0.82, 'arquivos em uso ou sem permissão'], bin: ['skipped', 0, 'caminho não existe mais'], dism: ['ok', 1.11] };
  var SKIPPED_RULES = [['yarn-cache', 'caminho não existe: %LOCALAPPDATA%\\Yarn\\Cache'], ['pnpm-store', 'vazio'], ['cargo-registry', 'variável de ambiente ausente: CARGO_HOME']];
  var EXCL = [
    ['C:\\Windows\\Installer', 'Cache do MSI; sem ele a desinstalação quebra'],
    ['C:\\Windows\\WinSxS', 'Só via DISM (tier D)'],
    ['C:\\ProgramData\\Package Cache', 'Instaladores usados para desinstalar'],
    ['C:\\Program Files\\WindowsApps', 'Gerenciado só pela Store'],
    ['C:\\pagefile.sys', 'Ajuste só com medição de RAM'],
    ['OneDrive* · *Google Drive*', 'Liberar pelo cliente de nuvem, nunca remover']
  ];
  var STEPS = [['survey', 'Varredura'], ['classify', 'Classificação'], ['plan', 'Plano'], ['execute', 'Execução'], ['report', 'Relatório']];

  /* ================= Estado do fluxo (mesmas regras de flowStates) ================= */
  var F;
  function freshFlow(scanDone) {
    return { step: 'survey', scan: scanDone ? 'done' : 'none', classify: 'idle', tab: 'A', sel: {}, approved: false,
      apTiers: { A: true, B: true, C: true, D: true }, ack: false, runs: {}, running: null, confirming: null, free: TOTAL - USED0, open: {}, xopen: {} };
  }
  F = freshFlow(true);
  function selItems() { return CANDS.filter(function (c) { return !c.blocked && F.sel[c.id]; }); }
  function hasSel() { return F.classify === 'done' && selItems().length > 0; }
  function planTiers() { return ['A', 'B', 'C', 'D'].filter(function (t) { return selItems().some(function (c) { return c.t === t; }); }); }
  function execTiers() { return planTiers().filter(function (t) { return F.apTiers[t]; }); }
  function executedAny() { return Object.keys(F.runs).length > 0; }
  function finished() { var ts = execTiers(); return F.approved && ts.length > 0 && ts.every(function (t) { return F.runs[t]; }); }
  function sum(list) { return list.reduce(function (a, c) { return a + c.gb; }, 0); }
  function stepUnlocked(s) {
    return s === 'survey' || (s === 'classify' && F.scan === 'done') || (s === 'plan' && hasSel()) ||
      (s === 'execute' && F.approved) || (s === 'report' && executedAny());
  }
  function stepDone(s) {
    return (s === 'survey' && F.scan === 'done') || (s === 'classify' && hasSel()) || (s === 'plan' && F.approved) || (s === 'execute' && finished());
  }

  /* ---------- Abas do fluxo: elemento persistente, indicador desliza, cadeado vira número ---------- */
  var flowEl = null, flowInd = null, flowPrev = {};
  function ensureFlow() {
    if (flowEl) return;
    var page = document.getElementById('page');
    flowEl = document.createElement('nav');
    flowEl.className = 'flow';
    flowEl.id = 'flow-host';
    flowEl.setAttribute('aria-label', 'Etapas da limpeza');
    flowEl.innerHTML = '<span class="flow-ind" aria-hidden="true"></span>' + STEPS.map(function (s, i) {
      return (i ? '<span class="flow-sep" aria-hidden="true"></span>' : '') +
        '<button type="button" class="flow-step" data-step="' + s[0] + '"><span class="step-num"></span>' + s[1] + '</button>';
    }).join('');
    flowInd = flowEl.querySelector('.flow-ind');
    page.parentNode.insertBefore(flowEl, page);
    addEventListener('resize', function () { moveFlowInd(true); });
  }
  function updateFlow(animate) {
    ensureFlow();
    var seps = flowEl.querySelectorAll('.flow-sep');
    STEPS.forEach(function (s, i) {
      var b = flowEl.querySelector('[data-step="' + s[0] + '"]'), num = b.querySelector('.step-num');
      var un = stepUnlocked(s[0]), dn = stepDone(s[0]), cur = F.step === s[0];
      var prev = flowPrev[s[0]] || {};
      var mark = !un ? 'lock' : (dn && !cur ? 'check' : 'n');
      if (prev.mark !== mark) {
        num.innerHTML = mark === 'lock' ? icon('lock', 11, 2.2) : mark === 'check' ? icon('check', 12, 3) : String(i + 1);
        if (animate && prev.mark) { num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop'); }
      }
      if (animate && prev.un === false && un) { b.classList.remove('unlocking'); void b.offsetWidth; b.classList.add('unlocking'); }
      b.classList.toggle('locked', !un);
      b.classList.toggle('done', dn);
      b.disabled = !un;
      if (!un) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      b.title = un ? '' : lockReason(s[0]);
      if (cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      if (i > 0) seps[i - 1].classList.toggle('on', un);
      flowPrev[s[0]] = { un: un, mark: mark };
    });
    moveFlowInd(!animate);
    document.dispatchEvent(new CustomEvent('dc:flow', { detail: { step: F.step, index: STEPS.findIndex(function (s) { return s[0] === F.step; }), done: STEPS.map(function (s) { return stepDone(s[0]); }), scanning: F.scan === 'scanning' } }));
  }
  function lockReason(s) {
    return { classify: 'Conclua a varredura', plan: 'Marque ao menos 1 item na Classificação', execute: 'Aprove o plano', report: 'Execute ao menos um tier' }[s] || '';
  }
  function moveFlowInd(instant) {
    if (!flowEl || !flowEl.offsetParent) return;
    var a = flowEl.querySelector('[aria-current="page"]');
    if (!a) return;
    if (instant) flowInd.style.transition = 'none';
    flowInd.style.transform = 'translate(' + a.offsetLeft + 'px,' + a.offsetTop + 'px)';
    flowInd.style.width = a.offsetWidth + 'px';
    flowInd.style.height = a.offsetHeight + 'px';
    if (instant) { void flowInd.offsetWidth; flowInd.style.transition = ''; }
  }
  function goStep(s) {
    if (!stepUnlocked(s)) return;
    F.step = s;
    if (s === 'classify' && F.classify === 'idle') runClassify(true);
    if (current !== 'cleanup') go('cleanup'); else go('cleanup', { force: true });
  }

  function head(eyebrow, title, actions) {
    return '<header class="page-head"><div class="titles"><span class="label-caps">' + eyebrow + '</span><h1>' + title + '</h1></div><div class="actions">' + (actions || '') + '</div></header>';
  }
  function tierBadge(t, long) { return '<span class="tier t' + t + '"><span class="sq"></span>' + t + (long ? ' · ' + TIERS[t] : '') + '</span>'; }
  function emptyCard(title, body, btn) { return '<div class="card empty"><h2>' + title + '</h2><p class="muted">' + body + '</p>' + (btn || '') + '</div>'; }

  /* ================= 1 · Varredura ================= */
  var scanTimer = null;
  function scanCard() {
    return '<section class="card scan" role="status" aria-live="polite" aria-label="Varredura em andamento">' +
      '<div class="scan-head"><span class="scan-disk" id="scan-disk" aria-hidden="true">' + icon('disk', 22) + '</span>' +
      '<div class="scan-title"><h2>Varrendo C:\\</h2><span class="small muted">Somente leitura · nada é alterado no disco</span></div>' +
      '<span class="pill info live" id="scan-pill"><span class="dot"></span><span id="scan-state">Em andamento</span></span>' +
      '<span class="mono small muted" id="scan-time">00:00</span></div>' +
      '<div class="indet" id="scan-bar" aria-hidden="true"></div>' +
      '<div class="scan-stats">' +
      '<div class="scan-stat"><span class="small muted">Arquivos lidos</span><span class="v" id="scan-files">0</span></div>' +
      '<div class="scan-stat"><span class="small muted">Tamanho lógico</span><span class="v" id="scan-size">0,0 GB</span></div>' +
      '<div class="scan-stat"><span class="small muted">Ritmo</span><span class="v" id="scan-rate">0</span><span class="small muted">arquivos/s</span></div>' +
      '</div>' +
      '<div class="spark-wrap"><span class="small muted">Ritmo nos últimos 10 s</span>' +
      '<svg class="spark" viewBox="0 0 400 48" preserveAspectRatio="none" aria-hidden="true"><path class="a" id="spark-a"/><path class="l" id="spark-l"/></svg></div>' +
      '</section>';
  }
  function ghostKpis() {
    var k = '<div class="kpi ghost"><span class="skel" style="width:40%"></span><span class="skel skel-lg" style="width:70%"></span><span class="skel" style="width:55%"></span></div>';
    return '<section class="kpis" aria-hidden="true">' + k + k + k + k + '</section>';
  }
  function bars(rows, keyp) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    return '<div class="barlist">' + rows.map(function (r, i) {
      return '<div class="bar-row"><span class="name">' + esc(r[0]) + '</span><div class="track"><span style="width:' + (r[1] / max * 100).toFixed(1) + '%;animation-delay:' + (i * 0.04) + 's"></span></div><span class="num">' + (keyp ? tw(keyp + i, r[1], 1) : fmt(r[1], 1)) + '</span></div>';
    }).join('') + '</div>';
  }
  function surveyPage() {
    var eyebrow = 'Etapa 1 de 5 · somente leitura', title = 'Varredura do volume';
    if (F.scan === 'scanning') {
      return head(eyebrow, title, '<button type="button" class="btn" disabled>Nova varredura</button><button type="button" class="btn btn-primary" disabled>Classificar candidatos ' + ARROW + '</button>') +
        spec + scanCard() + ghostKpis();
    }
    if (F.scan === 'none') {
      return head(eyebrow, title, '<label class="muted small" for="depth">Profundidade</label><select id="depth" class="select"><option>2 níveis</option><option>1 nível</option></select><button type="button" class="btn btn-primary" data-action="scan">Iniciar varredura</button>') +
        spec + '<div class="card empty fx"><span class="empty-ico" aria-hidden="true">' + icon('disk', 28, 1.5) + '</span><h2>Nenhuma varredura ainda</h2><p class="muted">A varredura só lê o disco: mede o volume, as pastas por raiz, o perfil do usuário e as pastas de nuvem (tamanho lógico × real).</p>' +
        '<button type="button" class="btn btn-primary" data-action="scan">Iniciar varredura</button></div>';
    }
    var used = TOTAL - F.free;
    return head(eyebrow, title, '<button type="button" class="btn" data-action="scan">Nova varredura</button><button type="button" class="btn btn-primary" data-step="classify">Classificar candidatos ' + ARROW + '</button>') +
      spec +
      '<section class="kpis" aria-label="Resumo do volume">' +
      '<div class="kpi"><span class="small muted">Usado</span><span class="value">' + tw('sv-used', used, 1, ' GB') + '</span><span class="small muted">de 953,0 GB · <a class="link" href="#" data-nav="history">+6,5 GB desde 05/11</a></span></div>' +
      '<div class="kpi"><span class="small muted">Livre</span><span class="value">' + tw('sv-free', F.free, 1, ' GB') + '</span>' +
      (F.free / TOTAL < 0.1 ? '<span class="pill err"><span class="dot"></span>Crítico · ' + fmt(F.free / TOTAL * 100, 1) + '% livre</span>' : '<span class="pill ok"><span class="dot"></span>Saudável · ' + fmt(F.free / TOTAL * 100, 1) + '% livre</span>') + '</div>' +
      '<div class="kpi"><span class="small muted">Arquivos</span><span class="value">' + tw('sv-files', 1284113, 0) + '</span><span class="small muted">312 ilegíveis</span></div>' +
      '<div class="kpi"><span class="small muted">Varredura</span><span class="value text">Concluída · 2 níveis</span><span class="small muted mono">48 s · há 3 min</span></div>' +
      '</section>' +
      '<section class="card" aria-label="Ocupação"><div class="card-head"><h2>Ocupação do C:\\</h2><span class="num">' + tw('sv-pct', used / TOTAL * 100, 1, '%') + '</span></div>' +
      '<div class="meter" role="img" aria-label="' + fmt(used / TOTAL * 100, 1) + '% ocupado"><span style="width:' + (used / TOTAL * 100).toFixed(1) + '%"></span></div></section>' +
      '<div class="grid-2"><section class="card"><div class="card-head"><h2>Por raiz do volume</h2><span class="small muted">GB lógico</span></div>' +
      bars([['Users', 412.6], ['Program Files', 158.3], ['ProgramData', 96.4], ['Windows', 41.2], ['Program Files (x86)', 32.5], ['$Recycle.Bin', 18.7]]) + '</section>' +
      '<section class="card"><div class="card-head"><h2>Perfil do usuário</h2><span class="small muted">GB lógico</span></div>' +
      bars([['AppData', 188.2], ['.gradle', 64.9], ['Downloads', 52.3], ['.m2', 31.8], ['node_modules', 22.4], ['Documents', 18.0]]) + '</section></div>';
  }
  function startScan() {
    if (F.scan === 'scanning') return;
    F.scan = 'scanning';
    F.step = 'survey';
    document.body.classList.add('is-scanning');
    document.dispatchEvent(new CustomEvent('dc:scan', { detail: { on: true } }));
    if (current !== 'cleanup') go('cleanup'); else go('cleanup', { force: true });
    setTimeout(runScan, 220);
  }
  function endScan() {
    clearInterval(scanTimer); scanTimer = null;
    F.scan = 'done';
    document.body.classList.remove('is-scanning');
    document.dispatchEvent(new CustomEvent('dc:scan', { detail: { on: false } }));
  }
  function runScan() {
    var t0 = performance.now(), hist = [], lastHist = t0, END = 1284113, DUR = 6500;
    var $ = function (id) { return document.getElementById(id); };
    clearInterval(scanTimer);
    scanTimer = setInterval(function () {
      var now = performance.now(), el = now - t0, k = Math.min(1, el / DUR);
      if (k >= 1 && !$('scan-files')) { endScan(); updateFlow(true); return; }
      if (!$('scan-files')) return;
      /* ritmo com ondulação: pastas de muitos arquivos pequenos vs. poucos grandes */
      var rate = 150000 + 90000 * Math.sin(el / 700) + 50000 * Math.sin(el / 230) + Math.random() * 30000;
      var files = Math.min(END, Math.round(END * (1 - Math.pow(1 - k, 1.6))));
      $('scan-files').textContent = files.toLocaleString('pt-BR');
      $('scan-size').textContent = fmt(files / END * 902.7, 1) + ' GB';
      $('scan-rate').textContent = Math.round(rate).toLocaleString('pt-BR');
      var s = Math.floor(el / 1000);
      $('scan-time').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      if (now - lastHist > 250) {
        lastHist = now;
        hist.push(rate); if (hist.length > 40) hist.shift();
        var pts = hist.map(function (v, i) { return [(i / 39) * 400, 46 - v / 330000 * 42]; });
        var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
        $('spark-l').setAttribute('d', d);
        if (pts.length > 1) $('spark-a').setAttribute('d', d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' 48 L0 48 Z');
      }
      if (k >= 1) {
        clearInterval(scanTimer); scanTimer = null;
        $('scan-state').textContent = 'Concluída';
        $('scan-pill').className = 'pill ok';
        $('scan-bar').classList.add('done');
        $('scan-disk').classList.add('done');
        $('scan-disk').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="draw" pathLength="1" d="M5 12l5 5L20 7"/></svg>';
        setTimeout(function () { endScan(); if (current === 'cleanup' && F.step === 'survey') go('cleanup', { force: true }); else updateFlow(true); }, 1000);
      }
    }, 90);
  }

  /* ================= 2 · Classificação ================= */
  function runClassify(silent) {
    F.classify = 'running';
    F.approved = false;
    if (!silent) soft();
    setTimeout(function () {
      if (Object.keys(F.sel).length === 0) CANDS.forEach(function (c) { if (!c.blocked) F.sel[c.id] = true; });
      F.classify = 'done';
      if (current === 'cleanup' && F.step === 'classify') { F._reveal = true; soft(); } else updateFlow(true);
    }, 1700);
  }
  function classifySkeleton() {
    var groups = ['A', 'B', 'C', 'D'].map(function (t, g) {
      var rows = '';
      for (var r = 0; r < 3; r++) rows += '<div class="skel-row" style="animation-delay:' + (g * 0.08 + r * 0.04) + 's"><span class="skel" style="width:' + (38 + (r * 17 + g * 11) % 30) + '%"></span><span class="skel" style="width:56px"></span></div>';
      return '<div class="skel-group">' + tierBadge(t, true) + rows + '</div>';
    }).join('');
    return '<div class="grid-aside"><section class="card" role="status" aria-label="Classificação em andamento">' +
      '<div class="card-head"><h2>Medindo os caminhos do catálogo…</h2><span class="pill info live"><span class="dot"></span>Medindo</span></div>' +
      '<div class="indet" aria-hidden="true"></div>' + groups + '</section>' +
      '<aside class="card" aria-hidden="true"><h2>Seleção</h2>' + ['A', 'B', 'C', 'D'].map(function (t) { return '<div class="kv">' + tierBadge(t, true) + '<span class="skel" style="width:60px"></span></div>'; }).join('') +
      '<div class="divider"></div><span class="skel skel-lg" style="width:60%"></span></aside></div>';
  }
  function classifyPage() {
    var n = selItems().length;
    var actions = '<button type="button" class="btn" data-action="classify-run"' + (F.classify === 'running' ? ' disabled' : '') + '>Reclassificar</button>' +
      '<button type="button" class="btn btn-primary' + (n ? ' ready' : '') + '" data-step="plan"' + (hasSel() ? '' : ' disabled') + '>Montar plano ' + ARROW + '</button>';
    var out = head('Etapa 2 de 5 · somente leitura', 'Classificação dos candidatos', actions) + spec +
      '<div class="note" role="note">' + icon('info') + '<span>Candidatos a verificar, não lista de execução. O caminho existir no disco não prova que ele está sem uso.</span></div>';
    if (F.classify !== 'done') return out + classifySkeleton();
    var reveal = F._reveal ? ' fx' : ''; F._reveal = false;
    var tabs = ['A', 'B', 'C', 'D', 'X'].map(function (t) {
      var cnt = t === 'X' ? EXCL.length : CANDS.filter(function (c) { return c.t === t; }).length;
      return '<button type="button" class="tab" role="tab" data-tab="' + t + '" aria-selected="' + (F.tab === t) + '">' + (t === 'X' ? 'Exclusões' : tierBadge(t) + TIERS[t]) + '<span class="count">' + cnt + '</span></button>';
    }).join('');
    var panel;
    if (F.tab === 'X') {
      panel = '<p class="small muted">Nunca entram no plano, mesmo com tudo marcado.</p><div class="table-wrap"><table><thead><tr><th>Caminho</th><th>Motivo</th></tr></thead><tbody>' +
        EXCL.map(function (e) { return '<tr><td class="mono small">' + esc(e[0]) + '</td><td class="small">' + e[1] + '</td></tr>'; }).join('') + '</tbody></table></div>';
    } else {
      var rows = CANDS.filter(function (c) { return c.t === F.tab; });
      panel = '<div class="card-head"><p class="small muted">' + TIER_HINT[F.tab] + ' Itens bloqueados não entram no plano.</p><button type="button" class="btn" data-action="toggle-tier">Marcar/desmarcar tier</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th><span class="sr-only">Selecionar</span></th><th>Item</th><th class="num">GB</th><th>Risco</th><th>Observação</th></tr></thead><tbody>' +
        rows.map(function (c) {
          return '<tr class="' + (c.blocked ? 'blocked' : (F.sel[c.id] ? 'sel' : '')) + '"><td><input type="checkbox" id="c-' + c.id + '" data-sel="' + c.id + '"' + (c.blocked ? ' disabled' : (F.sel[c.id] ? ' checked' : '')) + '></td>' +
            '<td><label for="c-' + c.id + '">' + esc(c.label) + '</label><span class="path">' + esc(c.target) + '</span></td><td class="num">' + fmt(c.gb, 1) + '</td><td class="small">' + RISK[c.risk] + '</td>' +
            '<td>' + (c.blocked ? '<span class="pill warn"><span class="dot"></span>bloqueado: ' + c.blocked + '</span>' : '<span class="small muted">' + esc(c.note) + '</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    var tabAnim = F._tabAnim ? ' fx' : ''; F._tabAnim = false;
    var selRows = ['A', 'B', 'C', 'D'].map(function (t) {
      var its = selItems().filter(function (c) { return c.t === t; });
      return '<div class="kv">' + tierBadge(t, true) + '<span><span class="small muted">' + its.length + (its.length === 1 ? ' item' : ' itens') + '</span> · <span class="num">' + tw('cl-s' + t, sum(its), 1, ' GB') + '</span></span></div>';
    }).join('');
    return out + '<div class="grid-aside' + reveal + '">' +
      '<section class="card" aria-label="Candidatos por tier"><div class="tabs" role="tablist" aria-label="Tiers" id="tier-tabs">' + tabs + '</div>' +
      '<div class="tab-panel' + tabAnim + '" role="tabpanel">' + panel + '</div>' +
      '<details><summary>Regras sem candidato (' + SKIPPED_RULES.length + ')</summary><ul class="checklist small">' + SKIPPED_RULES.map(function (s) { return '<li><span class="mono">' + s[0] + '</span><span class="muted">' + esc(s[1]) + '</span></li>'; }).join('') + '</ul></details></section>' +
      '<aside style="display:flex;flex-direction:column;gap:16px"><section class="card" aria-label="Seleção"><h2>Seleção</h2>' + selRows +
      '<div class="divider"></div><div class="kv" style="font-weight:600"><span>Total estimado</span><span class="num" style="font-size:18px">' + tw('cl-total', sum(selItems()), 1, ' GB') + '</span></div>' +
      '<span class="small muted">' + n + (n === 1 ? ' item selecionado' : ' itens selecionados') + '</span>' +
      (n ? '' : '<p class="small warn">Marque ao menos 1 item para montar o plano.</p>') + '</section></aside></div>';
  }

  /* ================= 3 · Plano ================= */
  function canApprove() { return !F.approved && F.ack && execTiers().length > 0; }
  function planJson() {
    var o = { volume: 'C:', tiers: {} };
    planTiers().forEach(function (t) {
      o.tiers[t] = selItems().filter(function (c) { return c.t === t; }).map(function (c) { return { id: c.id, kind: c.kind, label: c.label, target: c.target }; });
    });
    return JSON.stringify(o, null, 2);
  }
  function planPage() {
    if (!hasSel()) return head('Etapa 3 de 5 · revisão', 'Plano de limpeza', '') + spec + emptyCard('Sem seleção', 'Abra a Classificação, revise os candidatos e volte aqui para montar o plano.', '<button type="button" class="btn btn-primary" data-step="classify">Ir para a Classificação</button>');
    var items = selItems(), pts = planTiers();
    var approveBtn = F.approved
      ? '<span class="pill ok approved-pill"><span class="ico-pop">' + icon('check', 12, 3) + '</span>Plano aprovado</span><button type="button" class="btn btn-primary" data-step="execute">Ir para a Execução ' + ARROW + '</button>'
      : '<button type="button" class="btn btn-primary' + (canApprove() ? ' ready' : '') + '" id="approve-btn" data-action="approve"' + (canApprove() ? '' : ' disabled') + '>Aprovar plano</button>';
    var rows = pts.map(function (t) {
      var its = items.filter(function (c) { return c.t === t; });
      return '<tr class="group"><td colspan="2">' + tierBadge(t, true) + '</td><td class="num">' + fmt(sum(its), 1) + '</td></tr>' +
        its.map(function (c) { return '<tr><td>' + esc(c.label) + '<span class="path">' + esc(c.target) + '</span></td><td class="mono small">' + c.kind + '</td><td class="num">' + fmt(c.gb, 1) + '</td></tr>'; }).join('');
    }).join('');
    var maxT = Math.max.apply(null, pts.map(function (t) { return sum(items.filter(function (c) { return c.t === t; })); }));
    var missing = F.approved ? '' : (execTiers().length === 0 ? 'Marque ao menos um tier para aprovar.' : (!F.ack ? 'Confirme a revisão do plano para aprovar.' : ''));
    return head('Etapa 3 de 5 · revisão', 'Plano de limpeza', '<button type="button" class="btn" data-step="classify">Voltar à seleção</button>' + approveBtn) + spec +
      '<section class="kpis" aria-label="Resumo do plano">' +
      '<div class="kpi"><span class="small muted">Itens no plano</span><span class="value">' + tw('pl-n', items.length, 0) + '</span><span class="small muted">' + pts.map(function (t) { return items.filter(function (c) { return c.t === t; }).length + ' ' + t; }).join(' · ') + '</span></div>' +
      '<div class="kpi"><span class="small muted">Liberação estimada</span><span class="value">' + tw('pl-gb', sum(items), 1, ' GB') + '</span><span class="small muted">soma dos tamanhos medidos</span></div>' +
      '</section>' +
      '<div class="grid-aside"><section class="card"><div class="card-head"><h2>Itens por tier</h2><span class="small muted">ordem de execução: A → B → C → D</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Item</th><th>Tipo</th><th class="num">GB</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
      '<aside style="display:flex;flex-direction:column;gap:16px">' +
      '<section class="card approval' + (F.approved ? ' is-approved' : '') + '" aria-label="Aprovação"><h2>Aprovação</h2><p class="small muted">Cada tier roda separado, com dry-run antes e medição do espaço livre a cada item.</p>' +
      '<fieldset style="border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:8px"><legend class="label-caps" style="margin-bottom:6px">Tiers aprovados</legend>' +
      pts.map(function (t) { return '<label class="kv" style="cursor:pointer">' + tierBadge(t, true) + '<input type="checkbox" data-aptier="' + t + '"' + (F.apTiers[t] ? ' checked' : '') + (F.approved ? ' disabled' : '') + '></label>'; }).join('') +
      '</fieldset><div class="divider"></div>' +
      '<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-ack style="margin-top:2px"' + (F.ack ? ' checked' : '') + (F.approved ? ' disabled' : '') + '><span class="small">Revisei itens e riscos. Remover cache também é irreversível.</span></label>' +
      '<p class="small muted missing" aria-live="polite">' + missing + '</p>' +
      '<p class="small muted">O plan.json também roda com a skill: <span class="mono">cleanup.ps1 -Plan plan.json -Tier A</span></p></section>' +
      '<section class="card"><h2>Por tier</h2>' + pts.map(function (t) {
        var s = sum(items.filter(function (c) { return c.t === t; }));
        return '<div class="tier-bar">' + tierBadge(t, true) + '<div class="track"><span style="width:' + (s / maxT * 100).toFixed(1) + '%;background:var(--t' + t + ')"></span></div><span class="num">' + fmt(s, 1) + '</span></div>';
      }).join('') + '</section></aside></div>' +
      '<section class="card" aria-label="plan.json"><div class="card-head"><h2>plan.json</h2><button type="button" class="btn" data-toast="plan.json copiado">' + icon('copy') + 'Copiar plan.json</button></div>' +
      '<pre class="code">' + esc(planJson()) + '</pre></section>';
  }

  /* ================= 4 · Execução ================= */
  function currentTier() { return execTiers().filter(function (t) { return !F.runs[t]; })[0] || null; }
  function tierItems(t) { return selItems().filter(function (c) { return c.t === t; }); }
  var STATUS_TONE = { ok: 'ok', partial: 'warn', skipped: 'neutral', failed: 'err' };
  var STATUS_TXT = { ok: 'ok', partial: 'parcial', skipped: 'pulado', failed: 'erro' };
  function executePage() {
    var eyebrow = 'Etapa 4 de 5 · execução', title = 'Execução por tier';
    if (!F.approved) return head(eyebrow, title, '') + spec + emptyCard('Nenhum plano aprovado', 'Aprove o plano antes de executar. Só os tiers aprovados podem rodar, um de cada vez.', '<button type="button" class="btn btn-primary" data-step="plan">Ir para o Plano</button>');
    var totalFreed = Object.keys(F.runs).reduce(function (a, t) { return a + F.runs[t].freed; }, 0);
    var actions = finished() ? '<span class="fx">Liberado nesta execução: <strong class="num">' + tw('ex-total', totalFreed, 1, ' GB', true) + '</strong></span><button type="button" class="btn btn-primary ready fx" data-step="report">Ver relatório ' + ARROW + '</button>' : '';
    var cur = currentTier();
    var stages = execTiers().map(function (t) {
      var run = F.runs[t], running = F.running === t;
      var pill = run ? '<span class="pill ok stage-pill"><span class="ico-pop">' + icon('check', 11, 3) + '</span>Concluído</span>'
        : running ? '<span class="pill info live"><span class="dot"></span>Executando</span>'
          : t === cur ? '<span class="pill neutral">Próximo</span>' : '<span class="pill neutral">Aguardando</span>';
      var est = sum(tierItems(t));
      var body = run ? '<span class="num stage-num">' + tw('st-' + t, run.freed, 1, ' GB', true) + '</span><span class="small muted">previsto ' + gb(est) + '</span>'
        : running ? '<span class="num stage-num" id="st-live">+0,0 GB</span><div class="meter"><span class="live-bar" id="st-bar" style="width:0%"></span></div>'
          : '<span class="num stage-num muted">' + gb(est) + '</span><span class="small muted">previsto' + (t === 'D' ? ' · operação longa' : '') + '</span>';
      return '<div class="stage' + (running || (!F.running && t === cur) ? ' active' : '') + (run ? ' done' : '') + '"><div class="row">' + tierBadge(t, true) + pill + '</div>' + body + '</div>';
    }).join('');
    var main = '';
    if (F.running) {
      var t = F.running;
      main = '<section class="card fx" role="status" aria-live="polite"><div class="card-head"><h2>Executando tier ' + t + ' · ' + TIERS[t] + '</h2><span class="mono small muted" id="ex-count">0 de ' + tierItems(t).length + '</span></div>' +
        '<div class="kv"><span class="muted">Liberado neste tier</span><span class="num" id="ex-freed">+0,0 GB</span></div>' +
        '<ul class="exec-list" id="exec-live">' + tierItems(t).map(function (c) {
          return '<li class="exec-item queued" data-id="' + c.id + '"><span class="exec-ico" aria-hidden="true"><span class="ring"></span>' + icon('check', 12, 3) + '</span>' +
            '<span class="exec-name">' + esc(c.label) + '<span class="exec-st small muted">na fila</span></span><span class="num small">' + fmt(c.gb, 1) + ' GB est.</span></li>';
        }).join('') + '</ul></section>';
    } else if (cur) {
      var its = tierItems(cur);
      main = '<section class="card fx" aria-label="Tier ' + cur + '"><div class="card-head"><h2>Tier ' + cur + ' · ' + TIERS[cur] + ' — dry-run</h2><span class="small muted">nada foi alterado ainda</span></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Item</th><th>Tipo</th><th class="num">GB previsto</th></tr></thead><tbody>' +
        its.map(function (c) { return '<tr><td>' + esc(c.label) + '<span class="path">' + esc(c.target) + '</span></td><td class="mono small">' + c.kind + '</td><td class="num">' + fmt(c.gb, 1) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        (F.confirming === cur
          ? '<div class="inset confirm fx" style="flex-wrap:wrap"><span>Executar o tier ' + cur + ' remove ' + its.length + ' itens (~' + gb(sum(its)) + '). Esta ação não pode ser desfeita.</span><div class="actions"><button type="button" class="btn" data-action="exec-cancel">Cancelar</button><button type="button" class="btn btn-primary btn-danger" data-action="exec-run">Confirmar e executar</button></div></div>'
          : '<div class="actions"><button type="button" class="btn btn-primary btn-lg" data-action="exec-request">Executar tier ' + cur + '</button></div>') + '</section>';
    }
    var results = execTiers().filter(function (t) { return F.runs[t]; }).reverse().map(function (t, i) {
      var r = F.runs[t];
      return '<section class="card' + (i === 0 && F._newRun ? ' fx' : '') + '" aria-label="Tier ' + t + ' · resultado"><div class="card-head"><h2>Tier ' + t + ' · resultado</h2><span class="small muted">' + gb(r.freeBefore) + ' → ' + gb(r.freeAfter) + ' livres</span></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Status</th><th>Item</th><th class="num">Δ livre</th></tr></thead><tbody>' +
        r.items.map(function (it) { return '<tr><td><span class="pill ' + STATUS_TONE[it.status] + '"><span class="dot"></span>' + STATUS_TXT[it.status] + '</span></td><td>' + esc(it.label) + (it.cause ? '<span class="path">' + it.cause + '</span>' : '') + '</td><td class="num">' + sgb(it.freed) + '</td></tr>'; }).join('') +
        '</tbody></table></div></section>';
    }).join('');
    F._newRun = false;
    return head(eyebrow, title, actions) + spec +
      '<div class="note warn-note" role="note">' + icon('warn') + '<span>Remoção é irreversível. Cada tier roda separado e mede o espaço livre antes e depois de cada item; item travado não aborta o tier.</span></div>' +
      '<section class="stepper" aria-label="Tiers">' + stages + '</section>' + main + results;
  }
  function runTier() {
    var t = currentTier();
    if (!t || F.running) return;
    F.running = t; F.confirming = null;
    soft();
    var emit = function (on, i) { document.dispatchEvent(new CustomEvent('dc:exec', { detail: { on: on, tier: t, label: TIERS[t], i: i, n: tierItems(t).length } })); };
    emit(true, 0);
    var its = tierItems(t), i = 0, freed = 0, results = [], before = F.free;
    var $ = function (id) { return document.getElementById(id); };
    function row(id) { var l = $('exec-live'); return l && l.querySelector('[data-id="' + id + '"]'); }
    function setRow(id, st, txt) {
      var li = row(id); if (!li) return;
      li.className = 'exec-item ' + st;
      li.querySelector('.exec-st').textContent = txt;
    }
    (function next() {
      if (i >= its.length) {
        F.runs[t] = { items: results, freed: freed, freeBefore: before, freeAfter: F.free };
        F.running = null; F._newRun = true; emit(false, its.length);
        if (current === 'cleanup' && F.step === 'execute') soft(); else updateFlow(true);
        if (finished()) toast('Execução concluída · ' + sgb(Object.keys(F.runs).reduce(function (a, k) { return a + F.runs[k].freed; }, 0)));
        return;
      }
      var c = its[i];
      setRow(c.id, 'running', 'rodando');
      setTimeout(function () {
        var o = OUTCOME[c.id] || ['ok', 0.97 + Math.random() * 0.04];
        var f = Math.round(c.gb * o[1] * 10) / 10;
        freed += f; F.free += f;
        results.push({ label: c.label, status: o[0], freed: f, cause: o[2] || '' });
        setRow(c.id, o[0], STATUS_TXT[o[0]] + (o[2] ? ' · ' + o[2] : ''));
        var li = row(c.id); if (li) li.querySelector('.num').textContent = f ? sgb(f) : '—';
        i++;
        if ($('ex-count')) $('ex-count').textContent = i + ' de ' + its.length;
        if ($('ex-freed')) $('ex-freed').textContent = sgb(freed);
        if ($('st-live')) $('st-live').textContent = sgb(freed);
        if ($('st-bar')) $('st-bar').style.width = (i / its.length * 100) + '%';
        emit(true, i);
        setTimeout(next, 260);
      }, (t === 'D' ? 1800 : 650) + Math.random() * 600);
    })();
  }

  /* ================= Variante v2 (08 otimizado): Plano e Execução com menos scroll ================= */
  function isV2() { return document.body && document.body.getAttribute('data-variant') === 'v2'; }
  function planPageV2() {
    var eyebrow = 'Etapa 3 de 5 · revisão', title = 'Plano de limpeza';
    if (!hasSel()) return head(eyebrow, title, '') + spec + emptyCard('Sem seleção', 'Abra a Classificação, revise os candidatos e volte aqui para montar o plano.', '<button type="button" class="btn btn-primary" data-step="classify">Ir para a Classificação</button>');
    var items = selItems(), pts = planTiers(), run = execTiers();
    var runItems = items.filter(function (c) { return F.apTiers[c.t]; });
    var can = canApprove();
    var reason = F.approved ? '' : (run.length === 0 ? 'Marque ao menos um tier para aprovar.' : (!F.ack ? 'Confirme a revisão do plano para aprovar.' : ''));
    var approveBtn = F.approved
      ? '<span class="pill ok approved-pill"><span class="ico-pop">' + icon('check', 12, 3) + '</span>Plano aprovado</span><button type="button" class="btn btn-primary ready" data-step="execute">Ir para a Execução ' + ARROW + '</button>'
      : '<button type="button" class="btn btn-primary' + (can ? ' ready' : '') + '" id="approve-btn" data-action="approve" aria-disabled="' + !can + '"' + (reason ? ' title="' + reason + '"' : '') + '>Aprovar plano</button>';
    var maxT = Math.max.apply(null, pts.map(function (t) { return sum(items.filter(function (c) { return c.t === t; })); }));
    var chips = pts.map(function (t) {
      var its = items.filter(function (c) { return c.t === t; });
      return '<label class="chip-tier' + (F.apTiers[t] ? ' on' : '') + '" style="--tc:var(--t' + t + ')"><input type="checkbox" data-aptier="' + t + '"' + (F.apTiers[t] ? ' checked' : '') + (F.approved ? ' disabled' : '') + '>' +
        '<span class="chip-box" aria-hidden="true">' + icon('check', 11, 3) + '</span><span class="chip-txt"><b>' + t + ' · ' + TIERS[t] + '</b><span class="small muted">' + its.length + (its.length === 1 ? ' item' : ' itens') + ' · ' + gb(sum(its)) + '</span></span></label>';
    }).join('');
    var groups = pts.map(function (t) {
      var its = items.filter(function (c) { return c.t === t; }), s = sum(its), open = !!F.open[t];
      return '<div class="grp' + (F.apTiers[t] ? '' : ' off') + '" data-grp="' + t + '" data-open="' + open + '">' +
        '<button type="button" class="grp-head" data-action="grp" data-t="' + t + '" aria-expanded="' + open + '">' + tierBadge(t, true) +
        '<span class="small muted">' + its.length + (its.length === 1 ? ' item' : ' itens') + '</span>' +
        (F.apTiers[t] ? '' : '<span class="pill neutral">fora desta execução</span>') +
        '<span class="grp-bar"><i style="width:' + (s / maxT * 100).toFixed(1) + '%;background:var(--t' + t + ')"></i></span><span class="num">' + gb(s) + '</span><span class="chev">' + icon('chevdown', 14) + '</span></button>' +
        '<div class="grp-body"><div><ul class="grp-items">' + its.map(function (c) {
          return '<li><span class="gi-name">' + esc(c.label) + '<span class="gi-path">' + esc(c.target) + '</span></span><span class="mono small muted">' + c.kind + '</span><span class="small muted">' + RISK[c.risk] + '</span><span class="num">' + fmt(c.gb, 1) + '</span></li>';
        }).join('') + '</ul></div></div></div>';
    }).join('');
    return head(eyebrow, title, '<button type="button" class="btn" data-step="classify">Voltar à seleção</button><button type="button" class="btn" data-action="json-open">' + icon('file') + 'plan.json</button>' + approveBtn) + spec +
      '<section class="card approve-card' + (F.approved ? ' is-approved' : '') + '" aria-label="Aprovação">' +
      '<div class="ap-sum">' +
      '<div class="ap-kpi"><span class="small muted">Itens que vão rodar</span><span class="ap-v">' + tw('p2-n', runItems.length, 0) + '</span></div>' +
      '<div class="ap-kpi"><span class="small muted">Liberação estimada</span><span class="ap-v">' + tw('p2-gb', sum(runItems), 1, ' GB') + '</span></div>' +
      '<div class="ap-kpi"><span class="small muted">Livre depois (estimado)</span><span class="ap-v">' + tw('p2-free', F.free + sum(runItems), 1, ' GB') + '</span></div>' +
      '</div>' +
      '<div class="ap-ctrl">' +
      '<div class="ap-step"><span class="label-caps"><span class="ap-n">1</span>Tiers que vão rodar</span><div class="chips" data-need="tiers">' + chips + '</div></div>' +
      '<div class="ap-step"><span class="label-caps"><span class="ap-n">2</span>Confirmação</span>' +
      '<label class="ack' + (F.ack ? ' on' : '') + '" data-need="ack"><input type="checkbox" data-ack' + (F.ack ? ' checked' : '') + (F.approved ? ' disabled' : '') + '><span>Revisei itens e riscos. Remover cache também é irreversível.</span></label></div>' +
      (F.approved ? '<p class="small ok ap-msg">' + icon('check', 14, 2.4) + ' Aprovado. Cada tier roda separado na Execução, com dry-run antes.</p>'
        : '<p class="small muted ap-msg" aria-live="polite">' + (reason ? icon('info', 14) + ' ' + reason : icon('check', 14, 2.4) + ' Pronto para aprovar.') + '</p>') +
      '</div></section>' +
      '<section class="card"><div class="card-head"><h2>Itens por tier</h2><div class="actions"><span class="small muted">ordem de execução: A → B → C → D</span><button type="button" class="btn" data-action="grp-all">' + (pts.every(function (t) { return F.open[t]; }) ? 'Recolher todos' : 'Expandir todos') + '</button></div></div>' +
      '<div class="grps">' + groups + '</div></section>';
  }
  function openJsonDrawer() {
    var d = document.getElementById('json-drawer');
    if (!d) {
      d = document.createElement('div');
      d.id = 'json-drawer';
      d.className = 'drawer-wrap';
      document.body.appendChild(d);
    }
    d.innerHTML = '<div class="drawer-scrim" data-action="json-close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="plan.json">' +
      '<div class="card-head"><h2>plan.json</h2><div class="actions"><button type="button" class="btn" data-toast="plan.json copiado">' + icon('copy') + 'Copiar</button><button type="button" class="btn" data-action="json-close" aria-label="Fechar">×</button></div></div>' +
      '<p class="small muted">O plan.json também roda com a skill: <span class="mono">cleanup.ps1 -Plan plan.json -Tier A</span></p>' +
      '<pre class="code">' + esc(planJson()) + '</pre></aside>';
    void d.offsetWidth;
    d.classList.add('open');
    setTimeout(function () { var b = d.querySelector('[aria-label="Fechar"]'); if (b) b.focus(); }, 50);
  }
  function closeJsonDrawer() { var d = document.getElementById('json-drawer'); if (d) d.classList.remove('open'); }

  function executePageV2() {
    var eyebrow = 'Etapa 4 de 5 · execução', title = 'Execução por tier';
    if (!F.approved) return head(eyebrow, title, '') + spec + emptyCard('Nenhum plano aprovado', 'Aprove o plano antes de executar. Só os tiers aprovados podem rodar, um de cada vez.', '<button type="button" class="btn btn-primary" data-step="plan">Ir para o Plano</button>');
    var ts = execTiers(), cur = currentTier(), done = ts.filter(function (t) { return F.runs[t]; }).length;
    var totalFreed = Object.keys(F.runs).reduce(function (a, t) { return a + F.runs[t].freed; }, 0);
    var active = F.running || cur;
    var k = finished() ? ts.length : ts.indexOf(active) + 1;
    var actions;
    if (finished()) actions = '<span class="fx">Liberado: <strong class="num">' + tw('x2-total', totalFreed, 1, ' GB', true) + '</strong></span><button type="button" class="btn btn-primary ready fx" data-step="report">Ver relatório ' + ARROW + '</button>';
    else if (F.running) actions = '<button type="button" class="btn btn-primary" disabled><span class="spin-ring" aria-hidden="true"></span>Executando tier ' + F.running + '…</button>';
    else if (F.confirming) actions = '<button type="button" class="btn btn-primary" disabled>Executar tier ' + cur + '</button>';
    else actions = '<button type="button" class="btn btn-primary ready" data-action="exec-request">Executar tier ' + cur + ' ' + ARROW + '</button>';

    var gTitle, gDesc;
    if (finished()) { gTitle = 'Execução concluída'; gDesc = sgb(totalFreed) + ' liberados em ' + ts.length + (ts.length === 1 ? ' tier' : ' tiers') + '. O relatório já está disponível.'; }
    else if (F.running) { gTitle = 'Executando tier ' + F.running + ' · ' + TIERS[F.running]; gDesc = '<span id="ex-count">0 de ' + tierItems(F.running).length + '</span> itens · <span id="ex-freed">+0,0 GB</span> liberados · não feche o app.'; }
    else if (F.confirming) { gTitle = 'Confirmar tier ' + cur + ' · ' + TIERS[cur]; gDesc = 'Última verificação antes de remover.'; }
    else { gTitle = (done ? 'Próximo: ' : 'Comece pelo ') + 'tier ' + cur + ' · ' + TIERS[cur]; gDesc = tierItems(cur).length + ' itens · ~' + gb(sum(tierItems(cur))) + '. Revise o dry-run abaixo e use <b>Executar tier ' + cur + '</b> no topo. Um tier por vez; o próximo fica pronto aqui ao terminar.'; }
    var segs = ts.map(function (t) {
      var st = F.runs[t] ? 'done' : F.running === t ? 'running' : t === cur ? 'current' : 'waiting';
      return '<div class="seg ' + st + '" style="--tc:var(--t' + t + ')"><span class="seg-bar"><i' + (st === 'running' ? ' id="st-bar" style="width:0%"' : '') + '></i></span><span class="seg-lbl">' +
        (st === 'done' ? icon('check', 11, 3) : '') + t + '</span></div>';
    }).join('');
    var confirm = F.confirming && F.confirming === cur && !F.running
      ? '<div class="inset confirm fx" style="flex-wrap:wrap"><span>Executar o tier ' + cur + ' remove ' + tierItems(cur).length + ' itens (~' + gb(sum(tierItems(cur))) + '). Esta ação não pode ser desfeita.</span><div class="actions"><button type="button" class="btn" data-action="exec-cancel">Cancelar</button><button type="button" class="btn btn-danger-solid" data-action="exec-run">' + icon('warn', 15, 2) + 'Confirmar e executar</button></div></div>'
      : '';
    var rows = ts.map(function (t) {
      var r = F.runs[t], running = F.running === t, isCur = !F.running && t === cur;
      var st = r ? 'done' : running ? 'running' : isCur ? 'current' : 'waiting';
      var open = running || isCur || !!F.xopen[t];
      var its = tierItems(t), est = sum(its);
      var statusIco = r ? '<span class="xs ok ico-pop">' + icon('check', 12, 3) + '</span>' : running ? '<span class="xs spin-ring"></span>' : '<span class="xs n">' + (ts.indexOf(t) + 1) + '</span>';
      var pill = r ? '<span class="pill ok">Concluído</span>' : running ? '<span class="pill info live"><span class="dot"></span>Executando</span>' : isCur ? '<span class="pill neutral strong">Próximo</span>' : '<span class="pill neutral">Aguardando</span>';
      var value = r ? '<span class="num">' + tw('x2-' + t, r.freed, 1, ' GB', true) + ' <span class="muted">/ ' + fmt(est, 1) + '</span></span>' : '<span class="num muted">' + gb(est) + ' previsto</span>';
      var body;
      if (running) {
        body = '<ul class="exec-list" id="exec-live">' + its.map(function (c) {
          return '<li class="exec-item queued" data-id="' + c.id + '"><span class="exec-ico" aria-hidden="true"><span class="ring"></span>' + icon('check', 12, 3) + '</span><span class="exec-name">' + esc(c.label) + '<span class="exec-st small muted">na fila</span></span><span class="num small">' + fmt(c.gb, 1) + ' GB est.</span></li>';
        }).join('') + '</ul>';
      } else if (r) {
        body = '<p class="small muted">' + gb(r.freeBefore) + ' → ' + gb(r.freeAfter) + ' livres</p><ul class="res-list">' + r.items.map(function (it) {
          return '<li><span class="pill ' + STATUS_TONE[it.status] + '"><span class="dot"></span>' + STATUS_TXT[it.status] + '</span><span class="gi-name">' + esc(it.label) + (it.cause ? '<span class="gi-path">' + it.cause + '</span>' : '') + '</span><span class="num">' + sgb(it.freed) + '</span></li>';
        }).join('') + '</ul>';
      } else {
        body = (isCur ? '<p class="small muted">Dry-run · nada foi alterado ainda</p>' : '') + '<ul class="grp-items">' + its.map(function (c) {
          return '<li><span class="gi-name">' + esc(c.label) + '<span class="gi-path">' + esc(c.target) + '</span></span><span class="mono small muted">' + c.kind + '</span><span class="small muted">' + RISK[c.risk] + '</span><span class="num">' + fmt(c.gb, 1) + '</span></li>';
        }).join('') + '</ul>';
      }
      return '<div class="xrow ' + st + '" data-xrow="' + t + '" data-open="' + open + '" style="--tc:var(--t' + t + ')">' +
        '<button type="button" class="xrow-head" data-action="xrow" data-t="' + t + '" aria-expanded="' + open + '"' + (running || isCur ? ' tabindex="-1"' : '') + '>' + statusIco + tierBadge(t, true) +
        '<span class="small muted">' + its.length + (its.length === 1 ? ' item' : ' itens') + '</span>' + pill + value + '<span class="chev">' + icon('chevdown', 14) + '</span></button>' +
        '<div class="grp-body"><div><div class="xrow-inner' + (running || (isCur && F._newRun) ? ' fx' : '') + '">' + body + '</div></div></div></div>';
    }).join('');
    F._newRun = false;
    return head(eyebrow, title, actions) + spec +
      '<section class="card guide' + (finished() ? ' is-done' : '') + '" aria-live="polite">' +
      '<div class="guide-top"><div class="guide-txt"><span class="label-caps">Passo ' + k + ' de ' + ts.length + '</span><h2>' + gTitle + '</h2><p class="small muted">' + gDesc + '</p></div>' +
      '<div class="guide-segs" aria-hidden="true">' + segs + '</div></div>' + confirm +
      '<p class="small warn-line">' + icon('warn', 14) + ' Remoção é irreversível. Cada tier mede o espaço livre antes e depois de cada item; item travado não aborta o tier.</p></section>' +
      '<section class="card xlist" aria-label="Tiers aprovados">' + rows + '</section>';
  }

  /* ================= 5 · Relatório ================= */
  function reportPage() {
    var eyebrow = 'Etapa 5 de 5 · relatório', title = 'Relatório da limpeza';
    if (!executedAny()) return head(eyebrow, title, '') + spec + emptyCard('Sem relatório', 'Nenhum tier executado. Execute ao menos um tier aprovado.', '<button type="button" class="btn btn-primary" data-step="execute">Ir para a Execução</button>');
    var ts = execTiers().filter(function (t) { return F.runs[t]; });
    var freed = ts.reduce(function (a, t) { return a + F.runs[t].freed; }, 0);
    var est = ts.reduce(function (a, t) { return a + sum(tierItems(t)); }, 0);
    var all = []; ts.forEach(function (t) { all = all.concat(F.runs[t].items); });
    var pending = all.filter(function (i) { return i.status !== 'ok'; });
    var free0 = TOTAL - USED0, pct0 = USED0 / TOTAL * 100, pct1 = (TOTAL - F.free) / TOTAL * 100;
    var blocked = CANDS.filter(function (c) { return c.blocked; });
    var maxT = Math.max.apply(null, ts.map(function (t) { return Math.max(F.runs[t].freed, sum(tierItems(t))); }));
    return head(eyebrow, title,
      '<button type="button" class="btn" data-toast="Relatório copiado (Markdown)">' + icon('copy') + 'Copiar relatório</button>' +
      '<button type="button" class="btn" data-toast="Abre o diálogo de impressão (simulado)">' + icon('file') + 'Exportar PDF</button>' +
      '<button type="button" class="btn" data-toast="Imagem salva: Documentos\\disk-cleanup-relatorio.png">' + icon('image') + 'Salvar imagem</button>' +
      '<button type="button" class="btn btn-primary" data-action="new-analysis" title="O relatório sai da tela ao começar de novo — exporte antes se quiser guardar. O histórico de varreduras é mantido.">Nova análise</button>') + spec +
      '<section class="kpis" aria-label="Resultado">' +
      '<div class="kpi kpi-hero"><span class="small muted">Liberado</span><span class="value">' + tw('rp-freed', freed, 1, ' GB', true) + '</span><span class="small muted">previsto ' + gb(est) + '</span></div>' +
      '<div class="kpi"><span class="small muted">Livre</span><span class="value">' + tw('rp-free', F.free, 1, ' GB') + '</span><span class="small muted">antes ' + gb(free0) + '</span></div>' +
      '<div class="kpi"><span class="small muted">Ocupação</span><span class="value">' + tw('rp-pct', pct1, 1, '%') + '</span><span class="small muted">antes ' + fmt(pct0, 1) + '%</span></div>' +
      '<div class="kpi"><span class="small muted">Pendências</span><span class="value">' + tw('rp-pend', pending.length, 0) + '</span><span class="small muted">' + all.length + ' itens executados</span></div>' +
      '</section>' +
      '<div class="grid-2"><section class="card" aria-label="Antes e depois"><div class="card-head"><h2>Antes e depois</h2><span class="small muted">ocupação do C:\\</span></div>' +
      '<div class="ba"><div class="kv small"><span class="muted">Antes</span><span class="num">' + fmt(pct0, 1) + '%</span></div><div class="meter"><span style="width:' + pct0.toFixed(1) + '%"></span></div>' +
      '<div class="kv small"><span class="muted">Depois</span><span class="num">' + fmt(pct1, 1) + '%</span></div><div class="meter after"><span style="width:' + pct1.toFixed(1) + '%"></span><i style="left:' + pct1.toFixed(1) + '%;width:' + (pct0 - pct1).toFixed(1) + '%"></i></div>' +
      '<p class="small muted">Faixa clara = espaço devolvido ao volume.</p></div></section>' +
      '<section class="card" aria-label="Liberado por tier"><div class="card-head"><h2>Liberado por tier</h2><span class="small muted">medido × previsto</span></div>' +
      ts.map(function (t, i) {
        var r = F.runs[t], e = sum(tierItems(t));
        return '<div class="tier-bar">' + tierBadge(t, true) + '<div class="track dual"><span class="ghost" style="width:' + (e / maxT * 100).toFixed(1) + '%"></span><span style="width:' + (r.freed / maxT * 100).toFixed(1) + '%;background:var(--t' + t + ');animation-delay:' + (0.1 + i * 0.08) + 's"></span></div><span class="num">' + sgb(r.freed) + ' <span class="muted">/ ' + fmt(e, 1) + '</span></span></div>';
      }).join('') + '</section></div>' +
      '<div class="grid-2"><section class="card"><h2>Decisões que divergiram do plano</h2>' +
      (blocked.length ? '<ul class="checklist small">' + blocked.map(function (c) { return '<li><strong>' + esc(c.label) + '</strong><span class="muted">mantido: ' + c.blocked + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">Nenhuma divergência.</p>') + '</section>' +
      '<section class="card"><h2>Pendências</h2>' +
      (pending.length ? '<ul class="checklist small">' + pending.map(function (i) { return '<li><strong>' + esc(i.label) + '</strong><span class="muted">' + STATUS_TXT[i.status] + ': ' + i.cause + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">Nenhuma pendência.</p>') + '</section></div>' +
      '<section class="card"><h2>Não tocado (deliberado)</h2><ul class="checklist small">' + EXCL.map(function (e) { return '<li><span class="mono">' + esc(e[0]) + '</span><span class="muted">' + e[1] + '</span></li>'; }).join('') + '</ul></section>';
  }

  /* ================= Histórico ================= */
  var ROOTS = [['Users', 412.6, 4.1], ['Program Files', 158.3, 1.2], ['ProgramData', 96.4, 1.6], ['Windows', 41.2, 0.3], ['Program Files (x86)', 32.5, -0.6], ['$Recycle.Bin', 18.7, 0.9]];
  var PROF = [['AppData', 188.2, 2.2], ['.gradle', 64.9, 1.1], ['Downloads', 52.3, -1.4], ['.m2', 31.8, 0.4], ['node_modules', 22.4, 0.6], ['Documents', 18.0, 0.02]];
  var SNAP_META = [['s1', '02/09/2026 10:12', 853.2], ['s2', '18/09/2026 11:07', 861.8], ['s3', '01/10/2026 18:20', 870.1], ['s4', '16/10/2026 09:41', 879.6], ['s5', '05/11/2026 16:30', 884.9], ['s6', '26/11/2026 14:02', 891.4]];
  function makeSnaps() {
    return SNAP_META.map(function (m, i) {
      var back = 5 - i;
      return { id: m[0], at: m[1], day: m[1].slice(0, 5), used: m[2], free: TOTAL - m[2], files: 1198000 + i * 17223, unreadable: 280 + i * 6, secs: 52 - i * 1.3 + (i % 2) * 3, depth: i === 0 ? 1 : 2,
        roots: ROOTS.map(function (r) { return [r[0], Math.round((r[1] - r[2] * back) * 10) / 10]; }),
        profile: PROF.map(function (r) { return [r[0], Math.round((r[1] - r[2] * back) * 10) / 10]; }) };
    });
  }
  var H = { snaps: makeSnaps(), detail: 's6', from: 's5', to: 's6', confirming: false };
  function snap(id) { return H.snaps.filter(function (s) { return s.id === id; })[0]; }
  function prevOf(s) { var i = H.snaps.indexOf(s); return i > 0 ? H.snaps[i - 1] : null; }
  function fixHistory() {
    var n = H.snaps.length, last = H.snaps[n - 1];
    if (!n) return;
    if (!snap(H.detail)) H.detail = last.id;
    if (!snap(H.to)) H.to = last.id;
    if (!snap(H.from)) H.from = (H.snaps[n - 2] || last).id;
  }
  function diff(a, b) {
    return b.map(function (r) {
      var o = a.filter(function (x) { return x[0] === r[0]; })[0];
      return [r[0], Math.round((r[1] - (o ? o[1] : 0)) * 10) / 10];
    }).filter(function (d) { return Math.abs(d[1]) >= 0.05; }).sort(function (x, y) { return Math.abs(y[1]) - Math.abs(x[1]); }).slice(0, 10);
  }
  function diffList(rows) {
    if (!rows.length) return '<p class="small muted">Nenhuma variação acima de 0,05 GB.</p>';
    var max = Math.max.apply(null, rows.map(function (r) { return Math.abs(r[1]); }));
    return '<div class="diff">' + rows.map(function (r, i) {
      var w = (Math.abs(r[1]) / max * 50).toFixed(1);
      return '<div class="diff-row"><span class="name">' + esc(r[0]) + '</span><div class="diff-track"><span class="' + (r[1] > 0 ? 'grow' : 'shrink') + '" style="width:' + w + '%;animation-delay:' + (i * 0.05) + 's"></span></div><span class="num">' + sgb(r[1]) + '</span></div>';
    }).join('') + '</div>';
  }
  function chart() {
    var W = 720, Hh = 250, L = 48, R = 84, T = 14, B = 28, n = H.snaps.length;
    var x = function (i) { return n === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (n - 1); };
    var y = function (v) { return T + (1 - v / 1000) * (Hh - T - B); };
    var grid = [0, 250, 500, 750, 1000].map(function (v) { return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>'; }).join('');
    var axis = [0, 250, 500, 750, 1000].map(function (v) { return '<text x="' + (L - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>'; }).join('');
    var d = H.snaps.map(function (s, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(s.used).toFixed(1); }).join(' ');
    var area = d + ' L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var dots = H.snaps.map(function (s, i) {
      return '<circle class="dot' + (s.id === H.detail ? ' cur' : '') + '" r="' + (s.id === H.detail ? 5.5 : 4) + '" cx="' + x(i).toFixed(1) + '" cy="' + y(s.used).toFixed(1) + '" style="animation-delay:' + (0.3 + i * 0.1) + 's"/>';
    }).join('');
    var hits = H.snaps.map(function (s, i) {
      return '<circle class="hit" r="16" cx="' + x(i).toFixed(1) + '" cy="' + y(s.used).toFixed(1) + '" tabindex="0" role="button" data-snap="' + s.id + '" data-i="' + i + '" aria-label="Varredura de ' + s.at + ': ' + gb(s.used) + '"/>';
    }).join('');
    var last = H.snaps[n - 1];
    return '<div class="chart" id="chart"><svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Espaço usado por varredura">' +
      '<g class="grid">' + grid + '</g><g class="axis">' + axis + H.snaps.map(function (s, i) { return '<text x="' + x(i).toFixed(1) + '" y="' + (Hh - 8) + '" text-anchor="middle">' + s.day + '</text>'; }).join('') + '</g>' +
      '<g class="ref"><line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(TOTAL).toFixed(1) + '" y2="' + y(TOTAL).toFixed(1) + '" stroke-dasharray="4 4"/><text x="' + (W - R + 6) + '" y="' + (y(TOTAL) + 4).toFixed(1) + '">capacidade</text></g>' +
      '<path class="area" d="' + area + '"/><path class="line" pathLength="1" d="' + d + '"/>' +
      '<line class="cross" id="cross" x1="0" x2="0" y1="' + T + '" y2="' + y(0).toFixed(1) + '" opacity="0"/>' + dots +
      '<text class="end-label" x="' + (x(n - 1) + 8).toFixed(1) + '" y="' + (y(last.used) + 18).toFixed(1) + '">' + gb(last.used) + '</text>' + hits +
      '</svg><div class="tooltip" id="tip" hidden></div></div>';
  }
  function historyPage() {
    fixHistory();
    var S = H.snaps, n = S.length;
    var clearBtn = n ? '<button type="button" class="btn" data-action="h-clear">' + icon('trash') + 'Limpar histórico</button>' : '';
    var out = head('Análise · somente leitura', 'Histórico de varreduras', '<span class="small muted">Salvo neste computador · últimas 100 varreduras</span>' + clearBtn) + spec +
      (H.confirming ? '<div class="inset confirm fx" style="flex-wrap:wrap"><span>Apagar as ' + n + ' varreduras salvas? Isso não toca no disco, só no histórico.</span><div class="actions"><button type="button" class="btn" data-action="h-clear-cancel">Cancelar</button><button type="button" class="btn btn-primary btn-danger" data-action="h-clear-ok">Apagar histórico</button></div></div>' : '');
    if (!n) return out + '<div class="card empty fx"><span class="empty-ico" aria-hidden="true">' + icon('history', 28, 1.5) + '</span><h2>Nenhuma varredura salva</h2><p class="muted">Toda varredura concluída entra aqui automaticamente. Faça a primeira na Varredura.</p><button type="button" class="btn btn-primary" data-action="h-restore">Ir para a Varredura</button></div>';
    var first = S[0], latest = S[n - 1], previous = S[n - 2];
    var dt = snap(H.detail), dp = prevOf(dt), from = snap(H.from), to = snap(H.to);
    var opts = function (sel) { return S.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + s.at + '</option>'; }).join(''); };
    var cmp = '';
    if (n < 2) cmp = '<p class="muted">Faça mais uma varredura para comparar.</p>';
    else if (H.from === H.to) cmp = '<p class="muted">Escolha duas varreduras diferentes para comparar.</p>';
    else {
      var days = Math.abs(S.indexOf(to) - S.indexOf(from)) * 17;
      cmp = '<div class="inset cmp-sum" style="flex-wrap:wrap;gap:24px;justify-content:flex-start">' +
        '<div class="cmp-stat"><span class="small muted">Usado</span><span class="num">' + tw('hc-u', to.used - from.used, 1, ' GB', true) + '</span></div>' +
        '<div class="cmp-stat"><span class="small muted">Livre</span><span class="num">' + tw('hc-f', to.free - from.free, 1, ' GB', true) + '</span></div>' +
        '<div class="cmp-stat"><span class="small muted">Arquivos</span><span class="num">' + tw('hc-a', to.files - from.files, 0, '', true) + '</span></div>' +
        '<div class="cmp-stat"><span class="small muted">Intervalo</span><span class="num">' + days + ' dias</span></div></div>' +
        '<div class="legend"><span><span class="key" style="background:var(--grow)"></span>Cresceu</span><span><span class="key" style="background:var(--shrink)"></span>Reduziu</span><span>Ordenado pela maior variação · 10 primeiras</span></div>' +
        '<div class="grid-2 fx-bars' + (H._cmpAnim ? ' fx' : '') + '"><div class="diff-col"><h3 class="label-caps">Por raiz do volume</h3>' + diffList(diff(from.roots, to.roots)) + '</div>' +
        '<div class="diff-col"><h3 class="label-caps">Perfil do usuário</h3>' + diffList(diff(from.profile, to.profile)) + '</div></div>';
    }
    var detailAnim = H._detailAnim ? ' fx' : ''; H._detailAnim = false; H._cmpAnim = false;
    return out +
      '<section class="kpis" aria-label="Resumo">' +
      '<div class="kpi"><span class="small muted">Varreduras</span><span class="value">' + tw('h-n', n, 0) + '</span><span class="small muted">desde ' + first.day + '</span></div>' +
      '<div class="kpi"><span class="small muted">Usado na última</span><span class="value">' + tw('h-last', latest.used, 1, ' GB') + '</span><span class="small muted">de 953,0 GB · ' + latest.day + '</span></div>' +
      '<div class="kpi"><span class="small muted">Desde a anterior</span><span class="value">' + (previous ? tw('h-prev', latest.used - previous.used, 1, ' GB', true) : '—') + '</span><span class="small muted">' + (previous ? previous.day + ' → ' + latest.day : 'só uma varredura') + '</span></div>' +
      '<div class="kpi"><span class="small muted">No período</span><span class="value">' + (previous ? tw('h-per', latest.used - first.used, 1, ' GB', true) : '—') + '</span><span class="small muted">' + (previous ? first.day + ' → ' + latest.day : '') + '</span></div>' +
      '</section>' +
      '<section class="card"><div class="card-head"><h2>Espaço usado em C:\\</h2><span class="small muted">GB · clique numa marca para ver a varredura</span></div>' + chart() + '</section>' +
      '<section class="card" id="h-detail" aria-labelledby="detail-title"><div class="card-head"><h2 id="detail-title">Varredura selecionada</h2><div class="compare-pick">' +
      '<label class="sr-only" for="detail-pick">Varredura</label><select id="detail-pick" class="select" data-hpick="detail">' + opts(H.detail) + '</select>' +
      (dp ? '<button type="button" class="btn" data-action="h-compare-prev">Comparar com a anterior</button>' : '') + '</div></div>' +
      '<div class="inset' + detailAnim + '" style="flex-wrap:wrap;gap:24px;justify-content:flex-start">' +
      '<div class="cmp-stat"><span class="small muted">Usado</span><span class="num">' + tw('hd-u', dt.used, 1, ' GB') + '</span></div>' +
      '<div class="cmp-stat"><span class="small muted">Livre</span><span class="num">' + tw('hd-f', dt.free, 1, ' GB') + '</span></div>' +
      '<div class="cmp-stat"><span class="small muted">Capacidade</span><span class="num">953,0 GB</span></div>' +
      '<div class="cmp-stat"><span class="small muted">Vs anterior</span><span class="num">' + (dp ? tw('hd-d', dt.used - dp.used, 1, ' GB', true) : 'primeira') + '</span></div>' +
      '<div class="cmp-stat"><span class="small muted">Arquivos</span><span class="num">' + tw('hd-a', dt.files, 0) + '</span></div>' +
      '<div class="cmp-stat"><span class="small muted">Ilegíveis</span><span class="num">' + tw('hd-i', dt.unreadable, 0) + '</span></div>' +
      '<div class="cmp-stat"><span class="small muted">Duração</span><span class="num">' + fmt(dt.secs, 0) + ' s</span></div>' +
      '<div class="cmp-stat"><span class="small muted">Profundidade</span><span class="num">' + (dt.depth === 1 ? '1 nível' : '2 níveis') + '</span></div></div>' +
      '<div class="legend"><span>GB · tamanho lógico · 10 maiores</span></div>' +
      '<div class="grid-2 fx-bars' + detailAnim + '"><div class="diff-col"><h3 class="label-caps">Por raiz do volume <span class="mono">C:\\</span></h3>' + bars(dt.roots.slice().sort(function (a, b) { return b[1] - a[1]; }), 'hr') + '</div>' +
      '<div class="diff-col"><h3 class="label-caps">Perfil do usuário <span class="mono">C:\\Users\\edils</span></h3>' + bars(dt.profile.slice().sort(function (a, b) { return b[1] - a[1]; }), 'hp') + '</div></div></section>' +
      '<section class="card" id="h-compare"><div class="card-head"><h2>O que mudou</h2>' +
      (n > 1 ? '<div class="compare-pick"><label class="small muted" for="cmp-from">De</label><select id="cmp-from" class="select" data-hpick="from">' + opts(H.from) + '</select><label class="small muted" for="cmp-to">para</label><select id="cmp-to" class="select" data-hpick="to">' + opts(H.to) + '</select></div>' : '') +
      '</div>' + cmp + '</section>' +
      '<section class="card"><h2>Varreduras</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Profundidade</th><th class="num">Usado</th><th class="num">Livre</th><th class="num">Δ usado</th><th class="num">Arquivos</th><th class="num">Duração</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
      S.slice().reverse().map(function (s) {
        var p = prevOf(s), tags = '';
        if (s.id === H.from) tags += '<span class="tag">de</span>';
        if (s.id === H.to) tags += '<span class="tag">para</span>';
        if (s.id === H.detail) tags += '<span class="tag tag-detail">em detalhe</span>';
        return '<tr data-row="' + s.id + '"' + (s.id === H.detail ? ' class="current"' : '') + '><td class="date">' + s.at + tags + '</td><td>' + (s.depth === 1 ? '1 nível' : '2 níveis') + '</td><td class="num">' + gb(s.used) + '</td><td class="num">' + gb(s.free) + '</td><td class="num">' + (p ? sgb(s.used - p.used) : '—') + '</td><td class="num">' + s.files.toLocaleString('pt-BR') + '</td><td class="num">' + fmt(s.secs, 0) + ' s</td>' +
          '<td><div class="row-actions"><button type="button" class="btn" data-hview="' + s.id + '" aria-label="Ver varredura de ' + s.at + '">Ver</button><button type="button" class="btn btn-danger" data-hdel="' + s.id + '" aria-label="Excluir varredura de ' + s.at + '">' + icon('trash', 14) + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }
  function showTip(hit) {
    var tip = document.getElementById('tip'), ch = document.getElementById('chart'), cross = document.getElementById('cross');
    if (!tip || !ch) return;
    var s = snap(hit.getAttribute('data-snap')), p = prevOf(s);
    tip.innerHTML = '<span class="v">' + gb(s.used) + '</span><span class="muted">' + s.at + '</span>' + (p ? '<span>' + sgb(s.used - p.used) + ' vs anterior</span>' : '<span class="muted">primeira varredura</span>');
    tip.hidden = false;
    var r = hit.getBoundingClientRect(), cr = ch.getBoundingClientRect();
    var left = r.left - cr.left + r.width / 2, top = r.top - cr.top;
    tip.style.left = Math.min(Math.max(left - tip.offsetWidth / 2, 0), cr.width - tip.offsetWidth) + 'px';
    tip.style.top = Math.max(0, top - tip.offsetHeight - 4) + 'px';
    cross.setAttribute('x1', hit.getAttribute('cx')); cross.setAttribute('x2', hit.getAttribute('cx')); cross.setAttribute('opacity', '1');
  }
  function hideTip() {
    var tip = document.getElementById('tip'), cross = document.getElementById('cross');
    if (tip) tip.hidden = true;
    if (cross) cross.setAttribute('opacity', '0');
  }
  function inspect(id, scroll) {
    H.detail = id; H._detailAnim = true;
    soft();
    if (scroll) { var el = document.getElementById('h-detail'); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  }

  /* ================= Configurações ================= */
  var spec = '';
  function settingsPage() {
    var mode = getMode();
    var envCard = document.body.hasAttribute('data-env-in-settings')
      ? '<section class="card" id="sobre"><div class="card-head"><h2>Ambiente</h2><span class="pill ok"><span class="dot"></span>Pronto</span></div>' +
        '<div class="kv"><span class="muted">Sistema</span><span>windows</span></div><div class="kv"><span class="muted">Volume</span><span class="mono">C:\\</span></div>' +
        '<div class="kv"><span class="muted">Catálogo</span><span>windows</span></div><div class="kv"><span class="muted">Modo</span><span style="font-weight:600">Aprovação explícita</span></div></section>'
      : '';
    var theme = ['system', 'light', 'dark'].map(function (m) {
      var l = m === 'system' ? 'Sistema' : m === 'light' ? 'Claro' : 'Escuro';
      return '<label class="option" style="flex:1 1 110px"><input type="radio" name="theme" value="' + m + '"' + (m === mode ? ' checked' : '') + '><span>' + l + '</span></label>';
    }).join('');
    return head('Preferências', 'Configurações', '<span class="small muted">Salvas automaticamente</span>') + spec +
      '<div class="grid-2"><section class="card">' +
      '<label class="field" style="justify-content:space-between"><span style="font-weight:600">Idioma</span><select class="select"><option>Automático (Português)</option><option>Português</option><option>English</option></select></label>' +
      '<div class="divider"></div><fieldset style="border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px"><legend style="font-weight:600;margin-bottom:8px">Tema</legend>' + theme + '</fieldset>' +
      '<div class="divider"></div><label class="field" style="justify-content:space-between"><span style="font-weight:600">Profundidade padrão</span><select class="select"><option>2 níveis</option><option>1 nível</option></select></label></section>' +
      '<section class="card"><h2>Exclusões extras</h2><p class="small muted">Caminhos que nunca entram no plano, além da lista obrigatória.</p>' +
      '<ul class="checklist small"><li class="kv"><span class="mono">D:\\Projetos\\vm-images</span><button type="button" class="btn" data-toast="Remover (simulado)">×</button></li></ul></section>' +
      '<section class="card"><div class="card-head"><h2>Atualizações</h2><span class="small muted mono">instalada v0.1.0-beta.5</span></div>' +
      '<label class="option"><input type="checkbox" checked><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:600">Baixar automaticamente</span><span class="small muted">Instala só quando você clicar em reiniciar.</span></span></label>' +
      '<label class="option"><input type="checkbox" checked><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:600">Canal beta</span><span class="small muted">Recebe versões de teste.</span></span></label></section>' +
      envCard + '</div>';
  }

  /* ================= Estados em andamento (estados.html) ================= */
  var DEMO_ITEMS = [['npm cache', 6.4, 'ok', 6.4], ['pip cache', 3.1, 'ok', 3.1], ['Temp (> 3 dias)', 7.9, 'partial', 6.5], ['NuGet packages', 4.2, 'ok', 4.2], ['Lixeira', 1.0, 'skipped', 0], ['VS Code — VSIX em cache', 1.2, 'ok', 1.2]];
  var demoTimer = null, dlTimer = null;
  function runDemoExec() {
    var list = document.getElementById('demo-list');
    if (!list) return;
    clearTimeout(demoTimer);
    var i = 0, freed = 0, total = DEMO_ITEMS.length;
    var setRow = function (idx, st, txt) { var li = list.children[idx]; li.className = 'exec-item ' + st; li.querySelector('.exec-st').textContent = txt; };
    var bar = document.getElementById('demo-bar'), cnt = document.getElementById('demo-count'), fr = document.getElementById('demo-freed');
    Array.prototype.forEach.call(list.children, function (li, k) { setRow(k, 'queued', 'na fila'); li.querySelector('.num').textContent = fmt(DEMO_ITEMS[k][1], 1) + ' GB est.'; });
    bar.style.width = '0%'; cnt.textContent = '0 de ' + total; fr.textContent = '+0,0 GB';
    document.getElementById('demo-head').textContent = 'Executando tier A · Cache';
    (function next() {
      if (!document.getElementById('demo-list')) return;
      if (i >= total) { document.getElementById('demo-head').textContent = 'Tier A · Cache concluído'; return; }
      setRow(i, 'running', 'rodando');
      demoTimer = setTimeout(function () {
        var it = DEMO_ITEMS[i];
        setRow(i, it[2], STATUS_TXT[it[2]]);
        list.children[i].querySelector('.num').textContent = it[3] ? sgb(it[3]) : '—';
        freed += it[3]; i++;
        bar.style.width = (i / total * 100) + '%'; cnt.textContent = i + ' de ' + total; fr.textContent = sgb(freed);
        demoTimer = setTimeout(next, 260);
      }, 700 + Math.random() * 700);
    })();
  }
  function runDownload() {
    var m = document.getElementById('dl-meter'), p = document.getElementById('dl-pct');
    if (!m) return;
    clearInterval(dlTimer);
    var v = 0;
    document.getElementById('dl-msg').textContent = 'Baixando 0.1.0-beta.6…';
    document.getElementById('dl-btn').hidden = true;
    dlTimer = setInterval(function () {
      if (!document.getElementById('dl-meter')) return clearInterval(dlTimer);
      v = Math.min(100, v + 1 + Math.random() * 3);
      m.style.width = v + '%'; p.textContent = Math.floor(v) + '%';
      if (v >= 100) { clearInterval(dlTimer); document.getElementById('dl-msg').textContent = 'Versão 0.1.0-beta.6 pronta'; document.getElementById('dl-btn').hidden = false; }
    }, 120);
  }
  function statesPage() {
    var skel = ['A', 'B', 'C', 'D'].map(function (t, g) {
      var rows = '';
      for (var r = 0; r < 3; r++) rows += '<div class="skel-row" style="animation-delay:' + (g * 0.08 + r * 0.04) + 's"><span class="skel" style="width:' + (38 + (r * 17 + g * 11) % 30) + '%"></span><span class="skel" style="width:56px"></span></div>';
      return '<div class="skel-group">' + tierBadge(t, true) + rows + '</div>';
    }).join('');
    var items = DEMO_ITEMS.map(function (it) {
      return '<li class="exec-item queued"><span class="exec-ico" aria-hidden="true"><span class="ring"></span>' + icon('check', 12, 3) + '</span><span class="exec-name">' + it[0] + '<span class="exec-st small muted">na fila</span></span><span class="num small">' + fmt(it[1], 1) + ' GB est.</span></li>';
    }).join('');
    return head('Estados em andamento', 'Feedback de progresso', '<button type="button" class="btn" data-action="states-replay">' + icon('replay') + 'Repetir simulações</button><button type="button" class="btn btn-primary" data-action="scan">Ver varredura ' + ARROW + '</button>') +
      '<aside class="proto-spec"><b>Regra: o visual nunca promete o que o core não mede.</b><ul>' +
      '<li><b>Varredura</b> — só <span class="mono">files</span> e <span class="mono">logicalBytes</span>: barra indeterminada, contadores vivos, ritmo e tempo derivados na UI.</li>' +
      '<li><b>Classificação</b> — sem progresso: esqueleto por tier com brilho; os tiers são fixos (A–D), os itens não.</li>' +
      '<li><b>Execução</b> — eventos <span class="mono">started/finished</span> por item: barra determinada (itens concluídos/total) e liberado somado ao vivo.</li>' +
      '<li><b>Atualização</b> — <span class="mono">percent</span> pode ser nulo: determinada quando há tamanho, indeterminada quando não há.</li></ul></aside>' +
      '<div class="grid-2">' +
      '<section class="card" role="status"><div class="card-head"><h2>Classificação</h2><span class="pill info live"><span class="dot"></span>Medindo</span></div><p class="small muted">Medindo os caminhos do catálogo…</p><div class="indet" aria-hidden="true"></div>' + skel + '</section>' +
      '<section class="card" role="status" aria-live="polite"><div class="card-head"><h2 id="demo-head">Executando tier A · Cache</h2><span class="mono small muted" id="demo-count">0 de 6</span></div>' +
      '<div class="meter"><span id="demo-bar" class="live-bar" style="width:0%"></span></div><div class="kv"><span class="muted">Liberado até agora</span><span class="num" id="demo-freed">+0,0 GB</span></div>' +
      '<ul class="exec-list" id="demo-list">' + items + '</ul></section>' +
      '<section class="card"><h2>Atualização na barra lateral</h2><div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))">' +
      '<div class="update-notice"><span id="dl-msg">Baixando 0.1.0-beta.6…</span><div class="meter" style="height:6px"><span id="dl-meter" class="live-bar" style="width:0%"></span></div><span class="mono small muted" id="dl-pct">0%</span><button type="button" class="btn btn-primary" id="dl-btn" hidden data-toast="Reinicia e instala (só com clique)">Reiniciar e atualizar</button></div>' +
      '<div class="update-notice"><span>Baixando 0.1.0-beta.6… <span class="muted">(tamanho desconhecido)</span></span><div class="indet" style="height:6px" aria-hidden="true"></div></div>' +
      '</div></section></div>';
  }

  /* ================= Navegação e renderização ================= */
  var PAGES = {
    cleanup: function () { var v2 = isV2(); return { survey: surveyPage, classify: classifyPage, plan: v2 ? planPageV2 : planPage, execute: v2 ? executePageV2 : executePage, report: reportPage }[F.step](); },
    history: historyPage,
    settings: settingsPage,
    states: statesPage
  };
  var AFTER = { states: function () { runDemoExec(); runDownload(); } };
  var current = null, busy = false;
  function markNav(id) {
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  function render(id, isSoft) {
    var host = document.getElementById('page');
    var y = isSoft ? scrollY : 0;
    host.classList.toggle('soft', !!isSoft);
    host.innerHTML = PAGES[id]();
    hydrate(host);
    animateNumbers(host, isSoft);
    syncThemeUi();
    ensureFlow();
    flowEl.hidden = id !== 'cleanup';
    if (id === 'cleanup') updateFlow(true);
    if (isSoft) window.scrollTo(0, y);
    if (AFTER[id] && !isSoft) setTimeout(AFTER[id], 250);
  }
  /** Atualiza a tela atual sem transição de página: só o que mudou anima (.fx e números). */
  function soft() { if (current) render(current, true); }
  function go(id, opts) {
    opts = opts || {};
    if (!PAGES[id] || (id === current && !opts.force) || busy) return;
    var from = current;
    current = id;
    markNav(id);
    document.dispatchEvent(new CustomEvent('dc:nav', { detail: { id: id, from: from } }));
    var host = document.getElementById('page');
    if (!from || reduce) { render(id); host.classList.remove('pg-out'); host.classList.add('pg-in'); return; }
    busy = true;
    host.classList.remove('pg-in');
    host.classList.add('pg-out');
    setTimeout(function () {
      render(id);
      host.classList.remove('pg-out');
      void host.offsetWidth;
      host.classList.add('pg-in');
      window.scrollTo({ top: 0 });
      busy = false;
    }, 140);
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'proto-toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2300);
  }

  /* ---------- Moldura ---------- */
  function protoBar() {
    var file = location.pathname.split('/').pop();
    var idx = PROTOS.findIndex(function (p) { return p[0] === file; });
    if (idx < 0) return;
    var prev = PROTOS[(idx + PROTOS.length - 1) % PROTOS.length], next = PROTOS[(idx + 1) % PROTOS.length];
    var bar = document.createElement('div');
    bar.className = 'proto-bar';
    bar.setAttribute('aria-label', 'Controles do protótipo');
    bar.innerHTML =
      '<a href="index.html" title="Todos os protótipos">' + icon('grid', 14) + '</a>' +
      '<a href="' + prev[0] + '" title="Anterior: ' + prev[1] + '">' + icon('left', 14, 2) + '</a>' +
      '<span class="t">' + String(idx + 1).padStart(2, '0') + ' · ' + PROTOS[idx][1] + '</span>' +
      '<a href="' + next[0] + '" title="Próximo: ' + next[1] + '">' + icon('chevron', 14, 2) + '</a>' +
      '<span class="sep"></span>' +
      '<button type="button" id="proto-replay" title="Repetir animações da tela">' + icon('replay', 14) + '<span class="lbl">Repetir</span></button>' +
      '<button type="button" id="proto-reset" title="Recomeçar o fluxo de limpeza e o histórico">' + icon('bolt', 14) + '<span class="lbl">Reiniciar</span></button>' +
      '<button type="button" id="proto-update" aria-pressed="false" title="Simular atualização disponível">' + icon('download', 14) + '<span class="lbl">Atualização</span></button>' +
      '<button type="button" id="proto-theme" title="Atalho do protótipo: no app o tema fica em Configurações"></button>';
    document.body.appendChild(bar);
    document.getElementById('proto-replay').onclick = function () { go(current, { force: true }); };
    document.getElementById('proto-reset').onclick = function () {
      endScan(); F = freshFlow(true); H = { snaps: makeSnaps(), detail: 's6', from: 's5', to: 's6', confirming: false };
      flowPrev = {}; go('cleanup', { force: true }); toast('Fluxo e histórico reiniciados');
    };
    document.getElementById('proto-update').onclick = function () {
      var on = document.body.classList.toggle('has-update');
      this.setAttribute('aria-pressed', String(on));
      document.dispatchEvent(new CustomEvent('dc:update', { detail: { on: on } }));
    };
    document.getElementById('proto-theme').onclick = function (e) { toggleTheme(e.clientX, e.clientY); };
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-nav]'))) { e.preventDefault(); go(el.getAttribute('data-nav')); return; }
    if ((el = e.target.closest('[data-step]'))) { if (!el.disabled) goStep(el.getAttribute('data-step')); return; }
    if ((el = e.target.closest('[data-tab]'))) { F.tab = el.getAttribute('data-tab'); F._tabAnim = true; soft(); return; }
    if ((el = e.target.closest('[data-hview]'))) { inspect(el.getAttribute('data-hview'), true); return; }
    if ((el = e.target.closest('[data-hdel]'))) {
      var id = el.getAttribute('data-hdel'), tr = el.closest('tr');
      tr.classList.add('row-out');
      setTimeout(function () { H.snaps = H.snaps.filter(function (s) { return s.id !== id; }); soft(); toast('Varredura excluída · o disco não foi tocado'); }, 280);
      return;
    }
    if ((el = e.target.closest('.chart .hit'))) { inspect(el.getAttribute('data-snap'), true); return; }
    if ((el = e.target.closest('[data-action]'))) {
      var a = el.getAttribute('data-action');
      if (a === 'scan') startScan();
      else if (a === 'states-replay') { runDemoExec(); runDownload(); }
      else if (a === 'classify-run') runClassify(false);
      else if (a === 'toggle-tier') {
        var its = CANDS.filter(function (c) { return c.t === F.tab && !c.blocked; });
        var all = its.every(function (c) { return F.sel[c.id]; });
        its.forEach(function (c) { F.sel[c.id] = !all; });
        F.approved = false; soft();
      } else if (a === 'approve') {
        if (!canApprove()) {
          var need = document.querySelector('[data-need="' + (execTiers().length === 0 ? 'tiers' : 'ack') + '"]');
          if (need) { need.classList.remove('attn'); void need.offsetWidth; need.classList.add('attn'); var inp = need.querySelector('input:not(:disabled)'); if (inp) inp.focus({ preventScroll: false }); }
          return;
        }
        el.classList.add('approving');
        el.innerHTML = icon('check', 16, 2.4) + 'Aprovado';
        setTimeout(function () { F.approved = true; F.confirming = null; updateFlow(true); toast('Plano aprovado · tiers ' + execTiers().join(', ')); }, 350);
        setTimeout(function () { goStep('execute'); }, 1000);
      } else if (a === 'exec-request') { F.confirming = currentTier(); soft(); }
      else if (a === 'exec-cancel') { F.confirming = null; soft(); }
      else if (a === 'exec-run') runTier();
      else if (a === 'grp' || a === 'xrow') {
        var tt = el.getAttribute('data-t'), box = el.parentNode, op = box.getAttribute('data-open') !== 'true';
        box.setAttribute('data-open', String(op)); el.setAttribute('aria-expanded', String(op));
        (a === 'grp' ? F.open : F.xopen)[tt] = op;
      } else if (a === 'grp-all') {
        var allOpen = planTiers().every(function (x) { return F.open[x]; });
        planTiers().forEach(function (x) { F.open[x] = !allOpen; });
        document.querySelectorAll('.grp').forEach(function (g) { g.setAttribute('data-open', String(!allOpen)); g.querySelector('.grp-head').setAttribute('aria-expanded', String(!allOpen)); });
        el.textContent = allOpen ? 'Expandir todos' : 'Recolher todos';
      } else if (a === 'json-open') openJsonDrawer();
      else if (a === 'json-close') closeJsonDrawer();
      else if (a === 'new-analysis') { endScan(); F = freshFlow(false); goStep('survey'); }
      else if (a === 'h-clear') { H.confirming = true; soft(); }
      else if (a === 'h-clear-cancel') { H.confirming = false; soft(); }
      else if (a === 'h-clear-ok') { H.snaps = []; H.confirming = false; soft(); }
      else if (a === 'h-restore') { H = { snaps: makeSnaps(), detail: 's6', from: 's5', to: 's6', confirming: false }; goStep('survey'); }
      else if (a === 'h-compare-prev') {
        var d = snap(H.detail), p = prevOf(d);
        if (p) { H.from = p.id; H.to = d.id; H._cmpAnim = true; soft(); var c = document.getElementById('h-compare'); if (c) c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
      }
      return;
    }
    if ((el = e.target.closest('[data-toast]'))) toast(el.getAttribute('data-toast'));
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'theme') {
      var r = t.closest('label').getBoundingClientRect();
      setMode(t.value, r.left + r.width / 2, r.top + r.height / 2);
    } else if (t.hasAttribute('data-sel')) {
      F.sel[t.getAttribute('data-sel')] = t.checked;
      F.approved = false; /* remontar o plano descarta a aprovação */
      soft();
    } else if (t.hasAttribute('data-aptier')) { F.apTiers[t.getAttribute('data-aptier')] = t.checked; soft(); }
    else if (t.hasAttribute('data-ack')) { F.ack = t.checked; soft(); }
    else if (t.hasAttribute('data-hpick')) {
      var k = t.getAttribute('data-hpick');
      H[k] = t.value;
      if (k === 'detail') H._detailAnim = true; else H._cmpAnim = true;
      soft();
    }
  });
  document.addEventListener('pointerover', function (e) { var h = e.target.closest && e.target.closest('.chart .hit'); if (h) showTip(h); });
  document.addEventListener('pointerout', function (e) { if (e.target.closest && e.target.closest('.chart .hit')) hideTip(); });
  document.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.chart .hit')) showTip(e.target); });
  document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.chart .hit')) hideTip(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeJsonDrawer();
    var h = e.target.closest && e.target.closest('.chart .hit');
    if (!h) return;
    var i = +h.getAttribute('data-i'), hits = document.querySelectorAll('.chart .hit');
    if (e.key === 'ArrowRight' && hits[i + 1]) { e.preventDefault(); hits[i + 1].focus(); }
    else if (e.key === 'ArrowLeft' && hits[i - 1]) { e.preventDefault(); hits[i - 1].focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspect(h.getAttribute('data-snap'), true); }
  });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (getMode() === 'system') setMode('system'); });

  /** Destaque do item ativo que desliza entre os itens (um elemento só, movido por transform). */
  function slider(nav, cls) {
    var ind = document.createElement('span');
    ind.className = cls || 'nav-ind';
    ind.setAttribute('aria-hidden', 'true');
    nav.classList.add('has-slider');
    nav.prepend(ind);
    var first = true;
    function move(instant) {
      var a = nav.querySelector('[aria-current="page"]');
      if (!a || !a.offsetParent) { ind.style.opacity = '0'; return; }
      if (instant) ind.style.transition = 'none';
      ind.style.opacity = '1';
      ind.style.transform = 'translate(' + a.offsetLeft + 'px,' + a.offsetTop + 'px)';
      ind.style.width = a.offsetWidth + 'px';
      ind.style.height = a.offsetHeight + 'px';
      if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
    }
    document.addEventListener('dc:nav', function () { requestAnimationFrame(function () { move(first); first = false; }); });
    addEventListener('resize', function () { move(true); });
    return move;
  }

  window.DC = {
    icon: icon, hydrate: hydrate, go: go, goStep: goStep, toast: toast, setMode: setMode, toggleTheme: toggleTheme,
    reduce: reduce, PROTOS: PROTOS, slider: slider, startScan: startScan,
    current: function () { return current; },
    /** Ficha do protótipo exibida no topo de cada página simulada. */
    spec: function (html, collapsed) {
      spec = collapsed
        ? '<details class="proto-spec"><summary>Sobre este protótipo</summary>' + html + '</details>'
        : '<aside class="proto-spec" aria-label="Sobre este protótipo">' + html + '</aside>';
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    hydrate(document);
    protoBar();
    syncThemeUi();
    var start = (location.hash || '').slice(1) || document.body.getAttribute('data-start');
    if (start === 'scan') { go('cleanup'); setTimeout(startScan, 500); return; }
    go(PAGES[start] ? start : 'cleanup');
  });
})();
