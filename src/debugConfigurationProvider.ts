// WinDev Helper - Debug Configuration Provider
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import { WinUIProjectManager } from './projectManager';
import { BuildManager } from './buildManager';
import { DEBUG_TYPES } from './constants';

/**
 * Provides debug configurations for WinUI applications
 */
export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    private readonly projectManager: WinUIProjectManager;
    private readonly buildManager: BuildManager;

    constructor(projectManager: WinUIProjectManager, buildManager: BuildManager) {
        this.projectManager = projectManager;
        this.buildManager = buildManager;
    }

    /**
     * Resolves a debug configuration before use
     * @param folder - The workspace folder
     * @param config - The debug configuration
     * @param token - Cancellation token
     * @returns The resolved configuration or undefined
     */
    async resolveDebugConfiguration(
        _folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        _token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | undefined> {
        // If no configuration provided, create a default one
        if (!config.type && !config.request && !config.name) {
            const project = this.projectManager.currentProject;
            if (!project) {
                vscode.window.showErrorMessage('No WinUI project found to debug.');
                return undefined;
            }

            config.type = DEBUG_TYPES.CORECLR;
            config.name = 'WinUI: Launch';
            config.request = 'launch';
            // Don't set preLaunchTask - we'll build in resolveDebugConfigurationWithSubstitutedVariables
            config.program = await this.getExecutablePath(project);
            config.cwd = path.dirname(project.fsPath);
            config.console = 'internalConsole';
            config.stopAtEntry = false;
        }

        return config;
    }

    /**
     * Resolves a debug configuration with full details
     * @param folder - The workspace folder
     * @param config - The debug configuration
     * @param token - Cancellation token
     * @returns The resolved configuration or undefined
     */
    async resolveDebugConfigurationWithSubstitutedVariables(
        _folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        _token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | undefined> {
        // For winui type, convert to coreclr
        if (config.type === DEBUG_TYPES.WINUI) {
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
                type: DEBUG_TYPES.CORECLR,
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
     * @param folder - The workspace folder
     * @param token - Cancellation token
     * @returns Array of debug configurations
     */
    provideDebugConfigurations(
        _folder: vscode.WorkspaceFolder | undefined,
        _token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        return [
            {
                type: DEBUG_TYPES.WINUI,
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
     * @param projectUri - URI to the project file
     * @returns The full path to the executable
     */
    private async getExecutablePath(projectUri: vscode.Uri): Promise<string> {
        const projectInfo = await this.projectManager.getProjectInfo();
        const projectName = path.basename(projectUri.fsPath, '.csproj');
        
        const targetFramework = projectInfo?.targetFramework;
        const outputPath = this.buildManager.getOutputPath(projectUri.fsPath, targetFramework);

        return path.join(outputPath, `${projectName}.exe`);
    }
}
