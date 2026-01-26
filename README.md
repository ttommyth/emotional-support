# Emotional Support

Emotional Support is a VS Code extension that opens a webview-based companion panel and exposes a minimal MCP server scaffold for future AI-driven reactions.

## Features

- Webview panel with a placeholder pet UI and mood controls
- Extension-to-webview messaging channel
- MCP server stub ready to wire into @modelcontextprotocol/sdk

## Commands

- Open AI Pet Panel
- Cycle AI Pet Mood (Demo)

## Run and Debug

1. Install dependencies: `npm install`
2. Build webview UI: `npm run build:webview`
3. Build once: `npm run compile`
3. Start watch mode: `npm run watch`
4. Press F5 to launch the Extension Development Host
5. Open the “Emotional Support” view in the Explorer sidebar

## Notes

- The MCP server is a stub. Replace the placeholder logic in the `PetMcpServer` class with actual MCP SDK wiring.
