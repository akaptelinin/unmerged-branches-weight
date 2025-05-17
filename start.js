#!/usr/bin/env node

const { execSync } = require('child_process');

try {
    console.log('Running collectUniqueCommitsWithBranches.js...');
    execSync('node collectUniqueCommitsWithBranches.js', { stdio: 'inherit' });

    console.log('Running calcTextAndBinaryOfCommits.js...');
    execSync('node calcTextAndBinaryOfCommits.js', { stdio: 'inherit' });

    console.log('Running aggregateBranchesBySize.js...');
    execSync('node aggregateBranchesBySize.js', { stdio: 'inherit' });

    console.log('All scripts executed successfully.');
} catch (error) {
    console.error('Error during script execution:', error.message);
    process.exit(1);
}
