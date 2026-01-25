// WinDev Helper - Build Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { WinAppCli } from './winAppCli';
import { CONFIG, OUTPUT_CHANNELS, DEFAULTS } from './constants';

export type BuildConfiguration = 'Debug' | 'Release';
export type BuildPlatform = 'x86' | 'x64' | 'ARM64';

/**
 * Manages build operations for WinUI projects
 */
export class BuildManager {
    private readonly outputChannel: vscode.OutputChannel;
    private _currentConfiguration: BuildConfiguration;
    private _currentPlatform: BuildPlatform;
    private buildProcess: cp.ChildProcess | undefined;
    private readonly configChangeDisposable: vscode.Disposable;

    // Event emitters for configuration changes
    private readonly _onConfigurationChanged = new vscode.EventEmitter<BuildConfiguration>();
    private readonly _onPlatformChanged = new vscode.EventEmitter<BuildPlatform>();

    /** Fired when build configuration changes */
    public readonly onConfigurationChanged = this._onConfigurationChanged.event;
    /** Fired when target platform changes */
    public readonly onPlatformChanged = this._onPlatformChanged.event;

    /**
     * Creates a new BuildManager instance
     * @param _winAppCli - WinAppCli instance (reserved for future use)
     */
    constructor(_winAppCli: WinAppCli) {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.BUILD);
        
        // Load defaults from configuration
        this._currentConfiguration = this.getConfigurationSetting();
        this._currentPlatform = this.getPlatformSetting();

        // Listen for configuration changes
        this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(`${CONFIG.SECTION}.${CONFIG.DEFAULT_CONFIGURATION}`)) {
                const newConfig = this.getConfigurationSetting();
                if (newConfig !== this._currentConfiguration) {
                    this._currentConfiguration = newConfig;
                    this._onConfigurationChanged.fire(this._currentConfiguration);
                }
            }
            if (e.affectsConfiguration(`${CONFIG.SECTION}.${CONFIG.DEFAULT_PLATFORM}`)) {
                const newPlatform = this.getPlatformSetting();
                if (newPlatform !== this._currentPlatform) {
                    this._currentPlatform = newPlatform;
                    this._onPlatformChanged.fire(this._currentPlatform);
                }
            }
        });
    }

    /**
     * Gets the configuration setting with proper type handling
     */
    private getConfigurationSetting(): BuildConfiguration {
        const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
        const value = config.get<string>(CONFIG.DEFAULT_CONFIGURATION);
        if (value === 'Release') {
            return 'Release';
        }
        return DEFAULTS.CONFIGURATION;
    }

    /**
     * Gets the platform setting with proper type handling
     */
    private getPlatformSetting(): BuildPlatform {
        const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
        const value = config.get<string>(CONFIG.DEFAULT_PLATFORM);
        if (value === 'x86') {
            return 'x86';
        }
        if (value === 'ARM64') {
            return 'ARM64';
        }
        return DEFAULTS.PLATFORM;
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
     * @param command - The dotnet command to run (build, clean, run, publish)
     * @param projectUri - Optional URI to the project file
     * @param showOutput - Whether to show output in the output channel
     * @param additionalArgs - Additional arguments to pass to dotnet
     * @returns Promise<boolean> - True if the command succeeded
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

            // Build args array without shell quoting - let spawn handle it
            const args: string[] = [command];
            if (projectPath) {
                args.push(projectPath);
            }
            args.push('-c', this._currentConfiguration);
            args.push(`-p:Platform=${this._currentPlatform}`);
            args.push(...additionalArgs);

            const displayCommand = `dotnet ${args.join(' ')}`;
            
            if (showOutput) {
                this.outputChannel.clear();
                this.outputChannel.appendLine(`> ${displayCommand}`);
                this.outputChannel.appendLine('');
                this.outputChannel.show();
            }

            // Use shell: false for security - avoids command injection
            this.buildProcess = cp.spawn('dotnet', args, {
                cwd: workingDir,
                shell: false,
                windowsHide: true
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

        if (selected && selected !== this._currentConfiguration) {
            this._currentConfiguration = selected as BuildConfiguration;
            this._onConfigurationChanged.fire(this._currentConfiguration);
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

        if (selected && selected !== this._currentPlatform) {
            this._currentPlatform = selected as BuildPlatform;
            this._onPlatformChanged.fire(this._currentPlatform);
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
     * @param projectPath - Path to the project file
     * @param targetFramework - Optional target framework (defaults to net8.0-windows10.0.19041.0)
     * @returns The full path to the build output directory
     */
    public getOutputPath(projectPath: string, targetFramework?: string): string {
        const projectDir = path.dirname(projectPath);
        const tfm = targetFramework || DEFAULTS.TARGET_FRAMEWORK;
        return path.join(
            projectDir, 
            'bin', 
            this._currentPlatform, 
            this._currentConfiguration, 
            tfm,
            this.getRuntimeIdentifier()
        );
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.cancelBuild();
        this.outputChannel.dispose();
        this.configChangeDisposable.dispose();
        this._onConfigurationChanged.dispose();
        this._onPlatformChanged.dispose();
    }
}
