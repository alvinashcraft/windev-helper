// WinDev Helper - Build Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { WinAppCli } from './winAppCli';

export type BuildConfiguration = 'Debug' | 'Release';
export type BuildPlatform = 'x86' | 'x64' | 'ARM64';

/**
 * Manages build operations for WinUI projects
 */
export class BuildManager {
    private winAppCli: WinAppCli;
    private outputChannel: vscode.OutputChannel;
    private _currentConfiguration: BuildConfiguration;
    private _currentPlatform: BuildPlatform;
    private buildProcess: cp.ChildProcess | undefined;

    constructor(winAppCli: WinAppCli) {
        this.winAppCli = winAppCli;
        this.outputChannel = vscode.window.createOutputChannel('WinUI Build');
        
        // Load defaults from configuration
        const config = vscode.workspace.getConfiguration('windevHelper');
        this._currentConfiguration = config.get<BuildConfiguration>('defaultConfiguration') || 'Debug';
        this._currentPlatform = config.get<BuildPlatform>('defaultPlatform') || 'x64';
    }

    /**
     * Gets the current build configuration
     */
    public get currentConfiguration(): BuildConfiguration {
        return this._currentConfiguration;
    }

    /**
     * Gets the current target platform
     */
    public get currentPlatform(): BuildPlatform {
        return this._currentPlatform;
    }

    /**
     * Builds the WinUI project
     */
    public async build(projectUri?: vscode.Uri): Promise<boolean> {
        return this.runDotnetCommand('build', projectUri);
    }

    /**
     * Rebuilds the WinUI project (clean + build)
     */
    public async rebuild(projectUri?: vscode.Uri): Promise<boolean> {
        const cleanSuccess = await this.clean(projectUri);
        if (!cleanSuccess) {
            return false;
        }
        return this.build(projectUri);
    }

    /**
     * Cleans the WinUI project
     */
    public async clean(projectUri?: vscode.Uri): Promise<boolean> {
        return this.runDotnetCommand('clean', projectUri);
    }

    /**
     * Runs the project without debugging
     */
    public async runWithoutDebugging(projectUri?: vscode.Uri): Promise<void> {
        const buildSuccess = await this.build(projectUri);
        if (!buildSuccess) {
            vscode.window.showErrorMessage('Build failed. Cannot run the application.');
            return;
        }

        await this.runDotnetCommand('run', projectUri, false);
    }

    /**
     * Publishes the project
     */
    public async publish(projectUri?: vscode.Uri, runtimeIdentifier?: string): Promise<boolean> {
        const rid = runtimeIdentifier || this.getRuntimeIdentifier();
        return this.runDotnetCommand('publish', projectUri, true, ['-r', rid, '--self-contained']);
    }

    /**
     * Runs a dotnet CLI command
     */
    private async runDotnetCommand(
        command: string, 
        projectUri?: vscode.Uri, 
        showOutput: boolean = true,
        additionalArgs: string[] = []
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const projectPath = projectUri?.fsPath || '';
            const workingDir = projectPath ? path.dirname(projectPath) : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            if (!workingDir) {
                vscode.window.showErrorMessage('No workspace folder found.');
                resolve(false);
                return;
            }

            const args = [
                command,
                projectPath ? `"${projectPath}"` : '',
                '-c', this._currentConfiguration,
                '-p:Platform=' + this._currentPlatform,
                ...additionalArgs
            ].filter(Boolean);

            const fullCommand = `dotnet ${args.join(' ')}`;
            
            if (showOutput) {
                this.outputChannel.clear();
                this.outputChannel.appendLine(`> ${fullCommand}`);
                this.outputChannel.appendLine('');
                this.outputChannel.show();
            }

            this.buildProcess = cp.spawn('dotnet', args, {
                cwd: workingDir,
                shell: true
            });

            this.buildProcess.stdout?.on('data', (data) => {
                if (showOutput) {
                    this.outputChannel.append(data.toString());
                }
            });

            this.buildProcess.stderr?.on('data', (data) => {
                if (showOutput) {
                    this.outputChannel.append(data.toString());
                }
            });

            this.buildProcess.on('close', (code) => {
                if (showOutput) {
                    this.outputChannel.appendLine('');
                    if (code === 0) {
                        this.outputChannel.appendLine(`Build succeeded.`);
                    } else {
                        this.outputChannel.appendLine(`Build failed with exit code ${code}.`);
                    }
                }
                this.buildProcess = undefined;
                resolve(code === 0);
            });

            this.buildProcess.on('error', (error) => {
                if (showOutput) {
                    this.outputChannel.appendLine(`Error: ${error.message}`);
                }
                this.buildProcess = undefined;
                resolve(false);
            });
        });
    }

    /**
     * Cancels the current build
     */
    public cancelBuild(): void {
        if (this.buildProcess) {
            this.buildProcess.kill();
            this.outputChannel.appendLine('Build cancelled.');
        }
    }

    /**
     * Shows a quick pick to select build configuration
     */
    public async selectConfiguration(): Promise<void> {
        const configurations: BuildConfiguration[] = ['Debug', 'Release'];
        const selected = await vscode.window.showQuickPick(configurations, {
            placeHolder: 'Select build configuration',
            title: 'Build Configuration'
        });

        if (selected) {
            this._currentConfiguration = selected as BuildConfiguration;
            vscode.window.showInformationMessage(`Build configuration set to ${selected}`);
        }
    }

    /**
     * Shows a quick pick to select target platform
     */
    public async selectPlatform(): Promise<void> {
        const platforms: BuildPlatform[] = ['x86', 'x64', 'ARM64'];
        const selected = await vscode.window.showQuickPick(platforms, {
            placeHolder: 'Select target platform',
            title: 'Target Platform'
        });

        if (selected) {
            this._currentPlatform = selected as BuildPlatform;
            vscode.window.showInformationMessage(`Target platform set to ${selected}`);
        }
    }

    /**
     * Gets the runtime identifier for the current platform
     */
    public getRuntimeIdentifier(): string {
        switch (this._currentPlatform) {
            case 'x86':
                return 'win-x86';
            case 'x64':
                return 'win-x64';
            case 'ARM64':
                return 'win-arm64';
            default:
                return 'win-x64';
        }
    }

    /**
     * Gets the output path for the current build
     */
    public getOutputPath(projectPath: string): string {
        const projectDir = path.dirname(projectPath);
        return path.join(
            projectDir, 
            'bin', 
            this._currentPlatform, 
            this._currentConfiguration, 
            `net8.0-windows10.0.19041.0`,
            this.getRuntimeIdentifier()
        );
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.cancelBuild();
        this.outputChannel.dispose();
    }
}
