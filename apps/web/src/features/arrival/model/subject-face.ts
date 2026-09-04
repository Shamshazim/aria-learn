/**
 * How a subject looks on the picker.
 *
 * A child who cannot yet read "Mathematics" can still recognise a face and a colour, so the
 * face carries the card and the word only confirms it. The mapping is by keyword rather than
 * by id because subjects come from the curriculum files, and a new one must not need a code
 * change to be usable — it lands on the default face and still works.
 */
export type SubjectFace = Readonly<{
  emoji: string;
  /** Card background. Kept pale so the dark subject name stays readable on it. */
  tint: string;
  /** The matching saturated colour, used for the card edge and the hover lift. */
  edge: string;
  /** One line for the older bands. */
  note: string;
}>;

const DEFAULT_FACE: SubjectFace = {
  emoji: '📚',
  tint: '#efecfd',
  edge: '#7c5ce0',
  note: 'Today’s lesson is ready.',
};

/**
 * Ordered, so a name that matches two rules takes the first.
 *
 * "English Writing" contains both "writ" and "english", and it is a writing class, so writing
 * is tested first. "Math Adventures" is maths and should look like it, but with its own face.
 */
const RULES: readonly Readonly<{ test: RegExp; face: SubjectFace }>[] = [
  {
    test: /adventure/u,
    face: { emoji: '🧭', tint: '#e9f4fd', edge: '#2a8fd0', note: 'Puzzles, games and real life.' },
  },
  {
    test: /math|arithmetic|number|algebra|geometr/u,
    face: { emoji: '🧮', tint: '#e4edfe', edge: '#2f73f0', note: 'Numbers, shapes and patterns.' },
  },
  {
    test: /writ|composition|spelling|grammar/u,
    face: { emoji: '✏️', tint: '#fbe9f2', edge: '#d9509a', note: 'Put your own words on the page.' },
  },
  {
    test: /read|phonic|literacy|english|language arts/u,
    face: { emoji: '📖', tint: '#fdece4', edge: '#ee7a3c', note: 'Stories, sounds and new words.' },
  },
  {
    test: /science|biolog|chemis|physic/u,
    face: { emoji: '🔬', tint: '#e3f5ea', edge: '#3d9e63', note: 'How the world actually works.' },
  },
  {
    test: /histor|social|geograph/u,
    face: { emoji: '🌍', tint: '#faf0dc', edge: '#c79218', note: 'People, places and what happened.' },
  },
  {
    test: /art|music|draw/u,
    face: { emoji: '🎨', tint: '#f3e9fd', edge: '#8b4fd6', note: 'Make something of your own.' },
  },
];

export function faceFor(subjectName: string): SubjectFace {
  const name = subjectName.toLowerCase();
  return RULES.find((rule) => rule.test.test(name))?.face ?? DEFAULT_FACE;
}
