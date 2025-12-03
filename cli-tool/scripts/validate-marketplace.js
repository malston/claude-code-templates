#!/usr/bin/env node

// ABOUTME: Validates marketplace.json plugin path references
// ABOUTME: Reports missing files and provides validation statistics

const MarketplaceValidator = require('../src/validation/validators/MarketplaceValidator');
const path = require('path');
const chalk = require('chalk');

async function main() {
  console.log(chalk.blue.bold('\n🔍 Marketplace.json Validation\n'));

  const validator = new MarketplaceValidator();
  const marketplacePath = path.join(__dirname, '../../.claude-plugin/marketplace.json');

  const result = await validator.validate(marketplacePath);

  // Display statistics
  console.log(chalk.cyan('📊 Statistics:'));
  console.log(`   Plugins validated: ${result.validatedPlugins}`);
  console.log(`   Total paths checked: ${result.stats.totalPaths}`);
  console.log(`   Valid paths: ${chalk.green(result.stats.validPaths)}`);
  console.log(`   Invalid paths: ${chalk.red(result.stats.invalidPaths)}`);
  console.log();

  // Display validation result
  if (result.valid) {
    console.log(chalk.green.bold('✅ All paths are valid!\n'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold(`❌ Found ${result.errors.length} invalid path(s):\n`));

    // Group errors by plugin
    const errorsByPlugin = {};
    result.errors.forEach(error => {
      if (!errorsByPlugin[error.plugin]) {
        errorsByPlugin[error.plugin] = [];
      }
      errorsByPlugin[error.plugin].push(error);
    });

    // Display errors grouped by plugin
    Object.keys(errorsByPlugin).forEach(pluginName => {
      console.log(chalk.yellow(`\n  ${pluginName}:`));
      errorsByPlugin[pluginName].forEach(error => {
        console.log(`    ${chalk.gray(error.field)}: ${chalk.red(error.path)}`);
      });
    });

    console.log(chalk.yellow('\n💡 Tip: Update the paths in .claude-plugin/marketplace.json or create the missing files.\n'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('\n❌ Error running validation:'), error.message);
  process.exit(1);
});
