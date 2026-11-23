// Fluxo guiado: cada etapa só é liberada quando o pré-requisito dela foi cumprido.
// Pré-requisitos são independentes (não em cadeia): rever o Plano descarta a
// aprovação no núcleo e tranca a Execução, mas o Relatório de tiers já
// executados continua acessível.

export type StepName = 'survey' | 'classify' | 'plan' | 'execute' | 'report'

export const STEP_ORDER: readonly StepName[] = ['survey', 'classify', 'plan', 'execute', 'report']

export interface FlowFacts {
  surveyDone: boolean
  /** Classificação carregada com ao menos um item selecionável marcado. */
  hasSelection: boolean
  approved: boolean
  executedAny: boolean
  executionFinished: boolean
}

export interface StepState {
  name: StepName
  unlocked: boolean
  done: boolean
  /** Etapa cujo cumprimento libera esta; `null` para a primeira. */
  requires: StepName | null
}

export function flowStates(f: FlowFacts): StepState[] {
  const unlocked: Record<StepName, boolean> = {
    survey: true,
    classify: f.surveyDone,
    plan: f.hasSelection,
    execute: f.approved,
    report: f.executedAny,
  }
  const done: Record<StepName, boolean> = {
    survey: f.surveyDone,
    classify: f.hasSelection,
    plan: f.approved,
    execute: f.executionFinished,
    report: false,
  }
  return STEP_ORDER.map((name, i) => ({
    name,
    unlocked: unlocked[name],
    done: done[name],
    requires: i === 0 ? null : STEP_ORDER[i - 1]!,
  }))
}
