import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { fakeUpdater, updateInfo } from '../test/fakeUpdater'
import { useUpdateStore } from './stores/update'
import { updaterPlugin, type UpdaterPort } from './updater'

function setup(updater: UpdaterPort = fakeUpdater()) {
  const pinia = createPinia()
  pinia.use(updaterPlugin(updater))
  createApp({}).use(pinia)
  setActivePinia(pinia)
  return { store: useUpdateStore(), updater }
}

describe('update store', () => {
  it('na abertura com atualização automática: lê a versão, verifica e baixa em segundo plano', async () => {
    const { store, updater } = setup(fakeUpdater({ check: vi.fn(async () => updateInfo) }))
    await store.startup(true, true)
    expect(store.version).toBe('0.1.0')
    expect(updater.check).toHaveBeenCalledWith(true)
    expect(store.status).toBe('ready')
    expect(store.available).toEqual(updateInfo)
    expect(store.progress).toEqual({ downloaded: 100, total: 100, percent: 100 })
    expect(store.busy).toBe(false)
  })

  it('sem atualização automática só lê a versão', async () => {
    const { store, updater } = setup()
    await store.startup(false, false)
    expect(store.version).toBe('0.1.0')
    expect(updater.check).not.toHaveBeenCalled()
    expect(store.status).toBe('idle')
  })

  it('verificação sem novidade fica "em dia"; sem versão legível a versão fica nula', async () => {
    const { store } = setup(fakeUpdater({ appVersion: vi.fn(async () => Promise.reject(new Error('sem IPC'))) }))
    await store.startup(true, false)
    expect(store.version).toBeNull()
    expect(store.status).toBe('upToDate')
    expect(store.available).toBeNull()
  })

  it('falha da verificação guarda o erro do núcleo', async () => {
    const check = vi.fn(async () => Promise.reject({ code: 'update_feed', params: { detail: 'offline' } }))
    const { store } = setup(fakeUpdater({ check }))
    await store.check(false)
    expect(store.status).toBe('error')
    expect(store.error).toEqual({ code: 'update_feed', params: { detail: 'offline' } })
  })

  it('download e instalação só andam no estado certo e guardam falhas', async () => {
    const download = vi.fn(async () => Promise.reject(new Error('rede caiu')))
    const { store, updater } = setup(fakeUpdater({ check: vi.fn(async () => updateInfo), download }))
    await store.download()
    await store.install()
    expect(download).not.toHaveBeenCalled()
    expect(updater.install).not.toHaveBeenCalled()

    await store.check(false)
    expect(store.status).toBe('available')
    await store.download()
    expect(store.status).toBe('error')
    expect(store.error).toEqual({ message: 'rede caiu' })
  })

  it('instala a versão baixada; falha na instalação volta como erro', async () => {
    const install = vi.fn(async () => Promise.reject({ code: 'update', params: { detail: 'assinatura inválida' } }))
    const { store } = setup(fakeUpdater({ check: vi.fn(async () => updateInfo), install }))
    await store.startup(true, false)
    expect(store.status).toBe('ready')
    await store.install()
    expect(install).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('error')
    expect(store.error).toEqual({ code: 'update', params: { detail: 'assinatura inválida' } })
  })

  it('não verifica de novo enquanto uma operação está em curso', async () => {
    let release: (value: null) => void = () => {}
    const check = vi.fn(() => new Promise<null>((resolve) => (release = resolve)))
    const { store } = setup(fakeUpdater({ check }))
    const first = store.check(false)
    expect(store.busy).toBe(true)
    await store.check(false)
    expect(check).toHaveBeenCalledTimes(1)
    release(null)
    await first
    expect(store.status).toBe('upToDate')
  })
})
