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

let projectManager: WinUIProjectManager;
let winAppCli: WinAppCli;
let buildManager: BuildManager;
let packageManager: PackageManager;
let templateManager: TemplateManager;
let statusBarManager: StatusBarManager;

export async function activate(context: vscode.ExtensionContext) {
    console.log('WinDev Helper extension is now active');

    // Initialize managers
    winAppCli = new WinAppCli();
    projectManager = new WinUIProjectManager(context, winAppCli);
    buildManager = new BuildManager(winAppCli);
    packageManager = new PackageManager(winAppCli);
    templateManager = new TemplateManager();
    statusBarManager = new StatusBarManager(context);

    // Check if we're in a WinUI project
    await projectManager.detectWinUIProject();

    // Register debug configuration provider
    const debugProvider = new DebugConfigurationProvider(projectManager, buildManager);
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('winui', debugProvider)
    );

    // Register all commands
    registerCommands(context);

    // Auto-restore packages if enabled
    const config = vscode.workspace.getConfiguration('windevHelper');
    if (config.get<boolean>('autoRestoreOnOpen') && projectManager.isWinUIProject) {
        await packageManager.restorePackages();
    }

    // Update status bar
    if (config.get<boolean>('showStatusBarItems')) {
        statusBarManager.show();
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    // Project creation commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.createProject', async () => {
            await templateManager.createProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.createLibrary', async () => {
            await templateManager.createLibrary();
        })
    );

    // Item templates
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.addPage', async (uri?: vscode.Uri) => {
            await templateManager.addPage(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.addUserControl', async (uri?: vscode.Uri) => {
            await templateManager.addUserControl(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.addWindow', async (uri?: vscode.Uri) => {
            await templateManager.addWindow(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.addViewModel', async (uri?: vscode.Uri) => {
            await templateManager.addViewModel(uri);
        })
    );

    // Build commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.buildProject', async () => {
            await buildManager.build(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.rebuildProject', async () => {
            await buildManager.rebuild(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.cleanProject', async () => {
            await buildManager.clean(projectManager.currentProject);
        })
    );

    // Debug commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.debugProject', async () => {
            await vscode.debug.startDebugging(undefined, {
                type: 'winui',
                name: 'WinUI: Debug',
                request: 'launch',
                project: projectManager.currentProject?.fsPath,
                configuration: buildManager.currentConfiguration,
                platform: buildManager.currentPlatform
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.runWithoutDebugging', async () => {
            await buildManager.runWithoutDebugging(projectManager.currentProject);
        })
    );

    // Package commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.createMsixPackage', async () => {
            await packageManager.createMsixPackage(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.signPackage', async () => {
            await packageManager.signPackage();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.generateCertificate', async () => {
            await packageManager.generateCertificate();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.installCertificate', async () => {
            await packageManager.installCertificate();
        })
    );

    // Identity and manifest commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.createDebugIdentity', async () => {
            await packageManager.createDebugIdentity(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.generateManifest', async () => {
            await packageManager.generateManifest(projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.openManifest', async () => {
            await projectManager.openManifest();
        })
    );

    // Package management commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.restorePackages', async () => {
            await packageManager.restorePackages();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.updatePackages', async () => {
            await packageManager.updatePackages();
        })
    );

    // Initialization commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.initializeProject', async () => {
            await winAppCli.init();
        })
    );

    // Configuration commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.selectBuildConfiguration', async () => {
            await buildManager.selectConfiguration();
            statusBarManager.updateConfiguration(buildManager.currentConfiguration);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.selectPlatform', async () => {
            await buildManager.selectPlatform();
            statusBarManager.updatePlatform(buildManager.currentPlatform);
        })
    );

    // Template commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.installTemplates', async () => {
            await templateManager.installTemplates();
        })
    );

    // CLI commands
    context.subscriptions.push(
        vscode.commands.registerCommand('windev-helper.checkWinAppCli', async () => {
            await winAppCli.checkInstallation();
        })
    );
}

export function deactivate() {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
}
