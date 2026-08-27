import { lessonNoteSchema } from '@/curriculum/lessons/lesson.schema';
import type { LessonNote } from '@/curriculum/lessons/lesson.types';

/** The headings a note must carry, mapped to the field each one fills. */
const PROSE_SECTIONS = {
  'What it is': 'whatItIs',
  'The one idea': 'oneIdea',
  'Worked example': 'workedExample',
} as const;

const LIST_SECTIONS = {
  'Common stumbles': 'stumbles',
  'Two concrete models': 'models',
  'Language to use': 'useLanguage',
  'Language to avoid': 'avoidLanguage',
} as const;

export class LessonNoteError extends Error {
  override readonly name = 'LessonNoteError';
}

/**
 * Turns one authored `.md` note into the typed record a prompt is built from.
 *
 * The parse is strict and the schema is applied after it: a note missing its models or its
 * review line fails here, at load, rather than producing a thinner explanation later that
 * nobody would trace back to a missing heading.
 */
export function parseLessonNote(source: string, fileName: string): LessonNote {
  const { frontMatter, body } = split(source, fileName);
  const sections = readSections(body);
  const candidate: Record<string, unknown> = {
    id: frontMatter.get('id') ?? '',
    skillCode: frontMatter.get('skill') ?? '',
    review: { status: frontMatter.get('review') ?? '' },
    ...Object.fromEntries(
      Object.entries(PROSE_SECTIONS).map(([heading, field]) => [
        field,
        (sections.get(heading) ?? []).join(' '),
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(LIST_SECTIONS).map(([heading, field]) => [
        field,
        bullets(sections.get(heading) ?? []),
      ]),
    ),
  };
  const parsed = lessonNoteSchema.safeParse(candidate);
  if (!parsed.success)
    throw new LessonNoteError(`Lesson note ${fileName}: ${parsed.error.message}`);
  return parsed.data;
}

function split(
  source: string,
  fileName: string,
): {
  frontMatter: ReadonlyMap<string, string>;
  body: string;
} {
  const match = /^---\n(?<head>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(source);
  const head = match?.groups?.head;
  const body = match?.groups?.body;
  if (head === undefined || body === undefined) {
    throw new LessonNoteError(`Lesson note ${fileName} has no front matter block`);
  }
  const frontMatter = new Map<string, string>();
  for (const line of head.split('\n')) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      frontMatter.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  return { frontMatter, body };
}

function readSections(body: string): ReadonlyMap<string, readonly string[]> {
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of body.split('\n')) {
    const heading = /^## (?<title>.+)$/u.exec(line)?.groups?.title;
    if (heading !== undefined) {
      current = [];
      sections.set(heading.trim(), current);
      continue;
    }
    if (current !== null && line.trim() !== '') current.push(line.trim());
  }
  return sections;
}

function bullets(lines: readonly string[]): readonly string[] {
  return lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2).trim());
}
