<script setup lang="ts">
import { computed } from 'vue'
import { useUpdateStore } from '../../application/stores/update'
import { useI18n } from '../i18n'

const update = useUpdateStore()
const { t } = useI18n()

const VISIBLE = ['available', 'downloading', 'ready', 'installing'] as const
const visible = computed(() => (VISIBLE as readonly string[]).includes(update.status))

// Só calculado quando visível: nesses estados `available` sempre existe.
const message = computed(() => {
  const version = update.available!.version
  const percent = update.progress?.percent
  switch (update.status) {
    case 'available':
      return t('update.available', { version })
    case 'downloading':
      return percent == null ? t('update.downloading', { version }) : t('update.downloadingPercent', { version, percent })
    case 'ready':
      return t('update.ready', { version })
    default:
      return t('update.installing')
  }
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="update-notice" role="status" aria-live="polite" data-test="update-notice">
      <span>{{ message }}</span>
      <button v-if="update.status === 'available'" type="button" class="btn" data-test="update-download" @click="update.download()">
        {{ t('update.download') }}
      </button>
      <button v-else-if="update.status === 'ready'" type="button" class="btn btn-primary" data-test="update-restart" @click="update.install()">
        {{ t('update.restart') }}
      </button>
    </div>
  </Transition>
</template>
