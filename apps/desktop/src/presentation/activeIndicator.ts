import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'

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

  const later = () => void nextTick(measure)
  watch(deps, later)
  onMounted(() => {
    later()
    window.addEventListener('resize', measure)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', measure))
  return style
}
