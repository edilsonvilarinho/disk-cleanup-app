import { computed, inject, type InjectionKey } from 'vue'
import { useSettingsStore } from '../application/stores/settings'
import { formatCount, formatDate, formatDay, formatDuration, formatGb, formatPercent, formatSignedGb } from '../domain/format'
import type { TextDto } from '../domain/models'
import {
  intlLocale,
  pickText,
  resolveLocale,
  translate,
  translateError,
  type ErrorInfo,
  type Params,
} from '../i18n/i18n'
import { MESSAGES } from '../i18n/messages'

/** Idiomas do sistema (no app: `navigator.languages`, que segue o SO). */
export const SYSTEM_LANGUAGES_KEY: InjectionKey<() => readonly string[]> = Symbol('systemLanguages')

const fromNavigator = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]

export function useI18n() {
  const settings = useSettingsStore()
  const systemLanguages = inject(SYSTEM_LANGUAGES_KEY, fromNavigator)
  const locale = computed(() => resolveLocale(settings.language, systemLanguages()))
  const systemLocale = computed(() => resolveLocale('auto', systemLanguages()))
  const intl = computed(() => intlLocale(locale.value))
  const messages = computed(() => MESSAGES[locale.value])
  return {
    locale,
    systemLocale,
    t: (key: string, params?: Params) => translate(messages.value, key, params),
    txt: (text: TextDto) => pickText(text, locale.value),
    err: (info: ErrorInfo) => translateError(messages.value, info),
    gb: (bytes: number, digits = 1) => formatGb(bytes, digits, intl.value),
    num: (bytes: number) => formatGb(bytes, 1, intl.value).replace(' GB', ''),
    signedGb: (bytes: number) => formatSignedGb(bytes, 1, intl.value),
    pct: (value: number) => formatPercent(value, 1, intl.value),
    count: (value: number) => formatCount(value, intl.value),
    duration: (ms: number) => formatDuration(ms, intl.value),
    date: (iso: string, withTime = true) => formatDate(iso, withTime, intl.value),
    day: (day: string) => formatDay(day, intl.value),
  }
}
