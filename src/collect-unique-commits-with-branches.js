const { execSync } = require('child_process');

/**
 * Collect unique commits with their branches for a given Git repository.
 * @param {string} repoPath - Path to the Git repository
 * @returns {Promise<Array<{commit: string, branches?: string[]}>>}
 */
module.exports = async function collectUniqueCommitsWithBranches(repoPath, defaultBr) {
  const start = Date.now();
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

  // Collect commits unique to each branch
  refs.forEach((ref, i) => {
    const branch = ref.replace(/^refs\/(heads|remotes)\//, '');
    console.log(`(${i + 1}/${refs.length}) Checking branch ${branch}`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`${elapsed}s elapsed\n`);

    const out = execSync(
      `git rev-list ${ref} --not ${defaultBr} --no-merges`,
      gitLarge
    ).trim();

    (out ? out.split('\n') : []).forEach(hash => {
      if (!commitMap.has(hash)) commitMap.set(hash, new Set());
      commitMap.get(hash).add(branch);
    });
  });

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
    result.push(branches === null ? { commit } : { commit, branches: Array.from(branches) });
  }

  return result;
};
