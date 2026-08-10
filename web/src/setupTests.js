import '@testing-library/jest-dom';

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
