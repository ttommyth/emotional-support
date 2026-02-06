# Code Review Checklist

Use this checklist when reviewing changes to the Emotional Support extension.

## Universal Checks

- [ ] TypeScript strict mode passes (`npm run check-types`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Full build succeeds (`npm run compile`)
- [ ] No `enum` usage — uses `as const` arrays and derived union types
- [ ] Uses `type` imports (`import type { ... }`) where possible
- [ ] All VS Code disposables pushed to `context.subscriptions`

## Extension Host (`src/`)

- [ ] No synchronous file I/O in `activate()` path
- [ ] `vscode` is NOT imported in `mcp-server.ts`
- [ ] Message validation uses `typeof` checks before casting
- [ ] `isPetAction()` guard used when receiving string action names
- [ ] New commands registered in both `package.json` and `extension.ts`
- [ ] New settings added to all three locations (package.json, getConfig(), App.tsx handler)

## Action System

- [ ] `PET_ACTIONS` (pet-mood-service.ts) matches `RobotActionName` (types.ts) matches `robotActions` (index.ts)
- [ ] New action has correct tags for its category
- [ ] Action's `apply()` uses target-based animation (sets targets, doesn't directly mutate transforms)
- [ ] Eye color is appropriate for the action's mood
- [ ] If disableable, added to `disabledActions` enum in package.json

## Props

- [ ] Anchor is child of `bodyPivot`, mesh is child of `scene`
- [ ] Added to `RobotProps` type and `createRobotProps()` function
- [ ] Uses `MeshLambertMaterial` (matches robot style)
- [ ] `castShadow = true` on visible meshes
- [ ] Geometry is low-poly (sidebar webview performance)

## MCP Server

- [ ] No `vscode` imports
- [ ] Tool description is clear and includes allowed values
- [ ] Input schema uses zod v4 (`zod/v4`)
- [ ] Commands use `RobotControlCommand` discriminated union
- [ ] New command type handled in `McpBridge.processCommandFile()`

## Webview

- [ ] No direct DOM manipulation (use Three.js scene graph)
- [ ] CSP headers maintained in `getHtmlForWebview()`
- [ ] New message types validated before processing
- [ ] Performance-sensitive code avoids allocations in animation loop
- [ ] Scene cleanup handles new objects (dispose geometry/materials)

## Configuration

- [ ] Default value is sensible
- [ ] JSON Schema validation is appropriate (pattern, min/max, enum)
- [ ] Description includes usage examples where helpful
- [ ] Setting read in `getConfig()` with correct type and default
- [ ] Applied in webview `SET_CONFIG` handler
