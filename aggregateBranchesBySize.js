#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const inputPath = path.join(process.cwd(), 'unique-commits-with-branches-and-sizes.json')
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`)
  process.exit(1)
}
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

function calcCompressedSizeMB(size) {
  if (size >= 0.1) {
      return size.toFixed(1) + " MB";
  } else if (size >= 0.01) {
      return size.toFixed(2) + " MB";
  } else {
      return 0;
  }
}

// агрегируем по веткам
const map = {}
for (const { commit, textSize, binarySize, branches, avgCompressedSize } of data) {
  for (const branch of branches ?? ["$tags"]) {
    if (!map[branch]) {
      map[branch] = { branch, commits: [], textSize: 0, binarySize: 0, avgCompressedSize: 0 }
    }
    map[branch].textSize += textSize
    map[branch].binarySize += binarySize
    map[branch].avgCompressedSize += avgCompressedSize
    map[branch].commits.push({ commit, textSize, binarySize, avgCompressedSize })
  }
}

const full = Object.values(map)
  .map(b => ({
    branch: b.branch,
    avgCompressedSizeMB: calcCompressedSizeMB(b.avgCompressedSize),
    textSize: b.textSize,
    binarySize: b.binarySize,
    avgCompressedSize: b.avgCompressedSize,
    commits: b.commits,
  })).sort((a, b) => {
    const diffApprox = b.avgCompressedSize - a.avgCompressedSize;

    if (diffApprox !== 0) return diffApprox;

    return (b.binarySize + b.textSize) - (a.binarySize + a.textSize);
  })
const light = full.map(b => ({
  branch: b.branch,
  avgCompressedSizeMB: b.avgCompressedSizeMB,
  textSize: b.textSize,
  binarySize: b.binarySize,
}))

const outFull = path.join('sorted_branches_with_sizes.json')
const outLight = path.join('sorted_branches_with_sizes_light.json')

fs.writeFileSync(outFull, JSON.stringify(full, null, 2), 'utf8')
fs.writeFileSync(outLight, JSON.stringify(light, null, 2), 'utf8')

console.log('Full stats →', outFull)
console.log('Light stats →', outLight)
