# Emotional Support

Emotional Support is a VS Code extension that opens a webview-based companion panel and includes a lightweight pet mood service scaffold for future AI-driven reactions.

## Demo

🌐 **[View Live Demo on GitHub Pages](https://ttommyth.github.io/emotional-support/)**

The live demo showcases the 3D robot companion with all its animations and interactions. Click anywhere to knock the robot, and watch it automatically move around and perform various actions!

## Features

- Webview panel with a 3D robot companion with various animations
- Extension-to-webview messaging channel
- Pet mood service stub ready to wire into an automation or AI bridge
- **Adaptive Window Status Monitoring**: The robot adjusts its behavior based on VS Code window focus state
  - **Short breaks (30 seconds)**: Robot looks around when you briefly look away
  - **Medium breaks (2 minutes)**: Robot falls asleep after moderate inactivity
  - **Long breaks (3+ minutes)**: Robot walks away and then sleeps
  - **Return behaviors**: Context-aware greetings when you return
    - Quick peek if you were away less than 30 seconds
    - Wave if you interrupted the robot during lookaround or walk
    - Stretch and wave with personalized greeting based on time away when waking from sleep

## Robot Behavior

### Animation Model

- Actions are target-based: each frame, the active action writes target positions/rotations for body, head, arms, and legs.
- Targets are reset to the neutral pose each frame before action logic runs.
- Object transforms lerp toward targets with smoothing (0.1 factor) for motion continuity; yaw uses wrapped angle lerp.
- Actions can define optional pre/post transitions (with durations) and are executed in a simple state machine: pre -> main -> post.
- Eye color is driven by action metadata (cyan/red/green/off/purple/calm).
- Random blinking occurs unless the action blocks blinking; sleeping pinches eyes closed.

### Autopilot (Webview)

- Autopilot runs a small FSM with states: IDLE, MOVING, PERFORMING.
- IDLE chooses between moving to a random point, performing a random idleFiller action, or moving to a peek target.
- MOVING steers the robot toward a target and smoothly rotates to face the direction of travel.
- When a move target is reached and the robot is near the front (z > 8), it performs either peek (side positions) or wave (front position).
- Idle filler actions are selected from actions tagged with `idleFiller`.
- Autopilot pauses movement logic when an MCP override is active, unless the robot is already in a movement state.

### Interaction

- Clicking anywhere triggers a ripple and a probabilistic attention response.
- If sleeping: the robot plays a knocked reaction, then waves.
- If working: the robot briefly looks toward the click without fully interrupting the action.
- If idle-like: the robot waves, then returns to idle.
- Otherwise, the robot rotates to look toward the click direction.

### Focus/Unfocus Behavior (Extension)

- When the VS Code window loses focus, the extension starts a staged "unfocused" cycle with randomized delays.
- Each stage triggers a relaxed action (e.g., lookaround, stretch, sit, walk); delays back off exponentially.
- After the final stage, the robot sleeps until focus returns.
- When focus returns, the robot switches back to idle, autopilot is re-enabled, and it may move to the front.
- Agent activity while unfocused restarts the unfocused cycle.

### Props and Effects

- Props are tied to action names (prop key == action name).
- Prop lifecycle: hidden -> held -> dropping -> ground, then fades out.
- Props follow their anchors while held; once dropped, they simulate a simple gravity fall.
- Sleep action enables drifting "Z" particles; other actions hide them.

### Control Panel
- The webview includes a control panel to manually trigger moods and view status.

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
