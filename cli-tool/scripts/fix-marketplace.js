#!/usr/bin/env node

// ABOUTME: Interactive tool to fix marketplace.json invalid paths
// ABOUTME: Helps remove non-existent file references from plugins

const MarketplaceValidator = require('../src/validation/validators/MarketplaceValidator');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

async function main() {
  console.log(chalk.blue.bold('\n🔧 Marketplace.json Fixer\n'));

  const marketplacePath = path.join(__dirname, '../../.claude-plugin/marketplace.json');
  const validator = new MarketplaceValidator();
  const result = await validator.validate(marketplacePath);

  if (result.valid) {
    console.log(chalk.green('✅ No issues found! Marketplace.json is valid.\n'));
    return;
  }

  console.log(chalk.yellow(`Found ${result.errors.length} invalid path references.\n`));

  // Read the marketplace.json
  const marketplace = await fs.readJSON(marketplacePath);

  // Group errors by plugin
  const errorsByPlugin = {};
  result.errors.forEach(error => {
    if (!errorsByPlugin[error.plugin]) {
      errorsByPlugin[error.plugin] = [];
    }
    errorsByPlugin[error.plugin].push(error);
  });

  // Show what will be removed
  console.log(chalk.cyan('The following invalid references will be removed:\n'));

  let totalRemoved = 0;
  Object.keys(errorsByPlugin).forEach(pluginName => {
    const plugin = marketplace.plugins.find(p => p.name === pluginName);
    if (!plugin) return;

    console.log(chalk.yellow(`  ${pluginName}:`));

    errorsByPlugin[pluginName].forEach(error => {
      console.log(chalk.gray(`    ${error.field}: ${error.path}`));

      // Remove the path from the plugin
      if (plugin[error.field] && Array.isArray(plugin[error.field])) {
        const index = plugin[error.field].indexOf(error.path);
        if (index > -1) {
          plugin[error.field].splice(index, 1);
          totalRemoved++;
        }
      }
    });

    // Remove empty arrays
    ['commands', 'agents', 'mcpServers'].forEach(field => {
      if (plugin[field] && Array.isArray(plugin[field]) && plugin[field].length === 0) {
        delete plugin[field];
        console.log(chalk.dim(`    (removed empty ${field} array)`));
      }
    });

    console.log();
  });

  console.log(chalk.green(`✅ Removed ${totalRemoved} invalid path references.\n`));

  // Create backup
  const backupPath = marketplacePath + '.backup';
  await fs.copy(marketplacePath, backupPath);
  console.log(chalk.cyan(`📦 Backup created: ${backupPath}\n`));

  // Write the cleaned marketplace.json
  await fs.writeJSON(marketplacePath, marketplace, { spaces: 2 });
  console.log(chalk.green(`✅ Updated ${marketplacePath}\n`));

  // Validate the result
  const newResult = await validator.validate(marketplacePath);
  if (newResult.valid) {
    console.log(chalk.green.bold('🎉 Marketplace.json is now valid!\n'));
  } else {
    console.log(chalk.yellow(`⚠️  Still has ${newResult.errors.length} issues. Re-run to fix.\n`));
  }
}

main().catch(error => {
  console.error(chalk.red('\n❌ Error:'), error.message);
  process.exit(1);
});
