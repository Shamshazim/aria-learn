// Fry's first 100 "instant words" — the 100 most frequent words in English.
// These are learned by sight (instant recognition) to build reading fluency;
// the first 100 are typically targeted for mastery by end of Grade 1.
// Source: Dr. Edward Fry's Instant Word list (sightwords.com).

export interface SightWordSet {
  label: string
  words: string[]
}

export const FRY_FIRST_100: SightWordSet[] = [
  {
    label: 'Words 1–25',
    words: ['the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it',
      'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'I',
      'at', 'be', 'this', 'have', 'from'],
  },
  {
    label: 'Words 26–50',
    words: ['or', 'one', 'had', 'by', 'words', 'but', 'not', 'what', 'all', 'were',
      'we', 'when', 'your', 'can', 'said', 'there', 'use', 'an', 'each', 'which',
      'she', 'do', 'how', 'their', 'if'],
  },
  {
    label: 'Words 51–75',
    words: ['will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so',
      'some', 'her', 'would', 'make', 'like', 'him', 'into', 'time', 'has', 'look',
      'two', 'more', 'write', 'go', 'see'],
  },
  {
    label: 'Words 76–100',
    words: ['number', 'no', 'way', 'could', 'people', 'my', 'than', 'first', 'water', 'been',
      'called', 'who', 'oil', 'sit', 'now', 'find', 'long', 'down', 'day', 'did',
      'get', 'come', 'made', 'may', 'part'],
  },
]
