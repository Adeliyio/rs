import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/features/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Mirror the tsconfig @convex/* paths so tests that import generated
      // Convex modules resolve the same way the app does.
      '@convex/api': path.resolve(__dirname, './convex/_generated/api'),
      '@convex/dataModel': path.resolve(__dirname, './convex/_generated/dataModel'),
      '@convex/server': path.resolve(__dirname, './convex/_generated/server'),
    },
  },
});
