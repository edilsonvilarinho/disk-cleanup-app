import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { sanitizeHistory } from '../../domain/history'
import { compareVersions, countKinds, decideNotes, type NoteKind, type ReleaseNotes } from '../../domain/releaseNotes'
import { RELEASE_NOTES } from '../../releaseNotes/catalog'
import { useSettingsStore } from './settings'

export type NoteFilter = 'all' | NoteKind

/** Notas de versão: aviso depois de atualizar, selo na barra de status e gaveta. */
export const useReleaseNotesStore = defineStore('releaseNotes', {
  state: () => ({
    catalog: markRaw(RELEASE_NOTES) as readonly ReleaseNotes[],
    /** Versão instalada; `null` até a abertura decidir. */
    current: null as string | null,
    /** Versões novas desde a última vista (só nesta sessão). */
    pending: [] as ReleaseNotes[],
    notice: false,
    /** A gaveta já foi aberta nesta sessão: o selo some. */
    opened: false,
    drawer: null as { version: string; filter: NoteFilter } | null,
  }),
  getters: {
    chip: (state) => state.pending.length > 0 && !state.opened,
    counts: (state) => countKinds(state.pending),
    /** Versão do catálogo que está instalada (precedência SemVer: ignora `+build`). */
    installed: (state): string | null =>
      state.current ? (state.catalog.find((n) => compareVersions(n.version, state.current!) === 0)?.version ?? null) : null,
    shown(state): ReleaseNotes | null {
      return state.catalog.find((n) => n.version === state.drawer?.version) ?? null
    },
    /** Abas da gaveta: as versões novas, se a aberta é uma delas; senão, só a aberta. */
    tabs(state): readonly ReleaseNotes[] {
      const version = state.drawer?.version
      if (!version) return []
      return state.pending.some((n) => n.version === version) ? state.pending : state.catalog.filter((n) => n.version === version)
    },
  },
  actions: {
    /** Na abertura, com a versão instalada. Uma vez por sessão. */
    startup(current: string | null, catalog: readonly ReleaseNotes[] = RELEASE_NOTES) {
      if (!current || this.current) return
      this.current = current
      this.catalog = markRaw(catalog)
      const settings = useSettingsStore()
      // Preferências ou histórico salvos = já usava o app antes deste recurso.
      const existingUser = this.settingsStorage.load() != null || sanitizeHistory(this.historyStorage.load()).length > 0
      const decision = decideNotes(catalog, current, { seen: settings.seenVersion, existingUser, enabled: settings.releaseNotes })
      if (decision.markSeen) settings.setSeenVersion(decision.markSeen)
      this.pending = decision.show
      this.notice = decision.show.length > 0
    },
    markSeen() {
      if (this.current) useSettingsStore().setSeenVersion(this.current)
    },
    dismiss() {
      this.notice = false
      this.markSeen()
    },
    open(version?: string, filter: NoteFilter = 'all') {
      const target = version ?? this.pending[0]?.version ?? this.catalog[0]?.version
      if (!target) return
      this.drawer = { version: target, filter }
      this.notice = false
      if (this.pending.length && !this.opened) this.markSeen()
      this.opened = true
    },
    close() {
      this.drawer = null
    },
    setVersion(version: string) {
      if (this.drawer) this.drawer = { version, filter: 'all' }
    },
    setFilter(filter: NoteFilter) {
      if (this.drawer) this.drawer.filter = filter
    },
  },
})
