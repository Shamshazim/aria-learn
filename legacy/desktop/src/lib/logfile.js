'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Opens a log file as a raw descriptor for a child process to inherit.
 *
 * A stream from createWriteStream cannot be used here: it opens its file asynchronously, so
 * at the moment spawn() inspects it there is no descriptor yet and the call fails outright.
 * An integer fd from openSync is available immediately and is what stdio actually wants.
 */
function openLog(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return fs.openSync(file, 'a');
}

module.exports = { openLog };
