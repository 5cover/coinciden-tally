import { resolveFact } from './detections.js'
import type { DetectedFact, Detection } from './detections.js'

function formatFact(fact: DetectedFact): string {
  const parameters = fact.signature.parameters
  return `${fact.expression.label} / ${fact.relation}${Object.keys(parameters).length ? ` / ${JSON.stringify(parameters)}` : ''}`
}

/** Supply the same group's detections to display the facts referenced by explainedBy. */
export function debugDetection(detection: Detection, context: readonly Detection[] = [detection]): string {
  const prevalence = detection.prevalence
  const percent = (value: number | null): string => (value === null ? 'n/a' : `${(100 * value).toFixed(2)}%`)
  return [
    detection.subjects.map(item => item.label).join(', '),
    `expression: ${detection.expression.label}`,
    `relation: ${detection.relation}`,
    `signature: ${JSON.stringify(detection.signature)}`,
    ...(prevalence
      ? [
          `prevalence: ${percent(prevalence.frequency)} (${prevalence.matches}/${prevalence.eligibleOtherGroups}; missing ${prevalence.missingOtherGroups})`,
          `exact prevalence: ${percent(prevalence.exactFrequency)}`,
        ]
      : []),
    ...(detection.implications.length
      ? ['implies:', ...detection.implications.map(fact => `  - ${formatFact(fact)}`)]
      : []),
    ...(detection.explainedBy
      ? [
          `explained by conjunction: ${detection.explainedBy
            .map(reference => {
              const fact = resolveFact(reference, context)
              return fact ? formatFact(fact) : `unresolved expression / ${reference.relation}`
            })
            .join(' AND ')}`,
        ]
      : []),
  ].join('\n')
}
