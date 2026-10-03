export type Kind = 'number' | 'category' | 'boolean' | 'date';
export type Scalar = string | number | boolean;
export interface Values {
  number: number;
  category: string;
  boolean: boolean;
  date: string; // Gregorian ISO YYYY-MM-DD, validated at extraction.
}

export interface Source {
  url: string;
  locator: string;
  retrievedAt: string;
  raw?: string;
}

export type Observation<V = Scalar> =
  | { status: 'known'; value: V; sources: readonly Source[] }
  | { status: 'missing'; reason: string; sources: readonly Source[] };

export function known<V extends Scalar>(value: V, sources: readonly Source[] = []): Observation<V> {
  return { status: 'known', value, sources };
}

export function missing(reason = 'not recorded', sources: readonly Source[] = []): Observation<never> {
  return { status: 'missing', reason, sources };
}

export type ExpressionNode =
  | { op: 'field'; field: string }
  | { op: 'datePart'; part: 'year' | 'month' | 'monthDay'; input: ExpressionNode }
  | { op: 'interval'; from: ExpressionNode; to: ExpressionNode };

export interface Expression<K extends Kind = Kind> {
  node: ExpressionNode;
  kind: K;
  unit?: string;
  label: string;
}

export interface Field<T, K extends Kind = Kind> extends Expression<K> {
  id: string;
  read: (instance: T) => Observation<Values[K]>;
  /** An explicitly declared, verified materialized alias of an expression. */
  definedAs?: Expression<K>;
}

export interface Schema<T> {
  fields: readonly Field<T>[];
  /** Semantic endpoint pairs: no search over arbitrary arithmetic. */
  intervals?: readonly { from: Expression<'number'> | Expression<'date'>; to: Expression<'number'> | Expression<'date'> }[];
  expressions?: readonly Expression[];
}

export interface Domain<T> {
  id: string;
  instances: readonly T[];
  identify: (instance: T) => string;
  label: (instance: T) => string;
  schema: Schema<T>;
}

export function field<T, K extends Kind>(
  id: string,
  kind: K,
  read: (instance: T) => Observation<Values[K]>,
  options: { label?: string; unit?: string; definedAs?: Expression<K> } = {},
): Field<T, K> {
  if (!id) throw new Error('Field IDs must be nonempty');
  if (kind === 'number' && !options.unit) throw new Error(`Numeric field ${id} requires a semantic unit`);
  return { node: { op: 'field', field: id }, id, kind, read, label: options.label ?? id, ...options };
}

export function datePart(input: Expression<'date'>, part: 'year'): Expression<'number'>;
export function datePart(input: Expression<'date'>, part: 'month' | 'monthDay'): Expression<'category'>;
export function datePart(input: Expression<'date'>, part: 'year' | 'month' | 'monthDay'): Expression {
  return {
    node: { op: 'datePart', input: input.node, part },
    kind: part === 'year' ? 'number' : 'category',
    unit: part === 'year' ? 'year' : undefined,
    label: `${part}(${input.label})`,
  };
}

export function interval(from: Expression<'number'>, to: Expression<'number'>): Expression<'number'>;
export function interval(from: Expression<'date'>, to: Expression<'date'>): Expression<'number'>;
export function interval(from: Expression, to: Expression): Expression<'number'> {
  if (from.kind !== to.kind || !['number', 'date'].includes(from.kind) || from.unit !== to.unit) {
    throw new Error('Intervals require compatible endpoint kinds and units');
  }
  return {
    node: { op: 'interval', from: from.node, to: to.node },
    kind: 'number', unit: from.kind === 'date' ? 'day' : from.unit,
    label: `interval(${from.label}, ${to.label})`,
  };
}
