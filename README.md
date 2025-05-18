# unmerged-branches-weight

CLI that scans a Git repository and shows how much disk space every **unmerged** remote branch eats after compression

---

## Why

Over‑grown feature branches slow down `git clone` and waste storage.  Knowing the worst offenders lets you delete or squash them first

## How it works

1. Collects all commits reachable from every remote branch
2. Adds commits that are reachable only via tags to a virtual branch called `$tags`
3. Calculates compressed diff size in bytes per commit. Compression factor: text - 20%, binary - ~70% (depends on extension, see [code](./src/calc-text-and-binary-of-commits.js#L18))
4. Sums the numbers per branch and sorts branches by estimated compressed size

## Install

```bash
# global
npm i -g unmerged-branches-weight
```

## Usage

```bash
# one-off run
npx unmerged-branches-weight
# if installed
unmerged-branches-weight
npm run unmerged-branches-weight

Options
  --repo, -r <path>   # path to the Git repository (default = cwd)
  --out, -o <path>    # output directory for the report (default = <repo>/unmerged-branches-size-report)
  --branch, -b <name> # default branch name (master | main) (auto-detect if not provided)
  --no-prompt, -y     # run non‑interactively, use defaults when possible
  --help, -h          # show usage information
```

## Output

```
<dir>/
  branches_with_commits_and_sizes.json          full stats, biggest first
  branches_with_sizes.json                      branch‑only summary
  commits_with_branches_and_sizes.json          raw per‑commit data
```

### Example entries by report file

#### `branches_with_sizes.json`

```js
{
  "branch": "feature/payments‑v2",
  "estCompressedSize": "7.3 MB",
  "textSize": 1834120,
  "binarySize": 19112702
},
{
  "branch": "$tags",
  "estCompressedSize": "6.5 MB",
  "textSize": 694200,
  "binarySize": 9583150
}
```

#### `branches_with_commits_and_sizes.json`

```js
{
  "branch": "origin/feature/forms‑table",
  "estCompressedSizeMB": "12.5 MB",
  "textSize": 10485760,
  "binarySize": 2621440,
  "estCompressedSize": 13107200,
  "commits": [
    {
      "commit": "a1b2c3d4e5f6a7b8c9d0",
      "textSize": 5242880,
      "binarySize": 1310720,
      "estCompressedSize": 6553600
    },
    {
      "commit": "b2c3d4e5f6a7b8c9d0e1",
      "textSize": 5242880,
      "binarySize": 1310720,
      "estCompressedSize": 6553600
    }
  ]
},
{
  "branch": "origin/hotfix/task‑filter",
  "estCompressedSizeMB": "8.4 MB",
  "textSize": 8388608,
  "binarySize": 0,
  "estCompressedSize": 8388608,
  "commits": [
    {
      "commit": "c3d4e5f6a7b8c9d0e1f2",
      "textSize": 4194304,
      "binarySize": 0,
      "estCompressedSize": 4194304
    },
    {
      "commit": "d4e5f6a7b8c9d0e1f2g3",
      "textSize": 4194304,
      "binarySize": 0,
      "estCompressedSize": 4194304
    }
  ]
}
```

#### `commits_with_branches_and_sizes.json`

```js
{
  "commit": "d4e5f6a7b8c9d0e1f2g3",
  "estCompressedSize": 86376400,
  "estCompressedSizeMB": "82.4 MB",
  "textSize": 16760,
  "binarySize": 172752800,
  "branches": ["origin/feature/billing‑update"]
},
{
  "commit": "e5f6a7b8c9d0e1f2g3h4",
  "estCompressedSize": 71963773,
  "estCompressedSizeMB": "68.6 MB",
  "textSize": 54000,
  "binarySize": 102793173
  // commit reachable only via tags, will be placed in "$tags" branch
},
{
  "commit": "f6a7b8c9d0e1f2g3h4i5",
  "estCompressedSize": 14438189,
  "estCompressedSizeMB": "13.8 MB",
  "textSize": 3160,
  "binarySize": 14438013,
  "branches": [
    "origin/feature/billing‑update",
    "origin/bugs/fix-ai-chat-planning-revolution"
  ]
},
```


## Performance

On \~5k commit repo with 250 remotes and 3k unmerged commits the scan finishes in 3-4 min on an SSD

On \~200k commit repo with 4k remotes and 22k unmerged commits the scan finishes in 15-20 min on an SSD

## Limits

* Tested on Node 18+.
* Windows works via Git‑for‑Windows, macOS/Linux work out of the box
* Size is an estimate; for byte‑exact numbers use `git verify-pack`

## License

MIT — PRs and issues welcome
