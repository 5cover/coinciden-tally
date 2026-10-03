import { byPrevalence, mergeImplications } from './detections.js';
import type { Detection } from './detections.js';
import { Observations } from './expressions.js';
import type { Domain } from './model.js';
import { measurePrevalence } from './prevalence.js';
import type { IndexedSubject } from './prevalence.js';
import { defaultDetectors } from './relations.js';
import type { Detector } from './relations.js';

export class CoincidenceEngine<T> {
  readonly observations: Observations<T>;
  private readonly population: readonly IndexedSubject[];

  constructor(readonly domain: Domain<T>, readonly detectors: readonly Detector[] = defaultDetectors) {
    this.observations = new Observations(domain.schema);
    this.population = domain.instances.map(instance => ({
      id: domain.identify(instance), label: domain.label(instance), observations: this.observations.evaluate(instance),
    }));
    if (this.population.some(item => !item.id) || new Set(this.population.map(item => item.id)).size !== this.population.length) {
      throw new Error('Domain subject IDs must be unique and nonempty');
    }
    if (new Set(detectors.map(item => item.id)).size !== detectors.length) throw new Error('Duplicate detector IDs');
    // A cycle would suppress every member, so reject cyclic implication declarations.
    const visit = (id: string, path: Set<string>): void => {
      if (path.has(id)) throw new Error('Cyclic detector implications');
      for (const implied of detectors.find(item => item.id === id)?.implies ?? []) {
        if (!detectors.some(item => item.id === implied)) throw new Error(`Unknown implied detector ${implied}`);
        visit(implied, new Set([...path, id]));
      }
    };
    detectors.forEach(item => visit(item.id, new Set()));
  }

  detect(ids: readonly string[]): Detection[] {
    if (ids.length < 2 || new Set(ids).size !== ids.length) throw new Error('A group needs at least two distinct subjects');
    const group = [...ids].sort().map(id => {
      const subject = this.population.find(item => item.id === id);
      if (!subject) throw new Error(`Unknown subject ${id}`);
      return subject;
    });
    const detections: Detection[] = [];
    for (const expression of this.observations.expressions) {
      const observations = group.map(item => {
        const observation = item.observations.get(expression.id);
        if (!observation) throw new Error('Missing compiled observation');
        return observation;
      });
      if (observations.some(item => item.status === 'missing')) continue;
      const values = observations.flatMap(item => item.status === 'known' ? [item.value] : []);
      for (const detector of this.detectors) {
        if (!detector.accepts(expression, ids.length)) continue;
        const signature = detector.detect(values);
        if (signature) detections.push({
          subjects: group.map(item => ({ id: item.id, label: item.label })),
          expression, relation: detector.id, signature, observations, implications: [],
        });
      }
    }
    return mergeImplications(detections, new Map(this.detectors.map(item => [item.id, item.implies ?? []])));
  }

  analyze(ids: readonly string[], options: { maxGroups?: number } = {}): Detection[] {
    const detections = this.detect(ids);
    return measurePrevalence(this.population, ids, detections, this.detectors, options.maxGroups ?? 100_000).sort(byPrevalence);
  }
}
