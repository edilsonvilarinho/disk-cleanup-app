// Raiz de composição: escolhe adaptadores concretos e monta o app.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './styles/app.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { backgroundPlugin } from './application/background'
import { exporterPlugin } from './application/exporter'
import { gatewayPlugin } from './application/gatewayPlugin'
import { historyPlugin } from './application/history'
import { settingsPlugin } from './application/settings'
import { useSettingsStore } from './application/stores/settings'
import { ThemeController } from './application/theme'
import { updaterPlugin } from './application/updater'
import {
  applyThemeToDocument,
  trackPointer,
  localStorageSettingsStorage,
  systemPrefersDark,
  watchSystemTheme,
} from './infrastructure/browserTheme'
import { BrowserBackground, TauriBackground } from './infrastructure/background'
import { localStorageHistoryStorage } from './infrastructure/browserHistory'
import { DemoGateway } from './infrastructure/demoGateway'
import { BrowserExporter, TauriExporter } from './infrastructure/exporters'
import { TauriGateway } from './infrastructure/tauriGateway'
import { DemoUpdater, TauriUpdater } from './infrastructure/updater'
import App from './presentation/App.vue'
import { vueErrorHandler } from './presentation/errorHandler'
import { createAppRouter } from './presentation/router'
import { THEME_KEY } from './presentation/theme'

// Fora do Tauri (navegador, `pnpm dev`) usa dados de demonstração.
const inTauri = '__TAURI_INTERNALS__' in window
const gateway = inTauri ? new TauriGateway() : new DemoGateway()

const pinia = createPinia()
pinia.use(gatewayPlugin(gateway))
pinia.use(settingsPlugin(localStorageSettingsStorage))
pinia.use(historyPlugin(localStorageHistoryStorage))
pinia.use(exporterPlugin(inTauri ? new TauriExporter() : new BrowserExporter()))
pinia.use(updaterPlugin(inTauri ? new TauriUpdater() : new DemoUpdater()))
pinia.use(backgroundPlugin(inTauri ? new TauriBackground() : new BrowserBackground()))

const theme = new ThemeController(systemPrefersDark, applyThemeToDocument)
watchSystemTheme(() => theme.refresh())
trackPointer()

const app = createApp(App).use(pinia).use(createAppRouter()).provide(THEME_KEY, theme)
app.config.errorHandler = vueErrorHandler()
useSettingsStore(pinia).load()
app.mount('#app')
