<script setup lang="ts">
defineProps<{ title: string; description: string }>()
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">Próxima fase</span>
      <h1>{{ title }}</h1>
    </div>
  </header>
  <div class="card empty" data-test="pending">
    <h2>{{ title }} ainda não implementada</h2>
    <p class="muted">{{ description }}</p>
  </div>
</template>
