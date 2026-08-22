'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createNdjsonParser } = require('../src/lib/ndjson');

test('parses whole lines from a single chunk', () => {
  const parser = createNdjsonParser();
  const events = parser.push('{"status":"pulling"}\n{"total":10,"completed":5}\n');
  assert.deepStrictEqual(events, [{ status: 'pulling' }, { total: 10, completed: 5 }]);
});

test('withholds a partial line until its newline arrives', () => {
  const parser = createNdjsonParser();
  assert.deepStrictEqual(parser.push('{"total":100,"comp'), []);
  assert.deepStrictEqual(parser.push('leted":40}\n'), [{ total: 100, completed: 40 }]);
});

/** The real failure mode: a chunk boundary landing inside a number would corrupt progress. */
test('reassembles a line split across three chunks', () => {
  const parser = createNdjsonParser();
  assert.deepStrictEqual(parser.push('{"total":49'), []);
  assert.deepStrictEqual(parser.push('00000000,"comple'), []);
  assert.deepStrictEqual(parser.push('ted":1225000000}\n'),
    [{ total: 4900000000, completed: 1225000000 }]);
});

test('emits several events when one chunk completes multiple lines', () => {
  const parser = createNdjsonParser();
  parser.push('{"completed":1}\n{"completed":2}\n{"comp');
  const events = parser.push('leted":3}\n{"completed":4}\n');
  assert.deepStrictEqual(events, [{ completed: 3 }, { completed: 4 }]);
});

test('ignores blank lines', () => {
  const parser = createNdjsonParser();
  assert.deepStrictEqual(parser.push('\n\n{"status":"ok"}\n\n'), [{ status: 'ok' }]);
});

test('skips a malformed line rather than aborting the download', () => {
  const parser = createNdjsonParser();
  const events = parser.push('{"completed":1}\nnot json at all\n{"completed":2}\n');
  assert.deepStrictEqual(events, [{ completed: 1 }, { completed: 2 }]);
});

test('surfaces an error object so the caller can fail the pull', () => {
  const parser = createNdjsonParser();
  const [event] = parser.push('{"error":"no space left on device"}\n');
  assert.strictEqual(event.error, 'no space left on device');
});
