// Manual mock for expo-secure-store, automatically applied by Jest for every test (this file
// lives in `<rootDir>/__mocks__/`, adjacent to node_modules, which Jest auto-mocks node_modules
// packages from without an explicit jest.mock() call). Backed by a plain in-memory map so
// authStore's persistence calls behave like a real (tiny, synchronous) key/value store in tests,
// without touching any native module.
let store = {};

module.exports = {
  __reset: () => {
    store = {};
  },
  getItemAsync: jest.fn((key) => Promise.resolve(Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
  setItemAsync: jest.fn((key, value) => {
    store[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key) => {
    delete store[key];
    return Promise.resolve();
  }),
};
