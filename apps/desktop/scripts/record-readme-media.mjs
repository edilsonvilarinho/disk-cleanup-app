// Grava os GIFs do README a partir da interface em modo demonstração
// (DemoGateway, sem Tauri) e de um terminal animado com saída real dos testes.
// Não gera executável: usa o Edge instalado (Playwright `channel: 'msedge'`).
//
//   pnpm exec vite build && pnpm exec vite preview --port 4173 &
//   node scripts/record-readme-media.mjs http://localhost:4173 ../../docs/assets/readme
//
// GIFs das notas de versão (cenários `rn-*`, janela menor e paleta reduzida para
// não inchar o pacote; ver docs/release.md):
//   node scripts/record-readme-media.mjs http://localhost:4173 src/releaseNotes/media/<versão> rn-release-notes
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const OUT = resolve(process.argv[3] ?? '../../docs/assets/readme')
const VIEW = { width: 1280, height: 800 }
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })

/** Grava `scenario` em vídeo e converte para GIF com paleta própria (ffmpeg). */
async function record(name, scenario, { theme = 'dark', width = 960, fps = 12, view = VIEW, colors = 128, settings = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dc-media-'))
  const context = await browser.newContext({ viewport: view, recordVideo: { dir, size: view }, colorScheme: theme })
  // Preferências já salvas (ex.: última versão vista, para as notas de versão aparecerem).
  if (settings) await context.addInitScript((s) => localStorage.setItem('dc-settings', s), JSON.stringify(settings))
  await context.addInitScript((t) => localStorage.setItem('dc-theme', t), theme)
  const page = await context.newPage()
  await scenario(page)
  await context.close()
  const video = join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')))
  const gif = join(OUT, `${name}.gif`)
  const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.6', '-i', video, '-vf', filter, '-loop', '0', gif])
  rmSync(dir, { recursive: true, force: true })
  console.log(`gif: ${gif}`)
}

const pause = (page, ms) => page.waitForTimeout(ms)

async function survey(page) {
  await page.goto(`${BASE}/#/`)
  await pause(page, 900)
  // Cartão ao vivo: contadores, tempo, ritmo; a barra de status acompanha.
  await page.click('[data-test="start-survey"]')
  await page.waitForSelector('[data-test="kpi-used"]', { timeout: 15_000 })
  await pause(page, 2200)
  await page.mouse.wheel(0, 500)
  await pause(page, 1800)
}

async function classify(page) {
  await page.goto(`${BASE}/#/classificacao`)
  await page.waitForSelector('[data-test="row"]')
  await pause(page, 1200)
  await page.locator('[data-test="row"] input[type="checkbox"]').nth(1).click()
  await pause(page, 900)
  await page.click('[data-test="tab-C"]')
  await pause(page, 1400)
  await page.click('[data-test="tab-X"]')
  await pause(page, 1400)
  await page.click('[data-test="tab-A"]')
  await pause(page, 600)
  await page.click('[data-test="to-plan"]')
  await page.waitForSelector('[data-test="approval"]')
  await pause(page, 1300)
  // Grupo por tier recolhível e plan.json na gaveta lateral.
  await page.click('[data-test="plan-group"] button')
  await pause(page, 1200)
  await page.click('[data-test="open-json"]')
  await pause(page, 1600)
  await page.keyboard.press('Escape')
  await pause(page, 800)
}

async function theme(page) {
  // O tema fica em Configurações; a troca se revela em círculo a partir do clique.
  await page.goto(`${BASE}/#/configuracoes`)
  await page.waitForSelector('[data-test="theme-dark"]')
  await pause(page, 1000)
  await page.click('[data-test="theme-dark"]')
  await pause(page, 1500)
  await page.click('[data-test="theme-light"]')
  await pause(page, 1500)
  await page.click('[data-test="nav-history"]')
  await pause(page, 1200)
}

async function tour(page) {
  await survey(page)
  await page.mouse.wheel(0, -2000)
  await page.click('[data-test="to-classify"]')
  await page.waitForSelector('[data-test="row"]')
  await pause(page, 1500)
  await page.click('[data-test="tab-C"]')
  await pause(page, 1300)
  await page.click('[data-test="to-plan"]')
  await page.waitForSelector('[data-test="approval"]')
  await pause(page, 1200)
  // Aprovar antes da hora aponta o que falta (aria-disabled: o Playwright exige force); com a confirmação, aprova.
  await page.click('[data-test="approve"]', { force: true })
  await pause(page, 1300)
  await page.click('[data-test="ack"]')
  await pause(page, 700)
  await page.click('[data-test="approve"]')
  await page.waitForSelector('[data-test="execute"]')
  await pause(page, 1800)
}

async function executeReport(page) {
  await page.goto(`${BASE}/#/classificacao`)
  await page.waitForSelector('[data-test="row"]')
  await page.click('[data-test="to-plan"]')
  await page.waitForSelector('[data-test="approve"]')
  await pause(page, 900)
  await page.click('[data-test="ack"]')
  await pause(page, 600)
  await page.click('[data-test="approve"]')
  await page.waitForSelector('[data-test="execute"]')
  await pause(page, 1300)
  // Guia do passo: executar no topo, confirmar no próprio guia, itens ao vivo.
  await page.click('[data-test="execute"]')
  await pause(page, 1100)
  await page.click('[data-test="confirm-execute"]')
  await page.waitForSelector('[data-test="result"]', { state: 'attached' })
  await page.waitForSelector('[data-test="execute"]')
  await pause(page, 1400)
  await page.click('[data-test="execute"]')
  await pause(page, 700)
  await page.click('[data-test="confirm-execute"]')
  await page.waitForSelector('[data-test="to-report"]')
  await pause(page, 1200)
  await page.click('[data-test="to-report"]')
  await page.waitForSelector('[data-test="report-freed"]')
  await pause(page, 2200)
}

async function settings(page) {
  await page.goto(`${BASE}/#/configuracoes`)
  await page.waitForSelector('[data-test="language"]')
  await pause(page, 1000)
  await page.selectOption('[data-test="language"]', 'en')
  await pause(page, 1400)
  await page.click('[data-test="theme-light"]')
  await pause(page, 1200)
  await page.fill('[data-test="new-exclusion"]', 'D:\\Projects\\client-a')
  await page.click('[data-test="add-exclusion"]')
  await pause(page, 1200)
  await page.click('[data-test="theme-dark"]')
  await page.selectOption('[data-test="language"]', 'pt')
  await pause(page, 1500)
}

async function terminal(page) {
  await page.goto(pathToFileURL(resolve('scripts/terminal.html')).href)
  await page.waitForSelector('body[data-done="1"]', { timeout: 30_000 })
  await pause(page, 1500)
}

// ---------- Notas de versão: uma novidade por GIF, curto ----------
async function rnTrash(page) {
  await page.goto(`${BASE}/#/classificacao`)
  await page.waitForSelector('[data-test="row"]')
  await page.click('[data-test="to-plan"]')
  await page.waitForSelector('[data-test="plan-disposals"]')
  await pause(page, 900)
  await page.locator('[data-test="plan-disposals"]').scrollIntoViewIfNeeded()
  await page.locator('[data-test$="-trash"]').first().click()
  await pause(page, 1600)
  await page.locator('[data-test$="-permanent"]').first().click()
  await pause(page, 900)
  await page.locator('[data-test$="-trash"]').first().click()
  await pause(page, 1400)
}

async function rnTreemap(page) {
  await page.goto(`${BASE}/#/`)
  await page.click('[data-test="start-survey"]')
  await page.waitForSelector('[data-test="treemap"]', { timeout: 15_000 })
  await page.locator('[data-test="volume-map"]').scrollIntoViewIfNeeded()
  await pause(page, 1200)
  // Users → perfil: dois níveis até aparecerem as pastas do perfil.
  await page.locator('[data-test="tm-cell"]:not(.leaf)').first().click()
  await pause(page, 900)
  await page.locator('[data-test="tm-cell"]:not(.leaf)').first().click()
  await pause(page, 2000)
  await page.click('[data-test="crumb-0"]')
  await pause(page, 1200)
}

async function rnDuplicates(page) {
  await page.goto(`${BASE}/#/classificacao`)
  await page.waitForSelector('[data-test="row"]')
  await pause(page, 700)
  // Duplicados ficam na aba do tier D.
  await page.click('[data-test="tab-D"]')
  await pause(page, 700)
  await page.click('[data-test="find-duplicates"]')
  await page.waitForSelector('[data-test="duplicates-summary"]', { timeout: 15_000 })
  await pause(page, 2400)
}

async function rnRules(page) {
  await page.goto(`${BASE}/#/configuracoes`)
  await page.waitForSelector('[data-test="user-rules-settings"]')
  await page.locator('[data-test="user-rules-settings"]').scrollIntoViewIfNeeded()
  await pause(page, 700)
  await page.locator('[data-test="rule-path"]').pressSequentially(String.raw`D:\Render\Blender\cache`, { delay: 45 })
  await page.click('[data-test="add-rule"]')
  await pause(page, 1800)
}

// A própria gaveta: a demonstração informa a última versão do catálogo (+demo); com a
// versão vista duas atrás, aparecem o aviso e duas abas.
async function rnReleaseNotes(page) {
  await page.goto(`${BASE}/#/`)
  await page.waitForSelector('[data-test="rn-notice"]')
  await pause(page, 1800)
  await page.click('[data-test="rn-open"]')
  await page.waitForSelector('[data-test="rn-drawer"]')
  await pause(page, 2000)
  await page.locator('[data-test^="rn-tab-"]').nth(1).click()
  await pause(page, 1400)
  await page.click('[data-test="rn-filter-fixed"]')
  await pause(page, 2400)
  await page.keyboard.press('Escape')
  await pause(page, 700)
}

const RN = { theme: 'dark', width: 640, fps: 10, view: { width: 960, height: 600 }, colors: 64 }

// `node record-readme-media.mjs <url> <saída> [nome...]` grava só os nomes pedidos.
const ALL = {
  tour: [tour, { width: 960 }],
  survey: [survey, { width: 720 }],
  'classify-plan': [classify, { width: 720 }],
  'execute-report': [executeReport, { width: 720 }],
  settings: [settings, { width: 720 }],
  theme: [theme, { theme: 'light', width: 720 }],
  terminal: [terminal, { width: 720 }],
}
// Só sob pedido explícito: sem nomes, grava os GIFs do README.
const RELEASE = {
  'rn-trash': [rnTrash, RN],
  'rn-treemap': [rnTreemap, RN],
  'rn-duplicates': [rnDuplicates, RN],
  'rn-rules': [rnRules, RN],
  'rn-release-notes': [rnReleaseNotes, { ...RN, settings: { seenVersion: '0.1.0-beta.6' } }],
}
const wanted = process.argv.slice(4)
for (const [name, [scenario, options]] of Object.entries(ALL)) {
  if (wanted.length === 0 || wanted.includes(name)) await record(name, scenario, options)
}
for (const [name, [scenario, options]] of Object.entries(RELEASE)) {
  if (wanted.includes(name)) await record(name, scenario, options)
}
await browser.close()
