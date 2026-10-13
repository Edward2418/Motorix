// Configuración de Jest para ES Modules (se ejecuta con --experimental-vm-modules).
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: './tests/helpers/globalSetup.js',
  setupFiles: ['./tests/helpers/setupEnv.js'],
  testTimeout: 20000
};
