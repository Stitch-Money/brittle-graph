module.exports = {
  preset: 'ts-jest',
  coverageThreshold: {
    global: {
      "branches": 95,
      "functions": 100,
      "lines": 99,
      "statements": -10
    }
  }
};
