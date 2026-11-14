import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Proportion goes wrong when the price per item is never found. */
export const RAT_PROP_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-rat-prop-additive',
    skillCode: 'RAT.PROP',
    name: 'Adds a dollar for each extra item',
    signature: 'Adds the difference in count to the cost, as if each item cost one dollar',
    remediation: 'First find what one costs. Then times it by how many you want.',
    approach: 'worked-example',
    model: 'a table with one, three and five items and their cost',
    detects: { kind: 'derived', rule: 'additive-ratio' },
  },
  {
    id: 'misconception-rat-prop-kept-total',
    skillCode: 'RAT.PROP',
    name: 'Gives the cost already in the question',
    signature: 'Repeats the known total instead of finding the new one',
    remediation: 'More items cost more. Find the cost of one, then build up.',
    approach: 'concrete-story',
    model: 'a shop till ringing up items one at a time',
    detects: { kind: 'derived', rule: 'kept-total' },
  },
  {
    id: 'misconception-rat-prop-multiplied-total',
    skillCode: 'RAT.PROP',
    name: 'Multiplies the whole cost by the new count',
    signature: 'Multiplies the total for several items by the new number of items',
    remediation: 'The cost given is for three pens, not one. Share it first.',
    approach: 'visual-model',
    model: 'a bar for the cost of three pens split into three',
    detects: { kind: 'derived', rule: 'multiplied-total' },
  },
];
