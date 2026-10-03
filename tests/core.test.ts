import assert from 'node:assert/strict'
import test from 'node:test'
import { debugDetection as packagedDebugDetection } from 'coinciden-tally'
import {
  CoincidenceEngine,
  Observations,
  canonicalKey,
  combinations,
  combinationCount,
  datePart,
  debugDetection,
  field,
  interval,
  known,
  missing,
  resolveFact,
} from '../src/index.js'
import type { Detection, Domain, Observation, Schema } from '../src/index.js'

interface Item {
  id: string
  x: number | null
  y: number
  category: string
  stored?: number
}
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing test fixture or detection')
  return value
}
const x = field<Item, 'number'>('x', 'number', item => (item.x === null ? missing('unknown x') : known(item.x)), {
  unit: 'year',
})
const y = field<Item, 'number'>('y', 'number', item => known(item.y), {
  unit: 'year',
})
const category = field<Item, 'category'>('category', 'category', item => known(item.category))
function domain(
  instances: Item[],
  schema: Schema<Item> = {
    fields: [x, y, category],
    intervals: [{ from: x, to: y }],
  }
): Domain<Item> {
  return {
    id: 'synthetic',
    instances,
    identify: item => item.id,
    label: item => item.id,
    schema,
  }
}
const items: Item[] = [
  { id: 'a', x: 10, y: 58, category: 'A' },
  { id: 'b', x: 15, y: 63, category: 'A' },
  { id: 'c', x: 20, y: 68, category: 'B' },
  { id: 'd', x: 31, y: 80, category: 'B' },
]

test('pairs: equality and gap, never a two-point regularity; independent of order', () => {
  const engine = new CoincidenceEngine(domain(items))
  const detections = engine.detect(['a', 'b'])
  assert.deepEqual(detections, engine.detect(['b', 'a']))
  assert.ok(detections.some(item => item.relation === 'allEqual' && item.expression.label === 'category'))
  assert.ok(detections.some(item => item.relation === 'pairGap' && item.signature.parameters.gap === 5))
  assert.ok(detections.every(item => item.relation !== 'regularSpacing'))
  assert.ok(
    detections.find(item => item.relation === 'pairGap')?.implications.some(item => item.relation === 'allDistinct')
  )
  const gap = required(detections.find(item => item.expression.label === 'x' && item.relation === 'pairGap'))
  const distinct = required(gap.implications.find(item => item.relation === 'allDistinct'))
  assert.deepEqual(distinct.expression, gap.expression)
  assert.deepEqual(distinct.signature, { parameters: {}, class: {} })
  const display = debugDetection(gap)
  assert.ok(display.includes('implies:\n  - x / allDistinct'))
  assert.ok(!display.includes(gap.expression.id))
  assert.equal(packagedDebugDetection(gap), display)
})

test('N>2: positive sorted regularity and a discovered cross-field interval', () => {
  const engine = new CoincidenceEngine(domain(items))
  const detections = engine.detect(['c', 'a', 'b'])
  const spacing = detections.find(item => item.expression.label === 'x' && item.relation === 'regularSpacing')
  assert.equal(spacing?.signature.parameters.step, 5)
  assert.ok(required(spacing).implications.some(item => item.relation === 'allDistinct'))
  const derived = detections.find(item => item.expression.label === 'interval(x, y)' && item.relation === 'allEqual')
  assert.equal(derived?.signature.parameters.value, 48)
  assert.ok(
    engine.detect(['a', 'b', 'd']).some(item => item.expression.label === 'x' && item.relation === 'allDistinct')
  )
  assert.ok(
    !engine.detect(['a', 'b', 'd']).some(item => item.expression.label === 'x' && item.relation === 'regularSpacing')
  )
})

test('zero spacing is represented once as allEqual; duplicate values are not regular', () => {
  const same = items.map(item => ({ ...item, x: 4 }))
  const engine = new CoincidenceEngine(domain(same))
  assert.deepEqual(
    engine
      .detect(['a', 'b', 'c'])
      .filter(item => item.expression.label === 'x')
      .map(item => item.relation),
    ['allEqual']
  )
  assert.ok(
    !new CoincidenceEngine(
      domain([
        { ...items[0], id: 'a', x: 1, y: 2, category: 'A' },
        { id: 'b', x: 1, y: 2, category: 'B' },
        { id: 'c', x: 2, y: 3, category: 'C' },
      ])
    )
      .detect(['a', 'b', 'c'])
      .some(item => item.expression.label === 'x')
  )
})

test('canonical aliases are fused, checked, and cannot substitute for unavailable inputs', () => {
  const offset = interval(x, y)
  const stored = field<Item, 'number'>(
    'stored',
    'number',
    item => (item.stored === undefined ? missing() : known(item.stored)),
    { unit: 'year', definedAs: offset }
  )
  const schema = { fields: [x, y, stored], expressions: [offset] }
  const engine = new CoincidenceEngine(
    domain(
      items.map(item => ({ ...item, stored: item.y - (item.x ?? 0) })),
      schema
    )
  )
  const matches = engine.detect(['a', 'b', 'c']).filter(item => item.expression.node.op === 'interval')
  assert.equal(matches.length, 1)
  assert.deepEqual(new Set(matches[0]?.expression.aliases), new Set(['stored', 'interval(x, y)']))
  assert.throws(
    () => new CoincidenceEngine(domain([{ id: 'a', x: 10, y: 58, category: 'A', stored: 99 }], schema)),
    /disagrees/
  )
  const incomplete = new CoincidenceEngine(
    domain([{ id: 'a', x: null, y: 58, category: 'A', stored: 48 }, required(items[1])], schema)
  )
  assert.ok(!incomplete.detect(['a', 'b']).some(item => item.expression.node.op === 'interval'))
})

test('exact and structural prevalence differ; target is excluded; zeros are genuine', () => {
  const engine = new CoincidenceEngine(domain(items))
  const match = engine
    .analyze(['a', 'b'])
    .find(item => item.expression.label === 'category' && item.relation === 'allEqual')
  assert.deepEqual(match?.prevalence, {
    method: 'exhaustive',
    reference: 'other-groups-of-same-size',
    matching: 'structural-class',
    totalOtherGroups: 5,
    eligibleOtherGroups: 5,
    missingOtherGroups: 0,
    matches: 1,
    frequency: 1 / 5,
    exactMatches: 0,
    exactFrequency: 0,
  })
  const spacing = engine
    .analyze(['a', 'b', 'c'])
    .find(item => item.expression.label === 'x' && item.relation === 'regularSpacing')
  const prevalence = required(required(spacing).prevalence)
  assert.equal(prevalence.matches, 0)
  assert.equal(prevalence.eligibleOtherGroups, 3)
  assert.equal(prevalence.frequency, 0)
})

test('missing observations are not equal; prevalence uses eligible N-groups and reports coverage', () => {
  const population: Item[] = [
    { id: 'a', x: 2, y: 3, category: 'A' },
    { id: 'b', x: 2, y: 3, category: 'A' },
    { id: 'c', x: 2, y: 3, category: 'B' },
    { id: 'd', x: null, y: 3, category: 'B' },
  ]
  const engine = new CoincidenceEngine(domain(population))
  assert.ok(
    !engine.detect(['c', 'd']).some(item => item.expression.label === 'x' || item.expression.node.op === 'interval')
  )
  const prevalence = required(engine.analyze(['a', 'b']).find(item => item.expression.label === 'x')?.prevalence)
  assert.equal(prevalence.totalOtherGroups, 5)
  assert.equal(prevalence.missingOtherGroups, 3)
  assert.equal(prevalence.eligibleOtherGroups, 2)
  assert.equal(prevalence.frequency, 1)
})

test('empty reference population returns null, not zero; bounds and invalid groups fail explicitly', () => {
  const engine = new CoincidenceEngine(domain(items.slice(0, 2)))
  assert.ok(engine.analyze(['a', 'b']).every(item => item.prevalence?.frequency === null))
  assert.throws(() => engine.detect(['a']), /at least two/)
  assert.throws(() => engine.detect(['a', 'a']), /distinct/)
  assert.throws(() => engine.detect(['a', 'z']), /Unknown subject/)
  assert.throws(
    () =>
      new CoincidenceEngine(domain(items)).analyze(['a', 'b'], {
        maxGroups: 2,
      }),
    /requires 6/
  )
})

test('date parts, intervals, leap dates, implication pruning and provenance', () => {
  interface D {
    id: string
    start: Observation<string>
    end: Observation<string>
  }
  const source = {
    url: 'https://example.test/facts',
    locator: 'start',
    retrievedAt: '2026-10-03',
  }
  const start = field<D, 'date'>('start', 'date', item => item.start)
  const end = field<D, 'date'>('end', 'date', item => item.end)
  const instances: D[] = [
    { id: 'a', start: known('2000-02-29', [source]), end: known('2000-03-01') },
    { id: 'b', start: known('2000-02-29', [source]), end: known('2000-03-01') },
  ]
  const engine = new CoincidenceEngine({
    id: 'dates',
    instances,
    schema: { fields: [start, end], intervals: [{ from: start, to: end }] },
    identify: item => item.id,
    label: item => item.id,
  })
  const detections = engine.detect(['a', 'b'])
  assert.ok(!detections.some(item => item.expression.node.op === 'datePart'))
  const startEquality = required(detections.find(item => item.expression.label === 'start'))
  assert.equal(startEquality.implications.length, 3)
  for (const part of ['year', 'month', 'monthDay'] as const) {
    const implied = required(startEquality.implications.find(item => item.expression.label === `${part}(start)`))
    assert.deepEqual(implied.expression.node, { op: 'datePart', input: start.node, part })
    assert.equal(implied.expression.kind, part === 'year' ? 'number' : 'category')
    assert.equal(implied.expression.unit, part === 'year' ? 'year' : undefined)
    assert.deepEqual(implied.expression.aliases, [`${part}(start)`])
    assert.equal(implied.relation, 'allEqual')
    assert.equal(implied.signature.parameters.value, part === 'year' ? 2000 : part === 'month' ? '02' : '02-29')
  }
  const exported = JSON.parse(JSON.stringify(detections)) as Detection[]
  const facts = exported.flatMap(item => [item, ...item.implications])
  for (const detection of exported) {
    for (const reference of detection.explainedBy ?? []) {
      assert.ok(
        facts.some(fact => fact.expression.id === reference.expressionId && fact.relation === reference.relation)
      )
      const resolved = resolveFact(reference, exported)
      assert.equal(resolved?.expression.id, reference.expressionId)
      assert.equal(resolved.relation, reference.relation)
    }
  }
  const yearInterval = required(exported.find(item => item.expression.label === 'interval(year(start), year(end))'))
  assert.equal(yearInterval.explainedBy?.length, 2)
  assert.ok(
    yearInterval.explainedBy.every(reference =>
      exported.some(item =>
        item.implications.some(
          fact => fact.expression.id === reference.expressionId && fact.relation === reference.relation
        )
      )
    )
  )
  const display = debugDetection(yearInterval, exported)
  assert.ok(
    display.includes(
      'explained by conjunction: year(start) / allEqual / {"value":2000} AND year(end) / allEqual / {"value":2000}'
    )
  )
  for (const fact of facts) assert.ok(!display.includes(fact.expression.id))
  const standalone = debugDetection(yearInterval)
  assert.ok(standalone.includes('unresolved expression / allEqual'))
  assert.equal(resolveFact({ expressionId: startEquality.expression.id, relation: 'pairGap' }, exported), undefined)
  const impliedDisplay = debugDetection(startEquality)
  assert.ok(impliedDisplay.includes('year(start) / allEqual / {"value":2000}'))
  assert.ok(impliedDisplay.includes('month(start) / allEqual / {"value":"02"}'))
  assert.equal(detections.find(item => item.expression.label === 'interval(start, end)')?.signature.parameters.value, 1)
  assert.deepEqual(
    detections.find(item => item.expression.label === 'interval(start, end)')?.observations[0]?.sources,
    [source]
  )
  assert.throws(
    () =>
      new Observations({ fields: [start] }).evaluate({
        ...required(instances[0]),
        start: known('2001-02-29'),
      }),
    /Invalid date/
  )
  const varied = new CoincidenceEngine({
    ...engine.domain,
    instances: [required(instances[0]), { ...required(instances[1]), start: known('2004-02-29') }],
  })
  const monthDay = varied.detect(['a', 'b']).find(item => item.expression.label === 'monthDay(start)')
  assert.ok(monthDay?.implications.some(item => item.relation === 'allEqual'))
})

test('distinct calendar projections imply distinct inputs, including transitive year relations', () => {
  const date = field<{ id: string; date: string }, 'date'>('date', 'date', item => known(item.date))
  const detectDates = (dates: string[]): Detection[] => {
    const instances = dates.map((value, index) => ({ id: String(index), date: value }))
    return new CoincidenceEngine({
      id: 'calendar-projections',
      instances,
      schema: { fields: [date] },
      identify: item => item.id,
      label: item => item.id,
    }).detect(instances.map(item => item.id))
  }
  const differentMonths = detectDates(['2000-01-01', '2000-02-02', '2000-03-03'])
  const month = required(differentMonths.find(item => item.expression.label === 'month(date)'))
  assert.equal(month.relation, 'allDistinct')
  for (const label of ['monthDay(date)', 'date']) {
    assert.ok(!differentMonths.some(item => item.expression.label === label))
    assert.ok(month.implications.some(fact => fact.expression.label === label && fact.relation === 'allDistinct'))
  }

  const differentDays = detectDates(['2000-01-01', '2000-01-02', '2000-01-03'])
  const monthDay = required(differentDays.find(item => item.expression.label === 'monthDay(date)'))
  assert.ok(monthDay.implications.some(fact => fact.expression.label === 'date' && fact.relation === 'allDistinct'))
  assert.equal(differentDays.find(item => item.expression.label === 'month(date)')?.relation, 'allEqual')

  for (const dates of [
    ['2000-01-01', '2005-01-01'],
    ['2000-01-01', '2005-01-01', '2010-01-01'],
  ]) {
    const detections = detectDates(dates)
    const year = required(detections.find(item => item.expression.label === 'year(date)'))
    assert.equal(year.relation, dates.length === 2 ? 'pairGap' : 'regularSpacing')
    assert.ok(!detections.some(item => item.expression.label === 'date'))
    for (const label of ['year(date)', 'date']) {
      assert.ok(year.implications.some(fact => fact.expression.label === label && fact.relation === 'allDistinct'))
    }
  }
})

test('distinct dates do not imply distinct projections, and calendar implications do not cross fields', () => {
  const start = field<{ id: string; start: string; end: string }, 'date'>('start', 'date', item => known(item.start))
  const end = field<{ id: string; start: string; end: string }, 'date'>('end', 'date', item => known(item.end))
  const detections = new CoincidenceEngine({
    id: 'independent-dates',
    instances: [
      { id: 'a', start: '2000-01-01', end: '2000-01-01' },
      { id: 'b', start: '2000-02-02', end: '2000-01-02' },
      { id: 'c', start: '2000-03-03', end: '2001-01-01' },
    ],
    schema: { fields: [start, end] },
    identify: item => item.id,
    label: item => item.id,
  }).detect(['a', 'b', 'c'])
  const distinctEnd = required(detections.find(item => item.expression.label === 'end'))
  assert.equal(distinctEnd.relation, 'allDistinct')
  assert.deepEqual(distinctEnd.implications, [])
  assert.ok(!detections.some(item => ['year(end)', 'monthDay(end)'].includes(item.expression.label)))
  const startMonths = required(detections.find(item => item.expression.label === 'month(start)'))
  assert.ok(startMonths.implications.every(fact => fact.expression.label !== 'end'))
})

test('reject incompatible units, undeclared fields, forged types, cycles and invalid numeric values', () => {
  const weight = field<Item, 'number'>('weight', 'number', () => known(1), {
    unit: 'kg',
  })
  assert.throws(() => interval(x, weight), /compatible/)
  assert.throws(() => new Observations({ fields: [x], expressions: [interval(x, y)] }), /Unknown field/)
  assert.throws(() => new Observations({ fields: [x, x] }), /Duplicate/)
  assert.throws(
    () =>
      new Observations({
        fields: [x],
        expressions: [{ ...x, kind: 'category' }],
      }),
    /Inconsistent/
  )
  const cyclic = field<Item, 'number'>('cyclic', 'number', () => known(1), {
    unit: 'year',
    definedAs: {
      node: { op: 'field', field: 'cyclic' },
      label: 'self',
      kind: 'number',
      unit: 'year',
    },
  })
  assert.throws(() => new Observations({ fields: [cyclic] }), /Cyclic/)
  assert.throws(
    () =>
      new Observations({ fields: [x] }).evaluate({
        ...required(items[0]),
        x: NaN,
      }),
    /Invalid number/
  )
  assert.throws(
    () =>
      new Observations({ fields: [x] }).evaluate({
        ...required(items[0]),
        x: Infinity,
      }),
    /Invalid number/
  )
  assert.throws(
    () =>
      new Observations({
        fields: [x, y],
        expressions: [interval(interval(x, y), x)],
      }),
    /Nested intervals/
  )
  assert.equal(
    datePart(
      field<Item, 'date'>('date', 'date', () => known('2020-01-01')),
      'year'
    ).unit,
    'year'
  )
})

test('enumerate each unordered group once, including N=5', () => {
  assert.equal(combinationCount(45, 3), 14190)
  assert.equal([...combinations([1, 2, 3, 4], 2)].length, 6)
  assert.deepEqual([...combinations([1, 2, 3, 4, 5], 5)], [[1, 2, 3, 4, 5]])
  assert.throws(() => combinationCount(4, 5))
  assert.equal(canonicalKey({ b: 2, a: 1 }), canonicalKey({ a: 1, b: 2 }))
  const five = Array.from({ length: 5 }, (_, index) => ({
    id: String(index),
    x: index * 3,
    y: index * 3 + 48,
    category: 'A',
  }))
  const engine = new CoincidenceEngine(domain(five))
  assert.equal(
    engine.detect(five.map(item => item.id)).find(item => item.expression.label === 'x')?.signature.parameters.step,
    3
  )
})

test('detectors can extend the vocabulary but implications must be acyclic', () => {
  const detector = {
    id: 'allPositive',
    accepts: (expression: { kind: string }, size: number) => expression.kind === 'number' && size >= 2,
    detect: (values: readonly (number | string | boolean)[]) =>
      values.every(value => Number(value) > 0)
        ? { parameters: { sign: 'positive' }, class: { sign: 'positive' } }
        : null,
  }
  const engine = new CoincidenceEngine(domain(items), [detector])
  assert.ok(engine.detect(['a', 'c']).some(item => item.relation === 'allPositive'))
  assert.throws(() => new CoincidenceEngine(domain(items), [{ ...detector, implies: ['allPositive'] }]), /Cyclic/)
})

test('equal endpoints jointly explain equal intervals; each endpoint alone is insufficient', () => {
  const instances = items.map(item => ({ ...item, x: 10, y: 20 }))
  const detection = new CoincidenceEngine(domain(instances))
    .detect(['a', 'b', 'c'])
    .find(item => item.expression.label === 'interval(x, y)')
  assert.deepEqual(detection?.explainedBy, [
    { expressionId: canonicalKey(x.node), relation: 'allEqual' },
    { expressionId: canonicalKey(y.node), relation: 'allEqual' },
  ])
})

test('transitive implications retain structured facts after intermediate detections are suppressed', () => {
  const signature = { parameters: { value: 42 }, class: {} }
  const detectors = ['weakest', 'middle', 'strongest'].map((id, index, ids) => ({
    id,
    accepts: () => true,
    detect: () => signature,
    implies: ids.slice(Math.max(0, index - 1), index),
  }))
  const engine = new CoincidenceEngine(domain(items, { fields: [x] }), detectors)
  const detections = engine.detect(['a', 'b'])
  assert.equal(detections.length, 1)
  const strongest = required(detections[0])
  assert.equal(strongest.relation, 'strongest')
  assert.deepEqual(strongest.implications.map(fact => fact.relation).sort(), ['middle', 'weakest'])
  for (const fact of strongest.implications) {
    assert.deepEqual(fact.expression, strongest.expression)
    assert.deepEqual(fact.signature, signature)
  }
})
