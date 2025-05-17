const { spawnSync } = require('child_process');

/**
 * Calculate text and binary sizes for a list of commits.
 * @param {Array<{commit: string, branches?: string[]}>} commits
 * @param {string} repoPath - Path to the Git repository
 * @returns {Promise<Array<Object>>}
 */
module.exports = async function calcTextAndBinaryOfCommits(commits, repoPath) {
  const getAvgCompressedSize = (textSize, binarySize) => Math.floor(textSize * 0.2 + binarySize * 0.8) / 1000000;
  const getAvgCompressedSizeMBText = (textSize, binarySize) => {
    const size = getAvgCompressedSize(textSize, binarySize);
    if (size >= 0.1) return size.toFixed(1) + ' MB';
    if (size >= 0.01) return size.toFixed(2) + ' MB';
    return '0 MB';
  };
  const avgLineSize = 40;

  console.log(`Commits amount: ${commits.length}`);
  const start = Date.now();
  const results = [];

  for (let i = 0; i < commits.length; i++) {
    const { commit, branches } = commits[i];
    console.log(`[${i + 1}/${commits.length}] Processing ${commit}`);

    let textSize = 0;
    let binarySize = 0;
    const gitOptions = { cwd: repoPath, encoding: 'utf8' };

    const diffOut = spawnSync(
      'git',
      ['show', '--no-ext-diff', '--pretty=format:', '--numstat', '-M', commit],
      gitOptions
    ).stdout;

    const lines = diffOut.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const [added, deleted, file] = line.split('\t');
      if (!file || file.includes('=>')) continue;

      if (/^\d+$/.test(added) && /^\d+$/.test(deleted)) {
        textSize += (parseInt(added, 10) + parseInt(deleted, 10)) * avgLineSize;
      } else if (added === '-' && deleted === '-') {
        const existsInParent = spawnSync('git', ['cat-file', '-e', `${commit}^:${file}`], gitOptions).status === 0;
        if (!existsInParent) {
          const sizeOut = spawnSync('git', ['cat-file', '-s', `${commit}:${file}`], gitOptions);
          if (sizeOut.status === 0) {
            binarySize += parseInt(sizeOut.stdout.trim(), 10);
          }
        }
      }
    }

    const avg = getAvgCompressedSize(textSize, binarySize);
    const avgMB = getAvgCompressedSizeMBText(textSize, binarySize);

    const result = { commit, avgCompressedSize: avg, avgCompressedSizeMB: avgMB, textSize, binarySize };
    if (branches) result.branches = branches;

    console.log(` -> avgCompressedSize=${avgMB} text=${textSize}B binary=${binarySize}B`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`${elapsed}s elapsed\n`);
    results.push(result);
  }

  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return results;
};
