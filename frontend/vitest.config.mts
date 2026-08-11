import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Sans `all`, v8 ne compte que les fichiers réellement importés par
      // les tests exécutés — un chiffre trompeur sur un projet où la
      // plupart des fichiers n'ont encore aucun test. `all: true` inclut
      // tout `app/` et `components/` au dénominateur, pour un pourcentage
      // honnête.
      all: true,
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      // Seuil volontairement bas (4 fichiers de test au 2026-08 sur un
      // frontend Next.js conséquent) — voir le commentaire équivalent sur
      // backend/package.json (coverageThreshold). À relever au fur et à
      // mesure des PR qui ajoutent des tests, jamais en baisse.
      // Seuils légèrement sous la couverture réelle actuelle (2026-08 :
      // ~2.9% statements, ~2.2% branches, ~3% functions, ~2.9% lines, tout
      // app/ et components/ inclus) — juste assez de marge pour ne pas
      // échouer sur une variance mineure entre exécutions.
      thresholds: {
        statements: 2,
        branches: 2,
        functions: 2,
        lines: 2,
      },
    },
  },
});
