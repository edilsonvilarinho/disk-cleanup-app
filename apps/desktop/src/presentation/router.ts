import { createRouter, createWebHashHistory, type RouterHistory } from 'vue-router'
import SurveyView from './views/SurveyView.vue'

export interface Step {
  name: string
  path: string
}

export const STEPS: Step[] = [
  { name: 'survey', path: '/' },
  { name: 'classify', path: '/classificacao' },
  { name: 'plan', path: '/plano' },
  { name: 'execute', path: '/execucao' },
  { name: 'report', path: '/relatorio' },
]

/** Etapa do fluxo de limpeza (as abas só aparecem nelas). */
export const isFlowStep = (name: unknown): boolean => STEPS.some((s) => s.name === name)

/** Telas fora da inicial carregam sob demanda (code splitting).
 *  Hash history: funciona dentro do WebView do Tauri sem servidor. */
export function createAppRouter(history: RouterHistory = createWebHashHistory()) {
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'survey', component: SurveyView },
      { path: '/classificacao', name: 'classify', component: () => import('./views/ClassifyView.vue') },
      { path: '/plano', name: 'plan', component: () => import('./views/PlanView.vue') },
      { path: '/execucao', name: 'execute', component: () => import('./views/ExecuteView.vue') },
      { path: '/relatorio', name: 'report', component: () => import('./views/ReportView.vue') },
      { path: '/historico', name: 'history', component: () => import('./views/HistoryView.vue') },
      { path: '/configuracoes', name: 'settings', component: () => import('./views/SettingsView.vue') },
    ],
  })
}
