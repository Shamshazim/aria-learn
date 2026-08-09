'use strict';

/**
 * Incremental newline-delimited-JSON reader.
 *
 * Ollama reports download progress as one JSON object per line, but a network chunk can
 * split a line anywhere — including mid-number, so a naive parse-per-chunk both loses events
 * and throws. This keeps the unterminated tail of each chunk and prepends it to the next, so
 * a line is only parsed once it is complete.
 */
function createNdjsonParser() {
  let buffer = '';

  return {
    /** @returns {object[]} the objects completed by this chunk, in order */
    push(text) {
      buffer += text;
      const lines = buffer.split('\n');
      // The final element is whatever came after the last newline: possibly a partial line.
      buffer = lines.pop() ?? '';

      const events = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line));
        } catch {
          // A malformed line is not worth aborting a multi-gigabyte download over.
        }
      }
      return events;
    },
  };
}

module.exports = { createNdjsonParser };
