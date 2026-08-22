import { BookOpen, ClipboardCheck, Handshake, House, LucideIcon, PencilLine, Search } from 'lucide-react'

/** The learning steps for a topic, in order. The quiz is intentionally LAST — the final
 *  assessment after the student has learned, seen examples, practiced, and done homework. */
export type StepKey = 'learn' | 'examples' | 'guided' | 'practice' | 'homework' | 'quiz'

export interface TopicStep {
  key: StepKey
  label: string
  path: string // route suffix under /student/topic/:topicId/
  icon: LucideIcon
  className?: string
}

export const TOPIC_STEPS: TopicStep[] = [
  { key: 'learn', label: 'Learn', path: 'knowledge', icon: BookOpen },
  { key: 'examples', label: 'Examples', path: 'examples', icon: Search },
  { key: 'guided', label: 'Guided', path: 'guided', icon: Handshake },
  { key: 'practice', label: 'Practice', path: 'practice', icon: PencilLine },
  { key: 'homework', label: 'Homework', path: 'homework', icon: House, className: 'flow-step--hw' },
  { key: 'quiz', label: 'Quiz', path: 'quiz', icon: ClipboardCheck, className: 'flow-step--quiz' },
]

export function stepPath(topicId: string, step: TopicStep): string {
  return `/student/topic/${topicId}/${step.path}`
}

/** The next step after the given one, or null if this is the last (quiz). */
export function nextStep(key: StepKey): TopicStep | null {
  const i = TOPIC_STEPS.findIndex((s) => s.key === key)
  return i >= 0 && i < TOPIC_STEPS.length - 1 ? TOPIC_STEPS[i + 1] : null
}

// ── Completion tracking (per student, in localStorage) ───────────────────────
const storageKey = (userId: string) => `aria:steps:${userId}`
type DoneMap = Record<string, StepKey[]>

function readMap(userId: string): DoneMap {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) || '{}') } catch { return {} }
}

export function getDoneSteps(userId: string, topicId: string): StepKey[] {
  return readMap(userId)[topicId] ?? []
}

export function isStepDone(userId: string, topicId: string, key: StepKey): boolean {
  return getDoneSteps(userId, topicId).includes(key)
}

/** Marks a step complete for this student+topic (idempotent). */
export function markStepDone(userId: string | undefined, topicId: string | undefined, key: StepKey): void {
  if (!userId || !topicId) return
  const map = readMap(userId)
  const set = new Set(map[topicId] ?? [])
  if (set.has(key)) return
  set.add(key)
  map[topicId] = [...set]
  try { localStorage.setItem(storageKey(userId), JSON.stringify(map)) } catch { /* ignore */ }
}
