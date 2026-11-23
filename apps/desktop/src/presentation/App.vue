<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useSettingsStore } from '../application/stores/settings'
import { useSystemStore } from '../application/stores/system'
import AppSidebar from './components/AppSidebar.vue'
import { useI18n } from './i18n'
import { useTheme } from './theme'

const system = useSystemStore()
const settings = useSettingsStore()
const theme = useTheme()
const { locale } = useI18n()

watch(() => settings.theme, (mode) => theme.setMode(mode), { immediate: true })
watch(locale, (value) => document.documentElement.setAttribute('lang', value === 'pt' ? 'pt-BR' : 'en'), { immediate: true })
onMounted(() => system.load())
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <main class="main">
      <div class="container">
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
</template>
