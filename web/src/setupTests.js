import '@testing-library/jest-dom';

// jest-runner's worker registers an `uncaughtException` handler that prints
// the stack and exits(1). React 17's react-test-utils schedules its passive-
// effect flush on the real setImmediate, which can fire after
// jest-environment-jsdom has torn the DOM down (React 17 + Node 22 race;
// MUI FocusTrap timers are the usual source). That flush is a no-op against
// a closed document, but jest's handler would kill the worker before results
// are reported. Replace the worker handler with one that ignores exactly
// that crash and rethrows everything else so genuine failures stay loud.
process.removeAllListeners('uncaughtException');
process.on('uncaughtException', (err) => {
  if (
    err instanceof TypeError &&
    /reading 'createEvent'/.test(err && err.message) &&
    !global.document
  ) {
    return;
  }
  throw err;
});

// jsdom does not implement matchMedia; provide a deterministic stub.
// Default viewport is desktop (>= 768px); individual tests can override.
const createMatchMedia = (width) => (query) => ({
  matches: query.includes('min-width') ? width >= 768 : width < 768,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

beforeEach(() => {
  window.matchMedia = window.matchMedia || createMatchMedia(1024);
});
