# Emotional Support

Emotional Support is a VS Code extension that opens a webview-based companion panel and includes a lightweight pet mood service scaffold for future AI-driven reactions.

## Demo

🌐 **[View Live Demo on GitHub Pages](https://ttommyth.github.io/emotional-support/)**

The live demo showcases the 3D robot companion with all its animations and interactions. Click anywhere to knock the robot, and watch it automatically move around and perform various actions!

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

## GitHub Pages Deployment

The webview UI is automatically deployed to GitHub Pages when changes are pushed to the `main` branch. The deployment workflow:

1. Builds the webview UI from the `webview-ui` directory
2. Deploys the static files to GitHub Pages
3. Makes the demo available at https://ttommyth.github.io/emotional-support/

To manually trigger a deployment, go to the Actions tab in GitHub and run the "Deploy to GitHub Pages" workflow.
