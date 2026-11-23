/* Disk Cleanup — protótipos. Comportamento compartilhado entre as 5 telas.
   Funciona via file:// (sem fetch, sem módulos). */
(function () {
  'use strict';

  var THEME_KEY = 'dc-theme';
  var root = document.documentElement;

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function saveTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* storage bloqueado: só a sessão atual */ }
  }
  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function currentTheme() { return root.getAttribute('data-theme') || storedTheme() || systemTheme(); }
  function applyTheme(t) { root.setAttribute('data-theme', t); updateThemeButton(); }

  var ICON_SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var ICON_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function updateThemeButton() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var dark = currentTheme() === 'dark';
    btn.innerHTML = (dark ? ICON_SUN : ICON_MOON) + '<span>' + (dark ? 'Tema claro' : 'Tema escuro') + '</span>';
    btn.setAttribute('aria-label', dark ? 'Mudar para tema claro' : 'Mudar para tema escuro');
  }

  /* ---------- Sidebar ---------- */
  var STEPS = [
    { n: 1, id: 'survey', label: 'Survey', href: '01-survey.html' },
    { n: 2, id: 'classify', label: 'Classificação', href: '02-classificacao.html' },
    { n: 3, id: 'plan', label: 'Plano e aprovação', href: '03-plano.html' },
    { n: 4, id: 'execute', label: 'Execução', href: '04-execucao.html' },
    { n: 5, id: 'report', label: 'Relatório', href: '05-relatorio.html' }
  ];
  var MODES = {
    ro:   { text: 'Somente leitura', cls: 'ok',   helper: 'Inativo' },
    exec: { text: 'Executando · Tier B', cls: 'warn', helper: 'Ativo (UAC)' },
    done: { text: 'Concluído', cls: 'ok', helper: 'Encerrado' }
  };

  function renderSidebar() {
    var host = document.getElementById('sidebar');
    if (!host) return;
    var page = document.body.getAttribute('data-page');
    var mode = MODES[document.body.getAttribute('data-mode')] || MODES.ro;
    var idx = 0;
    STEPS.forEach(function (s, i) { if (s.id === page) idx = i; });

    var links = STEPS.map(function (s, i) {
      var cur = s.id === page ? ' aria-current="page"' : '';
      var done = i < idx ? ' class="done"' : '';
      return '<a href="' + s.href + '"' + cur + done + '><span class="step-num">' + s.n + '</span>' + s.label + '</a>';
    }).join('');

    host.innerHTML =
      '<div class="brand">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 14h18"/><circle cx="17" cy="17" r="0.8"/></svg>' +
        '<div style="display:flex;flex-direction:column"><span class="brand-name">Disk Cleanup</span><span class="small muted">v0.1 · protótipo</span></div>' +
      '</div>' +
      '<nav class="nav" aria-label="Etapas">' + links + '</nav>' +
      '<div class="env">' +
        '<span class="label-caps">Ambiente</span>' +
        '<div class="env-row"><span class="muted">Sistema</span><span>Windows 11 · NTFS</span></div>' +
        '<div class="env-row"><span class="muted">Volume</span><span class="mono">C:\\</span></div>' +
        '<div class="env-row"><span class="muted">Modo</span><span class="' + mode.cls + '" style="font-weight:600">' + mode.text + '</span></div>' +
        '<div class="env-row"><span class="muted">Helper admin</span><span>' + mode.helper + '</span></div>' +
      '</div>' +
      '<div class="spacer"></div>' +
      '<button type="button" class="btn btn-lg" id="theme-toggle"></button>';

    document.getElementById('theme-toggle').addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      applyTheme(next);
    });
    updateThemeButton();
  }

  /* ---------- Tabs genéricas: [data-tabs] > [role=tab][aria-controls] ---------- */
  function initTabs() {
    document.querySelectorAll('[data-tabs]').forEach(function (list) {
      var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
      function select(tab) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t); });
        t.addEventListener('keydown', function (e) {
          var k = e.key, j = i;
          if (k === 'ArrowRight') j = (i + 1) % tabs.length;
          else if (k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
          else return;
          e.preventDefault(); tabs[j].focus(); select(tabs[j]);
        });
      });
    });
  }

  /* ---------- Seleção de candidatos (tela 2): input[data-gb][data-tier] ---------- */
  function fmt(n, d) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function initSelection() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll('input[data-gb][data-tier]'));
    if (!boxes.length) return;
    function update() {
      var per = { A: 0, B: 0, C: 0, D: 0 }, count = { A: 0, B: 0, C: 0, D: 0 }, total = 0, n = 0;
      boxes.forEach(function (b) {
        if (b.checked && !b.disabled) {
          var gb = parseFloat(b.getAttribute('data-gb'));
          per[b.getAttribute('data-tier')] += gb; count[b.getAttribute('data-tier')]++; total += gb; n++;
        }
      });
      Object.keys(per).forEach(function (t) {
        var el = document.querySelector('[data-sum="' + t + '"]');
        if (el) el.textContent = fmt(per[t], 1) + ' GB';
        var c = document.querySelector('[data-cnt="' + t + '"]');
        if (c) c.textContent = count[t] + (count[t] === 1 ? ' item' : ' itens');
      });
      var tot = document.querySelector('[data-sum="total"]');
      if (tot) tot.textContent = fmt(total, 1) + ' GB';
      var cnt = document.querySelector('[data-sum="count"]');
      if (cnt) cnt.textContent = n + ' itens selecionados';
    }
    boxes.forEach(function (b) { b.addEventListener('change', update); });
    document.querySelectorAll('[data-select-all]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tier = btn.getAttribute('data-select-all');
        var group = boxes.filter(function (b) { return b.getAttribute('data-tier') === tier && !b.disabled; });
        var allOn = group.every(function (b) { return b.checked; });
        group.forEach(function (b) { b.checked = !allOn; });
        update();
      });
    });
    update();
  }

  /* ---------- Aprovação (tela 3): botão só habilita com ciência + tier marcado ---------- */
  function initApproval() {
    var ack = document.getElementById('ack');
    var go = document.getElementById('approve');
    if (!ack || !go) return;
    var tiers = Array.prototype.slice.call(document.querySelectorAll('input[name="approve-tier"]'));
    var pending = Array.prototype.slice.call(document.querySelectorAll('[data-decision]'));
    var status = document.getElementById('approve-status');
    function update() {
      var anyTier = tiers.some(function (t) { return t.checked; });
      var open = pending.filter(function (fs) { return !fs.querySelector('input:checked'); }).length;
      var ok = ack.checked && anyTier && open === 0;
      go.setAttribute('aria-disabled', ok ? 'false' : 'true');
      if (status) {
        status.textContent = open > 0 ? open + (open === 1 ? ' decisão pendente' : ' decisões pendentes')
          : !anyTier ? 'Selecione ao menos um tier'
          : !ack.checked ? 'Confirme a revisão do plano'
          : 'Pronto: o dry-run roda antes de qualquer remoção';
      }
    }
    go.addEventListener('click', function (e) {
      if (go.getAttribute('aria-disabled') === 'true') e.preventDefault();
    });
    document.querySelectorAll('input').forEach(function (i) { i.addEventListener('change', update); });
    update();
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(currentTheme());
    renderSidebar();
    initTabs();
    initSelection();
    initApproval();
  });
})();
