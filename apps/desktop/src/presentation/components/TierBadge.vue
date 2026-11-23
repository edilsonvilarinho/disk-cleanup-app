<script setup lang="ts">
import type { Tier } from '../../domain/models'
import { useI18n } from '../i18n'

defineProps<{ tier: Tier }>()
const { t } = useI18n()
</script>

<template>
  <span class="tier" :class="`t${tier}`"><span class="sq" />{{ tier }} · {{ t(`tier.${tier}`) }}</span>
</template>
