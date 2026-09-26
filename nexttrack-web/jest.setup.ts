import '@testing-library/jest-dom';

// jsdom doesn't implement HTMLMediaElement methods
Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: jest.fn().mockResolvedValue(undefined),
});

Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: jest.fn(),
});
