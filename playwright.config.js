import { defineConfig } from '@playwright/test';

// Em máquinas sem o Chromium do Playwright, aponte PW_CHROMIUM pro Chromium do sistema.
const executablePath = process.env.PW_CHROMIUM || undefined;
const PORTA = 4173;

const celular = (largura, altura, escala) => ({
  viewport: { width: largura, height: altura },
  deviceScaleFactor: escala,
  isMobile: true,
  hasTouch: true,
  locale: 'pt-BR',
});

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || `http://127.0.0.1:${PORTA}/`,
    launchOptions: {
      executablePath,
      // WebGL por software no headless (sem GPU)
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    { name: 'iphone-375x812', use: celular(375, 812, 3) },
    { name: 'android-412x915', use: celular(412, 915, 2.625) },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORTA} --strictPort`,
        url: `http://127.0.0.1:${PORTA}/`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
