# unmerged-branches-weight

## Description

**unmerged-branches-weight** is a Node.js utility for estimating the approximate weight of unmerged branches in a Git repository. The library collects data on commits, text, and binary changes in branches and outputs a sorted statistic based on branch size. It also includes commits that belong only to tags, marked with the branch name `$tags`.

### Key Features:

* Collects all unique commits associated with branches and tags
* Calculates the text and binary weight of commits
* Aggregates data by branches with compressed size calculation
* Sorts branches by descending size
* Generates two reports: full (with commits) and light (branches and sizes only)

## Installation

```bash
npm install -g unmerged-branches-weight
```

## Usage

### Run

In the root folder of the Git repository:

```bash
unmerged-branches-weight
```

### Output

After execution, the command will create two files in the current directory:

* `sorted_branches_with_sizes.json` – full data including commits
* `sorted_branches_with_sizes_light.json` – lightweight version with only branches and sizes

## Example

```
Full stats → sorted_branches_with_sizes.json
Light stats → sorted_branches_with_sizes_light.json
```

## Project Structure

* **collectUniqueCommitsWithBranches.js** - collects unique commits by branches and tags
* **calcTextAndBinaryOfCommits.js** - calculates the text and binary weight of commits
* **aggregateBranchesBySize.js** - aggregates and sorts branches by size
* **run-all.js** - sequentially runs all scripts

## Example Result File

```json
[
  {
    "branch": "feature/new-ui",
    "avgCompressedSizeMB": "1.5 MB",
    "textSize": 102400,
    "binarySize": 512000
  },
  {
    "branch": "$tags",
    "avgCompressedSizeMB": "0.3 MB",
    "textSize": 20480,
    "binarySize": 30720
  }
]
```

## License

MIT
