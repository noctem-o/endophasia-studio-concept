import type { LinkClass } from '../../state/compare';

export const CLASS_LABEL: Record<LinkClass, string> = {
  exact: 'EXACT',
  proposed: 'PROPOSED',
  'unmatched-a': 'UNMATCHED A',
  'unmatched-b': 'UNMATCHED B',
};

/** What each class asserts — and what it does not. */
export const CLASS_MEANING: Record<LinkClass, string> = {
  exact: 'Same event kind and tool, and identical values for the compared fields.',
  proposed: 'Same kind and tool, paired in storage order. A hypothesis for inspection, not a verified pairing.',
  'unmatched-a': 'No counterpart was proposed in B.',
  'unmatched-b': 'No counterpart was proposed in A.',
};
