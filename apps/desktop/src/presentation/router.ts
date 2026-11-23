import { createRouter, createWebHashHistory, type RouterHistory } from 'vue-router'
import ClassifyView from './views/ClassifyView.vue'
import PendingView from './views/PendingView.vue'
import PlanView from './views/PlanView.vue'
import SurveyView from './views/SurveyView.vue'

export interface Step {
  name: string
  path: string
  label: string
  soon?: boolean
}

export const STEPS: Step[] = [
  { name: 'survey', path: '/', label: 'Survey' },
  { name: 'classify', path: '/classificacao', label: 'Classificação' },
  { name: 'plan', path: '/plano', label: 'Plano' },
  { name: 'execute', path: '/execucao', label: 'Execução', soon: true },
  { name: 'report', path: '/relatorio', label: 'Relatório', soon: true },
]

/** Hash history: funciona dentro do WebView do Tauri sem servidor. */
export function createAppRouter(history: RouterHistory = createWebHashHistory()) {
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'survey', component: SurveyView },
      { path: '/classificacao', name: 'classify', component: ClassifyView },
      { path: '/plano', name: 'plan', component: PlanView },
      {
        path: '/execucao',
        name: 'execute',
        component: PendingView,
        props: {
          title: 'Execução',
          description:
            'Execução tier a tier com medição antes/depois, helper elevado para desinstaladores e DISM. Entra na próxima fase.',
        },
      },
      {
        path: '/relatorio',
        name: 'report',
        component: PendingView,
        props: {
          title: 'Relatório',
          description: 'Antes/depois, delta por tier, decisões divergentes e verificação de integridade. Entra na próxima fase.',
        },
      },
    ],
  })
}
