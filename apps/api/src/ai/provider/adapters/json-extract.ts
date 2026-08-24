import { z } from 'zod';

const jsonObjectSchema = z.record(z.string(), z.unknown());

export class JsonExtractionError extends Error {
  constructor() {
    super('Model output did not contain exactly one valid JSON object');
    this.name = 'JsonExtractionError';
  }
}

/** Returns one outermost JSON object and rejects missing, invalid, or ambiguous output. */
export function extractJsonObject(input: string): string {
  const candidates = findOutermostObjects(input);
  if (candidates.length !== 1) throw new JsonExtractionError();
  const candidate = candidates[0];
  if (candidate === undefined || !isJsonObject(candidate)) throw new JsonExtractionError();
  return candidate;
}

function findOutermostObjects(input: string): string[] {
  const candidates: string[] = [];
  let state: ScannerState = { start: -1, depth: 0, inString: false, escaped: false };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === undefined) continue;
    const previous = state;
    state = scanCharacter(state, character, index);
    if (previous.start >= 0 && state.start < 0) {
      candidates.push(input.slice(previous.start, index + 1));
    }
  }
  if (state.start >= 0) throw new JsonExtractionError();
  return candidates;
}

type ScannerState = {
  start: number;
  depth: number;
  inString: boolean;
  escaped: boolean;
};

function scanCharacter(state: ScannerState, character: string, index: number): ScannerState {
  if (state.start < 0) {
    return character === '{' ? { start: index, depth: 1, inString: false, escaped: false } : state;
  }
  return state.inString
    ? scanStringCharacter(state, character)
    : scanObjectCharacter(state, character);
}

function scanStringCharacter(state: ScannerState, character: string): ScannerState {
  if (state.escaped) return { ...state, escaped: false };
  if (character === '\\') return { ...state, escaped: true };
  if (character === '"') return { ...state, inString: false };
  return state;
}

function scanObjectCharacter(state: ScannerState, character: string): ScannerState {
  if (character === '"') return { ...state, inString: true };
  if (character === '{') return { ...state, depth: state.depth + 1 };
  if (character !== '}') return state;
  const depth = state.depth - 1;
  return { ...state, depth, start: depth === 0 ? -1 : state.start };
}

function isJsonObject(candidate: string): boolean {
  try {
    const parsed: unknown = JSON.parse(candidate);
    return jsonObjectSchema.safeParse(parsed).success;
  } catch {
    return false;
  }
}
