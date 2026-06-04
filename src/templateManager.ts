// WinDev Helper - Template Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import { CONFIG, EXTERNAL_URLS, OUTPUT_CHANNELS, TEMPLATE_NAMES, TEMPLATE_PACKAGES } from './constants';

/**
 * Identifies which dotnet template package should provide a given template.
 */
type TemplateSource = 'official' | 'community';

type ItemCategory = 'page' | 'window' | 'dialog' | 'control' | 'resourceDictionary';

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
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.PAGE, 'Page', uri, { supportsViewModel: true, isControl: false, itemCategory: 'page' });
    }

    /**
     * Adds a new UserControl to the project
     */
    public async addUserControl(uri?: vscode.Uri): Promise<void> {
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.USER_CONTROL, 'User Control', uri, { supportsViewModel: true, isControl: true, itemCategory: 'control' });
    }

    /**
     * Adds a new Window to the project
     */
    public async addWindow(uri?: vscode.Uri): Promise<void> {
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.WINDOW, 'Window', uri, { supportsViewModel: true, isControl: false, itemCategory: 'window' });
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
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.DIALOG, 'Content Dialog', uri, { supportsViewModel: true, isControl: false, itemCategory: 'dialog' });
    }

    /**
     * Adds a new Templated (custom) Control to the project. Generates a
     * Themes/Generic.xaml entry alongside the C# class via the official
     * `winui-templatedcontrol` template. Requires the official pack.
     */
    public async addTemplatedControl(uri?: vscode.Uri): Promise<void> {
        if (!(await this.ensureOfficialPack('Add New Templated Control', 'winui-templatedcontrol'))) { return; }
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.TEMPLATED_CONTROL, 'Templated Control', uri, { supportsViewModel: false, isControl: true, itemCategory: 'control' });
    }

    /**
     * Adds a new ResourceDictionary XAML file to the project via the official
     * `winui-resourcedictionary` template. Requires the official pack.
     */
    public async addResourceDictionary(uri?: vscode.Uri): Promise<void> {
        if (!(await this.ensureOfficialPack('Add New Resource Dictionary', 'winui-resourcedictionary'))) { return; }
        await this.addItem(TEMPLATE_NAMES.OFFICIAL.RESOURCE_DICTIONARY, 'Resource Dictionary', uri, { supportsViewModel: false, isControl: false, itemCategory: 'resourceDictionary' });
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

    private resolveCurrentFolder(uri?: vscode.Uri): string | undefined {
        if (uri) {
            try {
                const stat = fs.statSync(uri.fsPath);
                if (stat.isDirectory()) {
                    return uri.fsPath;
                }
                // It's a file — return its parent directory
                return path.dirname(uri.fsPath);
            } catch {
                // If stat fails (e.g., file doesn't exist), assume it's a file and use parent
                return path.dirname(uri.fsPath);
            }
        }
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) { return path.dirname(activeEditor.document.uri.fsPath); }
        return undefined;
    }

    private async pickTargetFolder(
        projectDir: string,
        itemCategory: ItemCategory,
        uri?: vscode.Uri,
    ): Promise<string | undefined> {
        const categoryDefaults: Record<ItemCategory, { label: string; relativePath: string }> = {
            page:               { label: 'Views Folder',              relativePath: 'Views' },
            window:             { label: 'Views Folder',              relativePath: 'Views' },
            dialog:             { label: 'Views Folder',              relativePath: 'Views' },
            control:            { label: 'Views/Controls Folder',     relativePath: path.join('Views', 'Controls') },
            resourceDictionary: { label: 'Resources Folder',          relativePath: 'Resources' },
        };

        const categoryDefault = categoryDefaults[itemCategory];
        const items: (vscode.QuickPickItem & { targetDir: string })[] = [];

        const currentFolder = this.resolveCurrentFolder(uri);
        if (currentFolder) {
            items.push({
                label: 'Current Folder',
                targetDir: currentFolder,
            });
        }

        items.push({
            label: 'Project Folder',
            targetDir: projectDir,
        });

        items.push({
            label: categoryDefault.label,
            targetDir: path.join(projectDir, categoryDefault.relativePath),
        });

        const pick = await vscode.window.showQuickPick(items, {
            placeHolder: 'Where should the item be created?',
            title: 'Target Folder',
        });

        return pick?.targetDir;
    }

    /**
     * Adds a new item using the specified template
     */
    private async addItem(
        template: string, 
        itemType: string, 
        uri?: vscode.Uri,
        options: { supportsViewModel: boolean; isControl: boolean; itemCategory: ItemCategory } = { supportsViewModel: false, isControl: false, itemCategory: 'page' }
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

        let createViewModel = false;
        if (options.supportsViewModel) {
            const viewModelChoice = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Create a corresponding ViewModel?',
                title: 'ViewModel Generation'
            });
            createViewModel = viewModelChoice === 'Yes';
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const projectDir = await this.findProjectDirectory(uri?.fsPath ?? workspaceFolder.uri.fsPath) ?? workspaceFolder.uri.fsPath;

        const viewTargetDir = await this.pickTargetFolder(projectDir, options.itemCategory, uri);
        if (!viewTargetDir) {
            return;
        }

        await fs.promises.mkdir(viewTargetDir, { recursive: true });

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Adding ${itemType}: ${itemName}...`,
            cancellable: false
        }, async () => {
            try {
                await this.ensureGlobalUsings(projectDir);

                // Ensure we don't write outside the project when using -o; if target is outside,
                // run dotnet new directly in the target directory (no -o).
                const projectDirResolved = path.resolve(projectDir);
                const viewTargetDirResolved = path.resolve(viewTargetDir);
                if (viewTargetDirResolved === projectDirResolved ||
                    viewTargetDirResolved.startsWith(projectDirResolved + path.sep)) {
                    // Inside or equal to projectDir: use -o with relative path
                    const relativeOutput = path.relative(projectDirResolved, viewTargetDirResolved);
                    const outputArg = relativeOutput ? ` -o "${relativeOutput}"` : '';
                    await this.executeCommand(`dotnet new ${template} -n ${itemName}${outputArg}`, projectDirResolved);
                } else {
                    // Outside project: run dotnet new directly in the target directory
                    await this.executeCommand(`dotnet new ${template} -n ${itemName}`, viewTargetDirResolved);
                }
                
                const xamlFile = path.join(viewTargetDir, `${itemName}.xaml`);
                const doc = await vscode.workspace.openTextDocument(xamlFile);
                await vscode.window.showTextDocument(doc);

                if (createViewModel) {
                    await this.createViewModel(itemName, projectDir, options.isControl);
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
    public async addViewModel(uri?: vscode.Uri): Promise<void> {
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

        const finalName = viewModelName.endsWith('ViewModel') ? viewModelName : `${viewModelName}ViewModel`;

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const projectDir = uri
            ? (await this.findProjectDirectory(uri.fsPath)) ?? workspaceFolder.uri.fsPath
            : workspaceFolder.uri.fsPath;

        const currentFolder = this.resolveCurrentFolder(uri);
        let isControl = false;
        if (currentFolder) {
            const relativePath = path.relative(projectDir, currentFolder);
            // Normalize path separators and make case-insensitive for comparison
            const normalizedRelative = relativePath.replace(/\\/g, '/').toLowerCase();
            isControl = normalizedRelative === 'views/controls' || normalizedRelative.endsWith('/views/controls');
        }
        const viewModelDir = isControl
            ? path.join(projectDir, 'ViewModels', 'Controls')
            : path.join(projectDir, 'ViewModels');

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Adding ViewModel: ${finalName}...`,
            cancellable: false
        }, async () => {
            try {
                await fs.promises.mkdir(viewModelDir, { recursive: true });
                await this.ensureMvvmInfrastructure(projectDir);
                
                const namespace = await this.detectNamespace(projectDir);
                const viewModelNamespace = isControl ? `${namespace}.ViewModels.Controls` : `${namespace}.ViewModels`;
                const content = this.generateViewModelContent(finalName, viewModelNamespace);
                
                const viewModelPath = path.join(viewModelDir, `${finalName}.cs`);
                await fs.promises.writeFile(viewModelPath, content, 'utf8');
                
                this.outputChannel.appendLine(`Created ViewModel: ${viewModelPath}`);
                
                const doc = await vscode.workspace.openTextDocument(viewModelPath);
                await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
                
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
        projectDir: string, 
        isControl: boolean,
        isStandalone: boolean = false
    ): Promise<void> {
        const viewModelName = isStandalone 
            ? viewName 
            : viewName.replace(/(Page|Window|Control|UserControl)$/, '') + 'ViewModel';
        
        await this.ensureMvvmInfrastructure(projectDir);

        let viewModelDir: string;
        if (isControl) {
            viewModelDir = path.join(projectDir, 'ViewModels', 'Controls');
        } else {
            viewModelDir = path.join(projectDir, 'ViewModels');
        }

        await fs.promises.mkdir(viewModelDir, { recursive: true });

        const namespace = await this.detectNamespace(projectDir);
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
     * @param projectDir - The project directory path (containing .csproj)
     */
    private async ensureMvvmInfrastructure(projectDir: string): Promise<void> {
        const hasMvvmToolkit = await this.checkMvvmToolkitInstalled(projectDir);
        if (!hasMvvmToolkit) {
            this.outputChannel.appendLine('Installing CommunityToolkit.Mvvm package...');
            try {
                await this.executeCommand('dotnet add package CommunityToolkit.Mvvm', projectDir);
                this.outputChannel.appendLine('CommunityToolkit.Mvvm installed successfully.');
            } catch (error) {
                this.outputChannel.appendLine(`Warning: Failed to install CommunityToolkit.Mvvm: ${error}`);
            }
        }

        await this.ensureGlobalUsings(projectDir);

        const baseViewModelPath = path.join(projectDir, 'ViewModels', 'BaseViewModel.cs');
        const baseViewModelExists = await this.fileExists(baseViewModelPath);
        
        if (!baseViewModelExists) {
            await this.createBaseViewModel(projectDir);
        }
    }

    /**
     * Ensures global usings file exists with required MVVM imports
     * @param projectDir - The project directory path (containing .csproj)
     */
    private async ensureGlobalUsings(projectDir: string): Promise<void> {
        const namespace = await this.detectNamespace(projectDir);
        
        const possiblePaths = [
            path.join(projectDir, 'Imports.cs'),
            path.join(projectDir, 'GlobalUsings.cs'),
            path.join(projectDir, 'Usings.cs')
        ];

        let globalUsingsPath: string | undefined;
        let existingContent = '';

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

        const requiredUsings = [
            'global using CommunityToolkit.Mvvm.ComponentModel;',
            'global using CommunityToolkit.Mvvm.Input;',
            `global using ${namespace}.ViewModels;`,
        ];

        if (!globalUsingsPath) {
            globalUsingsPath = path.join(projectDir, 'Imports.cs');
            const content = this.generateGlobalUsingsContent(namespace);
            await fs.promises.writeFile(globalUsingsPath, content, 'utf8');
            this.outputChannel.appendLine(`Created global usings file: ${globalUsingsPath}`);
            return;
        }

        const missingUsings: string[] = [];
        for (const usingStatement of requiredUsings) {
            const usingPattern = usingStatement.replace('global using ', '').replace(';', '');
            if (!existingContent.includes(usingPattern)) {
                missingUsings.push(usingStatement);
            }
        }

        if (missingUsings.length > 0) {
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
        // J.Magnet
        // Removed:
        // global using ${namespace}.Views;
        return `// Global using directives for ${namespace}
// This file contains global using statements that are available throughout the project.

global using CommunityToolkit.Mvvm.ComponentModel;
global using CommunityToolkit.Mvvm.Input;
global using CommunityToolkit.Mvvm.Messaging;

global using ${namespace}.ViewModels;

global using Microsoft.UI.Xaml;
global using Microsoft.UI.Xaml.Controls;
`;
    }

    /**
     * Checks if CommunityToolkit.Mvvm is referenced in the project
     * @param projectDir - The project directory path (containing .csproj)
     */
    private async checkMvvmToolkitInstalled(projectDir: string): Promise<boolean> {
        try {
            const entries = await fs.promises.readdir(projectDir);
            const csproj = entries.find(e => e.endsWith('.csproj'));
            if (csproj) {
                const content = await fs.promises.readFile(path.join(projectDir, csproj), 'utf8');
                return content.includes('CommunityToolkit.Mvvm');
            }
        } catch {
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
     * @param projectDir - The project directory path (containing .csproj)
     */
    private async createBaseViewModel(projectDir: string): Promise<void> {
        const viewModelsDir = path.join(projectDir, 'ViewModels');
        await fs.promises.mkdir(viewModelsDir, { recursive: true });

        const namespace = await this.detectNamespace(projectDir);
        
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
     * Finds the project directory containing a `.csproj` file.
     * First checks the given directory, then immediate subdirectories (forward search).
     * If multiple projects are found, prompts the user to select one.
     * Falls back to walking up the directory tree (backward search).
     * Returns `undefined` if no project file is found.
     */
    private async findProjectDirectory(filePath: string): Promise<string | undefined> {
        let dir: string;
        try {
            const stat = await fs.promises.stat(filePath);
            dir = stat.isDirectory() ? filePath : path.dirname(filePath);
        } catch {
            return undefined;
        }

        const entries = await fs.promises.readdir(dir);
        if (entries.some((e: string) => e.endsWith('.csproj'))) {
            return dir;
        }

        const projectDirs: string[] = [];
        for (const entry of entries) {
            const subDir = path.join(dir, entry);
            try {
                const stat = await fs.promises.stat(subDir);
                if (stat.isDirectory()) {
                    const subEntries = await fs.promises.readdir(subDir);
                    if (subEntries.some((e: string) => e.endsWith('.csproj'))) {
                        projectDirs.push(subDir);
                    }
                }
            } catch { /* ignore inaccessible directories */ }
        }

        if (projectDirs.length === 1) {
            return projectDirs[0];
        }

        if (projectDirs.length > 1) {
            const pick = await vscode.window.showQuickPick(
                projectDirs.map(d => ({ label: path.basename(d), description: d })),
                { placeHolder: 'Multiple projects found. Select one:' }
            );
            return pick?.description;
        }

        const root = path.parse(dir).root;
        while (dir !== root) {
            const parent = path.dirname(dir);
            if (parent === dir) { break; }
            dir = parent;
            try {
                const parentEntries = await fs.promises.readdir(dir);
                if (parentEntries.some((e: string) => e.endsWith('.csproj'))) {
                    return dir;
                }
            } catch {
                // Inaccessible directory while walking up; continue to parent
            }
        }

        return undefined;
    }

    /**
     * Detects the root namespace from the project file
     * @param projectDir - The project directory path (containing .csproj)
     */
    private async detectNamespace(projectDir: string): Promise<string> {
        try {
            const entries = await fs.promises.readdir(projectDir);
            const csproj = entries.find(e => e.endsWith('.csproj'));
            if (csproj) {
                const content = await fs.promises.readFile(path.join(projectDir, csproj), 'utf8');
                
                const rootNsMatch = content.match(/<RootNamespace>(.*?)<\/RootNamespace>/);
                if (rootNsMatch) {
                    return rootNsMatch[1];
                }

                return path.basename(csproj, '.csproj');
            }
        } catch {
        }

        return path.basename(projectDir);
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
     * Helps users install the WinUI agent + skills plugin from the Microsoft
     * `win-dev-skills` repository (https://github.com/microsoft/win-dev-skills).
     * The plugin ships the `winui-dev` agent plus the WinUI dev-workflow,
     * design, packaging, UI-testing, code-review, and WPF-migration skills for
     * GitHub Copilot CLI, Claude Code, and OpenAI Codex.
     *
     * Installation is two `copilot plugin` shell subcommands (add the
     * marketplace, then install the plugin), after which the user starts a new
     * Copilot session and runs the `/winui-setup` skill. This command opens a
     * terminal and runs the two install commands directly, then surfaces the
     * `/winui-setup` next step through the output channel and a notification.
     */
    public async installCopilotPlugin(): Promise<void> {
        const docsUrl = EXTERNAL_URLS.WIN_DEV_SKILLS_REPO;
        const marketplaceCommand = 'copilot plugin marketplace add microsoft/win-dev-skills';
        const installCommand = 'copilot plugin install winui@win-dev-skills';
        const setupCommand = '/winui-setup';

        const choice = await vscode.window.showInformationMessage(
            'Install the WinUI agent + skills plugin from microsoft/win-dev-skills? This opens a terminal and runs the GitHub Copilot CLI plugin install commands.',
            { modal: false },
            'Install in Terminal',
            'Copy Commands',
            'Open Docs',
        );

        if (!choice) { return; }

        if (choice === 'Open Docs') {
            await vscode.env.openExternal(vscode.Uri.parse(docsUrl));
            return;
        }

        if (choice === 'Copy Commands') {
            await vscode.env.clipboard.writeText(`${marketplaceCommand}\n${installCommand}`);
            vscode.window.showInformationMessage(
                `Plugin install commands copied to clipboard. Run them in a shell with the Copilot CLI on PATH, then start a new Copilot session and run '${setupCommand}'.`
            );
            return;
        }

        // Run the two install commands directly in a terminal. Unlike the
        // older `/plugin install` slash-command flow, `copilot plugin
        // marketplace add` and `copilot plugin install` are real shell
        // subcommands, so they can be sent straight to the terminal and run
        // identically across PowerShell, bash, and zsh (the `copilot`
        // executable resolves on PATH for each).
        this.outputChannel.show(true);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('=== WinUI Agent + Skills Plugin (microsoft/win-dev-skills) ===');
        this.outputChannel.appendLine('Running the Copilot CLI plugin install commands in a new terminal:');
        this.outputChannel.appendLine(`    ${marketplaceCommand}`);
        this.outputChannel.appendLine(`    ${installCommand}`);
        this.outputChannel.appendLine('When they finish, start a NEW Copilot session and run the setup skill:');
        this.outputChannel.appendLine(`    ${setupCommand}`);
        this.outputChannel.appendLine('');

        const terminal = vscode.window.createTerminal({ name: 'WinUI Skills Plugin' });
        terminal.show();
        terminal.sendText(marketplaceCommand);
        terminal.sendText(installCommand);

        vscode.window.showInformationMessage(
            `Installing the winui plugin from microsoft/win-dev-skills. Once it finishes, start a new Copilot session and run '${setupCommand}'.`
        );
    }

    /**
     * Opens the Microsoft `win-dev-skills` repository in the default browser.
     */
    public async openSkillsRepo(): Promise<void> {
        await vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.WIN_DEV_SKILLS_REPO));
    }

    /**
     * Verifies the Windows app development prerequisites that the
     * `win-dev-skills` `winui-setup` skill installs: the .NET SDK (>= 8),
     * the WinApp CLI (>= 0.3), the official WinUI 3 `dotnet new` templates,
     * and Windows Developer Mode. All checks are read-only — nothing is
     * installed or modified. Results, with the exact remediation command for
     * anything missing, are written to a dedicated output channel and a
     * summary is shown as a notification.
     */
    public async checkDevEnvironment(): Promise<void> {
        const channel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.DEV_ENVIRONMENT);
        channel.show(true);
        channel.appendLine('=== WinDev Environment Check ===');

        // WinUI 3 development requires Windows. On other platforms the toolchain
        // (and the remediation commands below, e.g. winget / reg) do not apply,
        // so short-circuit with a clear message rather than emitting misleading
        // Windows-only guidance.
        if (process.platform !== 'win32') {
            channel.appendLine('');
            channel.appendLine('This check is for Windows only. WinUI 3 apps build and run on Windows,');
            channel.appendLine('and the remediation commands (winget, reg) are Windows-specific.');
            channel.appendLine(`Detected platform: ${process.platform}.`);
            vscode.window.showInformationMessage(
                'WinDev environment check is only applicable on Windows. See the output channel for details.',
            );
            return;
        }

        channel.appendLine('Read-only verification of WinUI 3 development prerequisites.');
        channel.appendLine('');

        const results: { ok: boolean; label: string }[] = [];

        // .NET SDK >= 8
        const dotnet = await this.checkDotnetSdk();
        results.push({ ok: dotnet.ok, label: '.NET SDK' });
        channel.appendLine(`${dotnet.ok ? '[ OK ]' : '[MISS]'} .NET SDK (>= 8.0): ${dotnet.detail}`);
        if (!dotnet.ok) {
            channel.appendLine('       Fix: winget install --id Microsoft.DotNet.SDK.10 --exact');
        }

        // WinApp CLI >= 0.3
        const winapp = await this.checkWinAppCliVersion();
        results.push({ ok: winapp.ok, label: 'WinApp CLI' });
        channel.appendLine(`${winapp.ok ? '[ OK ]' : '[MISS]'} WinApp CLI (>= 0.3): ${winapp.detail}`);
        if (!winapp.ok) {
            channel.appendLine('       Fix: winget install --id Microsoft.WinAppCLI');
        }

        // WinUI 3 templates
        const templates = await this.isPackageInstalled(TEMPLATE_PACKAGES.OFFICIAL);
        results.push({ ok: templates, label: 'WinUI templates' });
        channel.appendLine(`${templates ? '[ OK ]' : '[MISS]'} WinUI 3 templates (${TEMPLATE_PACKAGES.OFFICIAL}): ${templates ? 'installed' : 'not installed'}`);
        if (!templates) {
            channel.appendLine(`       Fix: dotnet new install ${TEMPLATE_PACKAGES.OFFICIAL}`);
        }

        // Developer Mode (Windows only)
        const devMode = await this.checkDeveloperMode();
        results.push({ ok: devMode.ok, label: 'Developer Mode' });
        channel.appendLine(`${devMode.ok ? '[ OK ]' : '[MISS]'} Windows Developer Mode: ${devMode.detail}`);
        if (!devMode.ok && devMode.fixable) {
            channel.appendLine('       Fix (run elevated): reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock" /t REG_DWORD /f /v AllowDevelopmentWithoutDevLicense /d 1');
        }

        channel.appendLine('');
        const missing = results.filter(r => !r.ok).map(r => r.label);
        if (missing.length === 0) {
            channel.appendLine('All prerequisites satisfied. You are ready for WinUI 3 development.');
            vscode.window.showInformationMessage('WinDev environment check passed — all prerequisites are satisfied.');
        } else {
            channel.appendLine(`Missing or outdated: ${missing.join(', ')}. See the fixes above.`);
            const action = await vscode.window.showWarningMessage(
                `WinDev environment check: ${missing.join(', ')} need attention. See the output channel for fixes.`,
                'Show Output',
                'Install Skills Plugin',
            );
            if (action === 'Show Output') {
                channel.show(true);
            } else if (action === 'Install Skills Plugin') {
                await this.installCopilotPlugin();
            }
        }
    }

    /**
     * Checks for a .NET SDK of major version 8 or newer via `dotnet --list-sdks`.
     */
    private async checkDotnetSdk(): Promise<{ ok: boolean; detail: string }> {
        try {
            const output = await this.executeCommand('dotnet --list-sdks', undefined, true);
            const versions = output
                .split(/\r?\n/)
                .map(line => /^(\d+)\.\d+\.\d+/.exec(line.trim()))
                .filter((m): m is RegExpExecArray => m !== null)
                .map(m => parseInt(m[1], 10));
            if (versions.length === 0) {
                return { ok: false, detail: 'no SDKs reported by `dotnet --list-sdks`' };
            }
            const max = Math.max(...versions);
            return { ok: max >= 8, detail: `highest installed major version ${max}` };
        } catch {
            return { ok: false, detail: '`dotnet` not found on PATH' };
        }
    }

    /**
     * Checks for the WinApp CLI at version 0.3 or newer via `winapp --version`.
     */
    private async checkWinAppCliVersion(): Promise<{ ok: boolean; detail: string }> {
        try {
            const output = await this.executeCommand('winapp --version', undefined, true);
            // v0.3.2+ may prepend an "update available" banner on the first run of
            // the day; prefer a line that is only a version string so the banner
            // can't be mistaken for the installed version.
            const versionLine = output
                .split(/\r?\n/)
                .map(l => l.trim())
                .find(l => /^v?\d+\.\d+/.test(l));
            const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(versionLine ?? output);
            if (!match) {
                return { ok: false, detail: 'could not parse `winapp --version` output' };
            }
            const major = parseInt(match[1], 10);
            const minor = parseInt(match[2], 10);
            const ok = major > 0 || (major === 0 && minor >= 3);
            return { ok, detail: `version ${match[0]}` };
        } catch {
            return { ok: false, detail: '`winapp` not found on PATH' };
        }
    }

    /**
     * Reads the Developer Mode registry flag on Windows. On non-Windows hosts
     * the check is reported as not applicable (and not actionable).
     */
    private async checkDeveloperMode(): Promise<{ ok: boolean; detail: string; fixable: boolean }> {
        if (process.platform !== 'win32') {
            return { ok: true, detail: 'not applicable on this OS', fixable: false };
        }
        try {
            const output = await this.executeCommand(
                'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense',
                undefined,
                true,
            );
            // REG_DWORD values print as 0x1 / 0x0 in the query output.
            const enabled = /AllowDevelopmentWithoutDevLicense\s+REG_DWORD\s+0x1/i.test(output);
            return { ok: enabled, detail: enabled ? 'enabled' : 'disabled', fixable: true };
        } catch {
            return { ok: false, detail: 'disabled (registry value not set)', fixable: true };
        }
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
    private async executeCommand(command: string, cwd?: string, silent: boolean = false): Promise<string> {
        const workingDir = cwd
            ?? (await this.findProjectDirectory(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''))
            ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        return new Promise((resolve, reject) => {
            
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
