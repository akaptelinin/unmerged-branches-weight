const { execSync } = require('child_process');

const updateLog = require('./update-log');

/**
 * Collect unique commits with their branches for a given Git repository.
 * @param {string} repoPath - Path to the Git repository
 * @param {string} defaultBr - Branch to exclude commits from
 * @param {number} [startTs] - Timestamp (ms) when script started; if omitted, uses now
 * @returns {Promise<Array<{commit: string, branches?: string[]}>>}
 */
module.exports = async function collectUniqueCommitsWithBranches(repoPath, defaultBr, startTs) {
  const start = typeof startTs === 'number' ? startTs : Date.now();
  const commitMap = new Map();

  // Git options
  const gitSmall = { cwd: repoPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 };
  const gitLarge = { cwd: repoPath, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 };

  // List all branches and remotes
  const refs = execSync(
    'git for-each-ref --format="%(refname)" refs/heads refs/remotes',
    gitSmall
  )
    .trim()
    .split('\n')
    .filter(r => r && !r.endsWith('/HEAD'));

  // Process each branch with single-line updating log
  refs.forEach((ref, i) => {
    const branch = ref.replace(/^refs\/(heads|remotes)\//, '');
    updateLog(`Checking branch ${branch}`, i + 1, refs.length, start);

    const out = execSync(
      `git rev-list ${ref} --not ${defaultBr} --no-merges`,
      gitLarge
    ).trim();

    (out ? out.split('\n') : []).forEach(hash => {
      if (!commitMap.has(hash)) commitMap.set(hash, new Set());
      commitMap.get(hash).add(branch);
    });
  });

  // finish log line
  process.stdout.write('\n');

  // Exclude merge commits
  const mergeHashes = new Set(
    execSync('git rev-list --min-parents=2 --all', gitLarge)
      .trim()
      .split('\n')
      .filter(h => h)
  );

  // Include tag commits if not already present
  const tagCommits = execSync('git rev-list --tags --no-walk', gitLarge)
    .trim()
    .split('\n')
    .filter(h => h);

  tagCommits.forEach(hash => {
    if (commitMap.has(hash) || mergeHashes.has(hash)) return;
    commitMap.set(hash, null);
  });

  // Build result array
  const result = [];
  for (const [commit, branches] of commitMap) {
    result.push(
      branches === null
        ? { commit }
        : { commit, branches: Array.from(branches) }
    );
  }

  return result;
};
