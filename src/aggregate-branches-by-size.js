const fs = require('fs');
const path = require('path');

/**
 * Aggregate commit sizes by branch and write full and light reports.
 * @param {Array<{commit:string,textSize:number,binarySize:number,avgCompressedSize:number,branches?:string[]}>} data
 * @param {string} reportDir - Directory to write report files
 * @returns {Promise<void>}
 */
module.exports = async function aggregateBranchesBySize(data, reportDir) {
  const calcCompressedSizeMB = size => {
    if (size >= 0.1) return size.toFixed(1) + ' MB';
    if (size >= 0.01) return size.toFixed(2) + ' MB';
    return '0 MB';
  };

  // Group data by branch
  const map = {};
  data.forEach(({ commit, textSize, binarySize, avgCompressedSize, branches }) => {
    const branchList = branches || ['$tags'];
    branchList.forEach(branch => {
      if (!map[branch]) {
        map[branch] = { branch, commits: [], textSize: 0, binarySize: 0, avgCompressedSize: 0 };
      }
      map[branch].textSize += textSize;
      map[branch].binarySize += binarySize;
      map[branch].avgCompressedSize += avgCompressedSize;
      map[branch].commits.push({ commit, textSize, binarySize, avgCompressedSize });
    });
  });

  // Build full and light reports
  const full = Object.values(map)
    .map(b => ({
      branch: b.branch,
      avgCompressedSizeMB: calcCompressedSizeMB(b.avgCompressedSize),
      textSize: b.textSize,
      binarySize: b.binarySize,
      avgCompressedSize: b.avgCompressedSize,
      commits: b.commits,
    }))
    .sort((a, b) => {
      const diffApprox = b.avgCompressedSize - a.avgCompressedSize;
      if (diffApprox !== 0) return diffApprox;
      return b.binarySize + b.textSize - (a.binarySize + a.textSize);
    });

  const light = full.map(b => ({
    branch: b.branch,
    avgCompressedSizeMB: b.avgCompressedSizeMB,
    textSize: b.textSize,
    binarySize: b.binarySize,
  }));

  // Write reports
  const outFull = path.join(reportDir, 'sorted_branches_with_sizes.json');
  const outLight = path.join(reportDir, 'sorted_branches_with_sizes_light.json');
  fs.writeFileSync(outFull, JSON.stringify(full, null, 2), 'utf8');
  fs.writeFileSync(outLight, JSON.stringify(light, null, 2), 'utf8');

  // Logs
  console.log('Full stats →', outFull);
  console.log('Light stats →', outLight);
};