#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const readline = require('readline-sync');
const { execSync } = require('child_process');

function promptRepoPath() {
  const cwd = process.cwd();
  while (true) {
    const input = readline.question(`Git repo path (default: ${cwd}): `).trim();
    const repoPath = input || cwd;

    if (!fs.existsSync(repoPath)) {
      console.error(`Error: directory "${repoPath}" does not exist.`);
      console.error('Please check the path or press Enter to use the default.\n');
      continue;
    }
    if (!fs.statSync(repoPath).isDirectory()) {
      console.error(`Error: "${repoPath}" is not a directory.`);
      console.error('Make sure you point to the Git repo root folder.\n');
      continue;
    }
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      console.error(`Error: "${repoPath}" is not a Git repository (no .git folder).`);
      console.error('Provide a path to a folder initialized with "git init" or cloned.\n');
      continue;
    }
    return repoPath;
  }
}

function promptReportDir(defaultDir) {
  while (true) {
    const input = readline.question(`Output folder path (default: ${defaultDir}): `).trim();
    const choice = input || defaultDir;

    if (input) {
      const segments = input.split(/[\\/]+/);
      const bad = segments.find(seg =>
        seg === '.' ||
        seg === '..' ||
        seg.endsWith(' ') ||
        seg.endsWith('.')
      );
      if (bad) {
        console.error(`Error: invalid folder name segment "${bad}".`);
        console.error('Segments cannot be "." or "..", or end with a dot or space.\n');
        continue;
      }
    }

    const reportDir = path.resolve(choice);
    try {
      if (fs.existsSync(reportDir)) {
        if (!fs.statSync(reportDir).isDirectory()) {
          console.error(`Error: "${reportDir}" exists but is not a directory.`);
          console.error('Choose a different path or remove the existing file.\n');
          continue;
        }
        fs.accessSync(reportDir, fs.constants.W_OK);
      } else {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      return reportDir;
    } catch (err) {
      if (err.code === 'EACCES') {
        console.error(`Error: no permission to create or write to "${reportDir}".`);
        console.error('Try a different location or adjust folder permissions.\n');
      } else if (err.code === 'EINVAL' || err.code === 'ENOENT') {
        console.error(`Error: invalid path format "${reportDir}".`);
        console.error('Ensure the path syntax is correct.\n');
      } else {
        console.error(`Error accessing "${reportDir}": ${err.message}\n`);
      }
    }
  }
}

function detectDefaultBranch(repoPath) {
  try {
    execSync('git rev-parse --verify master', { cwd: repoPath, stdio: 'ignore' });
    return 'master';
  } catch {
    try {
      execSync('git rev-parse --verify main', { cwd: repoPath, stdio: 'ignore' });
      return 'main';
    } catch {
      return null;
    }
  }
}

function promptDefaultBranch(repoPath) {
  const def = detectDefaultBranch(repoPath);
  const promptLabel = def
    ? `Default branch name (default: ${def}): `
    : 'Default branch name (no “master” or “main” found): ';
  while (true) {
    const input = readline.question(promptLabel).trim();
    const branch = input || def;
    if (!branch) {
      console.error('Error: no default branch detected and none provided.');
      console.error('Please type a branch name that exists in the repo.\n');
      continue;
    }
    try {
      execSync(`git rev-parse --verify ${branch}`, { cwd: repoPath, stdio: 'ignore' });
      return branch;
    } catch {
      console.error(`Error: branch "${branch}" does not exist in repository.`);
      console.error('Please check the branch name and try again.\n');
    }
  }
}

// === main ===
const repoPath   = promptRepoPath();
const defaultDir = path.join(repoPath, 'unmerged-branches-size-report');
const reportDir  = promptReportDir(defaultDir);
const defaultBr  = promptDefaultBranch(repoPath);

console.log(`Repository:     ${repoPath}`);
console.log(`Report folder:  ${reportDir}`);
console.log(`Default branch: ${defaultBr}`);

const collect   = require('../src/collect-unique-commits-with-branches');
const calc      = require('../src/calc-text-and-binary-of-commits');
const aggregate = require('../src/aggregate-branches-by-size');

(async () => {
  try {
    const commits  = await collect(repoPath, defaultBr);
    const withSize = await calc(commits, repoPath, reportDir);
    await aggregate(withSize, reportDir);
  } catch (err) {
    console.error('Error:', err.message || err);
    console.error('If this keeps happening, make sure the repo is valid and try again.\n');
  }
})();
