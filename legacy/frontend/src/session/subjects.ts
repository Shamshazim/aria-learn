/**
 * How a subject looks on the picker.
 *
 * A child who cannot yet read "Mathematics" can still recognise a face and a colour, so
 * the face carries the card and the word only confirms it. The mapping is by keyword
 * rather than by id because subjects come from the curriculum JSON and a new one must
 * not need a code change to be usable — it lands on the default face and still works.
 */
export interface SubjectFace {
  emoji: string
  /** Card background. Kept pale so the black subject name stays readable on it. */
  tint: string
  /** The matching saturated colour, used for the card edge and the hover lift. */
  edge: string
  /** One line for the older bands. The early band never sees it. */
  note: string
}

const DEFAULT_FACE: SubjectFace = {
  emoji: '📚', tint: '#EFECFD', edge: '#7C5CE0', note: 'Today’s lesson is ready.',
}

/**
 * Ordered, so a name that matches two rules takes the first.
 *
 * Two real collisions decide the order. "English Writing" contains both "writ" and
 * "english", and it is a writing class, so writing is tested first. "English Language
 * Arts" contains both "language" and "art", and a child opening it should meet reading
 * rather than painting, so art is tested last.
 */
const RULES: Array<{ test: RegExp; face: SubjectFace }> = [
  { test: /math|arithmetic|number|algebra|geometr/, face: {
    emoji: '🧮', tint: '#E4EDFE', edge: '#2F73F0', note: 'Numbers, shapes and patterns.' } },
  { test: /writ|composition|spelling|grammar/, face: {
    emoji: '✏️', tint: '#FBE9F2', edge: '#D9509A', note: 'Put your own words on the page.' } },
  { test: /read|phonic|literacy|english|language arts/, face: {
    emoji: '📖', tint: '#FDECE4', edge: '#EE7A3C', note: 'Stories, sounds and new words.' } },
  { test: /science|biolog|chemis|physic/, face: {
    emoji: '🔬', tint: '#E3F5EA', edge: '#3D9E63', note: 'How the world actually works.' } },
  { test: /histor|social|geograph/, face: {
    emoji: '🌍', tint: '#FAF0DC', edge: '#C79218', note: 'People, places and what happened.' } },
  { test: /art|music|draw/, face: {
    emoji: '🎨', tint: '#F3E9FD', edge: '#8B4FD6', note: 'Make something of your own.' } },
]

export function faceFor(subjectName: string): SubjectFace {
  const name = subjectName.toLowerCase()
  return RULES.find((r) => r.test.test(name))?.face ?? DEFAULT_FACE
}
