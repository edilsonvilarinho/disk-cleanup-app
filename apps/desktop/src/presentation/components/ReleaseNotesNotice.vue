<script setup lang="ts">
import { computed } from 'vue'
import { useReleaseNotesStore } from '../../application/stores/releaseNotes'
import { NOTE_KINDS } from '../../domain/releaseNotes'
import { useI18n } from '../i18n'

// Aviso não bloqueante, acima da barra de status (onde ficam atualização e versão).
const notes = useReleaseNotesStore()
const { t, txt } = useI18n()

const latest = computed(() => notes.pending[0] ?? null)
const older = computed(() => notes.pending.slice(1).map((n) => `v${n.version}`).join(', '))
const kinds = computed(() => NOTE_KINDS.filter((k) => notes.counts[k] > 0))
</script>

<template>
  <Transition name="fade">
    <aside v-if="notes.notice && latest" class="rn-notice" role="status" aria-live="polite" :aria-label="t('releaseNotes.label')" data-test="rn-notice">
      <div class="rn-notice-row">
        <span class="rn-notice-ico" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
          </svg>
        </span>
        <span class="rn-notice-text">
          <strong>{{ t('releaseNotes.updatedTo', { version: `v${latest.version}` }) }}</strong>
          <span class="small muted">
            {{ txt(latest.headline) }}<template v-if="older"> · {{ t('releaseNotes.includes', { versions: older }) }}</template>
          </span>
        </span>
        <button type="button" class="icon-btn" :aria-label="t('releaseNotes.dismiss')" data-test="rn-dismiss" @click="notes.dismiss()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div class="rn-kinds">
        <span v-for="k in kinds" :key="k" class="kind" :class="`kind-${k}`" :data-test="`rn-count-${k}`">{{ notes.counts[k] }} {{ t(`releaseNotes.group.${k}`) }}</span>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-test="rn-open" @click="notes.open()">{{ t('releaseNotes.open') }}</button>
        <button v-if="notes.counts.fixed" type="button" class="btn" data-test="rn-open-fixes" @click="notes.open(undefined, 'fixed')">
          {{ t('releaseNotes.group.fixed') }}
        </button>
      </div>
    </aside>
  </Transition>
</template>
