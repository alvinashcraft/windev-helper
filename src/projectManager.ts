// WinDev Helper - Project Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WinAppCli } from './winAppCli';
import { CONTEXT_KEYS, FILE_PATTERNS, PROJECT_INDICATORS } from './constants';

/**
 * Manages WinUI project detection and operations
 */
export class WinUIProjectManager {
    private context: vscode.ExtensionContext;
    private winAppCli: WinAppCli;
    private _isWinUIProject: boolean = false;
    private _currentProject: vscode.Uri | undefined;
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(context: vscode.ExtensionContext, winAppCli: WinAppCli) {
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
            this.setIsWinUIProject(false);
            return false;
        }

        // Look for .csproj files
        const csprojFiles = await vscode.workspace.findFiles(FILE_PATTERNS.CSPROJ, '**/bin/**');
        
        for (const csprojFile of csprojFiles) {
            if (await this.isWinUIProjectFile(csprojFile)) {
                this._currentProject = csprojFile;
                this.setIsWinUIProject(true);
                return true;
            }
        }

        this.setIsWinUIProject(false);
        return false;
    }

    /**
     * Checks if a .csproj file is a WinUI project
     * @param csprojUri - URI to the .csproj file
     * @returns Promise<boolean> - True if this is a WinUI project
     */
    private async isWinUIProjectFile(csprojUri: vscode.Uri): Promise<boolean> {
        try {
            const content = await fs.promises.readFile(csprojUri.fsPath, 'utf8');
            
            // Check for WinUI indicators
            const hasUseWinUI = content.includes(PROJECT_INDICATORS.USE_WINUI);
            const hasWindowsAppSdk = content.includes(PROJECT_INDICATORS.WINDOWS_APP_SDK);
            const hasWinUIReference = content.includes(PROJECT_INDICATORS.WINUI_REFERENCE);
            const hasWindowsTarget = PROJECT_INDICATORS.WINDOWS_TARGET_REGEX.test(content);

            return hasUseWinUI || hasWindowsAppSdk || hasWinUIReference || hasWindowsTarget;
        } catch (error) {
            // Log specific error types for debugging
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
            return false;
        }
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
    public async openManifest(): Promise<void> {
        const projectDir = this.getProjectDirectory();
        if (!projectDir) {
            vscode.window.showErrorMessage('No WinUI project found.');
            return;
        }

        // Look for manifest file
        const manifestPatterns = [
            'Package.appxmanifest',
            '**/*.appxmanifest'
        ];

        for (const pattern of manifestPatterns) {
            const files = await vscode.workspace.findFiles(pattern, '**/bin/**', 1);
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
    public async getProjectInfo(): Promise<ProjectInfo | undefined> {
        if (!this._currentProject) {
            return undefined;
        }

        try {
            const content = await fs.promises.readFile(this._currentProject.fsPath, 'utf8');
            
            const targetFramework = this.extractXmlValue(content, 'TargetFramework');
            const windowsAppSdkVersion = this.extractPackageVersion(content, 'Microsoft.WindowsAppSDK');
            const windowsSdkVersion = this.extractPackageVersion(content, 'Microsoft.Windows.SDK.BuildTools');
            
            const info: ProjectInfo = {
                path: this._currentProject.fsPath,
                name: this.getProjectName() || 'Unknown',
                platforms: this.extractXmlValue(content, 'Platforms')?.split(';') || ['x64'],
                runtimeIdentifiers: this.extractXmlValue(content, 'RuntimeIdentifiers')?.split(';') || [],
                ...(targetFramework && { targetFramework }),
                ...(windowsAppSdkVersion && { windowsAppSdkVersion }),
                ...(windowsSdkVersion && { windowsSdkVersion })
            };

            return info;
        } catch {
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
        const csprojFiles = await vscode.workspace.findFiles('**/*.csproj', '**/bin/**');
        
        for (const csprojFile of csprojFiles) {
            if (await this.isWinUIProjectFile(csprojFile)) {
                projects.push(csprojFile);
            }
        }

        return projects;
    }

    /**
     * Selects a project from multiple available projects
     */
    public async selectProject(): Promise<vscode.Uri | undefined> {
        const projects = await this.getAllProjects();
        
        if (projects.length === 0) {
            vscode.window.showWarningMessage('No WinUI projects found in the workspace.');
            return undefined;
        }

        if (projects.length === 1) {
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
}

export interface ProjectInfo {
    path: string;
    name: string;
    targetFramework?: string;
    platforms: string[];
    runtimeIdentifiers: string[];
    windowsAppSdkVersion?: string;
    windowsSdkVersion?: string;
}
