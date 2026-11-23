<script setup lang="ts">
import { computed } from 'vue'
import { barWidth } from '../../domain/format'
import { useI18n } from '../i18n'

const props = defineProps<{ items: { name: string; bytes: number }[] }>()
const { gb, num } = useI18n()
const max = computed(() => Math.max(0, ...props.items.map((i) => i.bytes)))
</script>

<template>
  <div class="barlist">
    <div v-for="item in items" :key="item.name" class="bar-row">
      <span class="name" :title="item.name">{{ item.name }}</span>
      <div class="track" role="img" :aria-label="`${item.name}: ${gb(item.bytes)}`">
        <span :style="{ width: barWidth(item.bytes, max) }" />
      </div>
      <span class="num">{{ num(item.bytes) }}</span>
    </div>
  </div>
</template>
