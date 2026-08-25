import { z } from 'zod';

import { isScrubbedContext, type ScrubbedContext } from '@/privacy';

const MAX_PROMPT_INPUT_LENGTH = 2_000;

export const promptTextSchema = z.string().max(MAX_PROMPT_INPUT_LENGTH).trim().min(1);
export const scrubbedContextSchema = z.custom<ScrubbedContext>(isScrubbedContext);
