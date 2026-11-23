import { useClassificationStore } from './stores/classification'
import { useExecutionStore } from './stores/execution'
import { useExportStore } from './stores/export'
import { usePlanStore } from './stores/plan'
import { useReportStore } from './stores/report'
import { useSurveyStore } from './stores/survey'

/** "Nova análise": a interface volta ao Survey vazio e as abas 2–5 trancam de novo.
 *  Histórico, Configurações, sistema e atualização ficam. No núcleo, a próxima
 *  classificação/plano substitui a sessão (remontar o plano descarta aprovação e execuções). */
export function resetCleanupFlow(): void {
  useSurveyStore().$reset()
  useClassificationStore().$reset()
  usePlanStore().$reset()
  useExecutionStore().$reset()
  useReportStore().$reset()
  useExportStore().$reset()
}
