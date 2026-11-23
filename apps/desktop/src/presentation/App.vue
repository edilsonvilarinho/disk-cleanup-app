<script setup lang="ts">
import { onMounted } from 'vue'
import { useSystemStore } from '../application/stores/system'
import AppSidebar from './components/AppSidebar.vue'

const system = useSystemStore()
onMounted(() => system.load())
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <main class="main">
      <div class="container">
        <RouterView />
      </div>
    </main>
  </div>
</template>
