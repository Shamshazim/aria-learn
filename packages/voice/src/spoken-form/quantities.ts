import { cardinal, ordinal } from './numbers';

/**
 * Money, clock times, percentages and ordinals — the shapes where the digits are not the
 * whole story. Each one is recognised before plain numbers are, because "$1.50" read as a
 * decimal is "one point five zero" and no child has ever heard money said that way.
 */

/**
 * A comma is a thousands separator only in front of exactly three digits.
 *
 * Anything else is a comma: "Count 10, 20, 30" is a list, and swallowing its commas would
 * delete the pauses a child needs to hear the three numbers as three numbers.
 */
const GROUPED = String.raw`\d{1,3}(?:,\d{3})+|\d+`;

const MONEY = new RegExp(String.raw`\$(${GROUPED})(?:\.(\d{2}))?`, 'gu');
const TIME = /\b([01]?\d|2[0-3]):([0-5]\d)\b/gu;
const PERCENT = new RegExp(String.raw`(${GROUPED})(\.\d+)?\s*%`, 'gu');
const ORDINAL = new RegExp(String.raw`\b(${GROUPED})(?:st|nd|rd|th)\b`, 'gu');
const NUMBER = new RegExp(String.raw`(?:${GROUPED})(?:\.\d+)?`, 'gu');

export function speakQuantities(text: string): string {
  return text
    .replace(MONEY, (_match, dollars: string, cents?: string) => speakMoney(dollars, cents))
    .replace(TIME, (_match, hour: string, minute: string) => speakTime(hour, minute))
    .replace(
      PERCENT,
      (_match, whole: string, fraction?: string) =>
        `${cardinal(toNumber(`${whole}${fraction ?? ''}`))} percent`,
    )
    .replace(ORDINAL, (_match, digits: string) => ordinal(toNumber(digits)))
    .replace(NUMBER, (digits) => cardinal(toNumber(digits)));
}

function speakMoney(dollars: string, cents?: string): string {
  const whole = toNumber(dollars);
  const change = cents === undefined ? 0 : Number(cents);
  const wholeWords = `${cardinal(whole)} ${whole === 1 ? 'dollar' : 'dollars'}`;
  const changeWords = `${cardinal(change)} ${change === 1 ? 'cent' : 'cents'}`;
  if (change === 0) return wholeWords;
  return whole === 0 ? changeWords : `${wholeWords} and ${changeWords}`;
}

/** "3:00" is "three o'clock"; "3:05" is "three oh five"; "3:45" is "three forty-five". */
function speakTime(hour: string, minute: string): string {
  const hourWords = cardinal(Number(hour));
  const minutes = Number(minute);
  if (minutes === 0) return `${hourWords} o'clock`;
  if (minutes < 10) return `${hourWords} oh ${cardinal(minutes)}`;
  return `${hourWords} ${cardinal(minutes)}`;
}

function toNumber(digits: string): number {
  return Number(digits.replaceAll(',', ''));
}
