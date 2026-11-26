<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useActiveIndicator } from '../activeIndicator'
import { useI18n } from '../i18n'
import { isFlowStep } from '../router'

// Só marca e seções. Ambiente, versão e atualização ficam na barra de status;
// o tema fica em Configurações.
const { t } = useI18n()
const route = useRoute()
const inFlow = computed(() => isFlowStep(route.name))
/** "Limpeza" volta para a última etapa visitada, não para o início. */
const lastFlowPath = ref('/')
watch(() => route.path, (path) => {
  if (inFlow.value) lastFlowPath.value = path
}, { immediate: true })
const navEl = ref<HTMLElement | null>(null)
const indicator = useActiveIndicator(navEl, () => route.fullPath)
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
        <span class="small muted">{{ t('bar.tagline') }}</span>
      </div>
    </div>

    <nav ref="navEl" class="nav has-ind" :aria-label="t('nav.sections')">
      <span class="active-ind" :style="indicator" aria-hidden="true" />
      <RouterLink v-slot="{ href, navigate }" :to="lastFlowPath" custom>
        <a :href="href" :aria-current="inFlow ? 'page' : undefined" data-test="nav-cleanup" @click="navigate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M3 14h18" />
          </svg>
          {{ t('nav.cleanup') }}
        </a>
      </RouterLink>
      <RouterLink to="/historico" data-test="nav-history">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
        {{ t('nav.history') }}
      </RouterLink>
      <RouterLink to="/configuracoes" data-test="nav-settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        {{ t('nav.settings') }}
      </RouterLink>
    </nav>
  </aside>
</template>
