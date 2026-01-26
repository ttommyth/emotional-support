# Emotional Support

Emotional Support is a VS Code extension that opens a webview-based companion panel and includes a lightweight pet mood service scaffold for future AI-driven reactions.

## Features

- Webview panel with a placeholder pet UI and mood controls
- Extension-to-webview messaging channel
- Pet mood service stub ready to wire into an automation or AI bridge

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

- The pet mood service is a stub. Replace the placeholder logic in the `PetMoodService` class with your integration of choice.
