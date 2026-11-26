import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'

/** Tempo das transições de item (pop do número, troca de página) antes da medida final. */
export const SETTLE_MS = 420

/** Estilo do destaque que desliza até o item ativo de `container`. A primeira
 *  medição é instantânea (sem transição) para o destaque não "voar" ao abrir. */
export function useActiveIndicator(container: Ref<HTMLElement | null>, deps: WatchSource, selector = '[aria-current="page"]') {
  const style = ref<Record<string, string>>({ opacity: '0' })
  let first = true

  function measure() {
    const el = container.value?.querySelector<HTMLElement>(selector)
    if (!el) {
      style.value = { opacity: '0' }
      return
    }
    style.value = {
      opacity: '1',
      transform: `translate(${el.offsetLeft}px, ${el.offsetTop}px)`,
      width: `${el.offsetWidth}px`,
      height: `${el.offsetHeight}px`,
      ...(first ? { transition: 'none' } : {}),
    }
    first = false
  }

  // Remede no próximo tick e de novo quando as transições dos itens terminam
  // (ex.: número que vira check muda a largura da aba e desloca as vizinhas).
  let settle: ReturnType<typeof setTimeout> | undefined
  const later = () => {
    void nextTick(measure)
    clearTimeout(settle)
    settle = setTimeout(measure, SETTLE_MS)
  }
  watch(deps, later)
  onMounted(() => {
    later()
    window.addEventListener('resize', measure)
  })
  onBeforeUnmount(() => {
    clearTimeout(settle)
    window.removeEventListener('resize', measure)
  })
  return style
}
