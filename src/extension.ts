// WinDev Helper - VS Code Extension for WinUI Development
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { DebugConfigurationProvider } from './debugConfigurationProvider';
import { ServiceLocator } from './serviceLocator';
import { COMMANDS, CONFIG, DEBUG_TYPES } from './constants';
import { XamlPreviewController } from './xamlPreview';
import { XamlDesignerPanel } from './xamlDesigner';
import { PropertyPaneController } from './propertyPane';

let services: ServiceLocator;
let previewController: XamlPreviewController;
let propertyPaneController: PropertyPaneController;
let designerSelectionSubscription: vscode.Disposable | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('WinDev Helper extension is now active');

    // Initialize the service locator
    services = ServiceLocator.initialize(context);

    // Initialize XAML preview controller
    previewController = new XamlPreviewController(context.extensionPath);
    context.subscriptions.push(previewController);

    // Initialize property pane controller
    propertyPaneController = new PropertyPaneController(context);
    context.subscriptions.push(propertyPaneController);

    // Connect designer selection events to property pane
    designerSelectionSubscription = XamlDesignerPanel.onElementSelected(event => {
        propertyPaneController.updateDocument(event.document);
        propertyPaneController.selectElement(event.element);
    });
    context.subscriptions.push(designerSelectionSubscription);

    // Also update property pane when active editor changes to a XAML file
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && (editor.document.languageId === 'xaml' || editor.document.fileName.endsWith('.xaml'))) {
                propertyPaneController.updateDocument(editor.document);
                propertyPaneController.clearSelection();
            }
        })
    );

    // Register debug configuration provider
    const debugProvider = new DebugConfigurationProvider(
        services.projectManager, 
        services.buildManager
    );
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
        services.statusBarManager.show();
    }
}

/**
 * Performs background initialization tasks that shouldn't block extension activation
 */
function initializeInBackground(): void {
    // Detect WinUI project and optionally restore packages
    services.projectManager.detectWinUIProject()
        .then(async (isWinUI) => {
            if (isWinUI) {
                const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
                if (config.get<boolean>(CONFIG.AUTO_RESTORE_ON_OPEN)) {
                    try {
                        await services.packageManager.restorePackages();
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
            await services.templateManager.createProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_LIBRARY, async () => {
            await services.templateManager.createLibrary();
        })
    );

    // Item templates
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_PAGE, async (uri?: vscode.Uri) => {
            await services.templateManager.addPage(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_USER_CONTROL, async (uri?: vscode.Uri) => {
            await services.templateManager.addUserControl(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_WINDOW, async (uri?: vscode.Uri) => {
            await services.templateManager.addWindow(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_VIEW_MODEL, async (uri?: vscode.Uri) => {
            await services.templateManager.addViewModel(uri);
        })
    );

    // Build commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.BUILD_PROJECT, async () => {
            await services.buildManager.build(services.projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.REBUILD_PROJECT, async () => {
            await services.buildManager.rebuild(services.projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CLEAN_PROJECT, async () => {
            await services.buildManager.clean(services.projectManager.currentProject);
        })
    );

    // Debug commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.DEBUG_PROJECT, async () => {
            await vscode.debug.startDebugging(undefined, {
                type: DEBUG_TYPES.WINUI,
                name: 'WinUI: Debug',
                request: 'launch',
                project: services.projectManager.currentProject?.fsPath,
                configuration: services.buildManager.currentConfiguration,
                platform: services.buildManager.currentPlatform
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.RUN_WITHOUT_DEBUGGING, async () => {
            await services.buildManager.runWithoutDebugging(services.projectManager.currentProject);
        })
    );

    // Package commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_MSIX_PACKAGE, async () => {
            await services.packageManager.createMsixPackage(services.projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.SIGN_PACKAGE, async () => {
            await services.packageManager.signPackage();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.GENERATE_CERTIFICATE, async () => {
            await services.packageManager.generateCertificate();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.INSTALL_CERTIFICATE, async () => {
            await services.packageManager.installCertificate();
        })
    );

    // Identity and manifest commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_DEBUG_IDENTITY, async () => {
            await services.packageManager.createDebugIdentity(services.projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.GENERATE_MANIFEST, async () => {
            await services.packageManager.generateManifest(services.projectManager.currentProject);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_MANIFEST, async () => {
            await services.projectManager.openManifest();
        })
    );

    // Package management commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.RESTORE_PACKAGES, async () => {
            await services.packageManager.restorePackages();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UPDATE_PACKAGES, async () => {
            await services.packageManager.updatePackages();
        })
    );

    // Initialization commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.INITIALIZE_PROJECT, async () => {
            await services.winAppCli.init();
        })
    );

    // Configuration commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.SELECT_BUILD_CONFIGURATION, async () => {
            await services.buildManager.selectConfiguration();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.SELECT_PLATFORM, async () => {
            await services.buildManager.selectPlatform();
        })
    );

    // Template commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.INSTALL_TEMPLATES, async () => {
            await services.templateManager.installTemplates();
        })
    );

    // CLI commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CHECK_WINAPP_CLI, async () => {
            await services.winAppCli.checkInstallation();
        })
    );

    // XAML Preview command
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_XAML_PREVIEW, async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && (editor.document.languageId === 'xaml' || editor.document.fileName.endsWith('.xaml'))) {
                XamlDesignerPanel.createOrShow(context.extensionUri, previewController, editor.document);
            } else {
                XamlDesignerPanel.createOrShow(context.extensionUri, previewController);
            }
        })
    );
}

export function deactivate(): void {
    // previewController is disposed automatically via context.subscriptions
    // Only dispose services that aren't in subscriptions
    if (ServiceLocator.isInitialized) {
        services.dispose();
    }
}
