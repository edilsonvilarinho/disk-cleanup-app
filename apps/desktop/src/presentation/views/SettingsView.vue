<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ThemeMode } from '../../application/settings'
import { useSettingsStore } from '../../application/stores/settings'
import { useUpdateStore } from '../../application/stores/update'
import type { LanguagePreference } from '../../i18n/i18n'
import { useI18n } from '../i18n'

const settings = useSettingsStore()
const update = useUpdateStore()
const { t, err, systemLocale } = useI18n()
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

const checked = (event: Event) => (event.target as HTMLInputElement).checked

// Disponível/baixando/pronta aparecem no aviso da barra lateral, com a ação.
const updateStatus = computed(() => {
  if (update.status === 'checking') return t('update.checking')
  if (update.status === 'upToDate') return t('update.upToDate')
  if (update.status === 'error') return t('update.failed', { error: err(update.error!) })
  return ''
})

function add() {
  if (settings.addExclusion(newPath.value)) newPath.value = ''
}

const newRoot = ref('')
function addRoot() {
  if (settings.addProjectRoot(newRoot.value)) newRoot.value = ''
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

    <section class="card" data-test="project-roots-settings">
      <h2>{{ t('settings.projectRoots') }}</h2>
      <p class="small muted">{{ t('settings.projectRootsHint') }}</p>
      <form class="actions" style="flex-wrap: nowrap" data-test="project-roots-form" @submit.prevent="addRoot">
        <label class="sr-only" for="new-project-root">{{ t('settings.projectRootPlaceholder') }}</label>
        <input
          id="new-project-root"
          v-model="newRoot"
          class="select mono"
          style="flex: 1; min-width: 0"
          :placeholder="t('settings.projectRootPlaceholder')"
          data-test="new-project-root"
        />
        <button type="submit" class="btn" data-test="add-project-root">{{ t('settings.add') }}</button>
      </form>
      <TransitionGroup tag="ul" name="list" class="checklist small" style="position: relative">
        <li v-for="path in settings.projectRoots" :key="path" class="kv" data-test="project-root">
          <span class="mono" style="word-break: break-all">{{ path }}</span>
          <button type="button" class="btn" :aria-label="t('settings.remove', { path })" @click="settings.removeProjectRoot(path)">×</button>
        </li>
      </TransitionGroup>
      <Transition name="fade">
        <p v-if="!settings.projectRoots.length" class="muted" data-test="no-project-roots">{{ t('settings.noProjectRoots') }}</p>
      </Transition>
    </section>

    <section class="card" data-test="update-settings">
      <div class="card-head">
        <h2>{{ t('update.title') }}</h2>
        <span class="small muted mono">{{ t('update.installed', { version: update.version ?? '—' }) }}</span>
      </div>
      <label class="option">
        <input type="checkbox" data-test="auto-update" :checked="settings.autoUpdate" @change="settings.setAutoUpdate(checked($event))" />
        <span style="display: flex; flex-direction: column; gap: 2px">
          <span style="font-weight: 600">{{ t('update.auto') }}</span>
          <span class="small muted">{{ t('update.autoHint') }}</span>
        </span>
      </label>
      <label class="option">
        <input type="checkbox" data-test="beta-updates" :checked="settings.betaUpdates" @change="settings.setBetaUpdates(checked($event))" />
        <span style="display: flex; flex-direction: column; gap: 2px">
          <span style="font-weight: 600">{{ t('update.beta') }}</span>
          <span class="small muted">{{ t('update.betaHint') }}</span>
        </span>
      </label>
      <div class="actions" style="align-items: center">
        <button type="button" class="btn" data-test="update-check" :disabled="update.busy" @click="update.check(settings.betaUpdates)">
          {{ t('update.check') }}
        </button>
        <Transition name="fade" mode="out-in">
          <span v-if="updateStatus" :key="update.status" class="small" role="status" data-test="update-status">{{ updateStatus }}</span>
        </Transition>
      </div>
    </section>
  </div>
</template>
