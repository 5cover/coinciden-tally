import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { CoincidenceEngine, combinations, debugDetection } from '../src/index.js'
import type { Detection } from '../src/index.js'
import { presidentDataset, presidentsDomain } from '../src/domains/presidents/index.js'

// Reporting only: every pair goes through the unchanged public analyze API.
export const rarityThresholds = [0.01, 0.025, 0.05, 0.1] as const
export function describe(detections: readonly Detection[]) {
  const frequencies = detections.map(d => d.prevalence?.frequency ?? null)
  return {
    total: detections.length,
    equalities: detections.filter(d => d.relation === 'allEqual').length,
    cumulativeRarity: rarityThresholds.map(threshold => ({
      threshold,
      count: frequencies.filter(f => f !== null && f <= threshold).length,
    })),
    histogram: [0, ...rarityThresholds, 1].slice(1).map((upper, i) => ({
      lowerExclusive: i ? rarityThresholds[i - 1] : null,
      upperInclusive: upper,
      count: frequencies.filter(f => f !== null && f <= upper && (i === 0 || f > (rarityThresholds[i - 1] ?? 0)))
        .length,
    })),
    unknownPrevalence: frequencies.filter(f => f === null).length,
    minimumPrevalence: frequencies.filter((f): f is number => f !== null).sort((a, b) => a - b)[0] ?? null,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const target = args.length ? args : ['lincoln', 'kennedy']
  if (target.length !== 2) throw new Error('Supply exactly two president IDs (default: lincoln kennedy)')
  const engine = new CoincidenceEngine(presidentsDomain)
  // Run the designated pair first, before any folklore collection or comparison selection.
  const targetDetections = engine.analyze(target)
  const datasetBytes = await readFile(new URL('../data/presidents.json', import.meta.url))
  const metadata = {
    formatVersion: 1,
    nodeVersion: process.version,
    datasetSha256: createHash('sha256').update(datasetBytes).digest('hex'),
    protocolFiles: await Promise.all(
      [
        'src/core/engine.ts',
        'src/core/relations.ts',
        'src/core/expressions.ts',
        'src/core/signatures.ts',
        'src/core/detections.ts',
        'src/core/prevalence.ts',
        'src/core/groups.ts',
        'src/core/model.ts',
        'src/core/debug.ts',
        'src/domains/presidents/index.ts',
        'src/domains/presidents/model.ts',
        'src/domains/presidents/validate.ts',
        'scripts/pair-experiment.ts',
        'pnpm-lock.yaml',
      ].map(async path => ({
        path,
        sha256: createHash('sha256')
          .update(await readFile(new URL(`../${path}`, import.meta.url)))
          .digest('hex'),
      }))
    ),
    datasetRetrievedAt: presidentDataset.retrievedAt,
    source: presidentDataset.source,
    protocol: 'CoincidenceEngine.analyze, default schema/detectors, exhaustive other pairs, byPrevalence',
    expressions: engine.observations.expressions,
    population: presidentsDomain.instances.map(p => ({ id: p.id, name: p.name })),
    target: [...target].sort(),
    thresholds: rarityThresholds,
    thresholdMeaning: 'Descriptive inclusive cutoffs on structural frequency, not significance tests',
  }
  const directory = new URL('../data/pair-experiment/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const coverage = engine.observations.expressions.map(expression => {
    const missingIds = presidentsDomain.instances
      .filter(p => engine.observations.evaluate(p).get(expression.id)?.status === 'missing')
      .map(p => p.id)
    return { expression, known: presidentsDomain.instances.length - missingIds.length, missingIds }
  })
  await writeFile(
    new URL('coverage.json', directory),
    `${JSON.stringify({ datasetSha256: metadata.datasetSha256, coverage }, null, 2)}\n`
  )
  await writeFile(
    new URL('target.json', directory),
    `${JSON.stringify({ metadata, detections: targetDetections }, null, 2)}\n`
  )
  const rows: string[] = []
  const profiles = []
  for (const group of combinations(presidentsDomain.instances, 2)) {
    const ids = group.map(p => p.id).sort()
    const detections = engine.analyze(ids)
    rows.push(JSON.stringify({ ids, detections }))
    profiles.push({
      ids,
      ...describe(detections),
      rarest: detections.slice(0, 3).map(d => ({
        expression: d.expression.label,
        relation: d.relation,
        signature: d.signature,
        prevalence: d.prevalence,
      })),
    })
    if (profiles.length % 100 === 0) console.log(`Analyzed ${profiles.length} pairs`)
  }
  // Full, lossless engine output, one pair per line. Compression only avoids duplicated provenance bloat.
  await writeFile(new URL('all-pairs.jsonl.gz', directory), gzipSync(`${rows.join('\n')}\n`, { level: 9 }))
  const targetProfile = describe(targetDetections)
  const controls = profiles.filter(p => JSON.stringify(p.ids) !== JSON.stringify(metadata.target))
  const overview = {
    controlCount: controls.length,
    totalCountDistribution: [...new Set(controls.map(p => p.total))]
      .sort((a, b) => a - b)
      .map(total => ({
        total,
        pairs: controls.filter(p => p.total === total).length,
      })),
    controlsWithRareDetection: rarityThresholds.map((threshold, i) => ({
      threshold,
      pairs: controls.filter(p => (p.cumulativeRarity[i]?.count ?? 0) > 0).length,
    })),
    sameDescriptiveVector: controls
      .filter(
        p =>
          p.total === targetProfile.total &&
          p.equalities === targetProfile.equalities &&
          p.cumulativeRarity.every((r, i) => r.count === targetProfile.cumulativeRarity[i]?.count)
      )
      .map(p => p.ids),
    mostDetections: controls.filter(p => p.total === Math.max(...controls.map(p => p.total))).map(p => p.ids),
    rarestControlFacts: controls
      .flatMap(p => p.rarest.map(fact => ({ ids: p.ids, ...fact })))
      .sort(
        (a, b) =>
          (a.prevalence?.frequency ?? Infinity) - (b.prevalence?.frequency ?? Infinity) ||
          a.expression.localeCompare(b.expression) ||
          a.ids.join(',').localeCompare(b.ids.join(','))
      )
      .slice(0, 12),
  }
  const summary = { metadata, targetProfile, pairCount: profiles.length, overview, profiles }
  await writeFile(new URL('summary.json', directory), `${JSON.stringify(summary, null, 2)}\n`)
  const csv = (values: readonly unknown[]) => values.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')
  await writeFile(
    new URL('profiles.csv', directory),
    [
      csv(['a', 'b', 'total', 'equalities', ...rarityThresholds.map(t => `frequency<=${t}`), 'minimumFrequency']),
      ...profiles.map(p =>
        csv([...p.ids, p.total, p.equalities, ...p.cumulativeRarity.map(r => r.count), p.minimumPrevalence])
      ),
    ].join('\n') + '\n'
  )
  await writeFile(
    new URL('target.csv', directory),
    [
      csv([
        'expression',
        'relation',
        'parameters',
        'class',
        'values',
        'matches',
        'eligible',
        'missing',
        'frequency',
        'exactMatches',
        'exactFrequency',
        'sources',
      ]),
      ...targetDetections.map(d =>
        csv([
          d.expression.label,
          d.relation,
          JSON.stringify(d.signature.parameters),
          JSON.stringify(d.signature.class),
          JSON.stringify(d.observations.map(o => (o.status === 'known' ? o.value : null))),
          d.prevalence?.matches,
          d.prevalence?.eligibleOtherGroups,
          d.prevalence?.missingOtherGroups,
          d.prevalence?.frequency,
          d.prevalence?.exactMatches,
          d.prevalence?.exactFrequency,
          JSON.stringify(d.observations.map(o => o.sources)),
        ])
      ),
    ].join('\n') + '\n'
  )
  const readable =
    [
      `Target: ${target.join(', ')}; ${profiles.length} pairs; ${targetDetections.length} detections`,
      ...targetDetections.map(d => debugDetection(d, targetDetections)),
    ].join('\n\n') + '\n'
  await writeFile(new URL('target.txt', directory), readable)
  console.log(readable)
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) await main()
