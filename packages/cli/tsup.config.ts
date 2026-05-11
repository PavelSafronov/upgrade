import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/detect.ts',
    'src/plan.ts',
    'src/runner.ts',
    'src/catalog/index.ts',
    'src/catalog/types.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
