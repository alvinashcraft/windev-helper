// WinDev Helper - Status Bar Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

/**
 * Manages status bar items for build configuration and platform selection
 */
export class StatusBarManager {
    private context: vscode.ExtensionContext;
    private configurationItem: vscode.StatusBarItem;
    private platformItem: vscode.StatusBarItem;
    private currentConfiguration: string = 'Debug';
    private currentPlatform: string = 'x64';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        // Create configuration status bar item
        this.configurationItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.configurationItem.command = 'windev-helper.selectBuildConfiguration';
        this.configurationItem.tooltip = 'Click to change build configuration';
        this.updateConfigurationDisplay();

        // Create platform status bar item
        this.platformItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.platformItem.command = 'windev-helper.selectPlatform';
        this.platformItem.tooltip = 'Click to change target platform';
        this.updatePlatformDisplay();

        // Register disposables
        context.subscriptions.push(this.configurationItem);
        context.subscriptions.push(this.platformItem);

        // Load saved values
        this.loadSavedValues();
    }

    /**
     * Shows the status bar items
     */
    public show(): void {
        this.configurationItem.show();
        this.platformItem.show();
    }

    /**
     * Hides the status bar items
     */
    public hide(): void {
        this.configurationItem.hide();
        this.platformItem.hide();
    }

    /**
     * Updates the current configuration
     */
    public updateConfiguration(configuration: string): void {
        this.currentConfiguration = configuration;
        this.updateConfigurationDisplay();
        this.saveValues();
    }

    /**
     * Updates the current platform
     */
    public updatePlatform(platform: string): void {
        this.currentPlatform = platform;
        this.updatePlatformDisplay();
        this.saveValues();
    }

    /**
     * Updates the configuration display
     */
    private updateConfigurationDisplay(): void {
        const icon = this.currentConfiguration === 'Debug' ? '$(bug)' : '$(package)';
        this.configurationItem.text = `${icon} ${this.currentConfiguration}`;
    }

    /**
     * Updates the platform display
     */
    private updatePlatformDisplay(): void {
        this.platformItem.text = `$(circuit-board) ${this.currentPlatform}`;
    }

    /**
     * Loads saved values from workspace state
     */
    private loadSavedValues(): void {
        const config = vscode.workspace.getConfiguration('windevHelper');
        this.currentConfiguration = config.get<string>('defaultConfiguration') || 'Debug';
        this.currentPlatform = config.get<string>('defaultPlatform') || 'x64';
        this.updateConfigurationDisplay();
        this.updatePlatformDisplay();
    }

    /**
     * Saves current values to workspace state
     */
    private saveValues(): void {
        // Values are saved through the workspace configuration
        // when user explicitly changes settings
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.configurationItem.dispose();
        this.platformItem.dispose();
    }
}
