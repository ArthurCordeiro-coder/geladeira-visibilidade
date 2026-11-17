import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: funciona em https://<usuario>.github.io/<repositorio>/ sem fixar o nome.
  base: './',
  build: {
    target: 'es2020',
    // O Three.js sozinho tem ~580 kB minificado (~145 kB gzip) num chunk carregado sob demanda.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
