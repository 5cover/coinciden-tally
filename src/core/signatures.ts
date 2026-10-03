import type { Scalar } from './model.js';

/** Keys are stable regardless of object insertion order. */
export function canonicalKey(value: unknown): string {
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error('Canonical keys require finite, defined JSON values');
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalKey).join(',')}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalKey(item)}`).join(',')}}`;
}

export interface Signature {
  /** Exact observed fact, for inspection and secondary exact frequency. */
  parameters: Readonly<Record<string, Scalar>>;
  /** Predeclared equivalence class, used for the main prevalence. */
  class: Readonly<Record<string, Scalar>>;
}
