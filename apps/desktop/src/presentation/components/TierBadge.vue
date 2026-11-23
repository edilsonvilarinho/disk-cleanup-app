<script setup lang="ts">
import type { Tier } from '../../domain/models'
import { TIER_LABEL } from '../../domain/selection'

defineProps<{ tier: Tier }>()
</script>

<template>
  <span class="tier" :class="`t${tier}`"><span class="sq" />{{ tier }} · {{ TIER_LABEL[tier] }}</span>
</template>
