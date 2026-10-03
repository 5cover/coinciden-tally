import { datePart, interval, known, missing } from './model.js';
import type { Expression, ExpressionNode, Field, Observation, Schema } from './model.js';
import { canonicalKey } from './signatures.js';

export interface CompiledExpression extends Expression {
  id: string;
  aliases: readonly string[];
}

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export class Observations<T> {
  readonly expressions: readonly CompiledExpression[];
  private readonly fields = new Map<string, Field<T>>();

  constructor(schema: Schema<T>) {
    for (const entry of schema.fields) {
      if (this.fields.has(entry.id)) throw new Error(`Duplicate field ${entry.id}`);
      this.fields.set(entry.id, entry);
    }
    const candidates: Expression[] = [...schema.fields, ...schema.expressions ?? []];
    for (const entry of schema.fields) {
      if (entry.kind === 'date') {
        const input: Expression<'date'> = { ...entry, kind: 'date' };
        candidates.push(datePart(input, 'year'), datePart(input, 'month'), datePart(input, 'monthDay'));
      }
    }
    for (const pair of schema.intervals ?? []) {
      if (pair.from.kind === 'date' && pair.to.kind === 'date') {
        candidates.push(interval(pair.from, pair.to));
        candidates.push(interval(datePart(pair.from, 'year'), datePart(pair.to, 'year')));
      } else if (pair.from.kind === 'number' && pair.to.kind === 'number') {
        candidates.push(interval(pair.from, pair.to));
      } else throw new Error('Incompatible interval endpoints');
    }
    const unique = new Map<string, CompiledExpression>();
    for (const entry of candidates) {
      const node = this.normalize(entry.node);
      const inferred = this.infer(node);
      if (entry.kind !== inferred.kind || entry.unit !== inferred.unit) {
        throw new Error(`Inconsistent expression type or unit: ${entry.label}`);
      }
      const id = canonicalKey(node);
      const previous = unique.get(id);
      unique.set(id, previous
        ? { ...previous, aliases: [...new Set([...previous.aliases, entry.label])] }
        : { ...entry, node, id, aliases: [entry.label] });
    }
    this.expressions = [...unique.values()];
  }

  private normalize(node: ExpressionNode, visiting = new Set<string>()): ExpressionNode {
    if (node.op === 'field') {
      const entry = this.fields.get(node.field);
      if (!entry) throw new Error(`Unknown field ${node.field}`);
      if (visiting.has(node.field)) throw new Error(`Cyclic definition: ${node.field}`);
      if (!entry.definedAs) return node;
      return this.normalize(entry.definedAs.node, new Set([...visiting, node.field]));
    }
    if (node.op === 'datePart') return { ...node, input: this.normalize(node.input, visiting) };
    return { ...node, from: this.normalize(node.from, visiting), to: this.normalize(node.to, visiting) };
  }

  private infer(node: ExpressionNode): Pick<Expression, 'kind' | 'unit'> {
    if (node.op === 'field') {
      const entry = this.fields.get(node.field);
      if (!entry) throw new Error(`Unknown field ${node.field}`);
      return { kind: entry.kind, unit: entry.unit };
    }
    if (node.op === 'datePart') {
      if (this.infer(node.input).kind !== 'date') throw new Error('datePart requires a date');
      return { kind: node.part === 'year' ? 'number' : 'category',
        unit: node.part === 'year' ? 'year' : undefined };
    }
    if (node.from.op === 'interval' || node.to.op === 'interval') {
      throw new Error('Nested intervals are outside the bounded expression vocabulary');
    }
    const from = this.infer(node.from);
    const to = this.infer(node.to);
    if (from.kind !== to.kind || from.unit !== to.unit || !['number', 'date'].includes(from.kind)) {
      throw new Error('Interval operands must have the same numeric/date type and unit');
    }
    return { kind: 'number', unit: from.kind === 'date' ? 'day' : from.unit };
  }

  private readField(entry: Field<T>, instance: T): Observation {
    const observation = entry.read(instance);
    if (observation.status === 'missing') return observation;
    const value = observation.value;
    const valid = entry.kind === 'number' ? typeof value === 'number' && Number.isFinite(value)
      : entry.kind === 'boolean' ? typeof value === 'boolean'
      : typeof value === 'string' && (entry.kind !== 'date' || validDate(value));
    if (!valid) throw new Error(`Invalid ${entry.kind} observation: ${entry.id}`);
    return observation;
  }

  evaluate(instance: T): ReadonlyMap<string, Observation> {
    const cache = new Map<string, Observation>();
    const evaluateNode = (node: ExpressionNode): Observation => {
      const key = canonicalKey(node);
      const cached = cache.get(key);
      if (cached) return cached;
      let result: Observation;
      if (node.op === 'field') {
        const entry = this.fields.get(node.field);
        if (!entry) throw new Error(`Unknown field ${node.field}`);
        result = this.readField(entry, instance);
      } else if (node.op === 'datePart') {
        const input = evaluateNode(node.input);
        if (input.status === 'missing') result = input;
        else {
          const text = String(input.value);
          const value = node.part === 'monthDay' ? text.slice(5)
            : node.part === 'year' ? Number(text.slice(0, 4)) : text.slice(5, 7);
          result = known(value, input.sources);
        }
      } else {
        const from = evaluateNode(node.from);
        const to = evaluateNode(node.to);
        const sources = [...from.sources, ...to.sources];
        if (from.status === 'missing' || to.status === 'missing') {
          const reasons = [from, to].filter(item => item.status === 'missing').map(item => item.reason);
          result = missing(reasons.join('; '), sources);
        } else {
          const value = typeof from.value === 'number' && typeof to.value === 'number'
            ? to.value - from.value : (Date.parse(String(to.value)) - Date.parse(String(from.value))) / 86_400_000;
          if (!Number.isFinite(value)) throw new Error('Non-finite interval');
          result = known(value, sources);
        }
      }
      cache.set(key, result);
      return result;
    };
    for (const expression of this.expressions) evaluateNode(expression.node);
    for (const entry of this.fields.values()) {
      if (!entry.definedAs) continue;
      const stored = this.readField(entry, instance);
      const derived = evaluateNode(this.normalize(entry.node));
      if (stored.status === 'known' && derived.status === 'known' && stored.value !== derived.value) {
        throw new Error(`Materialized alias disagrees with definition: ${entry.id}`);
      }
    }
    return cache;
  }
}
