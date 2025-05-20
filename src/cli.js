/**
 * CLI for unmerged‑branches‑size report.
 *
 * Flags:
 *   --repo   | -r <path>   path to the Git repository (positional also accepted)
 *   --out    | -o <path>   output directory for the report
 *   --branch | -b <name>   default branch name (master | main)
 *   --no-prompt | -y       run non‑interactively, falling back to defaults
 *   --help   | -h          show usage
 *
 * Behaviour:
 *   • First non‑flag argument is treated as --repo for backward compat.
 *   • With --no-prompt any missing option uses defaults / auto‑detect; no prompts.
 *   • Default branch auto‑detects "master" or "main"; error if neither found
 *     and --branch is missing when --no-prompt is used.
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline-sync');
const { execSync } = require('child_process');

const collect = require('./collect-unique-commits-with-branches');
const calc = require('./calc-text-and-binary-of-commits');
const aggregate = require('./aggregate-branches-by-size');
const isSafePath = require('./is-safe-path');


// ───────────────────────── helpers ──────────────────────────
function usage() {
  console.log(`Usage: unmerged-branches-size [options] [repo]\n\n` +
    `Options:\n` +
    `  -r, --repo <path>       Path to Git repository\n` +
    `  -o, --out  <path>       Output folder for the report\n` +
    `  -b, --branch <name>     Default branch name (master | main)\n` +
    `  -y, --no-prompt         Disable interactive prompts; use defaults\n` +
    `  -h, --help              Show this help and exit`);
  process.exit(0);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = { noPrompt: false };

  let positionalHandled = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('-')) {
      switch (arg) {
        case '-r':
        case '--repo':
          opts.repo = argv[++i];
          break;
        case '-o':
        case '--out':
          opts.out = argv[++i];
          break;
        case '-b':
        case '--branch':
          opts.branch = argv[++i];
          break;
        case '-y':
        case '--no-prompt':
          opts.noPrompt = true;
          break;
        case '-h':
        case '--help':
          usage();
          break; // never reached
        default:
          console.error(`Unknown flag: ${arg}`);
          usage();
      }
    } else {
      // treat first positional as repo path (back‑compat with npm scripts)
      if (!positionalHandled) {
        opts.repo = arg;
        positionalHandled = true;
      } else {
        console.error(`Unexpected positional argument: ${arg}`);
        usage();
      }
    }
  }
  return opts;
}

// === non‑interactive validations (mirror the interactive ones) ===
function validateRepoPath(repoPath) {
  if (!repoPath) throw new Error('empty path');
  if (!fs.existsSync(repoPath)) {
    console.error(`Error: directory "${repoPath}" does not exist.`);
    process.exit(1);
  }
  if (!fs.statSync(repoPath).isDirectory()) {
    console.error(`Error: "${repoPath}" is not a directory.`);
    process.exit(1);
  }

  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: repoPath, stdio: 'ignore' });
  } catch {
    console.error(`Error: "${repoPath}" is not inside a Git working tree.`);
    console.error('Provide a path to a folder initialized with "git init" or cloned.\n');
    process.exit(1);
  }

  return repoPath;
}

function validateReportDir(outPath) {
  if (!outPath) throw new Error('empty path');

  const segments = outPath.split(/[\\/]+/);
  const bad = segments.find(seg => seg === '.' || seg === '..' || seg.endsWith(' ') || seg.endsWith('.'));
  if (bad) {
    console.error(`Error: invalid folder name segment "${bad}".`);
    process.exit(1);
  }

  if (!isSafePath(outPath)) {
    console.error(`Error: Path "${outPath}" is unsafe for your OS.`);
    process.exit(1);
  }

  const reportDir = path.resolve(outPath);
  try {
    if (fs.existsSync(reportDir)) {
      if (!fs.statSync(reportDir).isDirectory()) {
        console.error(`Error: "${reportDir}" exists but is not a directory.`);
        process.exit(1);
      }
      fs.accessSync(reportDir, fs.constants.W_OK);
    } else {
      fs.mkdirSync(reportDir, { recursive: true });
    }
  } catch (err) {
    if (err.code === 'EACCES') {
      console.error(`Error: no permission to create or write to "${reportDir}".`);
    } else if (err.code === 'EINVAL' || err.code === 'ENOENT') {
      console.error(`Error: invalid path format "${reportDir}".`);
    } else {
      console.error(`Error accessing "${reportDir}": ${err.message}`);
    }
    process.exit(1);
  }
  return reportDir;
}

function validateDefaultBranch(branch, repoPath) {
  if (branch !== 'master' && branch !== 'main') {
    console.error('Error: --branch accepts only "master" or "main".');
    process.exit(1);
  }
  try {
    execSync(`git rev-parse --verify ${branch}`, { cwd: repoPath, stdio: 'ignore' });
    return branch;
  } catch {
    console.error(`Error: branch "${branch}" does not exist in repository.`);
    process.exit(1);
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

// ───────────────────────── interactive originals (unchanged) ──────────────────────────
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

    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: repoPath, stdio: 'ignore' });
    } catch {
      console.error(`Error: "${repoPath}" is not inside a Git working tree.`);
      console.error('Provide a path to a folder initialized with "git init" or cloned.\n');
      process.exit(1);
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
    if (branch !== 'master' && branch !== 'main') {
      console.error('Error: only "master" or "main" are accepted.');
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

// ───────────────────────── main ──────────────────────────
const args = parseArgs();
const cwd = process.cwd();

const repoPath = args.repo
  ? validateRepoPath(args.repo)
  : (args.noPrompt ? validateRepoPath(cwd) : promptRepoPath());

const defaultDir = path.join(cwd, 'unmerged-branches-size-report');

const reportDir = args.out
  ? validateReportDir(args.out)
  : (args.noPrompt ? validateReportDir(defaultDir) : promptReportDir(defaultDir));

let defaultBr;
if (args.branch) {
  defaultBr = validateDefaultBranch(args.branch, repoPath);
} else if (args.noPrompt) {
  defaultBr = detectDefaultBranch(repoPath);
  if (!defaultBr) {
    console.error('Error: could not auto-detect "master" or "main". Use --branch to specify.');
    process.exit(1);
  }
  console.log(`Using detected default branch: ${defaultBr}`);
} else {
  defaultBr = promptDefaultBranch(repoPath);
}

console.log(`Repository:     ${repoPath}`);
console.log(`Report folder:  ${reportDir}`);
console.log(`Default branch: ${defaultBr}`);

const start = Date.now();

(async () => {
  try {
    const commits = await collect(repoPath, defaultBr, start);
    const withSize = await calc(commits, repoPath, reportDir, start);
    await aggregate(withSize, reportDir);

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`Done in ${elapsed}s`);
  } catch (err) {
    console.error('Error:', err.message || err);
    console.error('If this keeps happening, make sure the repo is valid and try again.\n');
  }
})();
