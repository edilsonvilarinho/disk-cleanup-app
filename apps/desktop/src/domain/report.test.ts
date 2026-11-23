import { describe, expect, it } from 'vitest'
import { translate, type Params } from '../i18n/i18n'
import { en, pt } from '../i18n/messages'
import { report } from '../test/fixtures'
import { reportMarkdown } from './report'

const tPt = (k: string, p?: Params) => translate(pt, k, p)
const tEn = (k: string, p?: Params) => translate(en, k, p)

describe('reportMarkdown', () => {
  it('gera o relatório no modelo da skill, em português', () => {
    const md = reportMarkdown(report, tPt, 'pt')
    expect(md).toContain('# Relatório de limpeza')
    expect(md).toContain('| Livre | 61,6 GB | 86,4 GB | +24,8 GB |')
    expect(md).toContain('| Ocupação | 93,5% | 90,9% | -2,6 p.p. |')
    expect(md).toContain('| A — Cache | +10,6 GB | 11,2 GB |')
    expect(md).toContain('| C — Regeneráveis | +14,2 GB | 14,2 GB |')
    expect(md).toContain('- Rótulo cuda → mantido: variável CUDA_PATH aponta para este caminho')
    expect(md).toContain('- Rótulo nvidia-dxcache (parcial): dx.bin: em uso')
    expect(md).toContain('- `C:\\Windows\\Installer` — cache do MSI')
  })

  it('em inglês usa números, rótulos e motivos em inglês', () => {
    const md = reportMarkdown(report, tEn, 'en')
    expect(md).toContain('# Cleanup report')
    expect(md).toContain('| Free | 61.6 GB | 86.4 GB | +24.8 GB |')
    expect(md).toContain('| Usage | 93.5% | 90.9% | -2.6 pp |')
    expect(md).toContain('| C — Regenerable | +14.2 GB | 14.2 GB |')
    expect(md).toContain('- Label cuda → kept: variable CUDA_PATH points to this path')
    expect(md).toContain('- Label nvidia-dxcache (partial): dx.bin: em uso')
    expect(md).toContain('- `C:\\Windows\\Installer` — MSI cache')
  })

  it('diz "nenhum" nas seções vazias, mostra perda com sinal e item sem causa', () => {
    const noCause = { ...report.pending[0]!, cause: null }
    const md = reportMarkdown(
      { ...report, pending: [noCause], blocked: [{ ...report.blocked[0]!, blocked: null }], exclusions: [], freedBytes: -(1024 ** 3) },
      tPt,
      'pt',
    )
    expect(md).toContain('| Livre | 61,6 GB | 86,4 GB | -1,0 GB |')
    expect(md).toContain('- Rótulo nvidia-dxcache (parcial): \n')
    expect(md).toContain('- Rótulo cuda → mantido: \n')
    expect(md.match(/- nenhum/g)).toHaveLength(1)
    const growth = reportMarkdown({ ...report, last: { ...report.last, usedPercent: 95 } }, tPt, 'pt')
    expect(growth).toContain('+1,5 p.p.')
  })
})
