#!/usr/bin/env node

// ABOUTME: Searches git history for missing marketplace.json files
// ABOUTME: Shows when files existed and what happened to them

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const MarketplaceValidator = require('../src/validation/validators/MarketplaceValidator');
const path = require('path');
const chalk = require('chalk');

const PROJECT_ROOT = path.join(__dirname, '../../');

/**
 * Execute git command safely
 * @param {Array<string>} args - Git command arguments
 * @returns {Promise<string>} Command output
 */
async function gitCommand(args) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: PROJECT_ROOT,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    return stdout;
  } catch (error) {
    return '';
  }
}

/**
 * Search git history for a file
 * @param {string} filePath - Path to search for
 * @returns {Promise<object|null>} File history information
 */
async function searchGitHistory(filePath) {
  try {
    // Check if file ever existed in git history
    const logs = await gitCommand([
      'log',
      '--all',
      '--full-history',
      '--pretty=format:%H|%ai|%an|%s',
      '--',
      filePath
    ]);

    if (!logs) {
      return null;
    }

    const commits = logs.trim().split('\n').map(line => {
      const [hash, date, author, message] = line.split('|');
      return { hash, date, author, message };
    });

    // Check if file was deleted
    const deletionLog = await gitCommand([
      'log',
      '--all',
      '--diff-filter=D',
      '--pretty=format:%H|%ai|%an|%s',
      '--',
      filePath
    ]);

    const deleted = deletionLog.trim() ? deletionLog.trim().split('\n')[0].split('|') : null;

    // Check last known commit where file existed
    const lastCommit = await gitCommand([
      'rev-list',
      '-n', '1',
      '--all',
      '--',
      filePath
    ]);

    return {
      existed: true,
      commits: commits,
      lastCommit: lastCommit.trim(),
      deleted: deleted ? {
        hash: deleted[0],
        date: deleted[1],
        author: deleted[2],
        message: deleted[3]
      } : null
    };
  } catch (error) {
    return null;
  }
}

/**
 * Try to find similar files (renamed or moved)
 * @param {string} filePath - Original file path
 * @returns {Promise<Array<string>>} Similar file paths
 */
async function findSimilarFiles(filePath) {
  try {
    const basename = path.basename(filePath);
    const allFiles = await gitCommand(['ls-files']);

    return allFiles
      .split('\n')
      .filter(f => f && f !== filePath && f.toLowerCase().includes(basename.toLowerCase()))
      .slice(0, 5); // Limit to 5 results
  } catch (error) {
    return [];
  }
}

async function main() {
  console.log(chalk.blue.bold('\n🔍 Searching Git History for Missing Files\n'));

  const validator = new MarketplaceValidator();
  const marketplacePath = path.join(PROJECT_ROOT, '.claude-plugin/marketplace.json');
  const result = await validator.validate(marketplacePath);

  if (result.valid) {
    console.log(chalk.green('✅ No missing files to search for!\n'));
    return;
  }

  console.log(chalk.yellow(`Found ${result.errors.length} missing files. Searching git history...\n`));

  const findings = {
    neverExisted: [],
    deleted: [],
    possiblyMoved: []
  };

  for (const error of result.errors) {
    const filePath = error.path;
    console.log(chalk.gray(`Searching: ${filePath}`));

    const history = await searchGitHistory(filePath);

    if (!history) {
      findings.neverExisted.push(error);
      console.log(chalk.red(`  ❌ Never existed in git history\n`));
      continue;
    }

    if (history.deleted) {
      findings.deleted.push({ error, history });
      console.log(chalk.yellow(`  📅 Deleted: ${history.deleted.date}`));
      console.log(chalk.gray(`     Commit: ${history.deleted.hash.substring(0, 8)}`));
      console.log(chalk.gray(`     Author: ${history.deleted.author}`));
      console.log(chalk.gray(`     Message: ${history.deleted.message}`));
    } else {
      findings.deleted.push({ error, history });
      console.log(chalk.yellow(`  📅 Last seen: ${history.commits[0].date}`));
      console.log(chalk.gray(`     Commit: ${history.commits[0].hash.substring(0, 8)}`));
    }

    // Look for similar files
    const similar = await findSimilarFiles(filePath);
    if (similar.length > 0) {
      findings.possiblyMoved.push({ error, similar });
      console.log(chalk.cyan(`  🔄 Similar files found:`));
      similar.slice(0, 3).forEach(s => console.log(chalk.cyan(`     - ${s}`)));
    }

    console.log();
  }

  // Summary
  console.log(chalk.blue.bold('\n📊 Summary:\n'));

  if (findings.deleted.length > 0) {
    console.log(chalk.yellow(`🗑️  ${findings.deleted.length} files existed but are now missing:`));
    findings.deleted.forEach(({ error, history }) => {
      console.log(chalk.gray(`   ${error.path}`));
      const info = history.deleted || history.commits[0];
      console.log(chalk.gray(`   └─ ${info.hash.substring(0, 8)} - ${info.message}\n`));
    });
  }

  if (findings.possiblyMoved.length > 0) {
    console.log(chalk.cyan(`🔄 ${findings.possiblyMoved.length} files might have been renamed/moved:`));
    findings.possiblyMoved.forEach(({ error, similar }) => {
      console.log(chalk.gray(`   ${error.path}`));
      similar.slice(0, 2).forEach(s => console.log(chalk.cyan(`   └─ Maybe: ${s}`)));
      console.log();
    });
  }

  if (findings.neverExisted.length > 0) {
    console.log(chalk.red(`❌ ${findings.neverExisted.length} files never existed in git:`));
    findings.neverExisted.forEach(error => {
      console.log(chalk.gray(`   ${error.path}`));
    });
    console.log();
  }

  // Provide restoration instructions
  if (findings.deleted.length > 0) {
    console.log(chalk.green.bold('\n💡 To restore deleted files:\n'));
    console.log(chalk.white('# Restore a specific file from its last commit:'));
    const example = findings.deleted[0];
    console.log(chalk.cyan(`git checkout ${example.history.lastCommit} -- ${example.error.path}`));
    console.log();
    console.log(chalk.white('# Or view the file content:'));
    console.log(chalk.cyan(`git show ${example.history.lastCommit}:${example.error.path}`));
    console.log();
  }
}

main().catch(error => {
  console.error(chalk.red('\n❌ Error:'), error.message);
  process.exit(1);
});
