// Orquestra o segundo plano: a cada 10 min mede o espaço livre (sem varrer) e
// avisa ao cruzar o limite; roda a varredura agendada (somente leitura); liga a
// bandeja e atende o "Varrer agora". Nunca executa limpeza.
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '../application/stores/history'
import { useSettingsStore } from '../application/stores/settings'
import { useSurveyStore } from '../application/stores/survey'
import { useSystemStore } from '../application/stores/system'
import { isDue, lowSpace, nextScanAt } from '../domain/monitor'
import { useI18n } from './i18n'

export const CHECK_EVERY_MS = 10 * 60 * 1000

export function useMonitor() {
  const settings = useSettingsStore()
  const system = useSystemStore()
  const survey = useSurveyStore()
  const history = useHistoryStore()
  const router = useRouter()
  const { t, gb, locale } = useI18n()
  let alerted = false
  let timer: ReturnType<typeof setInterval> | null = null
  let stopTray: (() => void) | null = null

  async function scanNow() {
    const info = system.info
    if (!info || survey.status === 'running') return
    await survey.run({ volumeRoot: info.volumeRoot, profile: info.profile, depth: settings.defaultDepth })
  }

  async function tick(now = new Date()) {
    const info = system.info
    if (!info) return
    if (settings.lowSpaceGb > 0) {
      try {
        const volume = await settings.background.volumeUsage(info.volumeRoot)
        const result = lowSpace(alerted, volume.freeBytes, settings.lowSpaceGb)
        alerted = result.alerted
        if (result.alert) {
          await settings.background.notify(
            t('monitor.alertTitle', { root: info.volumeRoot }),
            t('monitor.alertBody', { free: gb(volume.freeBytes), limit: `${settings.lowSpaceGb} GB` }),
          )
        }
      } catch {
        // Falha ao medir não derruba o app: tenta de novo no próximo ciclo.
      }
    }
    if (isDue(nextScanAt(settings.schedule, history.latest?.at ?? null, now), now)) await scanNow()
  }

  const labels = () => ({ open: t('tray.open'), scan: t('tray.scan'), quit: t('tray.quit'), tooltip: t('tray.tooltip') })

  // Liga/desliga a bandeja e reaplica os textos do menu ao trocar o idioma.
  watch(
    () => [settings.backgroundEnabled, locale.value] as const,
    ([enabled]) => void settings.background.setBackground(enabled, labels()).catch(() => {}),
  )

  // O sistema carrega assíncrono: mede assim que ele chega, sem esperar 10 min.
  watch(
    () => system.info,
    (info, before) => {
      if (info && !before) void tick()
    },
  )

  onMounted(async () => {
    if (settings.backgroundEnabled) void settings.background.setBackground(true, labels()).catch(() => {})
    stopTray = await settings.background.onTrayScan(() => {
      void router.push('/')
      void scanNow()
    })
    timer = setInterval(() => void tick(), CHECK_EVERY_MS)
    await tick()
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    stopTray?.()
  })

  return { tick }
}
