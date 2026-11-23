<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string }>()
</script>

<template>
  <div class="kpi">
    <span class="small muted">{{ label }}</span>
    <span class="value">{{ value }}</span>
    <slot>
      <span v-if="hint" class="small muted">{{ hint }}</span>
    </slot>
  </div>
</template>
