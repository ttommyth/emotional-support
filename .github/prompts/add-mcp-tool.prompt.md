# Add a New MCP Tool

Add a new tool to the MCP (Model Context Protocol) server so that AI agents can control additional robot behaviors.

## Key Constraints

- `src/mcp-server.ts` runs as a **standalone Node process** — never import `vscode` here
- Communication with the extension uses **file-based bridge** (JSON files in `EMOTIONAL_SUPPORT_BRIDGE_DIR`)
- The MCP server uses `@modelcontextprotocol/sdk` and `zod/v4` for input schemas

## Architecture

```
AI Agent → MCP stdio → mcp-server.ts → writes JSON → mcp-bridge.ts (fs.watch) → extension.ts → webview
```

## Steps

### 1. Define the command type in `src/mcp-bridge.ts`

If the tool needs a new command type, add a new branch to the `RobotControlCommand` discriminated union:

```ts
| {
    id: string;
    type: '<newCommandType>';
    payload: { /* your payload fields */ };
    requestedAt: string;
    source: 'mcp';
  }
```

Then handle it in `McpBridge.processCommandFile()`.

### 2. Register the tool in `src/mcp-server.ts`

Use `server.registerTool()`:

```ts
server.registerTool(
  'tool_name',
  {
    title: 'Human Readable Title',
    description: 'Clear description of what this tool does and when to use it.\n'
      + 'Include constraints and allowed values in the description.',
    inputSchema: {
      paramName: z.string().describe('Parameter description.'),
      optionalParam: z.number().optional().describe('Optional parameter.')
    }
  },
  async ({ paramName, optionalParam }) => {
    const command: RobotControlCommand = {
      id: randomUUID(),
      type: '<commandType>',
      payload: { /* ... */ },
      requestedAt: new Date().toISOString(),
      source: 'mcp'
    };
    await writeCommand(command);
    return {
      content: [{ type: 'text', text: 'Confirmation message.' }],
      structuredContent: { commandId: command.id }
    };
  }
);
```

### 3. Handle the command in the extension

In `src/mcp-bridge.ts`, add a case to `processCommandFile()` that dispatches to the `RobotControlTarget` interface. If the target interface needs a new method, add it there and implement it in `PetViewProvider` in `extension.ts`.

### 4. If the tool adds a new webview message, update messaging

See the `webview-messaging` prompt for the full checklist on adding new extension→webview or webview→extension message types.

## Best Practices

- Keep tool descriptions precise — agents rely on them to decide when to invoke tools
- Use `z.enum()` with `as const` arrays for constrained string parameters
- Prefer short, conservative default values for durations
- Return useful `structuredContent` so agents can chain tool calls
- Do not add state to `mcp-server.ts` — it's stateless; state lives in the extension
