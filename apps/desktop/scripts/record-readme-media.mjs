// Grava os GIFs do README a partir da interface em modo demonstração
// (DemoGateway, sem Tauri) e de um terminal animado com saída real dos testes.
// Não gera executável: usa o Edge instalado (Playwright `channel: 'msedge'`).
//
//   pnpm exec vite build && pnpm exec vite preview --port 4173 &
//   node scripts/record-readme-media.mjs http://localhost:4173 ../../docs/assets/readme
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
async function record(name, scenario, { theme = 'dark', width = 960, fps = 12 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dc-media-'))
  const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir, size: VIEW }, colorScheme: theme })
  await context.addInitScript((t) => localStorage.setItem('dc-theme', t), theme)
  const page = await context.newPage()
  await scenario(page)
  await context.close()
  const video = join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')))
  const gif = join(OUT, `${name}.gif`)
  const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.6', '-i', video, '-vf', filter, '-loop', '0', gif])
  rmSync(dir, { recursive: true, force: true })
  console.log(`gif: ${gif}`)
}

const pause = (page, ms) => page.waitForTimeout(ms)

async function survey(page) {
  await page.goto(`${BASE}/#/`)
  await pause(page, 900)
  await page.click('[data-test="start-survey"]')
  await page.waitForSelector('[data-test="kpi-used"]')
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
  await page.waitForSelector('[data-test="plan-json"]')
  await pause(page, 1500)
  await page.mouse.wheel(0, 600)
  await pause(page, 1800)
}

async function theme(page) {
  await page.goto(`${BASE}/#/`)
  await page.click('[data-test="start-survey"]')
  await page.waitForSelector('[data-test="kpi-used"]')
  await pause(page, 1200)
  await page.click('[data-test="theme-toggle"]')
  await pause(page, 1500)
  await page.click('[data-test="theme-toggle"]')
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
  await page.waitForSelector('[data-test="plan-json"]')
  await pause(page, 2000)
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
  await page.click('[data-test="execute"]')
  await pause(page, 1100)
  await page.click('[data-test="confirm-execute"]')
  await page.waitForSelector('[data-test="result"]')
  await pause(page, 1400)
  await page.click('[data-test="execute"]')
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
const wanted = process.argv.slice(4)
for (const [name, [scenario, options]] of Object.entries(ALL)) {
  if (wanted.length === 0 || wanted.includes(name)) await record(name, scenario, options)
}
await browser.close()
