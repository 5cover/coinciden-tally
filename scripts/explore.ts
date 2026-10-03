import { CoincidenceEngine, debugDetection } from '../src/index.js'
import { presidentDataset, presidentsDomain } from '../src/domains/presidents/index.js'
import { writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const json = args.includes('--json')
const saveOption = args.find(arg => arg.startsWith('--save='))
const savePath = saveOption?.slice('--save='.length)
if (savePath === '') throw new Error('--save requires an output path')
const ids = args.filter(arg => !arg.startsWith('--'))
const limitOption = args.find(arg => arg.startsWith('--max-groups='))
const maxGroups = limitOption ? Number(limitOption.slice('--max-groups='.length)) : 100_000
const engine = new CoincidenceEngine(presidentsDomain)
const groups = ids.length
  ? [ids]
  : [
      ['monroe', 'taft'],
      ['vanburen', 'hoover'],
      ['madison', 'polk', 'carter'],
      ['grant', 'coolidge', 'eisenhower'],
    ]
const results = groups.map(group => ({
  ids: group,
  detections: engine.analyze(group, { maxGroups }),
}))
if (args.includes('--save') || savePath) {
  await writeFile(
    savePath ?? new URL('../data/exploration-summary.json', import.meta.url),
    `${JSON.stringify(
      {
        datasetRetrievedAt: presidentDataset.retrievedAt,
        reference: presidentsDomain.id,
        results: results.map(result => ({
          ids: result.ids,
          detectionCount: result.detections.length,
          top: result.detections.slice(0, 8).map(item => ({
            expression: item.expression,
            relation: item.relation,
            signature: item.signature,
            prevalence: item.prevalence,
            implications: item.implications,
            explainedBy: item.explainedBy,
          })),
        })),
      },
      null,
      2
    )}\n`
  )
}
if (json)
  console.log(
    JSON.stringify(
      {
        source: presidentDataset.source,
        retrievedAt: presidentDataset.retrievedAt,
        results,
      },
      null,
      2
    )
  )
else {
  console.log(`Domain: ${presidentsDomain.instances.length} presidents; snapshot ${presidentDataset.retrievedAt}`)
  for (const result of results) {
    console.log(
      `\nGroup ${result.ids.join(', ')}: ${result.detections.length} detections, sorted by structural prevalence`
    )
    for (const detection of result.detections.slice(0, 8))
      console.log(`\n${debugDetection(detection, result.detections)}`)
  }
}
