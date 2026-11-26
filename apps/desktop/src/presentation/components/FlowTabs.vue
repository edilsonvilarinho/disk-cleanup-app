<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useClassificationStore } from '../../application/stores/classification'
import { useExecutionStore } from '../../application/stores/execution'
import { usePlanStore } from '../../application/stores/plan'
import { useSurveyStore } from '../../application/stores/survey'
import { flowStates } from '../../domain/flow'
import { useActiveIndicator } from '../activeIndicator'
import { useI18n } from '../i18n'
import { STEPS } from '../router'

const survey = useSurveyStore()
const classification = useClassificationStore()
const plan = usePlanStore()
const exec = useExecutionStore()
const route = useRoute()
const { t } = useI18n()

const paths = Object.fromEntries(STEPS.map((s) => [s.name, s.path]))

const steps = computed(() =>
  flowStates({
    surveyDone: survey.report !== null,
    hasSelection: classification.status === 'done' && classification.total.count > 0,
    approved: plan.approval !== null,
    executedAny: Object.keys(exec.runs).length > 0,
    executionFinished: exec.finished,
  }),
)
const navEl = ref<HTMLElement | null>(null)
// Remede quando a rota muda ou quando uma aba destranca (o rótulo muda de largura).
const indicator = useActiveIndicator(navEl, () => [route.fullPath, steps.value.map((s) => s.unlocked).join()])
</script>

<template>
  <nav ref="navEl" class="flow has-ind" :aria-label="t('nav.steps')" data-test="nav">
    <span class="active-ind" :style="indicator" aria-hidden="true" />
    <template v-for="(step, i) in steps" :key="step.name">
      <span v-if="i > 0" class="flow-sep" :class="{ on: step.unlocked }" aria-hidden="true" />
      <RouterLink
        v-if="step.unlocked"
        :to="paths[step.name]!"
        class="flow-step unlocking"
        :class="{ done: step.done }"
        :data-test="`step-${step.name}`"
      >
        <span class="step-num">
          <Transition name="pop" mode="out-in">
            <svg v-if="step.done && route.name !== step.name" key="done" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
            <span v-else key="num">{{ i + 1 }}</span>
          </Transition>
        </span>
        {{ t(`nav.${step.name}`) }}
        <span v-if="step.done" class="sr-only">({{ t('flow.done') }})</span>
      </RouterLink>
      <span
        v-else
        class="flow-step locked"
        role="link"
        aria-disabled="true"
        :title="t('flow.locked', { step: t(`nav.${step.requires}`) })"
        :data-test="`step-${step.name}`"
      >
        <span class="step-num">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        </span>
        {{ t(`nav.${step.name}`) }}
        <span class="sr-only">({{ t('flow.locked', { step: t(`nav.${step.requires}`) }) }})</span>
      </span>
    </template>
  </nav>
</template>
