<script setup lang="ts">
// Mapa do volume: área proporcional ao espaço alocado. Clique numa pasta com
// subpastas para entrar; a trilha volta. "Outros" (nome vazio) não abre.
import { computed, ref, watch } from 'vue'
import type { TreeNodeDto } from '../../domain/models'
import { squarify } from '../../domain/treemap'
import { useI18n } from '../i18n'

const props = defineProps<{ tree: TreeNodeDto }>()
const { t, gb } = useI18n()
/** Índices dos filhos escolhidos a partir da raiz. */
const path = ref<number[]>([])
watch(
  () => props.tree,
  () => (path.value = []),
)

const trail = computed(() => {
  const nodes: TreeNodeDto[] = [props.tree]
  for (const i of path.value) nodes.push(nodes[nodes.length - 1]!.children[i]!)
  return nodes
})
const current = computed(() => trail.value[trail.value.length - 1]!)
const cells = computed(() => {
  const kids = current.value.children
  return squarify(kids.map((c, i) => ({ key: String(i), bytes: c.bytes }))).map((r) => {
    const node = kids[Number(r.key)]!
    return { ...r, index: Number(r.key), node, small: r.w < 8 || r.h < 12 }
  })
})
const label = (n: TreeNodeDto) => n.name || t('survey.others')

function open(index: number) {
  if (current.value.children[index]!.children.length > 0) path.value = [...path.value, index]
}
</script>

<template>
  <div class="tm-crumbs" :aria-label="t('survey.mapPath')">
    <template v-for="(n, i) in trail" :key="i">
      <span v-if="i" aria-hidden="true">›</span>
      <button type="button" class="mono" :data-test="`crumb-${i}`" @click="path = path.slice(0, i)">{{ label(n) }}</button>
    </template>
    <span class="small muted num" style="margin-left: auto">{{ gb(current.bytes) }}</span>
  </div>
  <div v-if="cells.length" class="tm" data-test="treemap">
    <button
      v-for="(c, i) in cells"
      :key="`${path.join('.')}-${c.index}`"
      type="button"
      class="tm-cell"
      :class="{ other: !c.node.name, leaf: !c.node.children.length }"
      :style="{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, animationDelay: `${i * 0.02}s` }"
      :title="`${label(c.node)} · ${gb(c.node.bytes)}`"
      :aria-label="`${label(c.node)} · ${gb(c.node.bytes)}`"
      data-test="tm-cell"
      @click="open(c.index)"
    >
      <template v-if="!c.small">
        <strong>{{ label(c.node) }}</strong>
        <span class="num small muted">{{ gb(c.node.bytes) }}</span>
      </template>
    </button>
  </div>
  <p v-else class="small muted" data-test="treemap-empty">{{ t('survey.mapEmpty') }}</p>
</template>
