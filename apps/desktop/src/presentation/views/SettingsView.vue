<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ThemeMode } from '../../application/settings'
import { useSettingsStore } from '../../application/stores/settings'
import type { LanguagePreference } from '../../i18n/i18n'
import { useI18n } from '../i18n'

const settings = useSettingsStore()
const { t, systemLocale } = useI18n()
const newPath = ref('')

const systemName = computed(() => (systemLocale.value === 'pt' ? t('settings.langPt') : t('settings.langEn')))
const themes: ThemeMode[] = ['system', 'light', 'dark']
const themeLabel = (mode: ThemeMode) =>
  t(mode === 'system' ? 'settings.themeSystem' : mode === 'light' ? 'settings.themeLight' : 'settings.themeDark')

function onLanguage(event: Event) {
  settings.setLanguage((event.target as HTMLSelectElement).value as LanguagePreference)
}

function onDepth(event: Event) {
  settings.setDefaultDepth(Number((event.target as HTMLSelectElement).value) as 1 | 2)
}

function add() {
  if (settings.addExclusion(newPath.value)) newPath.value = ''
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">{{ t('settings.eyebrow') }}</span>
      <h1>{{ t('settings.title') }}</h1>
    </div>
    <span class="small muted">{{ t('settings.saved') }}</span>
  </header>

  <div class="grid-2">
    <section class="card">
      <label class="field" for="language" style="justify-content: space-between">
        <span style="font-weight: 600">{{ t('settings.language') }}</span>
        <select id="language" class="select" data-test="language" :value="settings.language" @change="onLanguage">
          <option value="auto">{{ t('settings.languageAuto', { name: systemName }) }}</option>
          <option value="pt">{{ t('settings.langPt') }}</option>
          <option value="en">{{ t('settings.langEn') }}</option>
        </select>
      </label>
      <div class="divider" />
      <fieldset style="border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
        <legend style="font-weight: 600; margin-bottom: 8px">{{ t('settings.theme') }}</legend>
        <label v-for="mode in themes" :key="mode" class="option" style="flex: 1 1 120px">
          <input type="radio" name="theme" :value="mode" :checked="settings.theme === mode" :data-test="`theme-${mode}`" @change="settings.setTheme(mode)" />
          <span>{{ themeLabel(mode) }}</span>
        </label>
      </fieldset>
      <div class="divider" />
      <label class="field" for="default-depth" style="justify-content: space-between">
        <span style="font-weight: 600">{{ t('settings.depth') }}</span>
        <select id="default-depth" class="select" data-test="default-depth" :value="settings.defaultDepth" @change="onDepth">
          <option :value="2">{{ t('survey.depth2') }}</option>
          <option :value="1">{{ t('survey.depth1') }}</option>
        </select>
      </label>
    </section>

    <section class="card" data-test="exclusions-settings">
      <h2>{{ t('settings.exclusions') }}</h2>
      <p class="small muted">{{ t('settings.exclusionsHint') }}</p>
      <form class="actions" style="flex-wrap: nowrap" @submit.prevent="add">
        <label class="sr-only" for="new-exclusion">{{ t('settings.exclusionPlaceholder') }}</label>
        <input
          id="new-exclusion"
          v-model="newPath"
          class="select mono"
          style="flex: 1; min-width: 0"
          :placeholder="t('settings.exclusionPlaceholder')"
          data-test="new-exclusion"
        />
        <button type="submit" class="btn" data-test="add-exclusion">{{ t('settings.add') }}</button>
      </form>
      <TransitionGroup tag="ul" name="list" class="checklist small" style="position: relative">
        <li v-for="path in settings.extraExclusions" :key="path" class="kv" data-test="exclusion">
          <span class="mono" style="word-break: break-all">{{ path }}</span>
          <button type="button" class="btn" :aria-label="t('settings.remove', { path })" @click="settings.removeExclusion(path)">×</button>
        </li>
      </TransitionGroup>
      <Transition name="fade">
        <p v-if="!settings.extraExclusions.length" class="muted" data-test="no-exclusions">{{ t('settings.noExclusions') }}</p>
      </Transition>
    </section>
  </div>
</template>
