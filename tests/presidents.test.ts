import assert from 'node:assert/strict'
import test from 'node:test'
import { CoincidenceEngine, combinationCount } from '../src/index.js'
import { presidentDataset, presidentsDomain, validateDataset } from '../src/domains/presidents/index.js'
import { parsePresident } from '../scripts/import-presidents.js'

test('snapshot contains all people once, 47 presidencies, and inspectable provenance', () => {
  assert.equal(presidentDataset.presidents.length, 45)
  assert.equal(
    presidentDataset.presidents.reduce((sum, p) => sum + p.presidencies.length, 0),
    47
  )
  assert.equal(new Set(presidentDataset.presidents.map(p => p.id)).size, 45)
  assert.deepEqual(
    presidentDataset.presidents.filter(p => p.presidencies.length > 1).map(p => p.id),
    ['cleveland', 'trump']
  )
  for (const p of presidentDataset.presidents) {
    for (const observation of [
      p.birthDate,
      p.deathDate,
      p.birthPlace,
      p.partySummary,
      p.religionSummary,
      ...p.presidencies.flatMap(period => [period.start, period.end]),
    ]) {
      assert.ok(observation.sources.length)
      assert.ok(
        observation.sources.every(
          source =>
            source.url === `https://millercenter.org/president/${p.id}` &&
            source.locator.startsWith('Fast Facts / ') &&
            source.retrievedAt === presidentDataset.retrievedAt
        )
      )
    }
  }
  const current = presidentDataset.presidents.find(p => p.id === 'trump')?.presidencies.at(-1)
  assert.equal(current?.end.status, 'missing')
  assert.ok(presidentDataset.presidents.some(p => p.deathDate.status === 'missing'))
})

test('arbitrary pair: empirical lifespan calendar-year equality can be traced to source', () => {
  const result = new CoincidenceEngine(presidentsDomain).analyze(['monroe', 'taft'])
  const match = result.find(
    item => item.relation === 'allEqual' && item.expression.label === 'interval(year(birthDate), year(deathDate))'
  )
  assert.ok(match)
  assert.ok(match.prevalence)
  assert.equal(match.signature.parameters.value, 73)
  assert.equal(match.prevalence.totalOtherGroups, combinationCount(45, 2) - 1)
  assert.equal(match.prevalence.matches, 11)
  assert.equal(match.prevalence.eligibleOtherGroups, 779)
  assert.ok(match.observations.every(item => item.status === 'known' && item.sources.length === 2))
})

test('arbitrary triplets use every other triplet, without maximizing a famous target', () => {
  const engine = new CoincidenceEngine(presidentsDomain)
  for (const ids of [
    ['madison', 'polk', 'carter'],
    ['grant', 'coolidge', 'eisenhower'],
  ]) {
    const result = engine.analyze(ids)
    assert.ok(result.length)
    assert.ok(result.every(item => item.subjects.length === 3 && item.prevalence?.totalOtherGroups === 14189))
    assert.ok(
      result.every(
        (item, index) =>
          !index || (result[index - 1]?.prevalence?.frequency ?? Infinity) <= (item.prevalence?.frequency ?? Infinity)
      )
    )
    for (const item of result) {
      const p = item.prevalence
      assert.ok(p)
      assert.equal(p.eligibleOtherGroups + p.missingOtherGroups, p.totalOtherGroups)
      assert.ok(p.exactMatches <= p.matches && p.matches <= p.eligibleOtherGroups)
    }
  }
})

test('five arbitrary presidents: detection remains N-ary; exhaustive guard is explicit', () => {
  const engine = new CoincidenceEngine(presidentsDomain)
  const ids = ['adams', 'monroe', 'grant', 'hoover', 'carter']
  assert.ok(engine.detect(ids).every(item => item.subjects.length === 5))
  assert.throws(() => engine.analyze(ids), /requires 1221759/)
})

test('import parses only homogeneous facts and preserves absent ends, not an index fallback', () => {
  const html = `<h1>Example</h1>
    <div class="data"><label>Birth Date</label><div><time datetime="1900-03-01T12:00:00Z">March 1, 1900</time></div></div>
    <div class="data"><label>President Number</label><div><div>1</div><div>3</div></div></div>
    <div class="data"><label>Inauguration Date</label><div><time datetime="1940-01-01T12:00:00Z">1940</time><time datetime="1950-01-01T12:00:00Z">1950</time></div></div>
    <div class="data"><label>Date Ended</label><div><time datetime="1944-01-01T12:00:00Z">1944</time></div></div>
    <article>Arbitrary narrative must never become an observation</article>`
  const p = parsePresident(html, 'example', 'Example', '2026-10-03T00:00:00Z')
  assert.equal(p.presidencies.length, 2)
  assert.equal(p.presidencies[1]?.end.status, 'missing')
  assert.equal(p.partySummary.status, 'missing')
  assert.equal(p.birthDate.status === 'known' && p.birthDate.value, '1900-03-01')
  assert.throws(
    () => parsePresident(html.replace('1944-01-01', '1939-01-01'), 'example', 'Example', '2026-10-03'),
    /Reversed/
  )
  assert.throws(
    () => parsePresident(html.replace('1944-01-01', '2029-01-01'), 'example', 'Example', '2026-10-03'),
    /future/
  )
  assert.throws(() => parsePresident(html.replace('<div>3</div>', ''), 'example', 'Example', '2026-10-03'), /Ambiguous/)
})

test('invalid persisted observations cannot silently enter the domain', () => {
  assert.throws(() => validateDataset({ ...presidentDataset, version: 2 }), /Unsupported/)
  assert.throws(
    () =>
      validateDataset({
        ...presidentDataset,
        presidents: [...presidentDataset.presidents, presidentDataset.presidents[0]],
      }),
    /Duplicate/
  )
  assert.throws(() => validateDataset({ ...presidentDataset, presidents: [{ id: 'example' }] }))
})
