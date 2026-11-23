<script setup lang="ts">
import { computed } from 'vue'
import { useSystemStore } from '../../application/stores/system'
import { STEPS } from '../router'
import { useTheme } from '../theme'

const system = useSystemStore()
const theme = useTheme()
const isDark = computed(() => theme.current.value === 'dark')
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 14h18" />
        <circle cx="17" cy="17" r="0.8" />
      </svg>
      <div style="display: flex; flex-direction: column">
        <span class="brand-name">Disk Cleanup</span>
        <span class="small muted">v0.1</span>
      </div>
    </div>

    <nav class="nav" aria-label="Etapas" data-test="nav">
      <RouterLink v-for="(step, i) in STEPS" :key="step.name" :to="step.path">
        <span class="step-num">{{ i + 1 }}</span>{{ step.label }}
        <span v-if="step.soon" class="soon">em breve</span>
      </RouterLink>
    </nav>

    <div class="env">
      <span class="label-caps">Ambiente</span>
      <template v-if="system.info">
        <div class="env-row"><span class="muted">Sistema</span><span data-test="env-os">{{ system.info.os }}</span></div>
        <div class="env-row"><span class="muted">Volume</span><span class="mono">{{ system.info.volumeRoot }}</span></div>
        <div class="env-row"><span class="muted">Catálogo</span><span>{{ system.info.catalog }}</span></div>
      </template>
      <p v-else-if="system.error" class="small err" data-test="env-error">{{ system.error }}</p>
      <div class="env-row"><span class="muted">Modo</span><span class="ok" style="font-weight: 600">Somente leitura</span></div>
    </div>

    <div class="spacer" />
    <button type="button" class="btn btn-lg" data-test="theme-toggle" @click="theme.toggle()">
      <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <span>{{ isDark ? 'Tema claro' : 'Tema escuro' }}</span>
    </button>
  </aside>
</template>
