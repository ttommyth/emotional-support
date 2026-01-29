# Emotional Support

Emotional Support is a VS Code extension that opens a webview-based companion panel and includes a lightweight pet mood service scaffold for future AI-driven reactions.

## Demo

🌐 **[View Live Demo on GitHub Pages](https://ttommyth.github.io/emotional-support/)**

The live demo showcases the 3D robot companion with all its animations and interactions. Click anywhere to knock the robot, and watch it automatically move around and perform various actions!

## Features

- Webview panel with a 3D robot companion with various animations
- Extension-to-webview messaging channel
- Pet mood service stub ready to wire into an automation or AI bridge
- **Window Status Monitoring**: The robot adjusts its behavior based on VS Code window focus state
  - After 2 minutes of inactivity, the robot falls asleep
  - After 3 minutes of inactivity, the robot walks away and then sleeps
  - When you return and focus the window, the robot wakes up with a stretch and waves to welcome you back

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
