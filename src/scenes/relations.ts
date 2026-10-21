import type { LineageRelation } from '@/domain/evolve';

export const ALL_RELATIONS: LineageRelation[] = ['forked_from', 'replay_of', 'candidate_of', 'evaluated_against', 'continuation_of', 'simulated_branch'];

export const RELATION_LABEL: Record<LineageRelation, string> = {
  forked_from: 'forked from',
  replay_of: 'replay of',
  candidate_of: 'candidate of',
  evaluated_against: 'evaluated against',
  continuation_of: 'continuation of',
  simulated_branch: 'simulated branch',
};
