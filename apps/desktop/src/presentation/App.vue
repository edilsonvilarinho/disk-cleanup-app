<script setup lang="ts">
import { useMonitor } from './monitor'
import { onMounted, watch } from 'vue'
import { useSettingsStore } from '../application/stores/settings'
import { useSystemStore } from '../application/stores/system'
import { useUpdateStore } from '../application/stores/update'
import AppSidebar from './components/AppSidebar.vue'
import FlowTabs from './components/FlowTabs.vue'
import StatusBar from './components/StatusBar.vue'
import { useI18n } from './i18n'
import { isFlowStep } from './router'
import { useTheme } from './theme'

const system = useSystemStore()
const settings = useSettingsStore()
const update = useUpdateStore()
const theme = useTheme()
const { locale } = useI18n()

watch(() => settings.theme, (mode) => theme.setMode(mode), { immediate: true })
watch(locale, (value) => document.documentElement.setAttribute('lang', value === 'pt' ? 'pt-BR' : 'en'), { immediate: true })
onMounted(() => {
  system.load()
  update.startup(settings.autoUpdate, settings.betaUpdates)
})

// Segundo plano: espaço livre, varredura agendada (leitura) e bandeja.
useMonitor()
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <main class="main">
      <div class="container">
        <FlowTabs v-if="isFlowStep($route.name)" />
        <!-- Telas são fragmentos: o wrapper com key dá um elemento para animar. -->
        <RouterView v-slot="{ Component, route }">
          <Transition name="page" mode="out-in">
            <div :key="route.path" class="page">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </div>
    </main>
  </div>
  <StatusBar />
</template>
