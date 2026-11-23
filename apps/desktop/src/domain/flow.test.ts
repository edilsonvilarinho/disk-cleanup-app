import { describe, expect, it } from 'vitest'
import { flowStates, type FlowFacts } from './flow'

const none: FlowFacts = { surveyDone: false, hasSelection: false, approved: false, executedAny: false, executionFinished: false }
const unlocked = (f: FlowFacts) => flowStates(f).filter((s) => s.unlocked).map((s) => s.name)
const done = (f: FlowFacts) => flowStates(f).filter((s) => s.done).map((s) => s.name)

describe('flowStates', () => {
  it('libera só o Survey no início', () => {
    expect(unlocked(none)).toEqual(['survey'])
    expect(done(none)).toEqual([])
    expect(flowStates(none)[0]!.requires).toBeNull()
    expect(flowStates(none)[2]!.requires).toBe('classify')
  })

  it('libera cada etapa pelo seu pré-requisito', () => {
    expect(unlocked({ ...none, surveyDone: true })).toEqual(['survey', 'classify'])
    expect(unlocked({ ...none, surveyDone: true, hasSelection: true })).toEqual(['survey', 'classify', 'plan'])
    const approved = { ...none, surveyDone: true, hasSelection: true, approved: true }
    expect(unlocked(approved)).toEqual(['survey', 'classify', 'plan', 'execute'])
    expect(done(approved)).toEqual(['survey', 'classify', 'plan'])
  })

  it('mantém o Relatório após executar mesmo com a aprovação descartada', () => {
    const f = { ...none, surveyDone: true, hasSelection: true, executedAny: true, executionFinished: true }
    expect(unlocked(f)).toEqual(['survey', 'classify', 'plan', 'report'])
    expect(done(f)).toEqual(['survey', 'classify', 'execute'])
  })
})
