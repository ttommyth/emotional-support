# Write Tests

Write or update tests for the Emotional Support extension using Mocha + `@vscode/test-electron`.

## Test Infrastructure

| Tool | Purpose |
|---|---|
| Mocha | Test runner |
| `@vscode/test-cli` | CLI for running VS Code extension tests |
| `@vscode/test-electron` | Downloads and launches VS Code for integration tests |

Tests live in `src/test/` and are compiled to `out/test/` by TypeScript.

## Running Tests

```bash
npm run pretest      # Compiles tests + extension + lint
npm test             # Runs vscode-test
npm run watch-tests  # Watch mode for test compilation
```

## Test File Location

Place test files in `src/test/` following the pattern `<module>.test.ts`.

## Test Structure

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('<Module> Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('<test description>', () => {
    // Arrange
    // Act
    // Assert
    assert.strictEqual(actual, expected);
  });

  test('<async test>', async () => {
    // Use await for async operations
    const result = await someAsyncFunction();
    assert.ok(result);
  });
});
```

## What to Test

| Component | Test approach |
|---|---|
| `PET_ACTIONS` | Verify all names are strings, no duplicates, matches expected count |
| `PetMoodService` | Test start/stop/setPetMood callbacks |
| `McpBridge` types | Verify `RobotControlCommand` shape parsing |
| Extension activation | Test command registration, view providers |
| Configuration | Test `getConfig()` returns valid defaults |

## Guidelines

- Extension tests run inside a VS Code instance — `vscode` module is available
- Keep tests fast — avoid long timeouts or real file system operations
- Use `assert.strictEqual` for value comparisons, `assert.ok` for truthiness
- Test files must be under `src/test/` to be included in the test compilation
- The `compile-tests` script compiles with `--outDir out` (separate from `dist/`)
