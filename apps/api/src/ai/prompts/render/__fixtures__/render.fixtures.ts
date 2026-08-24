export type RenderFixture = Readonly<{
  name: string;
  template: string;
  values: Readonly<Record<string, string>>;
  expected: string;
}>;

export const RENDER_FIXTURES: readonly RenderFixture[] = [
  {
    name: 'replaces repeated named values in order',
    template: '{{learner}} can use {{strategy}}. Ask {{learner}} to try.',
    values: { learner: 'the learner', strategy: 'counting on' },
    expected: 'the learner can use counting on. Ask the learner to try.',
  },
  {
    name: 'does not evaluate placeholders supplied inside a value',
    template: 'Context: {{context}}\nTask: {{task}}',
    values: { context: '{{task}} is learner text', task: 'add 4 and 5' },
    expected: 'Context: {{task}} is learner text\nTask: add 4 and 5',
  },
];
