import { CoincidenceEngine, debugDetection, field, known, missing } from 'coinciden-tally'
import type { Domain } from 'coinciden-tally'

interface Person {
  id: string
  birthYear: number | null
  eventYear: number
  category: string
}

const birth = field<Person, 'number'>(
  'birthYear',
  'number',
  p => (p.birthYear === null ? missing('not recorded') : known(p.birthYear)),
  { unit: 'year' }
)
const event = field<Person, 'number'>('eventYear', 'number', p => known(p.eventYear), { unit: 'year' })

const domain: Domain<Person> = {
  id: 'people',
  identify: p => p.id,
  label: p => p.id,
  instances: [
    { id: 'a', birthYear: 10, eventYear: 58, category: 'A' },
    { id: 'b', birthYear: 15, eventYear: 63, category: 'A' },
    { id: 'c', birthYear: 20, eventYear: 68, category: 'B' },
    { id: 'd', birthYear: 31, eventYear: 80, category: 'B' },
  ],
  schema: {
    fields: [birth, event, field<Person, 'category'>('category', 'category', p => known(p.category))],
    // Déclarer des endpoints sémantiquement pertinents, pas leur valeur dérivée.
    intervals: [{ from: birth, to: event }],
  },
}

const engine = new CoincidenceEngine(domain)
const detections = engine.analyze(['a', 'b', 'c'])
for (const detection of detections) console.log(debugDetection(detection))
