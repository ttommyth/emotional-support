import * as vscode from 'vscode';
import { isAgentActivityKind, type AgentActivityProvider, type AgentActivitySink, type AgentActivitySeverity } from './agent-activity';

/** Must match the `contributes.languageModelTools` entry in package.json. */
export const COPILOT_TOOL_NAME = 'emotionalSupport_react';

function toSeverity(value: unknown): AgentActivitySeverity | undefined {
	if (value === 'error' || value === 'warning' || value === 'info') {
		return value;
	}
	return undefined;
}

/**
 * Optional native Copilot tool — the MCP-free replacement for the MCP server's
 * `set_robot_action`. When the coding agent calls `emotionalSupport_react`
 * (e.g. at task start / milestones), the payload is normalized into the shared
 * AgentActivity pipeline, so it participates in the same session arbitration
 * and reaction mapping as every other provider.
 */
export class CopilotToolProvider implements AgentActivityProvider {
	readonly id = 'copilot-tool';
	private sink: AgentActivitySink | undefined;
	private disposable: vscode.Disposable | undefined;

	start(sink: AgentActivitySink) {
		this.sink = sink;
		this.disposable = vscode.lm.registerTool(COPILOT_TOOL_NAME, {
			invoke: async (options) => {
				const input = (options.input ?? {}) as Record<string, unknown>;
				const kind = typeof input.kind === 'string' ? input.kind : '';
				if (!isAgentActivityKind(kind)) {
					return new vscode.LanguageModelToolResult([
						new vscode.LanguageModelTextPart(
							'Unknown activity kind. Use one of: thinking, reading, searching, editing, testing, building, debugging, error, done, idle.'
						)
					]);
				}
				const detail = typeof input.detail === 'string' && input.detail ? input.detail : undefined;
				const message = typeof input.message === 'string' && input.message ? input.message : undefined;
				const sessionId = typeof input.sessionId === 'string' && input.sessionId ? input.sessionId : `copilot-${Date.now()}`;
				this.sink?.({
					sessionId,
					kind,
					detail,
					message,
					severity: toSeverity(input.severity),
					timestamp: Date.now()
				});
				return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Reaction set.')]);
			}
		});
	}

	dispose() {
		this.disposable?.dispose();
		this.disposable = undefined;
		this.sink = undefined;
	}
}
