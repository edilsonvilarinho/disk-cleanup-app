<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../../application/stores/settings'
import { useSystemStore } from '../../application/stores/system'
import { useUpdateStore } from '../../application/stores/update'
import { useI18n } from '../i18n'
import { STEPS } from '../router'
import { useTheme } from '../theme'
import UpdateNotice from './UpdateNotice.vue'

const system = useSystemStore()
const settings = useSettingsStore()
const update = useUpdateStore()
const theme = useTheme()
const { t, err } = useI18n()
const isDark = computed(() => theme.current.value === 'dark')

function toggleTheme() {
  settings.setTheme(isDark.value ? 'light' : 'dark')
}
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
        <span class="small muted mono" data-test="app-version">{{ update.version ? `v${update.version}` : '—' }}</span>
      </div>
    </div>

    <nav class="nav" :aria-label="t('nav.steps')" data-test="nav">
      <RouterLink v-for="(step, i) in STEPS" :key="step.name" :to="step.path">
        <span class="step-num">{{ i + 1 }}</span>{{ t(`nav.${step.name}`) }}
      </RouterLink>
    </nav>

    <nav class="nav" :aria-label="t('nav.settings')">
      <RouterLink to="/configuracoes" data-test="nav-settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        {{ t('nav.settings') }}
      </RouterLink>
    </nav>

    <div class="env">
      <span class="label-caps">{{ t('env.title') }}</span>
      <template v-if="system.info">
        <div class="env-row"><span class="muted">{{ t('env.system') }}</span><span data-test="env-os">{{ system.info.os }}</span></div>
        <div class="env-row"><span class="muted">{{ t('env.volume') }}</span><span class="mono">{{ system.info.volumeRoot }}</span></div>
        <div class="env-row"><span class="muted">{{ t('env.catalog') }}</span><span>{{ system.info.catalog }}</span></div>
      </template>
      <p v-else-if="system.error" class="small err" data-test="env-error">{{ err(system.error) }}</p>
      <div class="env-row"><span class="muted">{{ t('env.mode') }}</span><span style="font-weight: 600">{{ t('env.explicit') }}</span></div>
    </div>

    <div class="spacer" />
    <UpdateNotice />
    <button type="button" class="btn btn-lg" data-test="theme-toggle" @click="toggleTheme">
      <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <span>{{ isDark ? t('theme.toLight') : t('theme.toDark') }}</span>
    </button>
  </aside>
</template>
