// WinDev Helper - VS Code Extension for WinUI Development
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { WinUIProjectManager } from './projectManager';
import { WinAppCli } from './winAppCli';
import { BuildManager } from './buildManager';
import { PackageManager } from './packageManager';
import { TemplateManager } from './templateManager';
import { StatusBarManager } from './statusBarManager';
import { DebugConfigurationProvider } from './debugConfigurationProvider';
import { COMMANDS, CONFIG, DEBUG_TYPES } from './constants';

let projectManager: WinUIProjectManager;
let winAppCli: WinAppCli;
let buildManager: BuildManager;
let packageManager: PackageManager | undefined;
let templateManager: TemplateManager | undefined;
let statusBarManager: StatusBarManager;

/**
 * Lazily gets or creates the PackageManager instance
 */
function getPackageManager(): PackageManager {
    if (!packageManager) {
        packageManager = new PackageManager(winAppCli);
    }
    return packageManager;
}

/**
 * Lazily gets or creates the TemplateManager instance
 */
function getTemplateManager(): TemplateManager {
    if (!templateManager) {
        templateManager = new TemplateManager();
    }
    return templateManager;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('WinDev Helper extension is now active');

    // Initialize core managers synchronously
    winAppCli = new WinAppCli();
    projectManager = new WinUIProjectManager(context, winAppCli);
    buildManager = new BuildManager(winAppCli);
    statusBarManager = new StatusBarManager(context, buildManager);

    // Register debug configuration provider
    const debugProvider = new DebugConfigurationProvider(projectManager, buildManager);
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPES.WINUI, debugProvider)
    );

    // Register all commands
    registerCommands(context);

    // Perform non-blocking background initialization
    initializeInBackground();

    // Update status bar based on configuration
    const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
    if (config.get<boolean>(CONFIG.SHOW_STATUS_BAR_ITEMS)) {
        statusBarManager.show();
    }
}

/**
 * Performs background initialization tasks that shouldn't block extension activation
 */
function initializeInBackground(): void {
    // Detect WinUI project and optionally restore packages
    projectManager.detectWinUIProject()
        .then(async (isWinUI) => {
            if (isWinUI) {
                const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
                if (config.get<boolean>(CONFIG.AUTO_RESTORE_ON_OPEN)) {
                    try {
                        await getPackageManager().restorePackages();
                    } catch (err) {
                        console.error('Auto-restore failed:', err);
                    }
                }
            }
        })
        .catch(err => {
            console.error('Project detection failed:', err);
        });
}

function registerCommands(context: vscode.ExtensionContext): void {
    // Project creation commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_PROJECT, async () => {
            await getTemplateManager().createProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_LIBRARY, async () => {
            await getTemplateManager().createLibrary();
        })
    );

    // Item templates
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_PAGE, async (uri?: vscode.Uri) => {
            await getTemplateManager().addPage(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_USER_CONTROL, async (uri?: vscode.Uri) => {
            await getTemplateManager().addUserControl(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_WINDOW, async (uri?: vscode.Uri) => {
            await getTemplateManager().addWindow(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_VIEW_MODEL, async (uri?: vscode.Uri) => {
            await getTemplateManager().addViewModel(uri);
        })
    );

    // Build commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.BUILD_PROJECT, async () => {
            await buildManager.build(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.REBUILD_PROJECT, async () => {
            await buildManager.rebuild(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CLEAN_PROJECT, async () => {
            await buildManager.clean(projectManager.currentProject);
        })
    );

    // Debug commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.DEBUG_PROJECT, async () => {
            await vscode.debug.startDebugging(undefined, {
                type: DEBUG_TYPES.WINUI,
                name: 'WinUI: Debug',
                request: 'launch',
                project: projectManager.currentProject?.fsPath,
                configuration: buildManager.currentConfiguration,
                platform: buildManager.currentPlatform
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.RUN_WITHOUT_DEBUGGING, async () => {
            await buildManager.runWithoutDebugging(projectManager.currentProject);
        })
    );

    // Package commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_MSIX_PACKAGE, async () => {
            await getPackageManager().createMsixPackage(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.SIGN_PACKAGE, async () => {
            await getPackageManager().signPackage();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.GENERATE_CERTIFICATE, async () => {
            await getPackageManager().generateCertificate();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.INSTALL_CERTIFICATE, async () => {
            await getPackageManager().installCertificate();
        })
    );

    // Identity and manifest commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_DEBUG_IDENTITY, async () => {
            await getPackageManager().createDebugIdentity(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.GENERATE_MANIFEST, async () => {
            await getPackageManager().generateManifest(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_MANIFEST, async () => {
            await projectManager.openManifest();
        })
    );

    // Package management commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.RESTORE_PACKAGES, async () => {
            await getPackageManager().restorePackages();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UPDATE_PACKAGES, async () => {
            await getPackageManager().updatePackages();
        })
    );

    // Initialization commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.INITIALIZE_PROJECT, async () => {
            await winAppCli.init();
        })
    );

    // Configuration commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.SELECT_BUILD_CONFIGURATION, async () => {
            await buildManager.selectConfiguration();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.SELECT_PLATFORM, async () => {
            await buildManager.selectPlatform();
        })
    );

    // Template commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.INSTALL_TEMPLATES, async () => {
            await getTemplateManager().installTemplates();
        })
    );

    // CLI commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CHECK_WINAPP_CLI, async () => {
            await winAppCli.checkInstallation();
        })
    );
}

export function deactivate(): void {
    // Dispose all managers that have resources
    statusBarManager?.dispose();
    buildManager?.dispose();
    packageManager?.dispose();
    templateManager?.dispose();
    winAppCli?.dispose();
}
