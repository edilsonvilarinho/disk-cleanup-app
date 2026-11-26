import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useActiveIndicator } from './activeIndicator'

describe('useActiveIndicator', () => {
  it('some sem item ativo e acompanha o item marcado; a primeira medição não anima', async () => {
    const current = ref<number | null>(null)
    let style: ReturnType<typeof useActiveIndicator> | null = null
    const Probe = defineComponent({
      setup() {
        const el = ref<HTMLElement | null>(null)
        style = useActiveIndicator(el, () => current.value)
        return () => h('nav', { ref: el }, [0, 1].map((i) => h('a', current.value === i ? { 'aria-current': 'page' } : {}, `item ${i}`)))
      },
    })
    const wrapper = mount(Probe, { attachTo: document.body })
    await nextTick()
    await nextTick()
    expect(style!.value).toEqual({ opacity: '0' })
    current.value = 1
    await nextTick()
    await nextTick()
    expect(style!.value.opacity).toBe('1')
    expect(style!.value.transition).toBe('none')
    window.dispatchEvent(new Event('resize'))
    expect(style!.value.transition).toBeUndefined()
    wrapper.unmount()
  })
})
