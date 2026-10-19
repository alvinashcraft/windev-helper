// WinDev Helper - Project Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WinAppCli } from './winAppCli';
import { CONTEXT_KEYS, FILE_PATTERNS, PROJECT_INDICATORS } from './constants';

const projectExcludes = '**/{bin,obj,node_modules,.git,.vs,.winapp,packages}/**';

/**
 * Manages WinUI project detection and operations
 */
export class WinUIProjectManager {
    private context: Pick<vscode.ExtensionContext, 'subscriptions'>;
    private winAppCli: WinAppCli;
    private _isWinUIProject: boolean = false;
    private _isReactorProject: boolean = false;
    private _currentProject: vscode.Uri | undefined;
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(context: Pick<vscode.ExtensionContext, 'subscriptions'>, winAppCli: WinAppCli) {
        this.context = context;
        this.winAppCli = winAppCli;
        this.setupFileWatcher();
    }

    /**
     * Gets whether the current workspace contains a WinUI project
     */
    public get isWinUIProject(): boolean {
        return this._isWinUIProject;
    }

    /**
     * Gets whether the current workspace contains a Microsoft.UI.Reactor project
     */
    public get isReactorProject(): boolean {
        return this._isReactorProject;
    }

    /**
     * Gets the current WinUI project file
     */
    public get currentProject(): vscode.Uri | undefined {
        return this._currentProject;
    }

    /**
     * Detects if the current workspace contains a WinUI project
     * @returns Promise<boolean> - True if a WinUI project was detected
     */
    public async detectWinUIProject(): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this._currentProject = undefined;
            this.setIsReactorProject(false);
            this.setIsWinUIProject(false);
            return false;
        }

        // Look for .csproj files
        const csprojFiles = await vscode.workspace.findFiles(FILE_PATTERNS.CSPROJ, projectExcludes);
        
        let reactorDetected = false;
        const projects: vscode.Uri[] = [];
        for (const csprojFile of csprojFiles) {
            const content = await this.readProjectFile(csprojFile);
            if (content === undefined) {
                continue;
            }
            if (!reactorDetected && content.includes(PROJECT_INDICATORS.REACTOR_REFERENCE)) {
                reactorDetected = true;
            }
            if (this.matchesWinUIIndicators(content)) {
                projects.push(csprojFile);
            }
        }

        this._currentProject = projects.find(project => project.toString() === this._currentProject?.toString())
            ?? (projects.length === 1 ? projects[0] : undefined);
        this.setIsReactorProject(reactorDetected);
        this.setIsWinUIProject(projects.length > 0);
        return projects.length > 0;
    }

    /**
     * Reads a project file, returning its contents or `undefined` if it could
     * not be read (the specific failure is logged for diagnostics).
     */
    private async readProjectFile(csprojUri: vscode.Uri): Promise<string | undefined> {
        try {
            return await fs.promises.readFile(csprojUri.fsPath, 'utf8');
        } catch (error) {
            if (error instanceof Error) {
                if ('code' in error) {
                    const nodeError = error as NodeJS.ErrnoException;
                    if (nodeError.code === 'ENOENT') {
                        console.warn(`Project file not found: ${csprojUri.fsPath}`);
                    } else if (nodeError.code === 'EACCES') {
                        console.error(`Permission denied reading: ${csprojUri.fsPath}`);
                    } else {
                        console.error(`Error reading project file ${csprojUri.fsPath}: ${nodeError.code}`);
                    }
                } else {
                    console.error(`Error reading project file ${csprojUri.fsPath}: ${error.message}`);
                }
            }
            return undefined;
        }
    }

    /**
     * Returns true when the given .csproj content carries any WinUI indicator.
     */
    private matchesWinUIIndicators(content: string): boolean {
        const hasUseWinUI = content.includes(PROJECT_INDICATORS.USE_WINUI);
        const hasWindowsAppSdk = content.includes(PROJECT_INDICATORS.WINDOWS_APP_SDK);
        const hasWinUIReference = content.includes(PROJECT_INDICATORS.WINUI_REFERENCE);
        const hasWindowsTarget = PROJECT_INDICATORS.WINDOWS_TARGET_REGEX.test(content);
        return hasUseWinUI || hasWindowsAppSdk || hasWinUIReference || hasWindowsTarget;
    }

    /**
     * Checks if a .csproj file is a WinUI project
     * @param csprojUri - URI to the .csproj file
     * @returns Promise<boolean> - True if this is a WinUI project
     */
    private async isWinUIProjectFile(csprojUri: vscode.Uri): Promise<boolean> {
        const content = await this.readProjectFile(csprojUri);
        return content !== undefined && this.matchesWinUIIndicators(content);
    }

    /**
     * Sets up a file watcher to detect project changes
     */
    private setupFileWatcher(): void {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.csproj');
        
        this.fileWatcher.onDidCreate(() => this.detectWinUIProject());
        this.fileWatcher.onDidDelete(() => this.detectWinUIProject());
        this.fileWatcher.onDidChange(() => this.detectWinUIProject());

        this.context.subscriptions.push(this.fileWatcher);
    }

    /**
     * Sets the WinUI project context
     * @param value - Whether a WinUI project is detected
     */
    private setIsWinUIProject(value: boolean): void {
        this._isWinUIProject = value;
        vscode.commands.executeCommand('setContext', CONTEXT_KEYS.IS_WINUI_PROJECT, value);
    }

    /**
     * Sets the Reactor project context
     * @param value - Whether a Microsoft.UI.Reactor project is detected
     */
    private setIsReactorProject(value: boolean): void {
        this._isReactorProject = value;
        vscode.commands.executeCommand('setContext', CONTEXT_KEYS.IS_REACTOR_PROJECT, value);
    }

    /**
     * Gets the project directory
     */
    public getProjectDirectory(): string | undefined {
        if (this._currentProject) {
            return path.dirname(this._currentProject.fsPath);
        }
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    /**
     * Gets the project name
     */
    public getProjectName(): string | undefined {
        if (this._currentProject) {
            return path.basename(this._currentProject.fsPath, '.csproj');
        }
        return undefined;
    }

    /**
     * Opens the Package.appxmanifest file
     */
    public async openManifest(projectUri?: vscode.Uri): Promise<void> {
        const projectDir = projectUri ? path.dirname(projectUri.fsPath) : this.getProjectDirectory();
        if (!projectDir) {
            vscode.window.showErrorMessage('No WinUI project found.');
            return;
        }

        // Look for manifest file
        const manifestPatterns = [
            'Package.appxmanifest',
            '[Aa]ppx[Mm]anifest.xml',
            '**/*.appxmanifest'
        ];

        for (const pattern of manifestPatterns) {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(projectDir, pattern), projectExcludes, 1);
            if (files.length > 0) {
                const doc = await vscode.workspace.openTextDocument(files[0]);
                await vscode.window.showTextDocument(doc);
                return;
            }
        }

        const action = await vscode.window.showWarningMessage(
            'No app manifest found. Would you like to generate one?',
            'Generate'
        );
        if (action === 'Generate') {
            await this.winAppCli.manifest('generate', projectDir);
        }
    }

    /**
     * Gets project information from the .csproj file
     * @returns Promise<ProjectInfo | undefined> - The project info or undefined if not available
     */
    public async getProjectInfo(projectUri = this._currentProject): Promise<ProjectInfo | undefined> {
        if (!projectUri) {
            return undefined;
        }

        try {
            const content = await fs.promises.readFile(projectUri.fsPath, 'utf8');
            
            const targetFramework = this.extractXmlValue(content, 'TargetFramework');
            const windowsAppSdkVersion = this.extractPackageVersion(content, 'Microsoft.WindowsAppSDK');
            const windowsSdkVersion = this.extractPackageVersion(content, 'Microsoft.Windows.SDK.BuildTools');
            const windowsPackageType = this.extractXmlValue(content, 'WindowsPackageType');
            
            const info: ProjectInfo = {
                path: projectUri.fsPath,
                name: path.basename(projectUri.fsPath, '.csproj'),
                platforms: this.extractXmlValue(content, 'Platforms')?.split(';') || ['x64'],
                runtimeIdentifiers: this.extractXmlValue(content, 'RuntimeIdentifiers')?.split(';') || [],
                ...(targetFramework && { targetFramework }),
                ...(windowsAppSdkVersion && { windowsAppSdkVersion }),
                ...(windowsSdkVersion && { windowsSdkVersion }),
                ...(windowsPackageType && { windowsPackageType }),
            };

            return info;
        } catch (error) {
            console.error(`Failed to read project information for ${projectUri.fsPath}:`, error);
            return undefined;
        }
    }

    /**
     * Extracts a value from XML content
     */
    private extractXmlValue(content: string, tagName: string): string | undefined {
        const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 'i');
        const match = content.match(regex);
        return match ? match[1] : undefined;
    }

    /**
     * Extracts a package version from .csproj content
     */
    private extractPackageVersion(content: string, packageName: string): string | undefined {
        const regex = new RegExp(`<PackageReference\\s+Include="${packageName}"\\s+Version="([^"]+)"`, 'i');
        const match = content.match(regex);
        return match ? match[1] : undefined;
    }

    /**
     * Gets all WinUI projects in the workspace
     */
    public async getAllProjects(): Promise<vscode.Uri[]> {
        const projects: vscode.Uri[] = [];
        const csprojFiles = await vscode.workspace.findFiles(FILE_PATTERNS.CSPROJ, projectExcludes);
        
        for (const csprojFile of csprojFiles) {
            if (await this.isWinUIProjectFile(csprojFile)) {
                projects.push(csprojFile);
            }
        }

        return projects.sort((left, right) => left.fsPath.localeCompare(right.fsPath));
    }

    /**
     * Resolves an explicit resource or the active file to its nearest project.
     * Prompts when the resource or workspace contains multiple candidate projects.
     */
    public async selectProject(resource?: vscode.Uri): Promise<vscode.Uri | undefined> {
        let projects = await this.getAllProjects();
        const target = resource ?? vscode.window.activeTextEditor?.document.uri;
        if (target?.scheme === 'file') {
            const exact = projects.find(project => path.relative(project.fsPath, target.fsPath) === '');
            const containing = exact ? [exact] : projects.filter(project => this.containsPath(path.dirname(project.fsPath), target.fsPath));
            if (containing.length > 0) {
                const nearestLength = Math.max(...containing.map(project => path.dirname(project.fsPath).length));
                projects = containing.filter(project => path.dirname(project.fsPath).length === nearestLength);
            } else if (resource) {
                projects = projects.filter(project => this.containsPath(resource.fsPath, project.fsPath));
            }
        }
        
        if (projects.length === 0) {
            vscode.window.showWarningMessage(resource
                ? 'No WinUI projects found for the selected resource.'
                : 'No WinUI projects found in the workspace.');
            return undefined;
        }

        if (projects.length === 1) {
            this._currentProject = projects[0];
            return projects[0];
        }

        const items = projects.map(p => ({
            label: path.basename(p.fsPath, '.csproj'),
            description: vscode.workspace.asRelativePath(p),
            uri: p
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a WinUI project'
        });

        if (selected) {
            this._currentProject = selected.uri;
            return selected.uri;
        }

        return undefined;
    }

    private containsPath(directory: string, target: string): boolean {
        const relative = path.relative(directory, target);
        return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    }
}

export interface ProjectInfo {
    path: string;
    name: string;
    targetFramework?: string;
    platforms: string[];
    runtimeIdentifiers: string[];
    windowsAppSdkVersion?: string;
    windowsSdkVersion?: string;
    /** Value of WindowsPackageType property. 'None' = unpackaged, undefined = MSIX packaged (default) */
    windowsPackageType?: string;
}
