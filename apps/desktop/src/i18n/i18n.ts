// Tradução sem dependências: dicionários tipados, interpolação `{param}` e
// erros do núcleo como código + parâmetros.
import type { Messages } from './messages'

export type Locale = 'pt' | 'en'
export type LanguagePreference = 'auto' | Locale
export type Params = Record<string, string | number>

export interface TextLike {
  pt: string
  en: string
}

/** Erro já normalizado: código do núcleo (traduzível) ou mensagem crua. */
export type ErrorInfo = { code: string; params: Record<string, string> } | { message: string }

/** Automático: o primeiro idioma do sistema decide; português se começar com `pt`, senão inglês. */
export function resolveLocale(preference: LanguagePreference, systemLanguages: readonly string[]): Locale {
  if (preference !== 'auto') return preference
  return systemLanguages[0]?.toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

export function intlLocale(locale: Locale): string {
  return locale === 'pt' ? 'pt-BR' : 'en-US'
}

export function translate(messages: Messages, key: string, params: Params = {}): string {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages)
  if (typeof value !== 'string') return key
  return value.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

export function pickText(text: TextLike, locale: Locale): string {
  return text[locale]
}

export function errorInfo(error: unknown): ErrorInfo {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    const params = 'params' in error && typeof error.params === 'object' && error.params !== null ? error.params : {}
    return { code: error.code, params: params as Record<string, string> }
  }
  if (error instanceof Error) return { message: error.message }
  return { message: String(error) }
}

export function translateError(messages: Messages, info: ErrorInfo): string {
  if ('message' in info) return info.message
  const key = `errors.${info.code}`
  const text = translate(messages, key, info.params)
  return text === key ? translate(messages, 'errors.unknown', { code: info.code }) : text
}
