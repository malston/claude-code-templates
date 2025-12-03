// ABOUTME: Validates marketplace.json plugin path references
// ABOUTME: Ensures commands, agents, and mcpServers paths point to existing files

const fs = require('fs-extra');
const path = require('path');

/**
 * MarketplaceValidator - Validates marketplace.json plugin paths
 *
 * Checks:
 * - All command paths exist
 * - All agent paths exist
 * - All mcpServer paths exist
 */
class MarketplaceValidator {
  constructor() {
    this.errors = [];
    this.stats = {
      totalPaths: 0,
      validPaths: 0,
      invalidPaths: 0
    };
  }

  /**
   * Validate marketplace.json file
   * @param {string} marketplacePath - Path to marketplace.json
   * @returns {Promise<object>} Validation results
   */
  async validate(marketplacePath) {
    try {
      const content = await fs.readFile(marketplacePath, 'utf8');
      const data = JSON.parse(content);
      return await this.validateData(data);
    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: `Failed to read or parse marketplace.json: ${error.message}`,
          path: marketplacePath
        }],
        validatedPlugins: 0,
        stats: this.stats
      };
    }
  }

  /**
   * Validate marketplace data
   * @param {object} data - Marketplace data
   * @returns {Promise<object>} Validation results
   */
  async validateData(data) {
    this.errors = [];
    this.stats = {
      totalPaths: 0,
      validPaths: 0,
      invalidPaths: 0
    };

    const { plugins = [] } = data;
    // Go up 4 levels: validators -> validation -> src -> cli-tool -> project-root
    const projectRoot = path.join(__dirname, '../../../../');

    for (const plugin of plugins) {
      await this.validatePlugin(plugin, projectRoot);
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      validatedPlugins: plugins.length,
      stats: this.stats
    };
  }

  /**
   * Validate a single plugin's paths
   * @param {object} plugin - Plugin data
   * @param {string} projectRoot - Project root directory
   */
  async validatePlugin(plugin, projectRoot) {
    const { name, commands = [], agents = [], mcpServers = [] } = plugin;

    // Validate commands
    for (const cmdPath of commands) {
      await this.validatePath(name, 'commands', cmdPath, projectRoot);
    }

    // Validate agents
    for (const agentPath of agents) {
      await this.validatePath(name, 'agents', agentPath, projectRoot);
    }

    // Validate mcpServers
    for (const mcpPath of mcpServers) {
      await this.validatePath(name, 'mcpServers', mcpPath, projectRoot);
    }
  }

  /**
   * Validate a single path exists
   * @param {string} pluginName - Plugin name
   * @param {string} field - Field name (commands/agents/mcpServers)
   * @param {string} filePath - Path to validate
   * @param {string} projectRoot - Project root directory
   */
  async validatePath(pluginName, field, filePath, projectRoot) {
    this.stats.totalPaths++;

    const fullPath = path.join(projectRoot, filePath);
    const exists = await fs.pathExists(fullPath);

    if (!exists) {
      this.stats.invalidPaths++;
      this.errors.push({
        plugin: pluginName,
        field: field,
        path: filePath,
        message: `File does not exist: ${filePath}`
      });
    } else {
      this.stats.validPaths++;
    }
  }
}

module.exports = MarketplaceValidator;
