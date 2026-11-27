<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReleaseNotesStore, type NoteFilter } from '../../application/stores/releaseNotes'
import { useRouter } from 'vue-router'
import { NOTE_KINDS, type NoteKind, type NoteRoute, type ReleaseNoteItem } from '../../domain/releaseNotes'
import { useI18n } from '../i18n'

// Gaveta lateral (o mesmo componente visual do plan.json): versões em abas,
// filtro por tipo e itens recolhidos. O GIF só existe enquanto o item está aberto.
const notes = useReleaseNotesStore()
const router = useRouter()
const { t, txt, day } = useI18n()

/** Leva à tela onde a novidade mora e fecha a gaveta. */
function go(route: NoteRoute) {
  notes.close()
  return router.push({ name: route })
}

const shown = computed(() => notes.shown)
const isNew = computed(() => notes.pending.some((n) => n.version === shown.value?.version))
const filter = computed<NoteFilter>(() => notes.drawer?.filter ?? 'all')

const byKind = (kind: NoteKind): ReleaseNoteItem[] => shown.value?.items.filter((i) => i.kind === kind) ?? []
const filters = computed(() => {
  const list: { key: NoteFilter; n: number }[] = [{ key: 'all', n: shown.value?.items.length ?? 0 }]
  for (const k of NOTE_KINDS) if (byKind(k).length) list.push({ key: k, n: byKind(k).length })
  return list
})
const groups = computed(() =>
  NOTE_KINDS.filter((k) => filter.value === 'all' || filter.value === k)
    .map((kind) => ({ kind, items: byKind(kind) }))
    .filter((g) => g.items.length),
)

/** Aberto por padrão: o primeiro item do primeiro grupo visível. */
const open = ref<Record<string, boolean>>({})
watch(
  () => [notes.drawer?.version, notes.drawer?.filter],
  () => {
    const first = groups.value[0]?.items[0]
    open.value = first ? { [first.id]: true } : {}
  },
  { immediate: true },
)
const toggle = (id: string) => (open.value = { ...open.value, [id]: !open.value[id] })
const allOpen = computed(() => groups.value.every((g) => g.items.every((i) => open.value[i.id])))
function expandAll() {
  open.value = Object.fromEntries(groups.value.flatMap((g) => g.items.map((i) => [i.id, true])))
}

const closeBtn = ref<HTMLButtonElement | null>(null)
watch(
  () => notes.drawer !== null,
  async (isOpen) => {
    if (!isOpen) return
    await nextTick()
    closeBtn.value?.focus()
  },
)
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && notes.drawer) notes.close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="drawer">
    <div v-if="notes.drawer && shown" class="drawer-wrap rn-drawer" data-test="rn-drawer">
      <div class="drawer-scrim" @click="notes.close()" />
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="rn-title">
        <div class="rn-head">
          <div class="rn-titles">
            <!-- Cita a versão para a qual atualizou (a mais nova), não a aba aberta. -->
            <span class="label-caps">{{ isNew ? t('releaseNotes.updatedTo', { version: `v${notes.pending[0]!.version}` }) : t('releaseNotes.history') }}</span>
            <h2 id="rn-title">{{ txt(shown.headline) }}</h2>
            <span class="small muted"><span class="ver-chip mono">v{{ shown.version }}</span> · {{ day(shown.date) }}</span>
          </div>
          <button ref="closeBtn" type="button" class="icon-btn" :aria-label="t('releaseNotes.close')" data-test="rn-close" @click="notes.close()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p class="muted rn-summary">{{ txt(shown.summary) }}</p>

        <div v-if="notes.tabs.length > 1" class="rn-tabs" role="tablist" :aria-label="t('releaseNotes.history')">
          <button
            v-for="r in notes.tabs"
            :key="r.version"
            type="button"
            role="tab"
            :aria-selected="r.version === shown.version"
            :data-test="`rn-tab-${r.version}`"
            @click="notes.setVersion(r.version)"
          >
            <span class="mono">v{{ r.version }}</span>
            <span v-if="r.version === notes.installed" class="pill ok"><span class="dot" />{{ t('releaseNotes.installed') }}</span>
          </button>
        </div>

        <div class="rn-filters" role="group">
          <button
            v-for="f in filters"
            :key="f.key"
            type="button"
            :aria-pressed="filter === f.key"
            :data-test="`rn-filter-${f.key}`"
            @click="notes.setFilter(f.key)"
          >
            {{ f.key === 'all' ? t('releaseNotes.all') : t(`releaseNotes.group.${f.key}`) }} <span class="mono">{{ f.n }}</span>
          </button>
        </div>

        <section v-for="g in groups" :key="g.kind" class="rn-group" :data-test="`rn-group-${g.kind}`">
          <div v-if="filter === 'all'" class="rn-group-title">
            <span class="kind" :class="`kind-${g.kind}`">{{ t(`releaseNotes.group.${g.kind}`) }}</span>
            <span class="small muted">{{ g.items.length }}</span>
          </div>
          <div class="grps">
            <div v-for="item in g.items" :key="item.id" class="grp rn-item" :data-open="!!open[item.id]" data-test="rn-item">
              <button type="button" class="grp-head" :aria-expanded="!!open[item.id]" @click="toggle(item.id)">
                <span class="gi-name rn-item-name">
                  <span class="rn-item-title">
                    <strong>{{ txt(item.title) }}</strong>
                    <span v-if="item.experimental" class="kind kind-exp">{{ t('releaseNotes.experimental') }}</span>
                  </span>
                  <span class="small muted">{{ txt(item.area) }}</span>
                </span>
                <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <div class="grp-body">
                <div>
                  <div v-if="open[item.id]" class="rn-detail" data-test="rn-detail">
                    <p class="muted">{{ txt(item.body) }}</p>
                    <div v-if="item.fix" class="rn-ba" data-test="rn-fix">
                      <div class="rn-ba-side before">
                        <span class="label-caps">{{ t('releaseNotes.before') }}</span>
                        <span class="mono">{{ item.fix.target }}</span>
                        <span class="err">{{ txt(item.fix.before) }} <span class="mono">{{ item.fix.detail }}</span></span>
                      </div>
                      <div class="rn-ba-side after">
                        <span class="label-caps">{{ t('releaseNotes.after') }} · v{{ shown.version }}</span>
                        <span class="mono">{{ item.fix.target }}</span>
                        <span class="ok">{{ txt(item.fix.after) }} <span class="mono">{{ item.fix.detail }}</span></span>
                      </div>
                    </div>
                    <img v-if="item.media" class="rn-media" :src="item.media.src" :alt="txt(item.media.alt)" loading="lazy" data-test="rn-media" />
                    <div v-if="item.route">
                      <button type="button" class="btn" :data-test="`rn-go-${item.id}`" @click="go(item.route)">
                        {{ t('releaseNotes.go', { place: t(`nav.${item.route}`) }) }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="rn-foot">
          <button v-if="!allOpen" type="button" class="btn" data-test="rn-expand" @click="expandAll">{{ t('releaseNotes.expandAll') }}</button>
        </div>
      </aside>
    </div>
  </Transition>
</template>
