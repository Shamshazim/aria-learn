/**
 * What a move puts on screen.
 *
 * Display content is a union of its own so the same visual can accompany different moves,
 * and so adding a content type never widens the move union.
 */
export {
  moveContentSchema,
  displaySchema,
  textContentSchema,
  choicesContentSchema,
  visualContentSchema,
  passageContentSchema,
  workpadContentSchema,
} from './schemas/content.schema';

export type {
  MoveContent,
  Display,
  TextContent,
  ChoicesContent,
  VisualContent,
  PassageContent,
  WorkpadContent,
} from './schemas/content.schema';
