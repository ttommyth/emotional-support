import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Registers the MCP server definition provider that launches the standalone
 * `dist/mcp-server.js` process, bridged to the extension via a shared directory.
 */
export function registerMcpServer(context: vscode.ExtensionContext): void {
	const providerId = 'emotional-support.mcp';

	context.subscriptions.push(
		vscode.lm.registerMcpServerDefinitionProvider(providerId, {
			provideMcpServerDefinitions: () => {
				const serverModule = context.asAbsolutePath(path.join('dist', 'mcp-server.js'));
				const env = {
					EMOTIONAL_SUPPORT_BRIDGE_DIR: context.globalStorageUri.fsPath
				};
				return [
					new vscode.McpStdioServerDefinition(
						'Emotional Support Robot',
						process.execPath,
						[serverModule],
						env,
						String(context.extension.packageJSON?.version ?? '0.0.0')
					)
				];
			}
		})
	);
}
