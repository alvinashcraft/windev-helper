// WinDev Helper - Template Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

/**
 * Manages WinUI project and item templates
 */
export class TemplateManager {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('WinUI Templates');
    }

    /**
     * Installs WinUI templates from the dotnet template package
     */
    public async installTemplates(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Installing WinUI templates...',
            cancellable: false
        }, async () => {
            try {
                await this.executeCommand('dotnet new install VijayAnand.WinUITemplates');
                vscode.window.showInformationMessage('WinUI templates installed successfully.');
            } catch (error) {
                const action = await vscode.window.showErrorMessage(
                    `Failed to install templates: ${error}`,
                    'Learn More'
                );
                if (action === 'Learn More') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/egvijayanand/winui-templates'));
                }
            }
        });
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

        // Ask for template options
        const useMvvm = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Use MVVM Toolkit?',
            title: 'MVVM Support'
        });

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
                let command = `dotnet new winui -n ${projectName}`;
                if (useMvvm === 'Yes') {
                    command += ' -mvvm';
                }

                await this.executeCommand(command, targetDir);

                const projectPath = path.join(targetDir, projectName);
                
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
                await this.executeCommand(`dotnet new winuilib -n ${libraryName}`, targetDir);
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
        await this.addItem('winui-page', 'Page', uri, { supportsViewModel: true, isControl: false });
    }

    /**
     * Adds a new UserControl to the project
     */
    public async addUserControl(uri?: vscode.Uri): Promise<void> {
        await this.addItem('winui-usercontrol', 'User Control', uri, { supportsViewModel: true, isControl: true });
    }

    /**
     * Adds a new Window to the project
     */
    public async addWindow(uri?: vscode.Uri): Promise<void> {
        await this.addItem('winui-window', 'Window', uri, { supportsViewModel: true, isControl: false });
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
     * Ensures MVVM Toolkit is installed and BaseViewModel exists
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

        // Check if BaseViewModel exists
        const baseViewModelPath = path.join(workspaceRoot, 'ViewModels', 'BaseViewModel.cs');
        const baseViewModelExists = await this.fileExists(baseViewModelPath);
        
        if (!baseViewModelExists) {
            await this.createBaseViewModel(workspaceRoot);
        }
    }

    /**
     * Checks if CommunityToolkit.Mvvm is referenced in the project
     */
    private async checkMvvmToolkitInstalled(workspaceRoot: string): Promise<boolean> {
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
     */
    private async createBaseViewModel(workspaceRoot: string): Promise<void> {
        const viewModelsDir = path.join(workspaceRoot, 'ViewModels');
        await fs.promises.mkdir(viewModelsDir, { recursive: true });

        const namespace = await this.detectNamespace(workspaceRoot);
        const baseViewModelContent = `namespace ${namespace}.ViewModels
{
    public partial class BaseViewModel : ObservableObject
    {
        public BaseViewModel()
        {

        }

        [ObservableProperty]
        private string _title = string.Empty;
    }
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
     */
    private generateViewModelContent(viewModelName: string, namespace: string): string {
        // Derive a title from the ViewModel name (e.g., MainViewModel -> Main, SettingsViewModel -> Settings)
        const title = viewModelName.replace(/ViewModel$/, '');

        return `namespace ${namespace}
{
    public partial class ${viewModelName} : BaseViewModel
    {
        public ${viewModelName}()
        {
            Title = "${title}";
        }
    }
}
`;
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
