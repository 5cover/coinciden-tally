import type { Detection, Prevalence } from './detections.js'
import type { Observation } from './model.js'
import type { Detector } from './relations.js'
import { combinationCount, combinations } from './groups.js'
import { canonicalKey } from './signatures.js'

export interface IndexedSubject {
  id: string
  label: string
  observations: ReadonlyMap<string, Observation>
}

export function measurePrevalence(
  population: readonly IndexedSubject[],
  target: readonly string[],
  detections: readonly Detection[],
  detectors: readonly Detector[],
  maxGroups: number
): Detection[] {
  const count = combinationCount(population.length, target.length)
  if (!Number.isSafeInteger(maxGroups) || maxGroups < 1) throw new Error('maxGroups must be a positive safe integer')
  if (count > maxGroups) throw new Error(`Exhaustive enumeration requires ${count} groups; limit is ${maxGroups}`)
  const detectorById = new Map(detectors.map(item => [item.id, item]))
  const counters = detections.map((): Prevalence => ({
    method: 'exhaustive',
    reference: 'other-groups-of-same-size',
    matching: 'structural-class',
    totalOtherGroups: count - 1,
    eligibleOtherGroups: 0,
    missingOtherGroups: 0,
    matches: 0,
    frequency: null,
    exactMatches: 0,
    exactFrequency: null,
  }))
  const targetIds = new Set(target)
  const classes = detections.map(item => canonicalKey(item.signature.class))
  const exact = detections.map(item => canonicalKey(item.signature.parameters))
  for (const group of combinations(population, target.length)) {
    if (group.every(item => targetIds.has(item.id))) continue
    detections.forEach((detection, index) => {
      const counter = counters[index]
      const detector = detectorById.get(detection.relation)
      if (!counter || !detector) throw new Error('Missing prevalence mechanism')
      const values = group.map(item => item.observations.get(detection.expression.id))
      if (values.some(item => !item || item.status === 'missing')) {
        counter.missingOtherGroups++
        return
      }
      counter.eligibleOtherGroups++
      const knownValues = values.flatMap(item => (item?.status === 'known' ? [item.value] : []))
      const signature = detector.detect(knownValues)
      if (signature && canonicalKey(signature.class) === classes[index]) counter.matches++
      if (
        signature &&
        canonicalKey(signature.class) === classes[index] &&
        canonicalKey(signature.parameters) === exact[index]
      )
        counter.exactMatches++
    })
  }
  return detections.map((detection, index) => {
    const counter = counters[index]
    if (!counter) throw new Error('Missing counter')
    counter.frequency = counter.eligibleOtherGroups ? counter.matches / counter.eligibleOtherGroups : null
    counter.exactFrequency = counter.eligibleOtherGroups ? counter.exactMatches / counter.eligibleOtherGroups : null
    return { ...detection, prevalence: counter }
  })
}
