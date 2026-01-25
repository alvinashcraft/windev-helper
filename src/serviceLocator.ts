// WinDev Helper - Service Locator
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { WinAppCli } from './winAppCli';
import { WinUIProjectManager } from './projectManager';
import { BuildManager } from './buildManager';
import { PackageManager } from './packageManager';
import { TemplateManager } from './templateManager';
import { StatusBarManager } from './statusBarManager';

/**
 * Service locator for dependency injection across the extension.
 * Provides lazy initialization and centralized access to all services.
 */
export class ServiceLocator {
    private static _instance: ServiceLocator | undefined;
    private readonly _context: vscode.ExtensionContext;

    // Core services (eagerly initialized)
    private _winAppCli: WinAppCli | undefined;
    private _projectManager: WinUIProjectManager | undefined;
    private _buildManager: BuildManager | undefined;
    private _statusBarManager: StatusBarManager | undefined;

    // Lazy services (initialized on demand)
    private _packageManager: PackageManager | undefined;
    private _templateManager: TemplateManager | undefined;

    private constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    /**
     * Initializes the service locator with the extension context.
     * Must be called once during extension activation.
     * @param context - The VS Code extension context
     * @returns The singleton ServiceLocator instance
     */
    public static initialize(context: vscode.ExtensionContext): ServiceLocator {
        if (ServiceLocator._instance) {
            throw new Error('ServiceLocator is already initialized');
        }
        ServiceLocator._instance = new ServiceLocator(context);
        return ServiceLocator._instance;
    }

    /**
     * Gets the singleton ServiceLocator instance.
     * @throws Error if not initialized
     */
    public static get instance(): ServiceLocator {
        if (!ServiceLocator._instance) {
            throw new Error('ServiceLocator is not initialized. Call initialize() first.');
        }
        return ServiceLocator._instance;
    }

    /**
     * Checks if the service locator has been initialized.
     */
    public static get isInitialized(): boolean {
        return ServiceLocator._instance !== undefined;
    }

    /**
     * Gets the extension context.
     */
    public get context(): vscode.ExtensionContext {
        return this._context;
    }

    /**
     * Gets the WinAppCli service.
     */
    public get winAppCli(): WinAppCli {
        if (!this._winAppCli) {
            this._winAppCli = new WinAppCli();
        }
        return this._winAppCli;
    }

    /**
     * Gets the WinUIProjectManager service.
     */
    public get projectManager(): WinUIProjectManager {
        if (!this._projectManager) {
            this._projectManager = new WinUIProjectManager(this._context, this.winAppCli);
        }
        return this._projectManager;
    }

    /**
     * Gets the BuildManager service.
     */
    public get buildManager(): BuildManager {
        if (!this._buildManager) {
            this._buildManager = new BuildManager(this.winAppCli);
        }
        return this._buildManager;
    }

    /**
     * Gets the StatusBarManager service.
     */
    public get statusBarManager(): StatusBarManager {
        if (!this._statusBarManager) {
            this._statusBarManager = new StatusBarManager(this._context, this.buildManager);
        }
        return this._statusBarManager;
    }

    /**
     * Gets the PackageManager service (lazy-loaded).
     */
    public get packageManager(): PackageManager {
        if (!this._packageManager) {
            this._packageManager = new PackageManager(this.winAppCli);
        }
        return this._packageManager;
    }

    /**
     * Gets the TemplateManager service (lazy-loaded).
     */
    public get templateManager(): TemplateManager {
        if (!this._templateManager) {
            this._templateManager = new TemplateManager();
        }
        return this._templateManager;
    }

    /**
     * Disposes all services and clears the singleton instance.
     */
    public dispose(): void {
        this._statusBarManager?.dispose();
        this._buildManager?.dispose();
        this._packageManager?.dispose();
        this._templateManager?.dispose();
        this._winAppCli?.dispose();

        // Clear references
        this._winAppCli = undefined;
        this._projectManager = undefined;
        this._buildManager = undefined;
        this._statusBarManager = undefined;
        this._packageManager = undefined;
        this._templateManager = undefined;

        ServiceLocator._instance = undefined;
    }
}
