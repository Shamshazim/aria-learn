import { Band } from '../band'
import { AnswerKind, StepVisual } from '../types'

/**
 * The scripted session used by demo mode.
 *
 * It exists so the three band layouts can be designed, reviewed and corrected against
 * real interaction rather than a screenshot, and so the student experience can still be
 * shown when the local AI engine is not running. Nothing here reaches a real child:
 * `createApiSession` is what the app uses by default.
 */

export type MockSubject = 'math' | 'reading' | 'science'

export interface MockStep {
  say: string
  prompt?: string
  visual?: StepVisual
  answer: AnswerKind
  choices?: string[]
  prefill?: string[]
  /** The right answer, or null when the step is an open written response. */
  key: string | null
  hint: string
  teach: string
}

export const MOCK: Record<Band, Record<MockSubject, { focus: string; steps: MockStep[] }>> = {
  early: {
    math: { focus: 'Counting to 5', steps: [
      { say: 'How many apples?', visual: { kind: 'items', item: 'apple', count: 3 },
        answer: 'tiles', choices: ['2', '3', '4', '5'], key: '3',
        hint: 'Touch each apple. Say one number for each one.',
        teach: 'One… two… three. There are three apples.' },
      { say: 'Now count the stars.', visual: { kind: 'items', item: 'star', count: 5 },
        answer: 'tiles', choices: ['3', '4', '5', '6'], key: '5',
        hint: 'Point at each star while you count.',
        teach: 'Five stars. Count them with your finger.' },
      { say: 'How many blocks?', visual: { kind: 'items', item: 'block', count: 2 },
        answer: 'tiles', choices: ['1', '2', '3', '4'], key: '2',
        hint: 'There are not many. Look again.', teach: 'Two blocks. Just two.' },
    ] },
    reading: { focus: 'First sounds', steps: [
      { say: 'Which letter says buh, like ball?', answer: 'tiles', choices: ['B', 'D', 'M', 'S'], key: 'B',
        hint: 'Buh… buh… ball. Say it out loud.', teach: 'B says buh. Ball starts with B.' },
      { say: 'Which letter says sss, like sun?', answer: 'tiles', choices: ['S', 'T', 'P', 'N'], key: 'S',
        hint: 'Make the sound of a snake.', teach: 'S says sss. Sun starts with S.' },
      { say: 'Which letter says mmm, like moon?', answer: 'tiles', choices: ['N', 'M', 'W', 'R'], key: 'M',
        hint: 'Close your lips and hum.', teach: 'M says mmm. Moon starts with M.' },
    ] },
    science: { focus: 'Living and not living', steps: [
      { say: 'Which one is alive?', answer: 'tiles', choices: ['🐶', '🪨', '🚗', '🥄'], key: '🐶',
        hint: 'Which one eats and grows?', teach: 'A dog is alive. It eats, grows and moves on its own.' },
      { say: 'Which one grows in the ground?', answer: 'tiles', choices: ['🌻', '🔨', '📕', '🧦'], key: '🌻',
        hint: 'Look for the one with roots.', teach: 'A flower grows in the ground.' },
      { say: 'Which one do we drink?', answer: 'tiles', choices: ['💧', '🧱', '🪵', '🔑'], key: '💧',
        hint: 'Your body needs it every day.', teach: 'We drink water.' },
    ] },
  },

  middle: {
    math: { focus: 'Multiplication as equal groups', steps: [
      { say: 'A baker has 4 trays. Each tray holds 6 muffins. How many muffins in total?',
        prompt: '4 trays · 6 muffins on each tray', visual: { kind: 'groups', groups: 4, per: 6 },
        answer: 'numpad', key: '24',
        hint: 'Count one tray first, then add that number four times.',
        teach: 'Four groups of six. 6 + 6 + 6 + 6 = 24, which is the same as 4 × 6.' },
      { say: 'Now try 3 shelves with 7 books on each. How many books?',
        prompt: '3 shelves · 7 books on each shelf', visual: { kind: 'groups', groups: 3, per: 7 },
        answer: 'numpad', key: '21',
        hint: 'Seven, three times. You can add or you can multiply.',
        teach: '3 × 7 = 21 books.' },
      { say: 'A box holds 8 crayons. You have 5 boxes. How many crayons?',
        prompt: '5 boxes · 8 crayons in each box', visual: { kind: 'groups', groups: 5, per: 8 },
        answer: 'numpad', key: '40',
        hint: 'Five groups of eight. Try counting by eights.',
        teach: '8, 16, 24, 32, 40. That is 5 × 8 = 40.' },
    ] },
    reading: { focus: 'Word choice and sentence parts', steps: [
      { say: 'Which word means almost the same as "quick"?',
        prompt: 'Pick the word closest in meaning to quick.',
        answer: 'choices', choices: ['Fast', 'Quiet', 'Heavy', 'Late'], key: 'Fast',
        hint: 'Think about how something moves, not how it sounds.',
        teach: 'Quick and fast both describe speed. They are synonyms.' },
      { say: 'Which one of these is a question?',
        prompt: 'Pick the sentence that asks something.',
        answer: 'choices', choices: ['The dog ran home.', 'Where did the dog go?', 'Run, dog!', 'The dog is brown.'],
        key: 'Where did the dog go?',
        hint: 'Look for the sentence that ends with a question mark.',
        teach: 'A question asks something and ends with a question mark.' },
      { say: 'The rabbit jumped over the log. Which word is the verb?',
        prompt: 'The rabbit jumped over the log.',
        answer: 'choices', choices: ['rabbit', 'jumped', 'over', 'log'], key: 'jumped',
        hint: 'A verb is the doing word. What did the rabbit do?',
        teach: '"Jumped" is the action, so it is the verb.' },
    ] },
    science: { focus: 'Changes and living things', steps: [
      { say: 'Water turns into ice. What do we call that change?',
        prompt: 'Liquid water becomes solid ice.',
        answer: 'choices', choices: ['Freezing', 'Melting', 'Boiling', 'Mixing'], key: 'Freezing',
        hint: 'It happens when something gets very cold.',
        teach: 'Freezing turns a liquid into a solid. Melting does the opposite.' },
      { say: 'How many legs does one insect have?',
        prompt: 'Every insect has the same number of legs.',
        answer: 'numpad', key: '6',
        hint: 'Three pairs of legs.',
        teach: 'All insects have 6 legs. Spiders have 8, so they are not insects.' },
      { say: '3 plants each grow 4 new leaves. How many new leaves in total?',
        prompt: '3 plants · 4 new leaves each', visual: { kind: 'groups', groups: 3, per: 4 },
        answer: 'numpad', key: '12',
        hint: 'Three groups of four.', teach: '3 × 4 = 12 new leaves.' },
    ] },
  },

  senior: {
    math: { focus: 'Solving two-step equations', steps: [
      { say: 'Take it one operation at a time. Undo the addition first.',
        prompt: '3x + 7 = 22', answer: 'work', prefill: ['3x + 7 − 7 = 22 − 7', '3x = 15'], key: '5',
        hint: 'You already have 3x = 15. Divide both sides by 3.',
        teach: '3x = 15, so x = 5. Substitute it back: 3(5) + 7 = 22. It checks out.' },
      { say: 'Same idea, but watch the sign this time.',
        prompt: '5x − 4 = 26', answer: 'work', key: '6',
        hint: 'Add 4 to both sides before you divide.',
        teach: '5x = 30, so x = 6.' },
    ] },
    reading: { focus: 'Reading for tone', steps: [
      { say: 'Read the line, then tell me what the writer wants you to feel.',
        prompt: 'The bridge groaned under the weight of the morning traffic.',
        answer: 'text', key: null,
        hint: '"Groaned" is a sound a tired person makes. Why use it for a bridge?',
        teach: '"Groaned" gives the bridge a human strain, so the traffic feels like a burden. That is personification.' },
      { say: 'Now rewrite that line so the bridge sounds strong instead of tired.',
        prompt: 'Rewrite: The bridge groaned under the weight of the morning traffic.',
        answer: 'text', key: null,
        hint: 'Swap the verb. What sound does something solid make?',
        teach: 'A verb like "held" or "carried" turns strain into strength. The verb sets the tone.' },
    ] },
    science: { focus: 'Speed and heat transfer', steps: [
      { say: 'Set it up as a rate before you divide.',
        prompt: 'A car travels 240 km in 3 hours. Find the average speed in km/h.',
        answer: 'work', prefill: ['speed = distance ÷ time'], key: '80',
        hint: '240 divided by 3.',
        teach: '240 ÷ 3 = 80 km/h. Average speed is total distance over total time.' },
      { say: 'Explain the mechanism, not just the result.',
        prompt: 'Why does a metal spoon left in hot soup become warm?',
        answer: 'text', key: null,
        hint: 'Think about what the particles in the metal are doing.',
        teach: 'Conduction. Fast-moving particles in the soup collide with particles in the spoon and pass energy along the metal.' },
    ] },
  },
}

export function isMockSubject(v: string | null): v is MockSubject {
  return v === 'math' || v === 'reading' || v === 'science'
}
