// WinDev Helper - VS Code Extension for WinUI Development
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import { DebugConfigurationProvider } from './debugConfigurationProvider';
import { WinAppDebugConfigurationProvider } from './winAppDebugProvider';
import { ServiceLocator } from './serviceLocator';
import { COMMANDS, CONFIG, DEBUG_TYPES } from './constants';
import { XamlPreviewController } from './xamlPreview';
import { XamlDesignerEditorProvider } from './designer';

let services: ServiceLocator;
let previewController: XamlPreviewController;
let winAppDebugProvider: WinAppDebugConfigurationProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('WinDev Helper extension is now active');

    // Initialize the service locator
    services = ServiceLocator.initialize(context);

    // Initialize XAML preview controller
    previewController = new XamlPreviewController(context.extensionPath);
    context.subscriptions.push(previewController);
    context.subscriptions.push(XamlDesignerEditorProvider.register(context, previewController));

    // Register debug configuration provider
    winAppDebugProvider = new WinAppDebugConfigurationProvider(services.winAppCli);
    const debugProvider = new DebugConfigurationProvider(
        services.projectManager, 
        services.buildManager,
        winAppDebugProvider
    );
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPES.WINUI, debugProvider)
    );

    // Register the `winapp` debug type — parity with the official Microsoft
    // WinApp VS Code extension. Launches the build output via `winapp run`
    // (package identity) and attaches the requested debugger.
    //
    // We register the provider only once. Initial F5 configurations are
    // contributed statically via the `initialConfigurations` entry in
    // package.json, so a `Dynamic` registration is unnecessary and would
    // cause `resolveDebugConfiguration*` to fire twice (launching / attaching
    // the app twice).
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPES.WINAPP, winAppDebugProvider)
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
                if (config.get<boolean>(CONFIG.AUTO_RESTORE_ON_OPEN) && services.projectManager.currentProject) {
                    try {
                        await services.packageManager.restorePackages(services.projectManager.currentProject);
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
    const registerProjectCommand = (command: string, run: (project: vscode.Uri) => Promise<unknown>): void => {
        context.subscriptions.push(vscode.commands.registerCommand(command, async (resource?: vscode.Uri) => {
            const project = await services.projectManager.selectProject(resource);
            if (project) {
                await run(project);
            }
        }));
    };
    const registerWorkspaceCommand = (command: string, run: (project?: vscode.Uri) => Promise<unknown>): void => {
        context.subscriptions.push(vscode.commands.registerCommand(command, async (resource?: vscode.Uri) => {
            if ((await services.projectManager.getAllProjects()).length === 0) {
                await run();
                return;
            }
            const project = await services.projectManager.selectProject(resource);
            if (project) {
                await run(project);
            }
        }));
    };

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
        vscode.commands.registerCommand(COMMANDS.ADD_DIALOG, async (uri?: vscode.Uri) => {
            await services.templateManager.addDialog(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_TEMPLATED_CONTROL, async (uri?: vscode.Uri) => {
            await services.templateManager.addTemplatedControl(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_RESOURCE_DICTIONARY, async (uri?: vscode.Uri) => {
            await services.templateManager.addResourceDictionary(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_VIEW_MODEL, async (uri?: vscode.Uri) => {
            await services.templateManager.addViewModel(uri);
        })
    );

    // Build commands
    registerProjectCommand(COMMANDS.BUILD_PROJECT, project => services.buildManager.build(project));

    registerProjectCommand(COMMANDS.REBUILD_PROJECT, project => services.buildManager.rebuild(project));

    registerProjectCommand(COMMANDS.CLEAN_PROJECT, project => services.buildManager.clean(project));

    // Debug commands
    registerProjectCommand(COMMANDS.DEBUG_PROJECT, async project => {
        await vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(project), {
            type: DEBUG_TYPES.WINAPP,
            name: 'WinUI: Debug',
            request: 'launch',
            input: project.fsPath,
            configuration: services.buildManager.currentConfiguration,
            arch: services.buildManager.currentPlatform.toLowerCase()
        });
    });

    registerProjectCommand(COMMANDS.RUN_WITHOUT_DEBUGGING, async project => {
        const projectInfo = await services.projectManager.getProjectInfo(project);
        if (!projectInfo) {
            void vscode.window.showErrorMessage('Cannot run the application: failed to read project information.');
            return;
        }
        const isPackaged = projectInfo.windowsPackageType?.toLowerCase() !== 'none';
        await services.buildManager.runWithoutDebugging(project, projectInfo.targetFramework, isPackaged);
    });

    // Package commands
    registerProjectCommand(COMMANDS.CREATE_MSIX_PACKAGE, project => services.packageManager.createMsixPackage(project));

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

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CERTIFICATE_INFO, async () => {
            await services.packageManager.viewCertificateInfo();
        })
    );

    // Identity and manifest commands
    registerWorkspaceCommand(COMMANDS.CREATE_DEBUG_IDENTITY, project => services.packageManager.createDebugIdentity(project));

    registerWorkspaceCommand(COMMANDS.GENERATE_MANIFEST, project => services.packageManager.generateManifest(project));

    registerWorkspaceCommand(COMMANDS.OPEN_MANIFEST, project => services.projectManager.openManifest(project));

    // Package management commands
    registerWorkspaceCommand(COMMANDS.RESTORE_PACKAGES, project => services.packageManager.restorePackages(project));

    registerWorkspaceCommand(COMMANDS.UPDATE_PACKAGES, project => services.packageManager.updatePackages(project));

    // Initialization commands
    registerWorkspaceCommand(COMMANDS.INITIALIZE_PROJECT, project => services.winAppCli.init(
        project?.fsPath.toLowerCase().endsWith('.csproj') ? path.dirname(project.fsPath) : project?.fsPath));

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

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.INSTALL_COPILOT_PLUGIN, async () => {
            await services.templateManager.installCopilotPlugin();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_SKILLS_REPO, async () => {
            await services.templateManager.openSkillsRepo();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CHECK_DEV_ENVIRONMENT, async () => {
            await services.templateManager.checkDevEnvironment();
        })
    );

    // Microsoft.UI.Reactor commands (v3.1.0+)
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_REACTOR_APP, async () => {
            await services.reactorManager.createReactorApp();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.RUN_REACTOR_BOOTSTRAP, async () => {
            await services.reactorManager.runBootstrap();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_REACTOR_DOCS, async () => {
            await services.reactorManager.openDocs();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.INSTALL_REACTOR_PLUGIN, async () => {
            await services.reactorManager.installReactorPlugin();
        })
    );

    // CLI commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CHECK_WINAPP_CLI, async () => {
            await services.winAppCli.checkInstallation();
        })
    );

    // Microsoft Store commands (v0.2.0+)
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.STORE_CONFIGURE, async () => {
            await services.packageManager.configureStore();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.STORE_LIST_APPS, async () => {
            await services.packageManager.listStoreApps();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.STORE_SUBMISSION_STATUS, async () => {
            await services.packageManager.getStoreSubmissionStatus();
        })
    );

    registerWorkspaceCommand(COMMANDS.STORE_PUBLISH, project => services.packageManager.publishToStore(project));
    registerWorkspaceCommand(COMMANDS.STORE_INIT, project => services.packageManager.initializeStore(project));
    registerWorkspaceCommand(COMMANDS.STORE_PACKAGE, project => services.packageManager.packageForStore(project));
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.STORE_DETAILS, () => services.packageManager.storeDetails()),
        vscode.commands.registerCommand(COMMANDS.STORE_POLL, () => services.packageManager.pollStoreSubmission()),
        vscode.commands.registerCommand(COMMANDS.EMBED_IDENTITY, () => services.packageManager.embedIdentity())
    );

    // External catalog command (v0.2.0+)
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.CREATE_EXTERNAL_CATALOG, async () => {
            await services.packageManager.createExternalCatalog();
        })
    );

    // Run & manage commands (v0.3.0+)
    registerWorkspaceCommand(COMMANDS.RUN_PACKAGED_APP, project => services.packageManager.runPackagedApp(project));

    registerWorkspaceCommand(COMMANDS.UNREGISTER_PACKAGE, project => services.packageManager.unregisterPackage(project));

    registerWorkspaceCommand(COMMANDS.MANIFEST_ADD_ALIAS, project => services.packageManager.addManifestAlias(project));

    registerWorkspaceCommand(COMMANDS.CREATE_SPARSE_PACKAGE, project => services.packageManager.createSparsePackage(project));

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.AZURE_SIGN_PACKAGE, async () => {
            await services.packageManager.azureSignPackage();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.FIND_UI, async () => {
            await services.packageManager.findUi();
        })
    );

    registerWorkspaceCommand(COMMANDS.FIND_API, project => services.packageManager.findApi(project));

    // UI Automation commands (v0.3.0+)
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UI_LIST_WINDOWS, async () => {
            await services.packageManager.uiListWindows();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UI_INSPECT, async () => {
            await services.packageManager.uiInspect();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UI_SCREENSHOT, async () => {
            await services.packageManager.uiScreenshot();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UI_HOVER, async () => {
            await services.packageManager.uiHover();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UI_SEND_KEYS, async () => {
            await services.packageManager.uiSendKeys();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UI_CLICK, async () => {
            await services.packageManager.uiClick();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UI_SET_VALUE, async () => {
            await services.packageManager.uiSetValue();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.UI_RECORD, async () => {
            await services.packageManager.uiRecord();
        })
    );

    // Parity commands with the official Microsoft WinApp VS Code extension
    registerWorkspaceCommand(COMMANDS.MANIFEST_UPDATE_ASSETS, project => services.packageManager.manifestUpdateAssets(project));

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.RUN_SDK_TOOL, async () => {
            await services.packageManager.runSdkTool();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.GET_WINAPP_PATH, async () => {
            await services.packageManager.getWinAppPath();
        })
    );

    registerWorkspaceCommand(COMMANDS.CONFIGURE_WINAPP_DEBUG, project => services.packageManager.configureWinAppDebug(project));

    // XAML designer commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_XAML_DESIGNER, async (resource?: vscode.Uri) => {
            const uri = resource ?? vscode.window.activeTextEditor?.document.uri ?? XamlDesignerEditorProvider.activeDocumentUri;
            if (!uri || !uri.fsPath.toLowerCase().endsWith('.xaml')) {
                void vscode.window.showWarningMessage('Open a XAML file before launching the WinUI XAML Designer.');
                return;
            }
            await vscode.commands.executeCommand('vscode.openWith', uri, XamlDesignerEditorProvider.viewType);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_XAML_TEXT, async (resource?: vscode.Uri) => {
            const uri = resource ?? XamlDesignerEditorProvider.activeDocumentUri ?? vscode.window.activeTextEditor?.document.uri;
            if (uri) {
                await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
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
    winAppDebugProvider?.dispose();
}
