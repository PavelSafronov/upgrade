import { rules } from './rules/index.js';

const plugin = {
  rules,
  configs: {} as Record<string, any>,
};

plugin.configs.recommended = {
  plugins: ['mongodb-upgrade'],
  rules: Object.fromEntries(
    Object.keys(rules).map(id => [`mongodb-upgrade/${id}`, 'warn']),
  ),
};

export default plugin;
export { rules };
