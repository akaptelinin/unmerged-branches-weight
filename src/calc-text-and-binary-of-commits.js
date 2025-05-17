#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const inputPath = path.join(process.cwd(), 'unique-commits-with-branches.json')
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`)
  process.exit(1)
}

const getAvgCompressedSize = (textSize, binarySize) => Math.floor(textSize * 0.2 + binarySize * 0.8) / 1000000;
const getAvgCompressedSizeMBText = (textSize, binarySize) => {
  const size = getAvgCompressedSize(textSize, binarySize);

  if (size >= 0.1) {
    return size.toFixed(1) + " MB";
  } else if (size >= 0.01) {
    return size.toFixed(2) + " MB";
  } else {
    return 0;
  }
}


const commits = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const avgLineSize = 40

console.log(`Commits amount: ${commits.length}`)
const start = Date.now()
const results = []

for (let i = 0; i < commits.length; i++) {
  const { commit, branches } = commits[i]
  console.log(`[${i + 1}/${commits.length}] Processing ${commit}`)

  let textSize = 0
  let binarySize = 0

  const out = spawnSync(
    'git',
    ['show', '--no-ext-diff', '--pretty=format:', '--numstat', '-M', commit],
    { encoding: 'utf8' }
  ).stdout

  const lines = out.trim().split('\n').filter(Boolean)
  for (const line of lines) {
    const [a, d, file] = line.split('\t')
    if (!file || file.includes('=>')) continue

    if (/^\d+$/.test(a) && /^\d+$/.test(d)) {
      textSize += (parseInt(a, 10) + parseInt(d, 10)) * avgLineSize
    } else if (a === '-' && d === '-') {
      const existsInParent =
        spawnSync('git', ['cat-file', '-e', `${commit}^:${file}`]).status === 0
      if (!existsInParent) {
        const sizeOut = spawnSync(
          'git',
          ['cat-file', '-s', `${commit}:${file}`],
          { encoding: 'utf8' }
        )
        if (sizeOut.status === 0) {
          binarySize += parseInt(sizeOut.stdout.trim(), 10)
        }
      }
    }
  }

  const avgCompressedSize = getAvgCompressedSize(textSize, binarySize)
  const avgCompressedSizeMB = getAvgCompressedSizeMBText(textSize, binarySize)

  const result = {
    commit,
    avgCompressedSizeMB,
    textSize,
    binarySize,
    avgCompressedSize,
    ...(branches ? { branches } : {})
  }

  console.log(` -> avgCompressedSize=${avgCompressedSizeMB} text=${textSize}B binary=${binarySize}B`)
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`${elapsed}s elapsed\n`);
  results.push(result)
}

const outPath = path.join(
  path.dirname(inputPath),
  'unique-commits-with-branches-and-sizes.json'
)

results.sort((a, b) => {
  const diffApprox = b.avgCompressedSize - a.avgCompressedSize;

  if (diffApprox !== 0) return diffApprox;

  return (b.binarySize + b.textSize) - (a.binarySize + a.textSize);
})

fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')

console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s, output → ${outPath}`)
