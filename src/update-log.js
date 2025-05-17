const readline = require('readline');

module.exports = function updateLog(step, done, total, start) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const msg = `(${done}/${total}) ${step}\n${elapsed}s elapsed`;

  readline.moveCursor(process.stdout, 0, -2);
  readline.clearLine(process.stdout, 0);
  readline.moveCursor(process.stdout, 0, 1);
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);

  process.stdout.write(msg);
}
