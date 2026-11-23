import { createRouter, createWebHashHistory, type RouterHistory } from 'vue-router'
import ClassifyView from './views/ClassifyView.vue'
import ExecuteView from './views/ExecuteView.vue'
import PlanView from './views/PlanView.vue'
import ReportView from './views/ReportView.vue'
import SurveyView from './views/SurveyView.vue'

export interface Step {
  name: string
  path: string
  label: string
}

export const STEPS: Step[] = [
  { name: 'survey', path: '/', label: 'Survey' },
  { name: 'classify', path: '/classificacao', label: 'Classificação' },
  { name: 'plan', path: '/plano', label: 'Plano' },
  { name: 'execute', path: '/execucao', label: 'Execução' },
  { name: 'report', path: '/relatorio', label: 'Relatório' },
]

/** Hash history: funciona dentro do WebView do Tauri sem servidor. */
export function createAppRouter(history: RouterHistory = createWebHashHistory()) {
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'survey', component: SurveyView },
      { path: '/classificacao', name: 'classify', component: ClassifyView },
      { path: '/plano', name: 'plan', component: PlanView },
      { path: '/execucao', name: 'execute', component: ExecuteView },
      { path: '/relatorio', name: 'report', component: ReportView },
    ],
  })
}
