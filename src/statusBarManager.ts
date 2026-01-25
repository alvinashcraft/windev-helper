// WinDev Helper - Status Bar Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { BuildManager, BuildConfiguration, BuildPlatform } from './buildManager';
import { COMMANDS } from './constants';

/**
 * Manages status bar items for build configuration and platform selection
 */
export class StatusBarManager {
    private readonly buildManager: BuildManager;
    private readonly configurationItem: vscode.StatusBarItem;
    private readonly platformItem: vscode.StatusBarItem;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext, buildManager: BuildManager) {
        this.buildManager = buildManager;

        // Create configuration status bar item
        this.configurationItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.configurationItem.command = COMMANDS.SELECT_BUILD_CONFIGURATION;
        this.configurationItem.tooltip = 'Click to change build configuration';

        // Create platform status bar item
        this.platformItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.platformItem.command = COMMANDS.SELECT_PLATFORM;
        this.platformItem.tooltip = 'Click to change target platform';

        // Initialize display with current values from BuildManager
        this.updateConfigurationDisplay(this.buildManager.currentConfiguration);
        this.updatePlatformDisplay(this.buildManager.currentPlatform);

        // Subscribe to BuildManager events
        this.disposables.push(
            this.buildManager.onConfigurationChanged((config) => {
                this.updateConfigurationDisplay(config);
            })
        );
        this.disposables.push(
            this.buildManager.onPlatformChanged((platform) => {
                this.updatePlatformDisplay(platform);
            })
        );

        // Register disposables with extension context
        context.subscriptions.push(this.configurationItem);
        context.subscriptions.push(this.platformItem);
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
     * Updates the configuration display
     * @param configuration - The current build configuration
     */
    private updateConfigurationDisplay(configuration: BuildConfiguration): void {
        const icon = configuration === 'Debug' ? '$(bug)' : '$(package)';
        this.configurationItem.text = `${icon} ${configuration}`;
    }

    /**
     * Updates the platform display
     * @param platform - The current target platform
     */
    private updatePlatformDisplay(platform: BuildPlatform): void {
        this.platformItem.text = `$(circuit-board) ${platform}`;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.configurationItem.dispose();
        this.platformItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
