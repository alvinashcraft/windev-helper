// WinDev Helper - Template Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import { CONFIG, OUTPUT_CHANNELS, TEMPLATE_NAMES, TEMPLATE_PACKAGES } from './constants';

/**
 * Identifies which dotnet template package should provide a given template.
 */
type TemplateSource = 'official' | 'community';

/**
 * Manages WinUI project and item templates
 */
export class TemplateManager {
    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.TEMPLATES);
    }

    /**
     * Resolves which template package the user wants to use.
     *
     * Honors the `windevHelper.templates.source` setting. When set to `auto`,
     * prefers the official Microsoft package if it is installed, otherwise
     * falls back to the community package (which has been the historical
     * default for this extension).
     */
    private async resolveTemplateSource(): Promise<TemplateSource> {
        const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
        const setting = config.get<string>(CONFIG.TEMPLATES_SOURCE, 'auto');

        if (setting === 'official') { return 'official'; }
        if (setting === 'community') { return 'community'; }

        // auto: prefer official when available, otherwise community
        if (await this.isPackageInstalled(TEMPLATE_PACKAGES.OFFICIAL)) {
            return 'official';
        }
        return 'community';
    }

    /**
     * Returns true when the given template package id is reported as
     * installed by `dotnet new uninstall` (running it with no arguments
     * lists the currently installed template packages, which is the
     * fastest reliable way to detect installation — `dotnet new list`
     * is much slower and only surfaces individual templates).
     */
    private async isPackageInstalled(packageId: string): Promise<boolean> {
        try {
            const output = await this.executeCommand('dotnet new uninstall', undefined, true);
            return output.toLowerCase().includes(packageId.toLowerCase());
        } catch {
            return false;
        }
    }

    /**
     * Installs WinUI templates from the dotnet template package. Prompts the
     * user when the configured source is `auto` and neither package is
     * installed yet so they can pick between the official Microsoft package
     * and the community package.
     */
    public async installTemplates(): Promise<void> {
        const source = await this.pickInstallSource();
        if (!source) { return; }

        const packageId = source === 'official'
            ? TEMPLATE_PACKAGES.OFFICIAL
            : TEMPLATE_PACKAGES.COMMUNITY;

        const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
        const allowPrerelease = config.get<boolean>(CONFIG.TEMPLATES_ALLOW_PRERELEASE, true);
        const installCommand = source === 'official' && allowPrerelease
            ? `dotnet new install ${packageId}::*-* --force`
            : `dotnet new install ${packageId}`;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Installing ${packageId}...`,
            cancellable: false
        }, async () => {
            try {
                await this.executeCommand(installCommand);
                vscode.window.showInformationMessage(`${packageId} installed successfully.`);
            } catch (error) {
                const learnMoreUrl = source === 'official'
                    ? 'https://www.nuget.org/packages/Microsoft.WindowsAppSDK.WinUI.CSharp.Templates'
                    : 'https://github.com/egvijayanand/winui-templates';
                const action = await vscode.window.showErrorMessage(
                    `Failed to install templates: ${error}`,
                    'Learn More'
                );
                if (action === 'Learn More') {
                    vscode.env.openExternal(vscode.Uri.parse(learnMoreUrl));
                }
            }
        });
    }

    /**
     * Resolves which template package to install. Honors the configured
     * source unless it is `auto`, in which case the user is prompted.
     */
    private async pickInstallSource(): Promise<TemplateSource | undefined> {
        const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
        const setting = config.get<string>(CONFIG.TEMPLATES_SOURCE, 'auto');
        if (setting === 'official') { return 'official'; }
        if (setting === 'community') { return 'community'; }

        const pick = await vscode.window.showQuickPick(
            [
                {
                    label: 'Official (Microsoft.WindowsAppSDK.WinUI.CSharp.Templates)',
                    description: 'Microsoft — winui, winui-navview, winui-tabview, winui-mvvm, winui-lib, winui-unittest',
                    value: 'official' as const,
                },
                {
                    label: 'Community (VijayAnand.WinUITemplates)',
                    description: 'Stable — long-standing community pack used by previous releases',
                    value: 'community' as const,
                },
            ],
            { placeHolder: 'Which WinUI template package would you like to install?' }
        );
        return pick?.value;
    }

    /**
     * Creates a new WinUI project
     */
    public async createProject(): Promise<void> {
        // Check if templates are installed
        const templatesInstalled = await this.checkTemplatesInstalled();
        if (!templatesInstalled) {
            const action = await vscode.window.showWarningMessage(
                'WinUI templates are not installed. Would you like to install them?',
                'Install',
                'Cancel'
            );
            if (action === 'Install') {
                await this.installTemplates();
            } else {
                return;
            }
        }

        const source = await this.resolveTemplateSource();

        // Get project name
        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter project name',
            placeHolder: 'MyWinUIApp',
            validateInput: (value) => {
                if (!value) {
                    return 'Project name is required';
                }
                if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
                    return 'Project name must start with a letter and contain only letters, numbers, and underscores';
                }
                return undefined;
            }
        });

        if (!projectName) {
            return;
        }

        // Pick the template variant. The official Microsoft package exposes
        // dedicated MVVM and NavigationView templates; the community package
        // uses a single `winui` template with an `-mvvm` switch.
        const variant = await this.pickProjectTemplate(source);
        if (!variant) {
            return;
        }

        // Get target folder
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select folder for new project'
        });

        if (!folderUri || folderUri.length === 0) {
            return;
        }

        const targetDir = folderUri[0].fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating WinUI project: ${projectName}...`,
            cancellable: false
        }, async () => {
            try {
                let command = `dotnet new ${variant.template} -n ${projectName}`;
                if (variant.extraArgs) {
                    command += ` ${variant.extraArgs}`;
                }

                await this.executeCommand(command, targetDir);

                // Some templates create a subfolder named after the project, others don't
                const subfolderPath = path.join(targetDir, projectName);
                const projectPath = fs.existsSync(subfolderPath) ? subfolderPath : targetDir;
                
                const action = await vscode.window.showInformationMessage(
                    `WinUI project '${projectName}' created successfully.`,
                    'Open Project',
                    'Open in New Window'
                );

                if (action === 'Open Project') {
                    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), false);
                } else if (action === 'Open in New Window') {
                    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), true);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create project: ${error}`);
            }
        });
    }

    /**
     * Builds the quick-pick of available project template variants for the
     * resolved source. The official Microsoft package exposes dedicated
     * templates per scenario; the community package layers options onto a
     * single `winui` template via switches.
     */
    private async pickProjectTemplate(
        source: TemplateSource
    ): Promise<{ template: string; extraArgs?: string } | undefined> {
        if (source === 'official') {
            const pick = await vscode.window.showQuickPick(
                [
                    {
                        label: 'Blank App',
                        description: 'winui — single-project MSIX-packaged blank app',
                        value: { template: TEMPLATE_NAMES.OFFICIAL.BLANK },
                    },
                    {
                        label: 'NavigationView App',
                        description: 'winui-navview — starter shell with NavigationView',
                        value: { template: TEMPLATE_NAMES.OFFICIAL.NAVIGATION_VIEW },
                    },
                    {
                        label: 'TabView App',
                        description: 'winui-tabview — tab-based UI with add/remove/drag support',
                        value: { template: TEMPLATE_NAMES.OFFICIAL.TAB_VIEW },
                    },
                    {
                        label: 'MVVM App',
                        description: 'winui-mvvm — blank app pre-wired with CommunityToolkit.Mvvm',
                        value: { template: TEMPLATE_NAMES.OFFICIAL.MVVM },
                    },
                    {
                        label: 'Unit Test Project',
                        description: 'winui-unittest — packaged MSTest project for WinUI APIs',
                        value: { template: TEMPLATE_NAMES.OFFICIAL.UNIT_TEST },
                    },
                ],
                { placeHolder: 'Select a project template' }
            );
            return pick?.value;
        }

        // Community pack: ask up-front whether to enable the MVVM toolkit.
        const useMvvm = await vscode.window.showQuickPick(
            ['Yes', 'No'],
            { placeHolder: 'Use MVVM Toolkit?', title: 'MVVM Support' }
        );
        if (!useMvvm) { return undefined; }

        return {
            template: TEMPLATE_NAMES.COMMUNITY.BLANK,
            ...(useMvvm === 'Yes' ? { extraArgs: '-mvvm' } : {}),
        };
    }

    /**
     * Creates a new WinUI library project
     */
    public async createLibrary(): Promise<void> {
        const templatesInstalled = await this.checkTemplatesInstalled();
        if (!templatesInstalled) {
            const action = await vscode.window.showWarningMessage(
                'WinUI templates are not installed. Would you like to install them?',
                'Install',
                'Cancel'
            );
            if (action === 'Install') {
                await this.installTemplates();
            } else {
                return;
            }
        }

        const libraryName = await vscode.window.showInputBox({
            prompt: 'Enter library name',
            placeHolder: 'MyWinUILib',
            validateInput: (value) => {
                if (!value) {
                    return 'Library name is required';
                }
                if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
                    return 'Library name must start with a letter and contain only letters, numbers, and underscores';
                }
                return undefined;
            }
        });

        if (!libraryName) {
            return;
        }

        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select folder for new library'
        });

        if (!folderUri || folderUri.length === 0) {
            return;
        }

        const targetDir = folderUri[0].fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating WinUI library: ${libraryName}...`,
            cancellable: false
        }, async () => {
            try {
                const source = await this.resolveTemplateSource();
                const template = source === 'official'
                    ? TEMPLATE_NAMES.OFFICIAL.LIBRARY
                    : TEMPLATE_NAMES.COMMUNITY.LIBRARY;
                await this.executeCommand(`dotnet new ${template} -n ${libraryName}`, targetDir);
                vscode.window.showInformationMessage(`WinUI library '${libraryName}' created successfully.`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create library: ${error}`);
            }
        });
    }

    /**
     * Adds a new Page to the project
     */
    public async addPage(uri?: vscode.Uri): Promise<void> {
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.PAGE, 'Page', uri, { supportsViewModel: true, isControl: false });
    }

    /**
     * Adds a new UserControl to the project
     */
    public async addUserControl(uri?: vscode.Uri): Promise<void> {
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.USER_CONTROL, 'User Control', uri, { supportsViewModel: true, isControl: true });
    }

    /**
     * Adds a new Window to the project
     */
    public async addWindow(uri?: vscode.Uri): Promise<void> {
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.WINDOW, 'Window', uri, { supportsViewModel: true, isControl: false });
    }

    /**
     * Adds a new ContentDialog to the project.
     *
     * Only the official Microsoft template pack ships `winui-dialog`; if the
     * user has the community pack selected, this command bails out with a
     * message asking them to install the official pack rather than silently
     * scaffolding the wrong artifact.
     */
    public async addDialog(uri?: vscode.Uri): Promise<void> {
        if (!(await this.ensureOfficialPack('Add New Content Dialog', 'winui-dialog'))) { return; }
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.DIALOG, 'Content Dialog', uri, { supportsViewModel: true, isControl: false });
    }

    /**
     * Adds a new Templated (custom) Control to the project. Generates a
     * Themes/Generic.xaml entry alongside the C# class via the official
     * `winui-templatedcontrol` template. Requires the official pack.
     */
    public async addTemplatedControl(uri?: vscode.Uri): Promise<void> {
        if (!(await this.ensureOfficialPack('Add New Templated Control', 'winui-templatedcontrol'))) { return; }
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.TEMPLATED_CONTROL, 'Templated Control', uri, { supportsViewModel: false, isControl: true });
    }

    /**
     * Adds a new ResourceDictionary XAML file to the project via the official
     * `winui-resourcedictionary` template. Requires the official pack.
     */
    public async addResourceDictionary(uri?: vscode.Uri): Promise<void> {
        if (!(await this.ensureOfficialPack('Add New Resource Dictionary', 'winui-resourcedictionary'))) { return; }
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.RESOURCE_DICTIONARY, 'Resource Dictionary', uri, { supportsViewModel: false, isControl: false });
    }

    /**
     * Verifies the resolved template source is `official` before running an
     * item template that only ships in the Microsoft pack. Returns `true`
     * when the user can proceed; otherwise surfaces an actionable message
     * (offering to install the official pack) and returns `false`.
     */
    private async ensureOfficialPack(itemLabel: string, templateName: string): Promise<boolean> {
        const source = await this.resolveTemplateSource();
        if (source === 'official') { return true; }

        const action = await vscode.window.showWarningMessage(
            `${itemLabel} requires the official Microsoft template pack (${TEMPLATE_PACKAGES.OFFICIAL}). The '${templateName}' template is not included in the community pack.`,
            'Install Official Pack',
            'Cancel'
        );

        if (action === 'Install Official Pack') {
            // Temporarily force the official source so installTemplates picks it.
            const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
            const previous = config.get<string>(CONFIG.TEMPLATES_SOURCE, 'auto');
            try {
                await config.update(CONFIG.TEMPLATES_SOURCE, 'official', vscode.ConfigurationTarget.Workspace);
                await this.installTemplates();
            } finally {
                await config.update(CONFIG.TEMPLATES_SOURCE, previous, vscode.ConfigurationTarget.Workspace);
            }
        }
        return false;
    }

    /**
     * Adds a new item using the specified template
     */
    private async addItem(
        template: string, 
        itemType: string, 
        uri?: vscode.Uri,
        options: { supportsViewModel: boolean; isControl: boolean } = { supportsViewModel: false, isControl: false }
    ): Promise<void> {
        const itemName = await vscode.window.showInputBox({
            prompt: `Enter ${itemType} name`,
            placeHolder: `My${itemType.replace(' ', '')}`,
            validateInput: (value) => {
                if (!value) {
                    return `${itemType} name is required`;
                }
                if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
                    return 'Name must start with a letter and contain only letters, numbers, and underscores';
                }
                return undefined;
            }
        });

        if (!itemName) {
            return;
        }

        // Ask if user wants to create a corresponding ViewModel
        let createViewModel = false;
        if (options.supportsViewModel) {
            const viewModelChoice = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Create a corresponding ViewModel?',
                title: 'ViewModel Generation'
            });
            createViewModel = viewModelChoice === 'Yes';
        }

        // Determine workspace and target directories
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        
        // Determine target directory for the view
        let viewTargetDir: string;
        if (uri) {
            viewTargetDir = uri.fsPath;
        } else {
            // Default to Views folder, or Views/Controls for user controls
            if (options.isControl) {
                viewTargetDir = path.join(workspaceRoot, 'Views', 'Controls');
            } else {
                viewTargetDir = path.join(workspaceRoot, 'Views');
            }
        }

        // Ensure target directory exists
        await fs.promises.mkdir(viewTargetDir, { recursive: true });

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Adding ${itemType}: ${itemName}...`,
            cancellable: false
        }, async () => {
            try {
                // Always ensure global usings are configured for MVVM support
                // This ensures Pages, Controls, and Windows have access to common namespaces
                await this.ensureGlobalUsings(workspaceRoot);

                await this.executeCommand(`dotnet new ${template} -n ${itemName}`, viewTargetDir);
                
                // Open the created XAML file
                const xamlFile = path.join(viewTargetDir, `${itemName}.xaml`);
                const doc = await vscode.workspace.openTextDocument(xamlFile);
                await vscode.window.showTextDocument(doc);

                // Create ViewModel if requested
                if (createViewModel) {
                    await this.createViewModel(itemName, workspaceRoot, options.isControl);
                }
                
                vscode.window.showInformationMessage(`${itemType} '${itemName}' added successfully.`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add ${itemType}: ${error}`);
            }
        });
    }

    /**
     * Adds a new ViewModel to the project (standalone, without a view)
     */
    public async addViewModel(_uri?: vscode.Uri): Promise<void> {
        const viewModelName = await vscode.window.showInputBox({
            prompt: 'Enter ViewModel name',
            placeHolder: 'MyViewModel',
            validateInput: (value) => {
                if (!value) {
                    return 'ViewModel name is required';
                }
                if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
                    return 'Name must start with a letter and contain only letters, numbers, and underscores';
                }
                return undefined;
            }
        });

        if (!viewModelName) {
            return;
        }

        // Ensure name ends with ViewModel
        const finalName = viewModelName.endsWith('ViewModel') ? viewModelName : `${viewModelName}ViewModel`;

        // Ask if this is for a control
        const locationChoice = await vscode.window.showQuickPick(
            ['ViewModels folder', 'ViewModels/Controls folder'],
            {
                placeHolder: 'Where should the ViewModel be created?',
                title: 'ViewModel Location'
            }
        );

        if (!locationChoice) {
            return;
        }

        const isControl = locationChoice === 'ViewModels/Controls folder';

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Adding ViewModel: ${finalName}...`,
            cancellable: false
        }, async () => {
            try {
                await this.createViewModel(finalName, workspaceFolder.uri.fsPath, isControl, true);
                vscode.window.showInformationMessage(`ViewModel '${finalName}' added successfully.`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add ViewModel: ${error}`);
            }
        });
    }

    /**
     * Creates a ViewModel for a view
     * @param viewName The name of the view (will be converted to ViewModel name)
     * @param workspaceRoot The workspace root path
     * @param isControl Whether this is for a control (uses Controls subfolder)
     * @param isStandalone If true, the name is already a ViewModel name; if false, derive from view name
     */
    private async createViewModel(
        viewName: string, 
        workspaceRoot: string, 
        isControl: boolean,
        isStandalone: boolean = false
    ): Promise<void> {
        // Derive ViewModel name from view name (or use as-is if standalone)
        const viewModelName = isStandalone 
            ? viewName 
            : viewName.replace(/(Page|Window|Control|UserControl)$/, '') + 'ViewModel';
        
        // Ensure MVVM Toolkit is installed and BaseViewModel exists
        await this.ensureMvvmInfrastructure(workspaceRoot);

        // Determine target directory for ViewModel
        let viewModelDir: string;
        if (isControl) {
            viewModelDir = path.join(workspaceRoot, 'ViewModels', 'Controls');
        } else {
            viewModelDir = path.join(workspaceRoot, 'ViewModels');
        }

        // Ensure directory exists
        await fs.promises.mkdir(viewModelDir, { recursive: true });

        // Detect namespace from project
        const namespace = await this.detectNamespace(workspaceRoot);
        const viewModelNamespace = isControl ? `${namespace}.ViewModels.Controls` : `${namespace}.ViewModels`;

        // Generate ViewModel content
        const viewModelContent = this.generateViewModelContent(viewModelName, viewModelNamespace);

        // Write ViewModel file
        const viewModelPath = path.join(viewModelDir, `${viewModelName}.cs`);
        await fs.promises.writeFile(viewModelPath, viewModelContent, 'utf8');

        this.outputChannel.appendLine(`Created ViewModel: ${viewModelPath}`);

        // Open the created ViewModel
        const doc = await vscode.workspace.openTextDocument(viewModelPath);
        await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
    }

    /**
     * Ensures MVVM Toolkit is installed and global usings are configured
     * @param workspaceRoot - The workspace root path
     */
    private async ensureMvvmInfrastructure(workspaceRoot: string): Promise<void> {
        // Check if CommunityToolkit.Mvvm is referenced
        const hasMvvmToolkit = await this.checkMvvmToolkitInstalled(workspaceRoot);
        if (!hasMvvmToolkit) {
            this.outputChannel.appendLine('Installing CommunityToolkit.Mvvm package...');
            try {
                await this.executeCommand('dotnet add package CommunityToolkit.Mvvm', workspaceRoot);
                this.outputChannel.appendLine('CommunityToolkit.Mvvm installed successfully.');
            } catch (error) {
                this.outputChannel.appendLine(`Warning: Failed to install CommunityToolkit.Mvvm: ${error}`);
            }
        }

        // Ensure global usings are configured
        await this.ensureGlobalUsings(workspaceRoot);

        // Check if BaseViewModel exists
        const baseViewModelPath = path.join(workspaceRoot, 'ViewModels', 'BaseViewModel.cs');
        const baseViewModelExists = await this.fileExists(baseViewModelPath);
        
        if (!baseViewModelExists) {
            await this.createBaseViewModel(workspaceRoot);
        }
    }

    /**
     * Ensures global usings file exists with required MVVM imports
     * @param workspaceRoot - The workspace root path
     */
    private async ensureGlobalUsings(workspaceRoot: string): Promise<void> {
        const namespace = await this.detectNamespace(workspaceRoot);
        
        // Common locations for global usings file
        const possiblePaths = [
            path.join(workspaceRoot, 'Imports.cs'),
            path.join(workspaceRoot, 'GlobalUsings.cs'),
            path.join(workspaceRoot, 'Usings.cs')
        ];

        let globalUsingsPath: string | undefined;
        let existingContent = '';

        // Check if any global usings file exists
        for (const filePath of possiblePaths) {
            if (await this.fileExists(filePath)) {
                globalUsingsPath = filePath;
                try {
                    existingContent = await fs.promises.readFile(filePath, 'utf8');
                } catch {
                    existingContent = '';
                }
                break;
            }
        }

        // Required global usings for MVVM and Views
        const requiredUsings = [
            'global using CommunityToolkit.Mvvm.ComponentModel;',
            'global using CommunityToolkit.Mvvm.Input;',
            `global using ${namespace}.ViewModels;`,
            `global using ${namespace}.Views;`
        ];

        // If no file exists, create Imports.cs
        if (!globalUsingsPath) {
            globalUsingsPath = path.join(workspaceRoot, 'Imports.cs');
            const content = this.generateGlobalUsingsContent(namespace);
            await fs.promises.writeFile(globalUsingsPath, content, 'utf8');
            this.outputChannel.appendLine(`Created global usings file: ${globalUsingsPath}`);
            return;
        }

        // Check if required usings are present and add missing ones
        const missingUsings: string[] = [];
        for (const usingStatement of requiredUsings) {
            // Check if the using (or a variation) is already present
            const usingPattern = usingStatement.replace('global using ', '').replace(';', '');
            if (!existingContent.includes(usingPattern)) {
                missingUsings.push(usingStatement);
            }
        }

        if (missingUsings.length > 0) {
            // Append missing usings to the file
            const additionalContent = '\n' + missingUsings.join('\n') + '\n';
            await fs.promises.appendFile(globalUsingsPath, additionalContent, 'utf8');
            this.outputChannel.appendLine(`Added missing global usings to: ${globalUsingsPath}`);
        }
    }

    /**
     * Generates the content for a new global usings file
     * @param namespace - The project namespace
     * @returns The file content
     */
    private generateGlobalUsingsContent(namespace: string): string {
        return `// Global using directives for ${namespace}
// This file contains global using statements that are available throughout the project.

global using CommunityToolkit.Mvvm.ComponentModel;
global using CommunityToolkit.Mvvm.Input;
global using CommunityToolkit.Mvvm.Messaging;

global using ${namespace}.ViewModels;
global using ${namespace}.Views;

global using Microsoft.UI.Xaml;
global using Microsoft.UI.Xaml.Controls;
`;
    }

    /**
     * Checks if CommunityToolkit.Mvvm is referenced in the project
     */
    private async checkMvvmToolkitInstalled(_workspaceRoot: string): Promise<boolean> {
        try {
            const csprojFiles = await vscode.workspace.findFiles('**/*.csproj', '**/bin/**', 1);
            if (csprojFiles.length > 0) {
                const content = await fs.promises.readFile(csprojFiles[0].fsPath, 'utf8');
                return content.includes('CommunityToolkit.Mvvm');
            }
        } catch {
            // Ignore errors
        }
        return false;
    }

    /**
     * Checks if a file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Creates the BaseViewModel class
     * @param workspaceRoot - The workspace root path
     */
    private async createBaseViewModel(workspaceRoot: string): Promise<void> {
        const viewModelsDir = path.join(workspaceRoot, 'ViewModels');
        await fs.promises.mkdir(viewModelsDir, { recursive: true });

        const namespace = await this.detectNamespace(workspaceRoot);
        
        // Note: Using statements are provided via global usings in Imports.cs
        const baseViewModelContent = `namespace ${namespace}.ViewModels;

/// <summary>
/// Base class for all ViewModels in the application.
/// Inherits from ObservableObject to provide INotifyPropertyChanged support.
/// </summary>
public partial class BaseViewModel : ObservableObject
{
    /// <summary>
    /// Initializes a new instance of the <see cref="BaseViewModel"/> class.
    /// </summary>
    public BaseViewModel()
    {
    }

    /// <summary>
    /// Gets or sets the title for this ViewModel.
    /// </summary>
    [ObservableProperty]
    private string _title = string.Empty;
}
`;

        const baseViewModelPath = path.join(viewModelsDir, 'BaseViewModel.cs');
        await fs.promises.writeFile(baseViewModelPath, baseViewModelContent, 'utf8');
        this.outputChannel.appendLine(`Created BaseViewModel: ${baseViewModelPath}`);
    }

    /**
     * Detects the root namespace from the project file
     */
    private async detectNamespace(workspaceRoot: string): Promise<string> {
        try {
            // Find .csproj file
            const csprojFiles = await vscode.workspace.findFiles('**/*.csproj', '**/bin/**', 1);
            if (csprojFiles.length > 0) {
                const content = await fs.promises.readFile(csprojFiles[0].fsPath, 'utf8');
                
                // Try to find RootNamespace
                const rootNsMatch = content.match(/<RootNamespace>(.*?)<\/RootNamespace>/);
                if (rootNsMatch) {
                    return rootNsMatch[1];
                }

                // Fall back to project name
                const projectName = path.basename(csprojFiles[0].fsPath, '.csproj');
                return projectName;
            }
        } catch {
            // Ignore errors
        }

        // Default to folder name
        return path.basename(workspaceRoot);
    }

    /**
     * Generates ViewModel class content
     * @param viewModelName - The name of the ViewModel class
     * @param namespace - The namespace for the ViewModel
     * @returns The generated C# code
     */
    private generateViewModelContent(viewModelName: string, namespace: string): string {
        // Derive a title from the ViewModel name (e.g., MainViewModel -> Main, SettingsViewModel -> Settings)
        const title = viewModelName.replace(/ViewModel$/, '');

        // Note: Using statements are provided via global usings in Imports.cs
        return `namespace ${namespace};

/// <summary>
/// ViewModel for the ${title} view.
/// </summary>
public partial class ${viewModelName} : BaseViewModel
{
    /// <summary>
    /// Initializes a new instance of the <see cref="${viewModelName}"/> class.
    /// </summary>
    public ${viewModelName}()
    {
        Title = "${title}";
    }
}
`;
    }

    /**
     * Helps users install the official WinUI Copilot plugin for the GitHub
     * Copilot CLI / Claude Code. The plugin ships the `winui-dev` agent and
     * the WinUI dev / design / packaging / UI testing skills described at
     * https://devblogs.microsoft.com/ifdef-windows/build-native-windows-apps-with-ai-agents-for-winui-and-windows-app-sdk/
     *
     * The actual install is a slash command inside the Copilot CLI
     * (`/plugin install winui@awesome-copilot`), so this command opens a
     * terminal, starts the Copilot CLI, and copies the slash command to the
     * clipboard so the user can paste it after the prompt loads.
     */
    public async installCopilotPlugin(): Promise<void> {
        const docsUrl = 'https://devblogs.microsoft.com/ifdef-windows/build-native-windows-apps-with-ai-agents-for-winui-and-windows-app-sdk/';
        const installCommand = '/plugin install winui@awesome-copilot';
        const setupCommand = '/winui-setup';

        const choice = await vscode.window.showInformationMessage(
            'Install the WinUI Copilot plugin? This launches the GitHub Copilot CLI in a new terminal and copies the install slash-command to your clipboard so you can paste it at the prompt.',
            { modal: false },
            'Launch Copilot CLI',
            'Copy Commands',
            'Open Docs',
        );

        if (!choice) { return; }

        if (choice === 'Open Docs') {
            await vscode.env.openExternal(vscode.Uri.parse(docsUrl));
            return;
        }

        if (choice === 'Copy Commands') {
            await vscode.env.clipboard.writeText(`${installCommand}\n${setupCommand}`);
            vscode.window.showInformationMessage('Copilot plugin commands copied to clipboard. Paste them inside the Copilot CLI prompt.');
            return;
        }

        // Launch Copilot CLI in a new terminal. Surface the next-step
        // instructions through the WinUI Templates output channel and a
        // notification — emitting them via shell builtins (`echo`, `printf`,
        // `Write-Host`) would either error or render inconsistently across
        // PowerShell, bash, zsh, and cmd. This way the experience is
        // identical regardless of the user's default integrated shell.
        await vscode.env.clipboard.writeText(installCommand);

        this.outputChannel.show(true);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('=== WinUI Copilot Plugin ===');
        this.outputChannel.appendLine('Starting GitHub Copilot CLI in a new terminal...');
        this.outputChannel.appendLine('Once the Copilot prompt loads, paste (Ctrl+V) the install command');
        this.outputChannel.appendLine('that was copied to your clipboard:');
        this.outputChannel.appendLine(`    ${installCommand}`);
        this.outputChannel.appendLine('Then run:');
        this.outputChannel.appendLine(`    ${setupCommand}`);
        this.outputChannel.appendLine('');

        const terminal = vscode.window.createTerminal({ name: 'WinUI Copilot Plugin' });
        terminal.show();
        // `copilot` resolves on PATH for both PowerShell (Windows) and POSIX
        // shells (macOS/Linux), so this single sendText is shell-agnostic.
        terminal.sendText('copilot');

        vscode.window.showInformationMessage(
            `'${installCommand}' copied to clipboard. Paste it once the Copilot CLI prompt loads, then run '${setupCommand}'.`
        );
    }

    /**
     * Checks if WinUI templates are installed
     */
    private async checkTemplatesInstalled(): Promise<boolean> {
        try {
            const output = await this.executeCommand('dotnet new list winui', undefined, true);
            return output.includes('winui') || output.includes('WinUI');
        } catch {
            return false;
        }
    }

    /**
     * Executes a command in the terminal
     */
    private executeCommand(command: string, cwd?: string, silent: boolean = false): Promise<string> {
        return new Promise((resolve, reject) => {
            const workingDir = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            if (!silent) {
                this.outputChannel.appendLine(`> ${command}`);
                this.outputChannel.show();
            }

            cp.exec(command, { cwd: workingDir }, (error, stdout, stderr) => {
                if (!silent) {
                    if (stdout) {
                        this.outputChannel.appendLine(stdout);
                    }
                    if (stderr) {
                        this.outputChannel.appendLine(stderr);
                    }
                }
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
