import type { Detection } from './detections.js'

export function debugDetection(detection: Detection): string {
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
    ...(detection.implications.length ? [`implies: ${JSON.stringify(detection.implications)}`] : []),
    ...(detection.explainedBy ? [`explained by conjunction: ${JSON.stringify(detection.explainedBy)}`] : []),
  ].join('\n')
}
