import { describe, expect, it } from 'vitest'
import { report } from '../test/fixtures'
import { reportMarkdown } from './report'

describe('reportMarkdown', () => {
  it('gera o relatório no modelo da skill: resultado, tiers, divergências, pendências e exclusões', () => {
    const md = reportMarkdown(report)
    expect(md).toContain('# Relatório de limpeza')
    expect(md).toContain('| Livre | 61,6 GB | 86,4 GB | +24,8 GB |')
    expect(md).toContain('| Ocupação | 93,5% | 90,9% | -2,6 p.p. |')
    expect(md).toContain('| A — Cache | +10,6 GB | 11,2 GB |')
    expect(md).toContain('| C — Regeneráveis | +14,2 GB | 14,2 GB |')
    expect(md).toContain('- Rótulo cuda → mantido: variável CUDA_PATH aponta para este caminho')
    expect(md).toContain('- Rótulo nvidia-dxcache (parcial): dx.bin: em uso')
    expect(md).toContain('- `C:\\Windows\\Installer` — cache do MSI')
  })

  it('diz "nenhum" nas seções vazias e mostra perda de espaço com sinal', () => {
    const md = reportMarkdown({ ...report, pending: [], blocked: [], exclusions: [], freedBytes: -(1024 ** 3) })
    expect(md).toContain('| Livre | 61,6 GB | 86,4 GB | -1,0 GB |')
    expect(md.match(/- nenhum/g)).toHaveLength(3)
  })
})
