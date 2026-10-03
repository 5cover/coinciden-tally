import { validDate } from '../../core/expressions.js';
import type { Observation, Source } from '../../core/model.js';
import type { PresidentDataset } from './model.js';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected dataset object');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value.length) throw new Error('Expected nonempty dataset string');
  return value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected dataset array');
  return value as unknown[];
}
function observation(value: unknown, isDate = false): Observation<string> {
  const item = record(value);
  const sources = array(item.sources).map((entry): Source => {
    const source = record(entry);
    return { url: string(source.url), locator: string(source.locator), retrievedAt: string(source.retrievedAt),
      ...(typeof source.raw === 'string' ? { raw: source.raw } : {}) };
  });
  if (!sources.length) throw new Error('President observations require provenance');
  if (item.status === 'missing') return { status: 'missing', reason: string(item.reason), sources };
  if (item.status !== 'known') throw new Error('Unknown observation status');
  const text = string(item.value);
  if (isDate && !validDate(text)) throw new Error(`Invalid snapshot date: ${text}`);
  return { status: 'known', value: text, sources };
}

export function validateDataset(input: unknown): PresidentDataset {
  const data = record(input);
  if (data.version !== 1) throw new Error('Unsupported dataset version');
  const presidents = array(data.presidents).map(entry => {
    const item = record(entry);
    const presidencies = array(item.presidencies).map(period => {
      const term = record(period);
      if (typeof term.number !== 'number' || !Number.isSafeInteger(term.number) || term.number < 1) throw new Error('Invalid presidency number');
      const start = observation(term.start, true);
      const end = observation(term.end, true);
      if (start.status !== 'known' || (end.status === 'known' && end.value < start.value)) throw new Error('Invalid presidency period');
      return { number: term.number, start, end };
    });
    if (!presidencies.length) throw new Error('President must have at least one presidency');
    for (let i = 1; i < presidencies.length; i++) {
      const previous = presidencies[i - 1];
      const current = presidencies[i];
      if (!previous || !current || previous.end.status !== 'known'
        || previous.end.value >= current.start.value || previous.number >= current.number) throw new Error('Presidencies must be ordered and non-overlapping');
    }
    return { id: string(item.id), name: string(item.name), birthDate: observation(item.birthDate, true),
      deathDate: observation(item.deathDate, true), birthPlace: observation(item.birthPlace),
      partySummary: observation(item.partySummary), religionSummary: observation(item.religionSummary), presidencies };
  });
  if (new Set(presidents.map(item => item.id)).size !== presidents.length) throw new Error('Duplicate president');
  const numbers = presidents.flatMap(item => item.presidencies.map(period => period.number));
  if (new Set(numbers).size !== numbers.length) throw new Error('Duplicate presidency number');
  return { version: 1, source: string(data.source), retrievedAt: string(data.retrievedAt), presidents };
}
