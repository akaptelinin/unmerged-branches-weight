const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Calculate text and binary sizes for a list of commits.
 * @param {Array<{commit: string, branches?: string[]}>} commits
 * @param {string} repoPath - Path to the Git repository
 * @param {string} reportDir - Directory to write report files
 * @returns {Promise<Array<Object>>}
 */
module.exports = async function calcTextAndBinaryOfCommits(commits, repoPath, reportDir) {
  const getEstCompressedSize = (textSize, binarySize) => Math.floor(textSize * 0.2 + binarySize * 0.8);
  const getEstCompressedSizeMBText = (textSize, binarySize) => {
    const size = getEstCompressedSize(textSize, binarySize) / (1024 * 1024);
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

    const est = getEstCompressedSize(textSize, binarySize);
    const estMB = getEstCompressedSizeMBText(textSize, binarySize);

    const result = { commit, estCompressedSize: est, estCompressedSizeMB: estMB, textSize, binarySize };
    if (branches) result.branches = branches;

    console.log(` -> estCompressedSize=${estMB} text=${textSize}B binary=${binarySize}B`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`${elapsed}s elapsed\n`);
    results.push(result);
  }

  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  results.sort((a,b) => {
    const diffCompressed = b.estCompressedSize - a.estCompressedSize;

    if (diffCompressed !== 0) return diffCompressed

    return (b.textSize + b.binarySize) - (a.textSize + a.binarySize)
  })

  const outPath = path.join(reportDir, 'commits_with_branches_and_sizes.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

  return results;
};
