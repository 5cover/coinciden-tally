import type { Expression, Scalar } from './model.js'
import type { Signature } from './signatures.js'

/** Register a deterministic, permutation-invariant N-ary mechanism and fixed classes. */
export interface Detector {
  id: string
  accepts: (expression: Expression, size: number) => boolean
  detect: (values: readonly Scalar[]) => Signature | null
  implies?: readonly string[]
}

const equality: Detector = {
  id: 'allEqual',
  accepts: (_expression, size) => size >= 2,
  detect: values =>
    values.every(value => value === values[0]) ? { parameters: { value: values[0] ?? '' }, class: {} } : null,
}
const distinct: Detector = {
  id: 'allDistinct',
  accepts: (_expression, size) => size >= 2,
  detect: values => (new Set(values).size === values.length ? { parameters: {}, class: {} } : null),
}
const gap: Detector = {
  id: 'pairGap',
  accepts: (expression, size) => expression.kind === 'number' && size === 2,
  detect: values => {
    const sorted = values.map(Number).sort((a, b) => a - b)
    const delta = (sorted[1] ?? 0) - (sorted[0] ?? 0)
    if (!Number.isFinite(delta)) throw new Error('Non-finite gap')
    return delta > 0 ? { parameters: { gap: delta }, class: {} } : null
  },
  implies: ['allDistinct'],
}
const spacing: Detector = {
  id: 'regularSpacing',
  accepts: (expression, size) => expression.kind === 'number' && size >= 3,
  detect: values => {
    const sorted = values.map(Number).sort((a, b) => a - b)
    const step = (sorted[1] ?? 0) - (sorted[0] ?? 0)
    if (!Number.isFinite(step)) throw new Error('Non-finite step')
    return step > 0 && sorted.slice(1).every((value, index) => value - (sorted[index] ?? 0) === step)
      ? { parameters: { step }, class: {} }
      : null
  },
  implies: ['allDistinct'],
}

export const defaultDetectors: readonly Detector[] = [equality, distinct, gap, spacing]
