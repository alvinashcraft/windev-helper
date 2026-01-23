// WinDev Helper - Debug Configuration Provider
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import { WinUIProjectManager } from './projectManager';
import { BuildManager } from './buildManager';

/**
 * Provides debug configurations for WinUI applications
 */
export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    private projectManager: WinUIProjectManager;
    private buildManager: BuildManager;

    constructor(projectManager: WinUIProjectManager, buildManager: BuildManager) {
        this.projectManager = projectManager;
        this.buildManager = buildManager;
    }

    /**
     * Resolves a debug configuration before use
     */
    async resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | undefined> {
        // If no configuration provided, create a default one
        if (!config.type && !config.request && !config.name) {
            const project = this.projectManager.currentProject;
            if (!project) {
                vscode.window.showErrorMessage('No WinUI project found to debug.');
                return undefined;
            }

            config.type = 'coreclr';
            config.name = 'WinUI: Launch';
            config.request = 'launch';
            config.preLaunchTask = 'build';
            config.program = await this.getExecutablePath(project);
            config.cwd = path.dirname(project.fsPath);
            config.console = 'internalConsole';
            config.stopAtEntry = false;
        }

        return config;
    }

    /**
     * Resolves a debug configuration with full details
     */
    async resolveDebugConfigurationWithSubstitutedVariables(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | undefined> {
        // For winui type, convert to coreclr
        if (config.type === 'winui') {
            const projectPath = config.project || this.projectManager.currentProject?.fsPath;
            
            if (!projectPath) {
                vscode.window.showErrorMessage('No project specified for debugging.');
                return undefined;
            }

            // Build the project first
            const buildSuccess = await this.buildManager.build(vscode.Uri.file(projectPath));
            if (!buildSuccess) {
                vscode.window.showErrorMessage('Build failed. Cannot start debugging.');
                return undefined;
            }

            // Convert to coreclr configuration
            const executablePath = await this.getExecutablePath(vscode.Uri.file(projectPath));
            
            return {
                type: 'coreclr',
                name: config.name || 'WinUI: Launch',
                request: 'launch',
                program: executablePath,
                args: config.args || [],
                cwd: path.dirname(projectPath),
                console: 'internalConsole',
                stopAtEntry: config.stopAtEntry || false,
                env: config.env || {}
            };
        }

        return config;
    }

    /**
     * Provides initial debug configurations
     */
    provideDebugConfigurations(
        folder: vscode.WorkspaceFolder | undefined,
        token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        return [
            {
                type: 'winui',
                name: 'WinUI: Launch',
                request: 'launch',
                project: '${workspaceFolder}/${fileBasenameNoExtension}.csproj',
                configuration: 'Debug',
                platform: 'x64'
            }
        ];
    }

    /**
     * Gets the executable path for the project
     */
    private async getExecutablePath(projectUri: vscode.Uri): Promise<string> {
        const projectInfo = await this.projectManager.getProjectInfo();
        const projectDir = path.dirname(projectUri.fsPath);
        const projectName = path.basename(projectUri.fsPath, '.csproj');
        
        const configuration = this.buildManager.currentConfiguration;
        const platform = this.buildManager.currentPlatform;
        const targetFramework = projectInfo?.targetFramework || 'net8.0-windows10.0.19041.0';
        const runtimeIdentifier = this.buildManager.getRuntimeIdentifier();

        // Construct the output path
        const outputPath = path.join(
            projectDir,
            'bin',
            platform,
            configuration,
            targetFramework,
            runtimeIdentifier,
            `${projectName}.exe`
        );

        return outputPath;
    }
}
