// WinDev Helper - XAML Designer Preview Panel
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import { XamlParser, XamlElement } from './xamlParser';
import { XamlPreviewController, RenderResult, RendererStatus } from '../xamlPreview';

/**
 * Manages the XAML designer preview webview panel
 */
export class XamlDesignerPanel {
    public static currentPanel: XamlDesignerPanel | undefined;
    public static readonly viewType = 'xamlDesigner';

    private readonly panel: vscode.WebviewPanel;
    private readonly parser: XamlParser;
    private readonly previewController: XamlPreviewController;
    private disposables: vscode.Disposable[] = [];
    private currentDocument: vscode.TextDocument | undefined;
    private updateTimeout: NodeJS.Timeout | undefined;
    private lastParsedRoot: XamlElement | undefined;
    private rendererStatus: RendererStatus;

    /**
     * Create or show the XAML designer panel
     */
    public static createOrShow(
        extensionUri: vscode.Uri, 
        previewController: XamlPreviewController,
        document?: vscode.TextDocument
    ): void {
        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, show it
        if (XamlDesignerPanel.currentPanel) {
            XamlDesignerPanel.currentPanel.panel.reveal(column);
            if (document) {
                XamlDesignerPanel.currentPanel.updateDocument(document);
            }
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            XamlDesignerPanel.viewType,
            'XAML Preview',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        XamlDesignerPanel.currentPanel = new XamlDesignerPanel(panel, previewController, document);
    }

    /**
     * Revive the panel from a serialized state
     */
    public static revive(
        panel: vscode.WebviewPanel, 
        previewController: XamlPreviewController
    ): void {
        XamlDesignerPanel.currentPanel = new XamlDesignerPanel(panel, previewController);
    }

    private constructor(
        panel: vscode.WebviewPanel, 
        previewController: XamlPreviewController,
        document?: vscode.TextDocument
    ) {
        this.panel = panel;
        this.parser = new XamlParser();
        this.previewController = previewController;
        this.currentDocument = document;
        this.rendererStatus = previewController.getStatus();

        // Set initial HTML
        this.updateWebviewContent();

        // Listen for panel disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Listen for view state changes
        this.panel.onDidChangeViewState(
            () => {
                if (this.panel.visible && this.currentDocument) {
                    this.updatePreview();
                }
            },
            null,
            this.disposables
        );

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(message),
            null,
            this.disposables
        );

        // Listen for text document changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                if (this.currentDocument && e.document.uri.toString() === this.currentDocument.uri.toString()) {
                    this.scheduleUpdate();
                }
            })
        );

        // Listen for active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor && this.isXamlDocument(editor.document)) {
                    this.updateDocument(editor.document);
                }
            })
        );

        // Listen for cursor position changes to sync selection
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection(e => {
                if (this.currentDocument && 
                    e.textEditor.document.uri.toString() === this.currentDocument.uri.toString()) {
                    this.syncSelectionToDesigner(e.selections[0]);
                }
            })
        );

        // Listen for renderer changes
        this.disposables.push(
            previewController.onRendererChanged(status => {
                this.rendererStatus = status;
                this.updateRendererIndicator();
                this.updatePreview();
            })
        );

        // Select renderer and do initial preview
        this.previewController.selectRenderer().then(() => {
            this.rendererStatus = this.previewController.getStatus();
            this.updateRendererIndicator();
            if (document) {
                this.updatePreview();
            }
        });
    }

    /**
     * Update the current document being previewed
     */
    public updateDocument(document: vscode.TextDocument): void {
        if (!this.isXamlDocument(document)) {
            return;
        }
        
        this.currentDocument = document;
        this.panel.title = `XAML: ${path.basename(document.fileName)}`;
        this.updatePreview();
    }

    /**
     * Check if a document is a XAML file
     */
    private isXamlDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'xaml' || 
               document.fileName.endsWith('.xaml');
    }

    /**
     * Schedule a debounced update
     */
    private scheduleUpdate(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        const config = vscode.workspace.getConfiguration('windevHelper.preview');
        const delay = config.get<number>('updateDelay', 300);
        
        this.updateTimeout = setTimeout(() => {
            this.updatePreview();
        }, delay);
    }

    /**
     * Update the preview with current document content
     */
    private async updatePreview(): Promise<void> {
        if (!this.currentDocument) {
            this.showPlaceholder('Open a XAML file to preview');
            return;
        }

        const xamlText = this.currentDocument.getText();

        // Parse for element mapping (used for click-to-source)
        const parseResult = this.parser.parse(xamlText);
        if (parseResult.root) {
            this.lastParsedRoot = parseResult.root;
        }

        // Show loading indicator for native rendering
        if (this.rendererStatus.type === 'native') {
            this.showLoading();
        }

        // Get dimensions from config or use defaults
        const config = vscode.workspace.getConfiguration('windevHelper.preview');
        const width = config.get<number>('width', 800);
        const height = config.get<number>('height', 600);

        // Render using the controller (with file path for project context)
        const result = await this.previewController.render(xamlText, {
            width,
            height,
            theme: this.getTheme(),
            scale: 1.0, // TODO: Support high-DPI
            xamlFilePath: this.currentDocument.uri.fsPath
        });

        if (!result.success) {
            this.showError(result);
            return;
        }

        if (result.type === 'image') {
            // Native renderer returned an image
            this.showImagePreview(result);
        } else {
            // HTML renderer returned HTML
            this.showHtmlPreview(result);
        }
    }

    /**
     * Show image-based preview (from native renderer)
     */
    private showImagePreview(result: RenderResult & { success: true }): void {
        // Log warnings to console instead of showing in preview
        if (result.warnings && result.warnings.length > 0) {
            for (const warning of result.warnings) {
                console.log('[XAML Preview]', warning);
            }
        }

        this.panel.webview.postMessage({
            type: 'updateImagePreview',
            imageData: result.data,
            imageWidth: result.imageWidth,
            imageHeight: result.imageHeight,
            renderTimeMs: result.renderTimeMs,
            mappings: result.elementMappings.map(m => ({
                elementId: m.id,
                line: m.xamlLine,
                column: m.xamlColumn,
                bounds: m.bounds,
                tagName: m.type
            }))
        });
    }

    /**
     * Show HTML-based preview (from HTML fallback renderer)
     */
    private showHtmlPreview(result: RenderResult & { success: true }): void {
        this.panel.webview.postMessage({
            type: 'updateHtmlPreview',
            html: result.data,
            mappings: result.elementMappings.map(m => ({
                elementId: m.id,
                line: m.xamlLine,
                column: m.xamlColumn,
                tagName: m.type
            }))
        });
    }

    /**
     * Show loading indicator
     */
    private showLoading(): void {
        this.panel.webview.postMessage({
            type: 'showLoading'
        });
    }

    /**
     * Get the current VS Code theme
     */
    private getTheme(): 'light' | 'dark' {
        const theme = vscode.window.activeColorTheme;
        return theme.kind === vscode.ColorThemeKind.Light ? 'light' : 'dark';
    }

    /**
     * Show a placeholder message
     */
    private showPlaceholder(message: string): void {
        this.panel.webview.postMessage({
            type: 'showPlaceholder',
            message
        });
    }

    /**
     * Show an error from render result
     */
    private showError(result: RenderResult & { success: false }): void {
        this.panel.webview.postMessage({
            type: 'showError',
            code: result.code,
            message: result.message,
            line: result.line,
            column: result.column
        });
    }

    /**
     * Update renderer indicator in the UI
     */
    private updateRendererIndicator(): void {
        this.panel.webview.postMessage({
            type: 'updateRendererStatus',
            rendererType: this.rendererStatus.type,
            displayName: this.rendererStatus.displayName,
            status: this.rendererStatus.status
        });
    }

    /**
     * Sync editor selection to designer
     */
    private syncSelectionToDesigner(selection: vscode.Selection): void {
        if (!this.lastParsedRoot) {
            return;
        }

        const line = selection.active.line + 1; // Convert to 1-based
        const column = selection.active.character + 1;

        const element = this.parser.findElementAtPosition(this.lastParsedRoot, line, column);
        
        if (element) {
            this.panel.webview.postMessage({
                type: 'selectElement',
                line: element.sourceLocation.startLine
            });
        }
    }

    /**
     * Handle messages from the webview
     */
    private handleWebviewMessage(message: { type: string; line?: number; column?: number; x?: number; y?: number }): void {
        switch (message.type) {
            case 'elementClicked':
                if (message.line !== undefined && this.currentDocument) {
                    this.navigateToLine(message.line, message.column);
                }
                break;

            case 'imageClicked':
                // For image preview, find element at click coordinates
                if (message.x !== undefined && message.y !== undefined) {
                    // Element lookup would use the element mappings with bounds
                    // For now, just refresh
                }
                break;

            case 'refresh':
                this.previewController.clearCache();
                this.updatePreview();
                break;

            case 'switchRenderer':
                vscode.commands.executeCommand('workbench.action.openSettings', 'windevHelper.preview.renderer');
                break;
        }
    }

    /**
     * Navigate to a line in the editor
     */
    private navigateToLine(line: number, column?: number): void {
        const editor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.toString() === this.currentDocument!.uri.toString()
        );
        
        if (editor) {
            const position = new vscode.Position(line - 1, (column || 1) - 1);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
        }
    }

    /**
     * Set the webview HTML content
     */
    private updateWebviewContent(): void {
        this.panel.webview.html = this.getWebviewHtml();
    }

    /**
     * Generate the webview HTML
     */
    private getWebviewHtml(): string {
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data: https:;">
    <title>XAML Preview</title>
    <style>
        :root {
            --winui-accent: #0078d4;
            --winui-accent-hover: #106ebe;
            --winui-text: var(--vscode-editor-foreground);
            --winui-bg: var(--vscode-editor-background);
            --winui-border: var(--vscode-panel-border);
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif;
            font-size: 14px;
            color: var(--winui-text);
            background: var(--winui-bg);
            overflow: auto;
        }

        #toolbar {
            position: sticky;
            top: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--vscode-titleBar-activeBackground);
            border-bottom: 1px solid var(--winui-border);
        }

        #toolbar button {
            background: transparent;
            border: none;
            color: var(--winui-text);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 13px;
        }

        #toolbar button:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .toolbar-spacer { flex: 1; }

        #renderer-status {
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 3px;
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
        }

        #renderer-status:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        #renderer-status .indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        #renderer-status.native .indicator { background: #4caf50; }
        #renderer-status.azure .indicator { background: #2196f3; }
        #renderer-status.html .indicator { background: #ff9800; }
        #renderer-status.error .indicator { background: #f44336; }

        #render-time {
            font-size: 11px;
            opacity: 0.7;
        }

        #preview-container {
            padding: 16px;
            min-height: calc(100vh - 50px);
            display: flex;
            justify-content: center;
        }

        #preview-content {
            background: var(--winui-bg);
            border-radius: 8px;
            overflow: visible;
            position: relative;
        }

        #preview-image {
            max-width: 100%;
            height: auto;
            display: block;
        }

        #preview-html {
            padding: 16px;
        }

        .placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 300px;
            color: var(--vscode-descriptionForeground);
            gap: 12px;
            padding: 48px;
        }

        .placeholder-icon { font-size: 48px; opacity: 0.5; }

        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 200px;
            gap: 16px;
        }

        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--winui-border);
            border-top-color: var(--winui-accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error-container {
            padding: 16px;
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
            margin: 16px;
            max-width: 600px;
        }

        .error-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-errorForeground);
        }

        .error-message {
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
        }

        .error-location {
            margin-top: 8px;
            font-size: 12px;
            opacity: 0.8;
        }

        .warnings {
            padding: 8px 16px;
            background: var(--vscode-editorWarning-background);
            border-left: 3px solid var(--vscode-editorWarning-foreground);
            margin: 8px 16px;
            font-size: 12px;
        }

        .info-bar {
            padding: 6px 12px;
            background: var(--vscode-editorInfo-background, rgba(0, 120, 212, 0.1));
            border-left: 3px solid var(--vscode-editorInfo-foreground, #0078d4);
            margin: 0;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .info-bar.bindings {
            background: rgba(147, 112, 219, 0.1);
            border-left-color: #9370db;
        }

        .info-bar .icon {
            font-size: 14px;
        }

        .info-bar .label {
            font-weight: 500;
            color: var(--vscode-editorInfo-foreground, #0078d4);
        }

        .info-bar.bindings .label {
            color: #9370db;
        }

        .info-bar .content {
            flex: 1;
            opacity: 0.9;
        }

        .info-bar .binding-item {
            display: inline-block;
            background: rgba(147, 112, 219, 0.15);
            padding: 2px 6px;
            border-radius: 3px;
            margin: 2px 4px 2px 0;
            font-family: 'Cascadia Code', 'Consolas', monospace;
            font-size: 11px;
        }

        .info-bar .dismiss {
            background: none;
            border: none;
            color: var(--winui-text);
            opacity: 0.6;
            cursor: pointer;
            padding: 2px 4px;
            font-size: 14px;
        }

        .info-bar .dismiss:hover {
            opacity: 1;
        }

        /* Element overlay for image click detection */
        .element-overlay {
            position: absolute;
            border: 1px solid transparent;
            cursor: pointer;
            transition: border-color 0.15s;
        }

        .element-overlay:hover {
            border-color: var(--winui-accent);
            background: rgba(0, 120, 212, 0.1);
        }

        .element-overlay.selected {
            border: 2px solid var(--winui-accent);
        }

        /* HTML preview styles (same as before) */
        .xaml-selected { outline: 2px solid var(--winui-accent) !important; outline-offset: 2px; }
        [id^="xaml-el-"]:hover { outline: 1px dashed var(--winui-accent); outline-offset: 1px; cursor: pointer; }
    </style>
</head>
<body>
    <div id="toolbar">
        <button onclick="refresh()" title="Refresh Preview">↻ Refresh</button>
        <span class="toolbar-spacer"></span>
        <span id="render-time"></span>
        <span id="renderer-status" class="html" onclick="switchRenderer()" title="Click to change renderer">
            <span class="indicator"></span>
            <span class="label">HTML</span>
        </span>
    </div>
    <div id="info-container"></div>
    <div id="preview-container">
        <div id="preview-content">
            <div class="placeholder">
                <div class="placeholder-icon">📐</div>
                <div>Open a XAML file to preview</div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let elementMappings = [];
        let selectedElementId = null;

        function refresh() {
            vscode.postMessage({ type: 'refresh' });
        }

        function switchRenderer() {
            vscode.postMessage({ type: 'switchRenderer' });
        }

        function selectElementById(elementId) {
            // Remove previous selection
            document.querySelectorAll('.selected, .xaml-selected').forEach(el => {
                el.classList.remove('selected', 'xaml-selected');
            });

            selectedElementId = elementId;
            const el = document.getElementById(elementId);
            if (el) {
                el.classList.add(el.classList.contains('element-overlay') ? 'selected' : 'xaml-selected');
            }
        }

        function handleHtmlElementClick(event) {
            const target = event.target.closest('[id^="xaml-el-"]');
            if (target) {
                event.stopPropagation();
                const mapping = elementMappings.find(m => m.elementId === target.id);
                if (mapping) {
                    selectElementById(target.id);
                    vscode.postMessage({ type: 'elementClicked', line: mapping.line, column: mapping.column });
                }
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;
            const previewContent = document.getElementById('preview-content');
            const renderTime = document.getElementById('render-time');

            switch (message.type) {
                case 'updateImagePreview':
                    elementMappings = message.mappings || [];
                    
                    // Show info bar for bindings and warnings
                    updateInfoBar(message.warnings || []);
                    
                    // For native preview, just show the image without overlays
                    // Element click detection is not yet supported for native renderer
                    let html = '<img id="preview-image" src="data:image/png;base64,' + message.imageData + '" />';
                    
                    previewContent.innerHTML = html;
                    previewContent.style.position = 'relative';
                    
                    renderTime.textContent = message.renderTimeMs ? message.renderTimeMs + 'ms' : '';
                    break;

                case 'updateHtmlPreview':
                    elementMappings = message.mappings || [];
                    // Clear info bar for HTML preview (it handles bindings inline)
                    updateInfoBar([]);
                    previewContent.innerHTML = '<div id="preview-html">' + message.html + '</div>';
                    previewContent.addEventListener('click', handleHtmlElementClick);
                    renderTime.textContent = '';
                    break;

                case 'showLoading':
                    updateInfoBar([]);
                    previewContent.innerHTML = '<div class="loading"><div class="spinner"></div><div>Rendering...</div></div>';
                    break;

                case 'showPlaceholder':
                    updateInfoBar([]);
                    previewContent.innerHTML = '<div class="placeholder"><div class="placeholder-icon">📐</div><div>' + message.message + '</div></div>';
                    renderTime.textContent = '';
                    break;

                case 'showError':
                    updateInfoBar([]);
                    let errorHtml = '<div class="error-container"><div class="error-title">' + (message.code || 'Error') + '</div>';
                    errorHtml += '<div class="error-message">' + escapeHtml(message.message) + '</div>';
                    if (message.line) {
                        errorHtml += '<div class="error-location">Line ' + message.line;
                        if (message.column) errorHtml += ', Column ' + message.column;
                        errorHtml += '</div>';
                    }
                    errorHtml += '</div>';
                    previewContent.innerHTML = errorHtml;
                    renderTime.textContent = '';
                    break;

                case 'updateRendererStatus':
                    const status = document.getElementById('renderer-status');
                    status.className = message.rendererType + (message.status === 'error' ? ' error' : '');
                    status.querySelector('.label').textContent = message.displayName;
                    break;

                case 'selectElement':
                    const mapping = elementMappings.find(m => m.line === message.line);
                    if (mapping) {
                        selectElementById(mapping.elementId);
                        const el = document.getElementById(mapping.elementId);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    break;
            }
        });

        function handleOverlayClick(event, el) {
            event.stopPropagation();
            const line = parseInt(el.dataset.line, 10);
            const column = parseInt(el.dataset.column, 10);
            selectElementById(el.id);
            vscode.postMessage({ type: 'elementClicked', line: line, column: column });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function updateInfoBar(warnings) {
            const infoContainer = document.getElementById('info-container');
            if (!warnings || warnings.length === 0) {
                infoContainer.innerHTML = '';
                return;
            }

            let infoHtml = '';
            
            // Separate binding info from other warnings
            const bindingWarnings = warnings.filter(w => w.startsWith('Data bindings'));
            const otherWarnings = warnings.filter(w => !w.startsWith('Data bindings'));

            // Show binding info bar
            if (bindingWarnings.length > 0) {
                const bindingText = bindingWarnings[0];
                // Parse binding info to show nicely
                const match = bindingText.match(/Data bindings \\(([^)]+)\\): (.+)/);
                if (match) {
                    const bindType = match[1];
                    const details = match[2];
                    infoHtml += '<div class="info-bar bindings">';
                    infoHtml += '<span class="icon">⟷</span>';
                    infoHtml += '<span class="label">' + bindType + '</span>';
                    infoHtml += '<span class="content">' + escapeHtml(details) + '</span>';
                    infoHtml += '</div>';
                } else {
                    infoHtml += '<div class="info-bar bindings">';
                    infoHtml += '<span class="icon">⟷</span>';
                    infoHtml += '<span class="content">' + escapeHtml(bindingText) + '</span>';
                    infoHtml += '</div>';
                }
            }

            // Show other warnings
            for (const warning of otherWarnings) {
                infoHtml += '<div class="info-bar">';
                infoHtml += '<span class="icon">⚠️</span>';
                infoHtml += '<span class="content">' + escapeHtml(warning) + '</span>';
                infoHtml += '</div>';
            }

            infoContainer.innerHTML = infoHtml;
        }
    </script>
</body>
</html>`;
    }

    /**
     * Generate a nonce for script security
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        XamlDesignerPanel.currentPanel = undefined;

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
