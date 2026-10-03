import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import { known, missing } from '../src/core/model.js'
import type { Observation, Source } from '../src/core/model.js'
import { validDate } from '../src/core/expressions.js'
import type { President, PresidentDataset } from '../src/domains/presidents/model.js'
import { validateDataset } from '../src/domains/presidents/validate.js'

const origin = 'https://millercenter.org'
const retrievedAt = new Date().toISOString()
async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  return response.text()
}

/** Parse only Fast Facts, never anecdotes, essays or featured comparisons. */
export function parsePresident(html: string, id: string, name: string, accessedAt: string): President {
  const $ = load(html)
  const facts = new Map<string, { text: string; dates: string[]; numbers: number[] }>()
  $('.data').each((_index, element) => {
    const label = $(element).children('label').text().trim()
    if (!label) return
    const content = $(element).children('div')
    facts.set(label, {
      text: content.text().replace(/\s+/g, ' ').trim(),
      dates: content
        .find('time')
        .map((_i, time) => ($(time).attr('datetime') ?? '').slice(0, 10))
        .get(),
      numbers: content
        .children('div')
        .map((_i, item) => Number($(item).text().trim()))
        .get(),
    })
  })
  const url = `${origin}/president/${id}`
  const source = (label: string): Source[] => [
    {
      url,
      locator: `Fast Facts / ${label}`,
      retrievedAt: accessedAt,
      raw: facts.get(label)?.text ?? '',
    },
  ]
  const text = (label: string): Observation<string> => {
    const value = facts.get(label)?.text
    return value ? known(value, source(label)) : missing('not supplied by source', source(label))
  }
  const date = (label: string, index = 0): Observation<string> => {
    const value = facts.get(label)?.dates[index]
    if (!value) return missing('not supplied by source', source(label))
    if (!validDate(value)) throw new Error(`Invalid date ${label}: ${url}`)
    return known(value, source(label))
  }
  const numbers = facts.get('President Number')?.numbers ?? []
  const starts = facts.get('Inauguration Date')?.dates ?? []
  const ends = facts.get('Date Ended')?.dates ?? []
  if (
    !numbers.length ||
    starts.length !== numbers.length ||
    ends.length > starts.length ||
    numbers.some(number => !Number.isSafeInteger(number) || number < 1)
  ) {
    throw new Error(`Ambiguous presidency periods: ${url}`)
  }
  const presidencies = numbers.map((number, index) => {
    const start = date('Inauguration Date', index)
    const end = date('Date Ended', index)
    if (start.status !== 'known') throw new Error(`Missing start: ${url}`)
    if (end.status === 'known' && end.value < start.value) throw new Error(`Reversed period: ${url}`)
    if (end.status === 'known' && end.value > accessedAt.slice(0, 10)) {
      throw new Error(`Source lists a future end date as an observed fact: ${url}`)
    }
    return { number, start, end }
  })
  return {
    id,
    name,
    birthDate: date('Birth Date'),
    deathDate: date('Death Date'),
    birthPlace: text('Birth Place'),
    partySummary: text('Political Party'),
    religionSummary: text('Religion'),
    presidencies,
  }
}

async function main(): Promise<void> {
  const $ = load(await fetchHtml(`${origin}/president`))
  const links = new Map<string, string>()
  $('.president-info .views-field--title a').each((_index, element) => {
    const href = $(element).attr('href')
    const name = $(element).text().trim()
    if (href && /^\/president\/[^/]+$/.test(href) && name) links.set(href.slice('/president/'.length), name)
  })
  if (links.size < 40) throw new Error('Incomplete index or changed HTML; refusing to overwrite snapshot')
  const presidents: President[] = []
  // Deliberately sequential requests to the academic source.
  for (const [id, name] of links) {
    presidents.push(parsePresident(await fetchHtml(`${origin}/president/${id}`), id, name, retrievedAt))
  }
  presidents.sort((a, b) => (a.presidencies[0]?.number ?? 0) - (b.presidencies[0]?.number ?? 0))
  const dataset: PresidentDataset = {
    version: 1,
    source: `${origin}/president`,
    retrievedAt,
    presidents,
  }
  validateDataset(dataset)
  if (process.argv.includes('--audit')) {
    const snapshot = validateDataset(
      JSON.parse(await readFile(new URL('../data/presidents.json', import.meta.url), 'utf8'))
    )
    const comparable = (p: President): unknown =>
      JSON.parse(JSON.stringify(p, (key, value: unknown) => (key === 'sources' ? undefined : value))) as unknown
    const differences = presidents.filter(
      p =>
        JSON.stringify(comparable(p)) !==
        JSON.stringify(comparable(snapshot.presidents.find(old => old.id === p.id) ?? p))
    )
    const added = presidents.filter(p => !snapshot.presidents.some(old => old.id === p.id)).map(p => p.id)
    const removed = snapshot.presidents.filter(p => !presidents.some(current => current.id === p.id)).map(p => p.id)
    await writeFile(
      new URL('../data/presidents-audit.json', import.meta.url),
      `${JSON.stringify(
        {
          auditedAt: retrievedAt,
          method:
            'Same index, Fast Facts parser and collection rule for every president; values/status/reasons compared, provenance timestamps excluded',
          snapshotSha256: createHash('sha256')
            .update(await readFile(new URL('../data/presidents.json', import.meta.url)))
            .digest('hex'),
          added,
          removed,
          differences: differences.map(p => ({
            id: p.id,
            previous: snapshot.presidents.find(old => old.id === p.id),
            current: p,
          })),
          checked: presidents.map(p => ({ id: p.id, observations: p })),
        },
        null,
        2
      )}\n`
    )
    console.log(
      `Audited ${presidents.length} people: ${differences.length} changed, ${added.length} added, ${removed.length} removed`
    )
    return
  }
  // Generate a reproducible data artifact only after the complete import succeeds.
  await writeFile(new URL('../data/presidents.json', import.meta.url), `${JSON.stringify(dataset, null, 2)}\n`)
  console.log(
    `Imported ${presidents.length} people, ${presidents.reduce((sum, p) => sum + p.presidencies.length, 0)} presidencies; ${retrievedAt}`
  )
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) await main()
