// WinDev Helper - Property Pane Controller
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { PropertyPaneProvider } from './propertyPaneProvider';
import { XamlElement, XamlParser } from '../xamlDesigner/xamlParser';

/**
 * Controller that manages the property pane and its interaction with the XAML designer
 */
export class PropertyPaneController implements vscode.Disposable {
    private readonly provider: PropertyPaneProvider;
    private readonly treeView: vscode.TreeView<vscode.TreeItem>;
    private readonly parser: XamlParser;
    private disposables: vscode.Disposable[] = [];

    private currentDocument: vscode.TextDocument | null = null;
    private currentRoot: XamlElement | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.provider = new PropertyPaneProvider();
        this.parser = new XamlParser();

        // Create the tree view
        this.treeView = vscode.window.createTreeView('windevHelper.propertyPane', {
            treeDataProvider: this.provider,
            showCollapseAll: true
        });

        // Register commands
        this.disposables.push(
            vscode.commands.registerCommand('windevHelper.propertyPane.refresh', () => {
                this.provider.refresh();
            }),
            vscode.commands.registerCommand('windevHelper.propertyPane.toggleGrouping', () => {
                this.provider.toggleGrouping();
            }),
            vscode.commands.registerCommand('windevHelper.propertyPane.copyValue', (item: { name: string; value: string }) => {
                if (item && item.value) {
                    vscode.env.clipboard.writeText(item.value);
                    vscode.window.showInformationMessage(`Copied: ${item.value}`);
                }
            }),
            vscode.commands.registerCommand('windevHelper.propertyPane.goToDefinition', (item: { name: string }) => {
                this.goToPropertyDefinition(item?.name);
            })
        );

        // Listen for selection changes in the tree view
        this.disposables.push(
            this.treeView.onDidChangeSelection(_e => {
                // Could be used for future property editing
            })
        );

        context.subscriptions.push(this.treeView);
    }

    /**
     * Update the property pane when a document changes
     */
    public updateDocument(document: vscode.TextDocument): void {
        if (!this.isXamlDocument(document)) {
            return;
        }

        this.currentDocument = document;
        
        // Parse the document
        const parseResult = this.parser.parse(document.getText());
        this.currentRoot = parseResult.root || null;
    }

    /**
     * Update the selected element from the preview panel
     */
    public selectElementByLine(line: number, column?: number): void {
        if (!this.currentRoot) {
            this.provider.setSelectedElement(null);
            return;
        }

        const element = this.parser.findElementAtPosition(this.currentRoot, line, column || 1);
        this.provider.setSelectedElement(element ?? null);

        // Reveal the tree view if hidden
        if (element) {
            // TreeView.reveal requires a valid tree item, skip if we don't have one
            // this.treeView.reveal(undefined, { focus: false, select: false });
        }
    }

    /**
     * Select an element directly
     */
    public selectElement(element: XamlElement | null): void {
        this.provider.setSelectedElement(element);
    }

    /**
     * Clear the selection
     */
    public clearSelection(): void {
        this.provider.setSelectedElement(null);
    }

    /**
     * Navigate to where a property is defined in the XAML
     */
    private goToPropertyDefinition(propertyName: string | undefined): void {
        if (!propertyName || !this.currentDocument) {
            return;
        }

        // Find the property in the current document
        // This is a simple search - could be improved with parsed location data
        const text = this.currentDocument.getText();
        const pattern = new RegExp(`${propertyName}\\s*=`, 'i');
        const match = text.match(pattern);

        if (match && match.index !== undefined) {
            const position = this.currentDocument.positionAt(match.index);
            const editor = vscode.window.visibleTextEditors.find(
                e => e.document.uri.toString() === this.currentDocument!.uri.toString()
            );

            if (editor) {
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        }
    }

    /**
     * Check if a document is a XAML file
     */
    private isXamlDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'xaml' || 
               document.fileName.endsWith('.xaml');
    }

    /**
     * Get the provider for external access
     */
    public getProvider(): PropertyPaneProvider {
        return this.provider;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.treeView.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
