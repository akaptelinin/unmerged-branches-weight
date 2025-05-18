# unmerged-branches-weight

CLI that scans a Git repository and shows how much disk space every **unmerged** remote branch eats after compression.

---

## Why

Over‑grown feature branches slow down `git clone` and waste storage.  Knowing the worst offenders lets you delete or squash them first.

## How it works

1. Collects all commits reachable from every remote branch.
2. Adds commits that are reachable only via tags to a virtual branch called `$tags`.
3. Calculates diff sizes per commit – text at 20%, binary at ~70% (depends on extension, see [code](./src/calc-text-and-binary-of-commits.js#L18)).
4. Sums the numbers per branch and sorts branches by estimated compressed size.

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
  unique-commits-with-branches-and-sizes.json   raw per‑commit data
  sorted_branches_with_sizes.json               full stats, biggest first
  sorted_branches_with_sizes_light.json         branch‑only summary
```

Example entry

```json
{
  "branch": "feature/payments-v2",
  "avgCompressedSizeMB": "7.3 MB",
  "textSize": 1834120,
  "binarySize": 19112702
},
{
  "branch": "$tags",
  "avgCompressedSizeMB": "6.5 MB",
  "textSize": 694200,
  "binarySize": 9583150
}
```

## Performance

On \~5k commit repo with 250 remotes and 3k unmerged commits the scan finishes in 3-4 min on an SSD

On \~200k commit repo with 4k remotes and 22k unmerged commits the scan finishes in 15-20 min on an SSD

## Limits

* Tested on Node 18+.
* Windows works via Git‑for‑Windows, macOS/Linux work out of the box.
* Size is an estimate; for byte‑exact numbers use `git verify-pack`.

## License

MIT — PRs and issues welcome.
