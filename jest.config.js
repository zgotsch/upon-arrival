/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */

// https://github.com/facebook/jest/issues/5620#issuecomment-998716759
const actualProcess = process;
process.actual = () => actualProcess;

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: [],
};
