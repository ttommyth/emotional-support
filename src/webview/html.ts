import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Generate the webview HTML by reading the Vite build output from
 * `webview-ui/dist/` and injecting a Content-Security-Policy header.
 * Shared by the pet view and the control panel view providers.
 */
export function getHtmlForWebview(
	extensionUri: vscode.Uri,
	webview: vscode.Webview,
	entryFile: 'index.html' | 'control.html',
	title: string
): string {
	const distPath = vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist');
	const indexPath = vscode.Uri.joinPath(distPath, entryFile);
	try {
		const rawHtml = fs.readFileSync(indexPath.fsPath, 'utf8');
		const baseUri = webview.asWebviewUri(distPath);
		const csp = [
			"default-src 'none'",
			`img-src ${webview.cspSource} data:`,
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src ${webview.cspSource}`,
			`font-src ${webview.cspSource}`
		].join('; ');
		return rawHtml
			.replace('<head>', `<head>\n\t<meta http-equiv="Content-Security-Policy" content="${csp}">`)
			.replace(/(src|href)=\"\.\//g, `$1="${baseUri}/`);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	<style>
		body { font-family: sans-serif; padding: 16px; }
		code { background: #f2f2f2; padding: 2px 6px; border-radius: 6px; }
	</style>
</head>
<body>
	<h3>${title} not built yet</h3>
	<p>Run <code>npm run build:webview</code> in the extension workspace.</p>
	<p>${message}</p>
</body>
</html>`;
	}
}
