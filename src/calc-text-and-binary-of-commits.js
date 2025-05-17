const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const updateLog = require('./update-log');

/**
 * Calculate text and binary sizes for a list of commits.
 * @param {Array<{commit: string, branches?: string[]}>} commits
 * @param {string} repoPath - Path to the Git repository
 * @param {string} reportDir - Directory to write report files
 * @param {number} [startTs] - Timestamp (ms) when script started; if omitted, uses now
 * @returns {Promise<Array<Object>>}
 */
module.exports = async function calcTextAndBinaryOfCommits(commits, repoPath, reportDir, startTs) {
  const start = typeof startTs === 'number' ? startTs : Date.now();

  const guessCoef = file => {
    const ext = path.extname(file).toLowerCase().replace('.', '');
    const map = new Map([
      [['js', 'ts', 'jsx', 'tsx', 'c', 'cpp', 'h', 'cs', 'java', 'kt', 'py', 'go', 'rb', 'php', 'rs', 'swift', 'lua', 'scala', 'css', 'scss', 'less', 'sass', 'html', 'htm', 'xml', 'json', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'md', 'txt', 'csv', 'tsv', 'sql', 'log', 'sh', 'bat', 'dockerfile', 'makefile'], 0.25],
      [['min.js', 'min.css'], 0.35],
      [['svg'], 0.25],
      [['exe', 'dll', 'so', 'dylib', 'a', 'o', 'obj', 'class', 'wasm'], 0.5],
      [['pdf'], 0.6],
      [['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'], 0.8],
      [['zip', 'jar', 'rar', '7z', 'gz', 'bz2', 'xz', 'tgz', 'tar.gz', 'iso'], 1.0],
      [['jpg', 'jpeg', 'jfif', 'heic', 'heif'], 0.95],
      [['png', 'gif', 'webp', 'bmp', 'tiff', 'tif'], 0.9],
      [['cr2', 'nef', 'dng', 'arw', 'rw2'], 0.75],
      [['woff', 'woff2', 'ttf', 'otf', 'eot'], 0.85],
      [['wav', 'aiff'], 0.6],
      [['flac'], 0.65],
      [['mp3', 'ogg', 'oga', 'aac', 'm4a', 'opus'], 0.98],
      [['mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'flv'], 0.99],
      [['bin', 'img'], 0.85],
      [['parquet', 'orc'], 0.4],
    ].flatMap(([exts, k]) => exts.map(e => [e, k])));
    return map.get(ext) ?? 0.7;
  };

  const getEstCompressedSize = (textSize, binarySize, binaryCoef) =>
    Math.floor(textSize * 0.2 + binarySize * binaryCoef);
  const getEstCompressedSizeMBText = estSize => {
    const size = estSize / (1024 * 1024);
    if (size >= 0.1) return size.toFixed(1) + ' MB';
    if (size >= 0.01) return size.toFixed(2) + ' MB';
    return '0 MB';
  };
  const avgLineSize = 40;

  console.log(`Commits amount: ${commits.length}`);
  const results = [];

  let totalTextSize = 0;
  let totalBinarySize = 0;
  let totalEstSize = 0;

  for (let i = 0; i < commits.length; i++) {
    const { commit, branches } = commits[i];

    let textSize = 0;
    let binarySize = 0;
    let estSize = 0;
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
        const existsInParent =
          spawnSync('git', ['cat-file', '-e', `${commit}^:${file}`], gitOptions).status === 0;
        if (!existsInParent) {
          const sizeOut = spawnSync('git', ['cat-file', '-s', `${commit}:${file}`], gitOptions);
          if (sizeOut.status === 0) {
            binarySize += parseInt(sizeOut.stdout.trim(), 10);
            estSize = getEstCompressedSize(textSize, binarySize, guessCoef(file));
          }
        }
      }
    }

    const estMB = getEstCompressedSizeMBText(estSize);
    const result = { commit, estCompressedSize: estSize, estCompressedSizeMB: estMB, textSize, binarySize };
    if (branches) result.branches = branches;
    results.push(result);

    totalTextSize += textSize;
    totalBinarySize += binarySize;
    totalEstSize += estSize;
    const msg = ` ${commit} → estimate total compressed size=${getEstCompressedSizeMBText(totalEstSize)}, total text size=${textSize}B, total binary size=${binarySize}B`;
    updateLog(msg, i + 1, commits.length, start);
  }

  process.stdout.write('\n');
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  results.sort((a, b) => {
    const diff = b.estCompressedSize - a.estCompressedSize;
    if (diff !== 0) return diff;
    return b.textSize + b.binarySize - (a.textSize + a.binarySize);
  });

  const outPath = path.join(reportDir, 'commits_with_branches_and_sizes.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

  return results;
};
