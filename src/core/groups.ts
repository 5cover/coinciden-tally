export function combinationCount(population: number, size: number): number {
  if (!Number.isInteger(population) || !Number.isInteger(size) || size < 0 || population < size) {
    throw new Error('Invalid combination dimensions');
  }
  let count = 1;
  for (let i = 1; i <= Math.min(size, population - size); i++) count = count * (population - i + 1) / i;
  const rounded = Math.round(count);
  if (!Number.isSafeInteger(rounded)) throw new Error('Combination count exceeds safe integer range');
  return rounded;
}

export function* combinations<T>(items: readonly T[], size: number): Generator<readonly T[]> {
  combinationCount(items.length, size);
  const current: T[] = [];
  function* visit(start: number): Generator<readonly T[]> {
    if (current.length === size) { yield [...current]; return; }
    for (let index = start; index <= items.length - (size - current.length); index++) {
      const item = items[index];
      if (item === undefined) throw new Error('Unexpected sparse population');
      current.push(item);
      yield* visit(index + 1);
      current.pop();
    }
  }
  yield* visit(0);
}
