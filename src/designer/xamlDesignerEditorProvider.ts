import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { decideDesignerEdit } from './designerSync';
import { getDesignerControlCatalog } from './controlCatalog';
import { XamlPreviewController } from '../xamlPreview';
import { ensureWinUIEventHandler } from './codeBehind';

interface DesignerMessage {
    type?: unknown;
    text?: unknown;
    baseText?: unknown;
    handlerName?: unknown;
    eventArgsType?: unknown;
    eventName?: unknown;
}

/** Hosts the editable WinUI XAML designer as a custom text editor. */
export class XamlDesignerEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'windevHelper.xamlDesigner';
    public static activeDocumentUri: vscode.Uri | undefined;

    public static register(
        context: vscode.ExtensionContext,
        previewController: XamlPreviewController
    ): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider(
            XamlDesignerEditorProvider.viewType,
            new XamlDesignerEditorProvider(context, previewController),
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }

    private constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly previewController: XamlPreviewController
    ) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        panel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
        };
        panel.webview.html = this.getHtml(panel.webview);
        XamlDesignerEditorProvider.activeDocumentUri = document.uri;

        let pendingDesignerText: string | undefined;
        const subscriptions: vscode.Disposable[] = [];
        const postDocument = (): void => {
            void panel.webview.postMessage({
                type: 'documentChanged',
                text: document.getText(),
                fileName: document.fileName
            });
        };

        subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.uri.toString() !== document.uri.toString()) {
                return;
            }
            const changedText = event.document.getText();
            if (pendingDesignerText === changedText) {
                pendingDesignerText = undefined;
                return;
            }
            pendingDesignerText = undefined;
            postDocument();
        }));

        subscriptions.push(panel.onDidChangeViewState(() => {
            if (panel.active) {
                XamlDesignerEditorProvider.activeDocumentUri = document.uri;
            }
        }));

        let messageQueue = Promise.resolve();
        subscriptions.push(panel.webview.onDidReceiveMessage((message: DesignerMessage) => {
            messageQueue = messageQueue
                .then(() => this.handleMessage(message, document, panel, text => {
                    pendingDesignerText = text;
                }))
                .catch(error => {
                    pendingDesignerText = undefined;
                    void panel.webview.postMessage({
                        type: 'editResult',
                        ok: false,
                        text: document.getText()
                    });
                    void vscode.window.showWarningMessage(
                        `WinDev XAML Designer: ${error instanceof Error ? error.message : String(error)}`
                    );
                });
        }));

        panel.onDidDispose(() => {
            if (XamlDesignerEditorProvider.activeDocumentUri?.toString() === document.uri.toString()) {
                XamlDesignerEditorProvider.activeDocumentUri = undefined;
            }
            subscriptions.forEach(subscription => subscription.dispose());
        });
    }

    private async handleMessage(
        message: DesignerMessage,
        document: vscode.TextDocument,
        panel: vscode.WebviewPanel,
        setPendingText: (text: string | undefined) => void
    ): Promise<void> {
        if (message.type === 'ready') {
            await panel.webview.postMessage({
                type: 'documentChanged',
                text: document.getText(),
                fileName: document.fileName
            });
            return;
        }
        if (message.type !== 'edit') {
            if (message.type === 'openText') {
                await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
            } else if (message.type === 'renderNativePreview') {
                await this.renderNativePreview(message, document, panel);
            } else if (message.type === 'wireEvent') {
                await this.wireEvent(message, document);
            }
            return;
        }

        const decision = decideDesignerEdit(document.getText(), message);
        if (decision === 'invalid') {
            throw new Error('The designer sent an invalid edit.');
        }
        if (decision === 'conflict') {
            await panel.webview.postMessage({
                type: 'editResult',
                ok: false,
                conflict: true,
                text: document.getText()
            });
            return;
        }
        if (decision === 'noop') {
            await panel.webview.postMessage({ type: 'editResult', ok: true });
            return;
        }

        const text = message.text as string;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
            text
        );
        setPendingText(text);
        if (!await vscode.workspace.applyEdit(edit)) {
            setPendingText(undefined);
            throw new Error('VS Code could not apply the designer edit.');
        }
        await panel.webview.postMessage({ type: 'editResult', ok: true });
    }

    private async wireEvent(message: DesignerMessage, document: vscode.TextDocument): Promise<void> {
        if (
            typeof message.handlerName !== 'string'
            || typeof message.eventArgsType !== 'string'
            || typeof message.eventName !== 'string'
            || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(message.eventName)
        ) {
            throw new Error('The designer sent invalid event handler data.');
        }
        await ensureWinUIEventHandler(document, message.handlerName, message.eventArgsType);
    }

    private async renderNativePreview(
        message: DesignerMessage,
        document: vscode.TextDocument,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        if (typeof message.text !== 'string') {
            throw new Error('The preview request did not contain XAML.');
        }
        const configuration = vscode.workspace.getConfiguration('windevHelper.preview');
        const configuredTheme = configuration.get<'auto' | 'light' | 'dark'>('theme', 'auto');
        const theme = configuredTheme === 'auto'
            ? (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'light' : 'dark')
            : configuredTheme;
        const result = await this.previewController.renderNative(message.text, {
            width: clampNumber(configuration.get<number>('width'), 100, 4096, 800),
            height: clampNumber(configuration.get<number>('height'), 100, 4096, 600),
            theme,
            scale: 1,
            xamlFilePath: document.uri.fsPath
        });
        if (result.success && result.type === 'image') {
            await panel.webview.postMessage({
                type: 'nativePreviewResult',
                success: true,
                image: result.data,
                renderTimeMs: result.renderTimeMs,
                warnings: result.warnings
            });
        } else {
            await panel.webview.postMessage({
                type: 'nativePreviewResult',
                success: false,
                message: result.success ? 'The native renderer did not return an image.' : result.message
            });
        }
    }

    private getHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'designer.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'designer.css'));
        const configuration = vscode.workspace.getConfiguration('windevHelper.designer');
        const previewConfiguration = vscode.workspace.getConfiguration('windevHelper.preview');
        const bootstrap = JSON.stringify({
            catalog: getDesignerControlCatalog(),
            nativePreviewAvailable: this.previewController.nativeRendererAvailable,
            platform: process.platform === 'win32' ? 'Windows' : process.platform,
            gridSize: clampNumber(configuration.get<number>('gridSize'), 1, 64, 8),
            snap: configuration.get<boolean>('snapToGrid', true),
            previewWidth: clampNumber(previewConfiguration.get<number>('width'), 100, 4096, 800),
            previewHeight: clampNumber(previewConfiguration.get<number>('height'), 100, 4096, 600)
        }).replace(/</g, '\\u003c');
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <title>WinUI XAML Designer</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <script nonce="${nonce}">window.designerBootstrap = ${bootstrap};</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    return randomBytes(24).toString('base64url');
}

function clampNumber(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(maximum, Math.max(minimum, value))
        : fallback;
}