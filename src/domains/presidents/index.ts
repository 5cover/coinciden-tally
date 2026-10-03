import { readFileSync } from 'node:fs';
import { field, known, missing } from '../../core/model.js';
import type { Domain } from '../../core/model.js';
import type { President } from './model.js';
import { validateDataset } from './validate.js';

export type { President, PresidentDataset, Presidency } from './model.js';
export { validateDataset } from './validate.js';

// Same relative depth in source and dist; snapshot is copied by the build script.
export const presidentDataset = validateDataset(JSON.parse(readFileSync(new URL('../../../data/presidents.json', import.meta.url), 'utf8')));

const birthDate = field<President, 'date'>('birthDate', 'date', p => p.birthDate);
const deathDate = field<President, 'date'>('deathDate', 'date', p => p.deathDate);
const firstStart = field<President, 'date'>('firstStart', 'date', p => p.presidencies[0]?.start ?? missing('no presidency'));
const lastEnd = field<President, 'date'>('lastEnd', 'date', p => p.presidencies.at(-1)?.end ?? missing('no presidency'));

export const presidentsDomain: Domain<President> = {
  id: 'us-presidents', instances: presidentDataset.presidents, identify: p => p.id, label: p => p.name,
  schema: {
    fields: [birthDate, deathDate, firstStart, lastEnd,
      field<President, 'category'>('birthPlace', 'category', p => p.birthPlace),
      field<President, 'category'>('partySummary', 'category', p => p.partySummary),
      field<President, 'category'>('religionSummary', 'category', p => p.religionSummary),
      field<President, 'number'>('presidencyPeriods', 'number', p => known(p.presidencies.length,
        p.presidencies.flatMap(period => period.start.sources)), { unit: 'count' })],
    intervals: [{ from: birthDate, to: firstStart }, { from: birthDate, to: deathDate }, { from: firstStart, to: lastEnd }],
  },
};
