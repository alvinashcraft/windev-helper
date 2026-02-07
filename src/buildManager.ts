// WinDev Helper - Build Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
     * Builds the WinUI project with optional cancellation support
     * @param projectUri - Optional URI to the project file
     * @param token - Optional cancellation token
     * @returns Promise<boolean> - True if the build succeeded
     */
    public async build(projectUri?: vscode.Uri, token?: vscode.CancellationToken): Promise<boolean> {
        return this.runDotnetCommand('build', projectUri, true, [], token);
    }

    /**
     * Rebuilds the WinUI project (clean + build) with optional cancellation support
     * @param projectUri - Optional URI to the project file
     * @param token - Optional cancellation token
     * @returns Promise<boolean> - True if the rebuild succeeded
     */
    public async rebuild(projectUri?: vscode.Uri, token?: vscode.CancellationToken): Promise<boolean> {
        const cleanSuccess = await this.clean(projectUri, token);
        if (!cleanSuccess) {
            return false;
        }
        
        // Check if cancelled after clean
        if (token?.isCancellationRequested) {
            return false;
        }
        
        return this.build(projectUri, token);
    }

    /**
     * Cleans the WinUI project with optional cancellation support
     * @param projectUri - Optional URI to the project file
     * @param token - Optional cancellation token
     * @returns Promise<boolean> - True if the clean succeeded
     */
    public async clean(projectUri?: vscode.Uri, token?: vscode.CancellationToken): Promise<boolean> {
        return this.runDotnetCommand('clean', projectUri, true, [], token);
    }

    /**
     * Runs the project without debugging.
     * For unpackaged apps, uses `dotnet run`.
     * For MSIX-packaged apps, builds, deploys, and launches through the package identity.
     * @param projectUri - Optional URI to the project file
     * @param targetFramework - Optional target framework moniker
     * @param isPackaged - Whether the app is MSIX-packaged (default: false)
     */
    public async runWithoutDebugging(
        projectUri?: vscode.Uri,
        targetFramework?: string,
        isPackaged: boolean = false
    ): Promise<void> {
        const buildSuccess = await this.build(projectUri);
        if (!buildSuccess) {
            vscode.window.showErrorMessage('Build failed. Cannot run the application.');
            return;
        }

        if (isPackaged && projectUri) {
            const deploySuccess = await this.deploy(projectUri, targetFramework);
            if (!deploySuccess) {
                vscode.window.showErrorMessage('MSIX deployment failed. Cannot run the application.');
                return;
            }

            const launched = await this.launchPackagedApp(projectUri, targetFramework);
            if (!launched) {
                vscode.window.showErrorMessage('Failed to launch packaged application.');
            }
        } else {
            await this.runDotnetCommand('run', projectUri, false);
        }
    }

    /**
     * Deploys the MSIX-packaged WinUI project for development.
     * This registers the app package so that COM classes (used by WinUI/Windows App SDK)
     * are available at runtime. Required before launching packaged apps for debugging.
     * Locates AppxManifest.xml in the build output and runs Add-AppxPackage -Register.
     * @param projectUri - Optional URI to the project file
     * @param targetFramework - Optional target framework moniker
     * @param token - Optional cancellation token
     * @returns Promise<boolean> - True if the deployment succeeded
     */
    public async deploy(
        projectUri?: vscode.Uri,
        targetFramework?: string,
        token?: vscode.CancellationToken
    ): Promise<boolean> {
        const projectPath = projectUri?.fsPath || '';
        if (!projectPath) {
            vscode.window.showErrorMessage('No project specified for deployment.');
            return false;
        }

        if (token?.isCancellationRequested) {
            return false;
        }

        const manifestPath = this.findAppxManifest(projectPath, targetFramework);
        if (!manifestPath) {
            vscode.window.showErrorMessage(
                'Could not find AppxManifest.xml in build output. ' +
                'Ensure the project is configured for MSIX packaging.'
            );
            return false;
        }

        // Register the MSIX package for development using Add-AppxPackage
        return this.runPowerShellDeploy(manifestPath, token);
    }

    /**
     * Launches a packaged WinUI app through its MSIX package identity.
     * Packaged apps must be launched this way so COM class registrations are available.
     * Parses the AppxManifest.xml for the package name and app ID, resolves the
     * PackageFamilyName via Get-AppxPackage, and uses shell:AppsFolder activation.
     * @param projectUri - URI to the project file
     * @param targetFramework - Optional target framework moniker
     * @returns Promise<boolean> - True if the app was launched
     */
    public async launchPackagedApp(
        projectUri: vscode.Uri,
        targetFramework?: string
    ): Promise<boolean> {
        const manifestPath = this.findAppxManifest(projectUri.fsPath, targetFramework);
        if (!manifestPath) {
            vscode.window.showErrorMessage(
                'Could not find AppxManifest.xml in build output. ' +
                'Ensure the project is configured for MSIX packaging.'
            );
            return false;
        }

        const manifestInfo = this.parseAppxManifest(manifestPath);
        if (!manifestInfo) {
            vscode.window.showErrorMessage('Could not parse package identity from AppxManifest.xml.');
            return false;
        }

        return this.runPowerShellLaunch(manifestInfo.packageName, manifestInfo.appId);
    }

    /**
     * Finds AppxManifest.xml in the build output.
     * Checks multiple candidate paths: with/without RID subfolder, with/without AppX subfolder.
     * @param projectPath - Full path to the .csproj file
     * @param targetFramework - Optional target framework moniker
     * @returns The path to AppxManifest.xml, or undefined if not found
     */
    public findAppxManifest(projectPath: string, targetFramework?: string): string | undefined {
        const candidates = [
            path.join(this.getOutputPath(projectPath, targetFramework, false), 'AppxManifest.xml'),
            path.join(this.getOutputPath(projectPath, targetFramework, true), 'AppxManifest.xml'),
            path.join(this.getOutputPath(projectPath, targetFramework, false), 'AppX', 'AppxManifest.xml'),
            path.join(this.getOutputPath(projectPath, targetFramework, true), 'AppX', 'AppxManifest.xml'),
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }

    /**
     * Parses AppxManifest.xml to extract the package Identity Name and Application Id.
     * @param manifestPath - Path to AppxManifest.xml
     * @returns Object with packageName and appId, or undefined on parse failure
     */
    private parseAppxManifest(manifestPath: string): { packageName: string; appId: string } | undefined {
        try {
            const content = fs.readFileSync(manifestPath, 'utf-8');
            // Extract Identity Name attribute
            const identityMatch = content.match(/<Identity\s[^>]*Name="([^"]+)"/);
            if (!identityMatch) {
                return undefined;
            }

            // Extract Application Id attribute (defaults to "App")
            const appIdMatch = content.match(/<Application\s[^>]*Id="([^"]+)"/);
            const appId = appIdMatch ? appIdMatch[1] : 'App';

            return { packageName: identityMatch[1], appId };
        } catch {
            return undefined;
        }
    }

    /**
     * Uses PowerShell to resolve the PackageFamilyName and launch the app via shell:AppsFolder.
     * @param packageName - The package Identity Name from AppxManifest.xml
     * @param appId - The Application Id from AppxManifest.xml
     * @returns Promise<boolean> - True if the launch succeeded
     */
    private runPowerShellLaunch(packageName: string, appId: string): Promise<boolean> {
        return new Promise((resolve) => {
            // PowerShell script: resolve the PackageFamilyName then activate via shell:AppsFolder
            const script = [
                `$pkg = Get-AppxPackage -Name '${packageName}' | Select-Object -First 1`,
                `if (-not $pkg) { Write-Error 'Package not found: ${packageName}'; exit 1 }`,
                `$aumid = $pkg.PackageFamilyName + '!${appId}'`,
                `Write-Host "Launching $aumid"`,
                `Start-Process "shell:AppsFolder\\$aumid"`
            ].join('; ');

            this.outputChannel.appendLine('');
            this.outputChannel.appendLine(`> Launching packaged app: ${packageName}!${appId}`);
            this.outputChannel.appendLine('');
            this.outputChannel.show();

            const proc = cp.spawn('powershell', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                script
            ], {
                shell: false,
                windowsHide: true
            });

            proc.stdout?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            proc.stderr?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    this.outputChannel.appendLine('Application launched successfully.');
                } else {
                    this.outputChannel.appendLine(`Failed to launch application (exit code ${code}).`);
                }
                resolve(code === 0);
            });

            proc.on('error', (error) => {
                this.outputChannel.appendLine(`Launch error: ${error.message}`);
                resolve(false);
            });
        });
    }

    /**
     * Runs Add-AppxPackage -Register to deploy the MSIX package for development.
     * @param manifestPath - Path to AppxManifest.xml
     * @param token - Optional cancellation token
     * @returns Promise<boolean> - True if deployment succeeded
     */
    private runPowerShellDeploy(manifestPath: string, token?: vscode.CancellationToken): Promise<boolean> {
        return new Promise((resolve) => {
            if (token?.isCancellationRequested) {
                resolve(false);
                return;
            }

            const command = `Add-AppxPackage -Register "${manifestPath}" -ForceUpdateFromAnyVersion`;

            this.outputChannel.appendLine('');
            this.outputChannel.appendLine(`> ${command}`);
            this.outputChannel.appendLine('');
            this.outputChannel.show();

            const proc = cp.spawn('powershell', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                command
            ], {
                shell: false,
                windowsHide: true
            });

            let cancellationListener: vscode.Disposable | undefined;
            if (token) {
                cancellationListener = token.onCancellationRequested(() => {
                    proc.kill('SIGTERM');
                    this.outputChannel.appendLine('Deployment cancelled by user.');
                });
            }

            proc.stdout?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            proc.stderr?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            proc.on('close', (code, signal) => {
                cancellationListener?.dispose();
                const wasCancelled = signal === 'SIGTERM' || token?.isCancellationRequested;

                if (wasCancelled) {
                    this.outputChannel.appendLine('Deployment was cancelled.');
                } else if (code === 0) {
                    this.outputChannel.appendLine('MSIX deployment succeeded.');
                } else {
                    this.outputChannel.appendLine(`MSIX deployment failed with exit code ${code}.`);
                }

                resolve(!wasCancelled && code === 0);
            });

            proc.on('error', (error) => {
                cancellationListener?.dispose();
                this.outputChannel.appendLine(`Deployment error: ${error.message}`);
                resolve(false);
            });
        });
    }

    /**
     * Publishes the project with optional cancellation support
     * @param projectUri - Optional URI to the project file
     * @param runtimeIdentifier - Optional runtime identifier
     * @param token - Optional cancellation token
     * @returns Promise<boolean> - True if the publish succeeded
     */
    public async publish(
        projectUri?: vscode.Uri, 
        runtimeIdentifier?: string,
        token?: vscode.CancellationToken
    ): Promise<boolean> {
        const rid = runtimeIdentifier || this.getRuntimeIdentifier();
        return this.runDotnetCommand('publish', projectUri, true, ['-r', rid, '--self-contained'], token);
    }

    /**
     * Runs a dotnet CLI command with cancellation support
     * @param command - The dotnet command to run (build, clean, run, publish)
     * @param projectUri - Optional URI to the project file
     * @param showOutput - Whether to show output in the output channel
     * @param additionalArgs - Additional arguments to pass to dotnet
     * @param token - Optional cancellation token
     * @returns Promise<boolean> - True if the command succeeded
     */
    private async runDotnetCommand(
        command: string, 
        projectUri?: vscode.Uri, 
        showOutput: boolean = true,
        additionalArgs: string[] = [],
        token?: vscode.CancellationToken
    ): Promise<boolean> {
        return new Promise((resolve) => {
            // Check if already cancelled
            if (token?.isCancellationRequested) {
                resolve(false);
                return;
            }

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

            // Handle cancellation
            let cancellationListener: vscode.Disposable | undefined;
            if (token) {
                cancellationListener = token.onCancellationRequested(() => {
                    this.cancelBuild();
                    if (showOutput) {
                        this.outputChannel.appendLine('Build cancelled by user.');
                    }
                });
            }

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

            this.buildProcess.on('close', (code, signal) => {
                cancellationListener?.dispose();
                
                const wasCancelled = signal === 'SIGTERM' || token?.isCancellationRequested;
                
                if (showOutput) {
                    this.outputChannel.appendLine('');
                    if (wasCancelled) {
                        this.outputChannel.appendLine('Build was cancelled.');
                    } else if (code === 0) {
                        this.outputChannel.appendLine(`Build succeeded.`);
                    } else {
                        this.outputChannel.appendLine(`Build failed with exit code ${code}.`);
                    }
                }
                this.buildProcess = undefined;
                
                // Return false if cancelled or failed
                resolve(!wasCancelled && code === 0);
            });

            this.buildProcess.on('error', (error) => {
                cancellationListener?.dispose();
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
            this.buildProcess.kill('SIGTERM');
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
     * @param includeRid - Whether to include the RuntimeIdentifier subfolder (default: true)
     * @returns The full path to the build output directory
     */
    public getOutputPath(projectPath: string, targetFramework?: string, includeRid: boolean = true): string {
        const projectDir = path.dirname(projectPath);
        const tfm = targetFramework || DEFAULTS.TARGET_FRAMEWORK;
        const segments = [projectDir, 'bin', this._currentPlatform, this._currentConfiguration, tfm];
        if (includeRid) {
            segments.push(this.getRuntimeIdentifier());
        }
        return path.join(...segments);
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
