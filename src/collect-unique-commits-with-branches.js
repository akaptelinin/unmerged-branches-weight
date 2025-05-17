#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

(() => {
  const start = Date.now();
  const outFile = path.join(__dirname, 'unique-commits-with-branches.json');
  const MASTER = 'master';
  const commitMap = new Map();

  const refs = execSync(
    'git for-each-ref --format="%(refname)" refs/heads refs/remotes',
    { encoding: 'utf-8', maxBuffer: 10*1024*1024 }
  )
    .trim()
    .split('\n')
    .filter(r => r && !r.endsWith('/HEAD'));

  refs.forEach((ref, i) => {
    const branch = ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '');

    console.log(`(${i+1}/${refs.length}) Checking branch ${branch}`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`${elapsed}s elapsed\n`);    const out = execSync(
      `git rev-list ${ref} --not ${MASTER} --no-merges`,
      { encoding: 'utf-8', maxBuffer: 50*1024*1024 }
    ).trim();
    (out ? out.split('\n') : []).forEach(hash => {
      if (!commitMap.has(hash)) commitMap.set(hash, new Set());
      commitMap.get(hash).add(branch);
    });
  });

  const mergeHashes = new Set(
    execSync('git rev-list --min-parents=2 --all', { encoding: 'utf-8', maxBuffer: 50*1024*1024 })
      .trim()
      .split('\n')
      .filter(h => h)
  );

  const tagCommits = execSync('git rev-list --tags --no-walk', {
    encoding: 'utf-8',
    maxBuffer: 50*1024*1024
  })
    .trim()
    .split('\n')
    .filter(h => h);

  tagCommits.forEach(hash => {
    if (commitMap.has(hash))   return;
    if (mergeHashes.has(hash)) return;
    commitMap.set(hash, null);
  });

  const result = [];
  for (const [commit, branches] of commitMap) {
    result.push(branches === null ? { commit } : { commit, branches: Array.from(branches) });
  }

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`done: ${result.length} entries → ${outFile} in ${(Date.now()-start)/1000}s`);
})();
