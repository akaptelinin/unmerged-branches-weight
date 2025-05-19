const fs = require('fs');
const path = require('path');

/**
 * Aggregate commit sizes by branch and write full and light reports.
 * @param {Array<{commit:string,textSize:number,binarySize:number,estCompressedSize:number,branches?:string[]}>} data
 * @param {string} reportDir - Directory to write report files
 * @returns {Promise<void>}
 */
module.exports = async function aggregateBranchesBySize(data, reportDir) {
  const calcCompressedSizeMB = size => {
    const sizeMB = size / (1024 * 1024)

    if (size >= 0.1) return sizeMB.toFixed(1) + ' MB';
    if (size >= 0.01) return sizeMB.toFixed(2) + ' MB';
    return '0 MB';
  };

  // Group data by branch
  const map = {};
  data.forEach(({ commit, textSize, binarySize, estCompressedSize, branches }) => {
    const branchList = branches || ['$tags'];
    branchList.forEach(branch => {
      if (!map[branch]) {
        map[branch] = { branch, commits: [], textSize: 0, binarySize: 0, estCompressedSize: 0 };
      }
      map[branch].textSize += textSize;
      map[branch].binarySize += binarySize;
      map[branch].estCompressedSize += estCompressedSize;
      map[branch].commits.push({ commit, textSize, binarySize, estCompressedSize });
    });
  });

  // Build full and light reports
  const full = Object.values(map)
    .map(b => ({
      branch: b.branch,
      estCompressedSizeMB: calcCompressedSizeMB(b.estCompressedSize),
      textSize: b.textSize,
      binarySize: b.binarySize,
      estCompressedSize: b.estCompressedSize,
      commits: b.commits,
    }))
    .sort((a, b) => {
      const diffApprox = b.estCompressedSize - a.estCompressedSize;
      if (diffApprox !== 0) return diffApprox;
      return b.binarySize + b.textSize - (a.binarySize + a.textSize);
    });

  const light = full.map(b => ({
    branch: b.branch,
    estCompressedSizeMB: b.estCompressedSizeMB,
    textSize: b.textSize,
    binarySize: b.binarySize,
  }));
  
  // Write reports
  const outFull = path.join(reportDir, 'branches_with_commits_and_sizes.json');
  const outLight = path.join(reportDir, 'branches_with_sizes.json');
  fs.writeFileSync(outFull, JSON.stringify(full, null, 2), 'utf8');
  fs.writeFileSync(outLight, JSON.stringify(light, null, 2), 'utf8');

  // Logs
  console.log('Stats saved in →', reportDir);
};