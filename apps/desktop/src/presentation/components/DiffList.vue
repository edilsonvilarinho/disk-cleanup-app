<script setup lang="ts">
// Barras divergentes a partir do eixo central: à direita cresceu (--grow), à
// esquerda reduziu (--shrink). Sinal e direção repetem a cor (nunca só cor).
import { computed } from 'vue'
import type { EntryDelta } from '../../domain/history'
import { useI18n } from '../i18n'

const props = defineProps<{ items: EntryDelta[] }>()
const { t, signedGb } = useI18n()
const max = computed(() => Math.max(0, ...props.items.map((i) => Math.abs(i.delta))))
const width = (delta: number) => `${max.value ? Math.max(1, (Math.abs(delta) / max.value) * 50) : 0}%`
</script>

<template>
  <p v-if="!items.length" class="small muted" data-test="diff-empty">{{ t('history.noChange') }}</p>
  <TransitionGroup v-else tag="div" name="list" class="diff">
    <div v-for="item in items" :key="item.key" class="diff-row" data-test="diff-row">
      <span class="name" :title="item.key">{{ item.name }}<span v-if="item.added" class="tag">{{ t('history.added') }}</span><span v-if="item.removed" class="tag">{{ t('history.removed') }}</span></span>
      <div class="diff-track" :title="`${item.name}: ${signedGb(item.delta)}`">
        <span :class="item.delta > 0 ? 'grow' : 'shrink'" :style="{ width: width(item.delta) }" />
      </div>
      <span class="num">{{ signedGb(item.delta) }}</span>
    </div>
  </TransitionGroup>
</template>
