import { describe, expect, it } from 'vitest'
import { errorInfo, intlLocale, pickText, resolveLocale, translate, translateError } from './i18n'
import { en, pt, type Messages } from './messages'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('mensagens', () => {
  it('inglês e português têm exatamente as mesmas chaves, nenhuma vazia', () => {
    expect(keys(en)).toEqual(keys(pt))
    const leaves = (m: Messages) => keys(m).map((k) => k.split('.').reduce<unknown>((o, p) => (o as never)[p], m))
    expect(leaves(pt).every((v) => typeof v === 'string' && v.length > 0)).toBe(true)
    expect(leaves(en).every((v) => typeof v === 'string' && v.length > 0)).toBe(true)
  })
})

describe('resolveLocale', () => {
  it('automático segue o primeiro idioma do sistema; pt* vira português, o resto inglês', () => {
    expect(resolveLocale('auto', ['pt-BR', 'en-US'])).toBe('pt')
    expect(resolveLocale('auto', ['pt'])).toBe('pt')
    expect(resolveLocale('auto', ['en-GB', 'pt-BR'])).toBe('en')
    expect(resolveLocale('auto', ['es-ES'])).toBe('en')
    expect(resolveLocale('auto', [])).toBe('en')
  })

  it('escolha explícita vence o sistema', () => {
    expect(resolveLocale('pt', ['en-US'])).toBe('pt')
    expect(resolveLocale('en', ['pt-BR'])).toBe('en')
  })

  it('mapeia para o locale do Intl', () => {
    expect(intlLocale('pt')).toBe('pt-BR')
    expect(intlLocale('en')).toBe('en-US')
  })
})

describe('translate', () => {
  it('busca por caminho, interpola parâmetros e devolve a chave se faltar', () => {
    expect(translate(pt, 'nav.settings')).toBe('Configurações')
    expect(translate(en, 'nav.settings')).toBe('Settings')
    expect(translate(pt, 'block.env_var', { value: 'CUDA_PATH' })).toBe('variável CUDA_PATH aponta para este caminho')
    expect(translate(en, 'block.env_var', { value: 'CUDA_PATH' })).toBe('variable CUDA_PATH points to this path')
    expect(translate(pt, 'nao.existe')).toBe('nao.existe')
    expect(translate(pt, 'nav')).toBe('nav')
    expect(translate(pt, 'common.items', {})).toBe('{n} itens')
  })

  it('escolhe o texto bilíngue do núcleo pelo idioma', () => {
    expect(pickText({ pt: 'Lixeira', en: 'Trash' }, 'pt')).toBe('Lixeira')
    expect(pickText({ pt: 'Lixeira', en: 'Trash' }, 'en')).toBe('Trash')
  })
})

describe('erros', () => {
  it('normaliza erro do núcleo, Error e texto', () => {
    expect(errorInfo({ code: 'tier_already_run', params: { tier: 'A' } })).toEqual({ code: 'tier_already_run', params: { tier: 'A' } })
    expect(errorInfo({ code: 'no_execution' })).toEqual({ code: 'no_execution', params: {} })
    expect(errorInfo(new Error('sem IPC'))).toEqual({ message: 'sem IPC' })
    expect(errorInfo('texto')).toEqual({ message: 'texto' })
    expect(errorInfo({ outro: 1 })).toEqual({ message: '[object Object]' })
  })

  it('traduz o código; código desconhecido vira mensagem genérica com o código', () => {
    expect(translateError(pt, { code: 'tier_already_run', params: { tier: 'A' } })).toBe('O tier A já foi executado nesta aprovação.')
    expect(translateError(en, { code: 'tier_already_run', params: { tier: 'A' } })).toBe('Tier A was already run in this approval.')
    expect(translateError(en, { code: 'xyz', params: {} })).toBe('Unexpected error (xyz).')
    expect(translateError(pt, { message: 'sem IPC' })).toBe('sem IPC')
  })
})
