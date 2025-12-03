// ABOUTME: Tests for marketplace.json path validation
// ABOUTME: Ensures all plugin component paths reference valid files

const MarketplaceValidator = require('../../src/validation/validators/MarketplaceValidator');
const path = require('path');

describe('MarketplaceValidator', () => {
  let validator;
  const marketplacePath = path.join(__dirname, '../../../.claude-plugin/marketplace.json');

  beforeEach(() => {
    validator = new MarketplaceValidator();
  });

  describe('validate marketplace.json paths', () => {
    it('should validate the marketplace.json file and report status', async () => {
      const result = await validator.validate(marketplacePath);

      // Verify validator runs successfully
      expect(result).toBeDefined();
      expect(result.validatedPlugins).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalPaths).toBeGreaterThan(0);

      // If there are errors, they should be properly formatted
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toHaveProperty('plugin');
        expect(result.errors[0]).toHaveProperty('field');
        expect(result.errors[0]).toHaveProperty('path');
      }
    });

    it('should detect missing command files', async () => {
      const testData = {
        plugins: [
          {
            name: 'test-plugin',
            commands: [
              './cli-tool/components/commands/nonexistent.md'
            ]
          }
        ]
      };

      const result = await validator.validateData(testData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatchObject({
        plugin: 'test-plugin',
        field: 'commands',
        path: './cli-tool/components/commands/nonexistent.md'
      });
    });

    it('should detect missing agent files', async () => {
      const testData = {
        plugins: [
          {
            name: 'test-plugin',
            agents: [
              './cli-tool/components/agents/nonexistent.md'
            ]
          }
        ]
      };

      const result = await validator.validateData(testData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatchObject({
        plugin: 'test-plugin',
        field: 'agents',
        path: './cli-tool/components/agents/nonexistent.md'
      });
    });

    it('should detect missing mcpServers files', async () => {
      const testData = {
        plugins: [
          {
            name: 'test-plugin',
            mcpServers: [
              './cli-tool/components/mcps/nonexistent.json'
            ]
          }
        ]
      };

      const result = await validator.validateData(testData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatchObject({
        plugin: 'test-plugin',
        field: 'mcpServers',
        path: './cli-tool/components/mcps/nonexistent.json'
      });
    });

    it('should handle plugins with no path fields', async () => {
      const testData = {
        plugins: [
          {
            name: 'test-plugin',
            description: 'Plugin without paths'
          }
        ]
      };

      const result = await validator.validateData(testData);

      expect(result.valid).toBe(true);
      expect(result.validatedPlugins).toBe(1);
    });

    it('should report all invalid paths across multiple plugins', async () => {
      const testData = {
        plugins: [
          {
            name: 'plugin-1',
            commands: ['./invalid1.md']
          },
          {
            name: 'plugin-2',
            agents: ['./invalid2.md']
          }
        ]
      };

      const result = await validator.validateData(testData);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.validatedPlugins).toBe(2);
    });
  });

  describe('validation statistics', () => {
    it('should return statistics about validated paths', async () => {
      const testData = {
        plugins: [
          {
            name: 'test-plugin',
            commands: ['./cli-tool/components/commands/git/feature.md'],
            agents: ['./cli-tool/components/agents/git/git-flow-manager.md']
          }
        ]
      };

      const result = await validator.validateData(testData);

      expect(result.stats).toBeDefined();
      expect(result.stats.totalPaths).toBe(2);
      expect(result.stats.validPaths).toBe(2);
      expect(result.stats.invalidPaths).toBe(0);
    });
  });
});
