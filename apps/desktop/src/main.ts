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
import { gatewayPlugin } from './application/gatewayPlugin'
import { ThemeController } from './application/theme'
import { applyThemeToDocument, localStorageThemeStorage, systemPrefersDark } from './infrastructure/browserTheme'
import { DemoGateway } from './infrastructure/demoGateway'
import { TauriGateway } from './infrastructure/tauriGateway'
import App from './presentation/App.vue'
import { createAppRouter } from './presentation/router'
import { THEME_KEY } from './presentation/theme'

// Fora do Tauri (navegador, `pnpm dev`) usa dados de demonstração.
const gateway = '__TAURI_INTERNALS__' in window ? new TauriGateway() : new DemoGateway()

const theme = new ThemeController(localStorageThemeStorage, systemPrefersDark, applyThemeToDocument)
theme.init()

const pinia = createPinia()
pinia.use(gatewayPlugin(gateway))

createApp(App).use(pinia).use(createAppRouter()).provide(THEME_KEY, theme).mount('#app')
