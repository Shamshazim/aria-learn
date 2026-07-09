// Registry of student learning resources shown on the Resources hub.
//
// To add a new resource: append an entry here, then (if it has its own page)
// add a matching <Route> in App.tsx pointing at `to`. The hub renders whatever
// is in this list, so nothing else needs to change.

export type ResourceSubject = 'Math' | 'English' | 'General'

export interface ResourceDef {
  id: string
  title: string
  emoji: string
  /** One friendly sentence a child (or parent) can understand. */
  blurb: string
  /** Route the card links to. */
  to: string
  subject: ResourceSubject
  /** A CSS custom-property name (without the leading --) used as the card accent. */
  accent: string
}

export const RESOURCES: ResourceDef[] = [
  {
    id: 'multiplication-chart',
    title: 'Multiplication Chart',
    emoji: '✖️',
    blurb: 'Explore the times tables, hide the answers to test yourself, or play a quick quiz.',
    to: '/student/resources/multiplication',
    subject: 'Math',
    accent: 'indigo',
  },
  {
    id: 'addition-facts',
    title: 'Addition & Subtraction Facts',
    emoji: '➕',
    blurb: 'Learn your number bonds with a facts grid and a quick + and − quiz.',
    to: '/student/resources/addition',
    subject: 'Math',
    accent: 'teal',
  },
  {
    id: 'hundreds-chart',
    title: 'Hundreds Chart',
    emoji: '💯',
    blurb: 'Count, skip-count by 2s, 5s and 10s, and find odd and even number patterns.',
    to: '/student/resources/hundreds-chart',
    subject: 'Math',
    accent: 'sky',
  },
  {
    id: 'sight-words',
    title: 'Sight Words',
    emoji: '👀',
    blurb: 'Flashcards for the 100 most common words — hear them and practise reading them fast.',
    to: '/student/resources/sight-words',
    subject: 'English',
    accent: 'pink',
  },
]
