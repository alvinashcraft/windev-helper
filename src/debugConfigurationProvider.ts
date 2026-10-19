// WinDev Helper - Debug Configuration Provider
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WinUIProjectManager } from './projectManager';
import { BuildManager } from './buildManager';
import { DEBUG_TYPES } from './constants';
import { WinAppDebugConfigurationProvider } from './winAppDebugProvider';

/**
 * Provides debug configurations for WinUI applications
 */
export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    private readonly projectManager: WinUIProjectManager;
    private readonly buildManager: BuildManager;
    private readonly winAppDebugProvider: WinAppDebugConfigurationProvider | undefined;

    constructor(projectManager: WinUIProjectManager, buildManager: BuildManager,
        winAppDebugProvider?: WinAppDebugConfigurationProvider) {
        this.projectManager = projectManager;
        this.buildManager = buildManager;
        this.winAppDebugProvider = winAppDebugProvider;
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
            const project = await this.projectManager.selectProject();
            if (!project) {
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
            const projectPath = config.project || (await this.projectManager.selectProject())?.fsPath;
            
            if (!projectPath) {
                return undefined;
            }

            const projectInfo = await this.projectManager.getProjectInfo(vscode.Uri.file(projectPath));
            if (!projectInfo) {
                vscode.window.showErrorMessage('Cannot debug the application: failed to read project information.');
                return undefined;
            }
            const isUnpackaged = projectInfo?.windowsPackageType?.toLowerCase() === 'none';
            if (!isUnpackaged) {
                if (this.winAppDebugProvider) {
                    return this.winAppDebugProvider.resolveDebugConfigurationWithSubstitutedVariables(
                        vscode.workspace.getWorkspaceFolder(vscode.Uri.file(projectPath)), {
                            type: DEBUG_TYPES.WINAPP, request: 'launch', name: config.name,
                            input: projectPath, configuration: config.configuration ?? this.buildManager.currentConfiguration,
                            arch: (config.platform ?? this.buildManager.currentPlatform).toLowerCase(),
                            args: config.args ?? []
                        }, _token);
                }
                vscode.window.showErrorMessage('Packaged debugging requires the WinApp debug provider. Use a winapp launch configuration.');
                return undefined;
            }

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
     * Gets the executable path for the project.
     * Tries multiple candidate locations to handle both MSIX-packaged and unpackaged apps:
     * - Unpackaged (WindowsPackageType=None): exe is in bin/{platform}/{config}/{tfm}/{rid}/
     * - Packaged (default MSIX): exe is in bin/{platform}/{config}/{tfm}/ (no RID subfolder)
     * - Packaged AppX layout: exe may be in bin/{platform}/{config}/{tfm}/{rid}/AppX/
     * @param projectUri - URI to the project file
     * @returns The full path to the executable
     */
    private async getExecutablePath(projectUri: vscode.Uri): Promise<string> {
        const projectInfo = await this.projectManager.getProjectInfo(projectUri);
        const projectName = path.basename(projectUri.fsPath, '.csproj');
        const targetFramework = projectInfo?.targetFramework;
        const exeName = `${projectName}.exe`;
        const isUnpackaged = projectInfo?.windowsPackageType?.toLowerCase() === 'none';

        // Build candidate paths in priority order
        const candidates: string[] = [];

        if (isUnpackaged) {
            // Unpackaged apps: RID subfolder is the primary location
            candidates.push(path.join(this.buildManager.getOutputPath(projectUri.fsPath, targetFramework, true), exeName));
            candidates.push(path.join(this.buildManager.getOutputPath(projectUri.fsPath, targetFramework, false), exeName));
        } else {
            // Packaged apps: no RID subfolder is the primary location
            candidates.push(path.join(this.buildManager.getOutputPath(projectUri.fsPath, targetFramework, false), exeName));
            candidates.push(path.join(this.buildManager.getOutputPath(projectUri.fsPath, targetFramework, true), exeName));
            // Also check AppX layout for packaged apps
            candidates.push(path.join(this.buildManager.getOutputPath(projectUri.fsPath, targetFramework, true), 'AppX', exeName));
        }

        // Return the first path that exists, or fall back to the primary candidate
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        // Pre-build: return the best guess (first candidate)
        return candidates[0];
    }
}
