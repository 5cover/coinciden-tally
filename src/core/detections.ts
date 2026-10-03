import type { CompiledExpression } from './expressions.js'
import type { Observation } from './model.js'
import { canonicalKey } from './signatures.js'
import type { Signature } from './signatures.js'

export interface Prevalence {
  method: 'exhaustive'
  reference: 'other-groups-of-same-size'
  matching: 'structural-class'
  totalOtherGroups: number
  eligibleOtherGroups: number
  missingOtherGroups: number
  matches: number
  frequency: number | null
  exactMatches: number
  exactFrequency: number | null
}

/** A fact keeps its expression inspectable even when its detection is suppressed. */
export interface DetectedFact {
  expression: CompiledExpression
  relation: string
  signature: Signature
}

/** Resolved against detections and their implications within the same subject group. */
export interface FactReference {
  expressionId: string
  relation: string
}

export interface Detection extends DetectedFact {
  subjects: readonly { id: string; label: string }[]
  observations: readonly Observation[]
  implications: readonly DetectedFact[]
  /** A conjunction of equalities that logically entails this interval equality. */
  explainedBy?: readonly FactReference[]
  prevalence?: Prevalence
}

/** Resolve a reference within a single subject group's detections, including suppressed facts. */
export function resolveFact(reference: FactReference, detections: readonly Detection[]): DetectedFact | undefined {
  for (const detection of detections) {
    for (const fact of [detection, ...detection.implications]) {
      if (fact.expression.id === reference.expressionId && fact.relation === reference.relation) return fact
    }
  }
  return undefined
}

function isCalendarProjectionOf(projection: CompiledExpression, source: CompiledExpression): boolean {
  const node = projection.node
  const sourceNode = source.node
  return (
    node.op === 'datePart' &&
    (canonicalKey(node.input) === source.id ||
      (node.part === 'month' &&
        sourceNode.op === 'datePart' &&
        sourceNode.part === 'monthDay' &&
        canonicalKey(node.input) === canonicalKey(sourceNode.input)))
  )
}

/** Only explicit, sound implications are suppressed; no statistical independence claim. */
export function mergeImplications(
  detections: readonly Detection[],
  implies: ReadonlyMap<string, readonly string[]>
): Detection[] {
  const suppressed = new Set<Detection>()
  const result = detections.map(detection => ({
    ...detection,
    implications: [...detection.implications],
  }))
  for (const detection of result) {
    const node = detection.expression.node
    if (detection.relation !== 'allEqual' || node.op !== 'interval') continue
    const parents = [node.from, node.to].map(operand =>
      result.find(item => item.relation === 'allEqual' && item.expression.id === canonicalKey(operand))
    )
    if (parents.every(parent => parent !== undefined)) {
      detection.explainedBy = parents.map(parent => ({
        expressionId: parent.expression.id,
        relation: parent.relation,
      }))
    }
  }
  for (const stronger of result) {
    for (const weaker of result) {
      if (stronger === weaker) continue
      const sameExpression = stronger.expression.id === weaker.expression.id
      const equalityProjection =
        stronger.relation === 'allEqual' &&
        weaker.relation === 'allEqual' &&
        isCalendarProjectionOf(weaker.expression, stronger.expression)
      // Distinct projected values entail distinct inputs, not the other way around.
      const distinctProjection =
        stronger.relation === 'allDistinct' &&
        weaker.relation === 'allDistinct' &&
        isCalendarProjectionOf(stronger.expression, weaker.expression)
      if (
        equalityProjection ||
        distinctProjection ||
        (sameExpression && implies.get(stronger.relation)?.includes(weaker.relation))
      ) {
        suppressed.add(weaker)
        stronger.implications.push({
          expression: weaker.expression,
          relation: weaker.relation,
          signature: weaker.signature,
        })
      }
    }
  }
  // Retain transitive suppressed facts on the surviving detection too.
  const byFact = new Map(result.map(item => [`${item.expression.id}:${item.relation}`, item]))
  return result
    .filter(item => !suppressed.has(item))
    .map(item => {
      const facts = new Map(item.implications.map(fact => [`${fact.expression.id}:${fact.relation}`, fact]))
      for (const [key] of facts) {
        for (const fact of byFact.get(key)?.implications ?? [])
          facts.set(`${fact.expression.id}:${fact.relation}`, fact)
      }
      return { ...item, implications: [...facts.values()] }
    })
}

export function byPrevalence(a: Detection, b: Detection): number {
  return (
    (a.prevalence?.frequency ?? Infinity) - (b.prevalence?.frequency ?? Infinity) ||
    a.expression.id.localeCompare(b.expression.id) ||
    a.relation.localeCompare(b.relation)
  )
}
