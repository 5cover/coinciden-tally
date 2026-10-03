import type { Observation } from '../../core/model.js';

export interface Presidency {
  number: number;
  start: Observation<string>;
  end: Observation<string>;
}

export interface President {
  id: string;
  name: string;
  birthDate: Observation<string>;
  deathDate: Observation<string>;
  birthPlace: Observation<string>;
  partySummary: Observation<string>;
  religionSummary: Observation<string>;
  presidencies: readonly Presidency[];
}

export interface PresidentDataset {
  version: 1;
  source: string;
  retrievedAt: string;
  presidents: readonly President[];
}
