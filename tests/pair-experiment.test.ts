import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { CoincidenceEngine, combinations } from '../src/index.js'
import type { Detection } from '../src/index.js'
import { presidentsDomain } from '../src/domains/presidents/index.js'
import { describe } from '../scripts/pair-experiment.js'

interface PairResult {
  ids: string[]
  detections: Detection[]
}
// Compare the public JSON contract, not in-memory extractor functions or undefined properties.
const jsonValue = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown
const archive = gunzipSync(readFileSync(new URL('../data/pair-experiment/all-pairs.jsonl.gz', import.meta.url)))
  .toString()
  .trim()
  .split('\n')
  .map(line => JSON.parse(line) as PairResult)
const target = JSON.parse(readFileSync(new URL('../data/pair-experiment/target.json', import.meta.url), 'utf8')) as {
  metadata: { datasetSha256: string; protocolFiles: { path: string; sha256: string }[] }
  detections: Detection[]
}

test('archived experiment is bound to the unchanged snapshot and protocol', () => {
  const sha = (path: string) =>
    createHash('sha256')
      .update(readFileSync(new URL(`../${path}`, import.meta.url)))
      .digest('hex')
  assert.equal(sha('data/presidents.json'), target.metadata.datasetSha256)
  for (const file of target.metadata.protocolFiles) assert.equal(sha(file.path), file.sha256, file.path)
})

test('lossless archive covers each unordered pair exactly once with the ordinary detection pipeline', () => {
  const engine = new CoincidenceEngine(presidentsDomain)
  const expected = [...combinations(presidentsDomain.instances, 2)].map(group =>
    group
      .map(p => p.id)
      .sort()
      .join(',')
  )
  assert.equal(archive.length, 990)
  assert.deepEqual(
    archive.map(p => p.ids.join(',')),
    expected
  )
  assert.equal(new Set(expected).size, archive.length)
  for (const pair of archive) {
    assert.deepEqual(
      pair.detections.map(({ prevalence: _prevalence, ...d }) => d),
      jsonValue(
        engine.detect(pair.ids).sort((a, b) => {
          const ai = pair.detections.findIndex(d => d.expression.id === a.expression.id && d.relation === a.relation)
          const bi = pair.detections.findIndex(d => d.expression.id === b.expression.id && d.relation === b.relation)
          return ai - bi
        })
      )
    )
    for (const d of pair.detections) {
      assert.ok(d.prevalence)
      const p = d.prevalence
      assert.equal(p.totalOtherGroups, 989)
      assert.equal(p.eligibleOtherGroups + p.missingOtherGroups, 989)
      assert.ok(p.exactMatches <= p.matches && p.matches <= p.eligibleOtherGroups)
    }
  }
})

test('target and varied controls reproduce exact prevalence with the same public API', () => {
  const engine = new CoincidenceEngine(presidentsDomain)
  assert.deepEqual(jsonValue(engine.analyze(['kennedy', 'lincoln'])), target.detections)
  for (const ids of [
    ['kennedy', 'lincoln'],
    ['ford', 'truman'],
    ['clinton', 'gwbush'],
    ['adams', 'jefferson'],
  ]) {
    assert.deepEqual(jsonValue(engine.analyze(ids)), archive.find(p => p.ids.join(',') === ids.join(','))?.detections)
  }
  assert.equal(describe(target.detections).total, 18)
  assert.equal(describe(target.detections).equalities, 1)
  assert.deepEqual(
    describe(target.detections).cumulativeRarity.map(r => r.count),
    [0, 0, 0, 0]
  )
})

test('folklore stays separately sourced, with factual verification distinct from representability', () => {
  const corpus = JSON.parse(
    readFileSync(new URL('../data/lincoln-kennedy-folklore.json', import.meta.url), 'utf8')
  ) as {
    sources: Record<string, { url: string; accessedOn: string }>
    claims: {
      id: string
      claim: string
      verdict: string
      verification: string
      codes: number[]
      detectedNaturally: boolean
      mapping: string
      circulation: string[]
      evidence: { source: string; locator: string }[]
    }[]
  }
  assert.equal(corpus.claims.length, 24)
  assert.equal(new Set(corpus.claims.map(c => c.id)).size, 24)
  for (const c of corpus.claims) {
    assert.ok(['exacte', 'approximative', 'trompeuse', 'fausse', 'non_verifiable'].includes(c.verdict))
    assert.ok(c.codes.length && c.codes.every(code => [1, 2, 3, 4, 5].includes(code)))
    assert.equal(c.detectedNaturally, c.codes.includes(1))
    assert.ok(c.verification && c.mapping && c.evidence.length && c.circulation.length)
    for (const ref of [...c.circulation, ...c.evidence.map(e => e.source)]) {
      assert.ok(corpus.sources[ref]?.url.startsWith('https://'), ref)
      assert.equal(corpus.sources[ref]?.accessedOn, '2026-10-03')
    }
    if (c.verdict === 'fausse') assert.ok(c.codes.includes(5))
    if (c.verdict === 'non_verifiable') assert.ok(!c.codes.includes(5))
  }
})
