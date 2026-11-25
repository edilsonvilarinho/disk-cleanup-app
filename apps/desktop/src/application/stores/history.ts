import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { SurveyDto } from '../../domain/models'
import {
  appendSnapshot,
  compareSnapshots,
  sanitizeHistory,
  toSnapshot,
  type Comparison,
  type ScanSnapshot,
} from '../../domain/history'
import type { SurveyRequest } from '../gateway'

/** Histórico de varreduras: gravado a cada survey concluído, persistido pela porta. */
export const useHistoryStore = defineStore('history', {
  state: () => ({
    loaded: false,
    snapshots: [] as ScanSnapshot[],
    /** Comparação escolhida pelo usuário; `null` = penúltima → última. */
    fromId: null as string | null,
    toId: null as string | null,
    /** Varredura em detalhe; `null` = a última. */
    detailId: null as string | null,
    /** Última gravação falhou (armazenamento cheio ou bloqueado). */
    saveFailed: false,
  }),
  getters: {
    latest: (state): ScanSnapshot | null => state.snapshots.at(-1) ?? null,
    previous: (state): ScanSnapshot | null => state.snapshots.at(-2) ?? null,
    from(): ScanSnapshot | null {
      return this.snapshots.find((s) => s.id === this.fromId) ?? this.previous
    },
    to(): ScanSnapshot | null {
      return this.snapshots.find((s) => s.id === this.toId) ?? this.latest
    },
    detail(): ScanSnapshot | null {
      return this.snapshots.find((s) => s.id === this.detailId) ?? this.latest
    },
    /** Varredura imediatamente anterior à que está em detalhe. */
    detailPrevious(): ScanSnapshot | null {
      const i = this.snapshots.findIndex((s) => s.id === this.detail?.id)
      return i > 0 ? this.snapshots[i - 1]! : null
    },
    comparison(): Comparison | null {
      const from = this.from
      const to = this.to
      return from && to && from.id !== to.id ? compareSnapshots(from, to) : null
    },
  },
  actions: {
    load() {
      if (this.loaded) return
      this.snapshots = sanitizeHistory(this.historyStorage.load()).map((s) => markRaw(s))
      this.loaded = true
    },
    persist() {
      this.saveFailed = !this.historyStorage.save([...this.snapshots])
    },
    /** Devolve o id gravado (o Survey usa para achar a varredura anterior). */
    record(survey: SurveyDto, request: SurveyRequest, at: Date = new Date()): string {
      this.load()
      const snapshot = toSnapshot(survey, {
        id: `${at.getTime()}-${this.snapshots.length}`,
        at,
        volumeRoot: request.volumeRoot,
        profilePath: request.profile,
        depth: request.depth,
      })
      this.snapshots = appendSnapshot(this.snapshots, markRaw(snapshot))
      this.fromId = null
      this.toId = null
      this.detailId = null
      this.persist()
      return snapshot.id
    },
    /** Varredura imediatamente anterior a `id` (ou `null`). */
    previousOf(id: string): ScanSnapshot | null {
      const i = this.snapshots.findIndex((s) => s.id === id)
      return i > 0 ? this.snapshots[i - 1]! : null
    },
    select(fromId: string, toId: string) {
      this.fromId = fromId
      this.toId = toId
    },
    inspect(id: string) {
      this.detailId = id
    },
    /** Leva a comparação para "anterior → em detalhe". */
    compareDetailWithPrevious() {
      const to = this.detail
      const from = this.detailPrevious
      if (to && from) this.select(from.id, to.id)
    },
    remove(id: string) {
      this.snapshots = this.snapshots.filter((s) => s.id !== id)
      if (this.fromId === id) this.fromId = null
      if (this.toId === id) this.toId = null
      if (this.detailId === id) this.detailId = null
      this.persist()
    },
    clear() {
      this.snapshots = []
      this.fromId = null
      this.toId = null
      this.detailId = null
      this.persist()
    },
  },
})
