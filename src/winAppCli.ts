// WinDev Helper - Windows App Development CLI Integration
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Wrapper for the Windows App Development CLI (winapp)
 * Provides methods to interact with the CLI for various WinUI development tasks
 */
export class WinAppCli {
    private outputChannel: vscode.OutputChannel;
    private winAppPath: string;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('WinApp CLI');
        this.winAppPath = this.getCliPath();
    }

    /**
     * Gets the path to the winapp CLI executable
     */
    private getCliPath(): string {
        const config = vscode.workspace.getConfiguration('windevHelper');
        const customPath = config.get<string>('winAppCliPath');
        return customPath || 'winapp';
    }

    /**
     * Executes a winapp CLI command
     */
    public async execute(command: string, args: string[] = [], cwd?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const workingDir = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            if (!workingDir) {
                reject(new Error('No workspace folder found'));
                return;
            }

            const fullCommand = `${this.winAppPath} ${command} ${args.join(' ')}`;
            this.outputChannel.appendLine(`> ${fullCommand}`);
            this.outputChannel.show();

            cp.exec(fullCommand, { cwd: workingDir }, (error, stdout, stderr) => {
                if (stdout) {
                    this.outputChannel.appendLine(stdout);
                }
                if (stderr) {
                    this.outputChannel.appendLine(stderr);
                }
                if (error) {
                    this.outputChannel.appendLine(`Error: ${error.message}`);
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * Checks if the winapp CLI is installed and accessible
     */
    public async checkInstallation(): Promise<boolean> {
        try {
            await this.execute('--version');
            vscode.window.showInformationMessage('WinApp CLI is installed and ready to use.');
            return true;
        } catch {
            const action = await vscode.window.showErrorMessage(
                'WinApp CLI is not installed or not in PATH. Please install it to use WinUI development features.',
                'Learn More'
            );
            if (action === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/microsoft/WinAppCli'));
            }
            return false;
        }
    }

    /**
     * Check if winapp.yaml exists in the workspace
     */
    public isInitialized(workspacePath?: string): boolean {
        const workingDir = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workingDir) {
            return false;
        }
        const winappYamlPath = path.join(workingDir, 'winapp.yaml');
        return fs.existsSync(winappYamlPath);
    }

    /**
     * Initialize project with Windows SDK and App SDK
     * @param projectPath Optional path to the project directory
     * @param skipPrompts If true, uses --no-prompt flag to skip interactive prompts (default: true for non-interactive execution)
     */
    public async init(projectPath?: string, skipPrompts: boolean = true): Promise<boolean> {
        try {
            const args: string[] = [];
            if (skipPrompts) {
                args.push('--no-prompt');
            }
            if (projectPath) {
                args.push(projectPath);
            }
            await this.execute('init', args);
            vscode.window.showInformationMessage('Project initialized with Windows SDK successfully.');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize project: ${error}`);
            return false;
        }
    }

    /**
     * Restore packages and dependencies
     * Returns true if restore was successful or skipped, false if failed
     */
    public async restore(projectPath?: string): Promise<boolean> {
        const workingDir = projectPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // Check if winapp.yaml exists before attempting restore
        if (!this.isInitialized(workingDir)) {
            const action = await vscode.window.showWarningMessage(
                'WinApp workspace not initialized. winapp.yaml not found. Would you like to initialize it now?',
                'Initialize',
                'Skip'
            );

            if (action === 'Initialize') {
                const initSuccess = await this.init(projectPath);
                if (!initSuccess) {
                    return false;
                }
            } else {
                return false;
            }
        }

        try {
            const args = projectPath ? [projectPath] : [];
            await this.execute('restore', args);
            vscode.window.showInformationMessage('Packages restored successfully.');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to restore packages: ${error}`);
            return false;
        }
    }

    /**
     * Update packages and dependencies to latest versions
     */
    public async update(projectPath?: string): Promise<void> {
        try {
            const args = projectPath ? [projectPath] : [];
            await this.execute('update', args);
            vscode.window.showInformationMessage('Packages updated successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update packages: ${error}`);
        }
    }

    /**
     * Create MSIX packages from directories
     */
    public async package(options: PackageOptions): Promise<void> {
        try {
            const args: string[] = [];
            if (options.inputDir) {
                args.push('-i', options.inputDir);
            }
            if (options.outputPath) {
                args.push('-o', options.outputPath);
            }
            if (options.manifestPath) {
                args.push('-m', options.manifestPath);
            }
            await this.execute('package', args);
            vscode.window.showInformationMessage('MSIX package created successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create MSIX package: ${error}`);
        }
    }

    /**
     * Add temporary app identity for debugging
     */
    public async createDebugIdentity(projectPath?: string): Promise<void> {
        try {
            const args = projectPath ? [projectPath] : [];
            await this.execute('create-debug-identity', args);
            vscode.window.showInformationMessage('Debug identity created successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create debug identity: ${error}`);
        }
    }

    /**
     * Generate and manage AppxManifest.xml files
     */
    public async manifest(action: 'generate' | 'validate', manifestPath?: string): Promise<void> {
        try {
            const args: string[] = [action];
            if (manifestPath) {
                args.push(manifestPath);
            }
            await this.execute('manifest', args);
            vscode.window.showInformationMessage(`Manifest ${action}d successfully.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to ${action} manifest: ${error}`);
        }
    }

    /**
     * Generate development certificates
     */
    public async generateCertificate(options: CertificateOptions): Promise<void> {
        try {
            const args: string[] = ['generate'];
            if (options.subjectName) {
                args.push('-n', options.subjectName);
            }
            if (options.outputPath) {
                args.push('-o', options.outputPath);
            }
            if (options.password) {
                args.push('-p', options.password);
            }
            await this.execute('cert', args);
            vscode.window.showInformationMessage('Certificate generated successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate certificate: ${error}`);
        }
    }

    /**
     * Install development certificates
     */
    public async installCertificate(certPath: string): Promise<void> {
        try {
            await this.execute('cert', ['install', certPath]);
            vscode.window.showInformationMessage('Certificate installed successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to install certificate: ${error}`);
        }
    }

    /**
     * Sign MSIX packages and executables
     */
    public async sign(options: SignOptions): Promise<void> {
        try {
            const args: string[] = [];
            if (options.inputPath) {
                args.push('-i', options.inputPath);
            }
            if (options.certPath) {
                args.push('-c', options.certPath);
            }
            if (options.password) {
                args.push('-p', options.password);
            }
            if (options.timestampUrl) {
                args.push('-t', options.timestampUrl);
            }
            await this.execute('sign', args);
            vscode.window.showInformationMessage('Package signed successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to sign package: ${error}`);
        }
    }

    /**
     * Access Windows SDK tools
     */
    public async tool(toolName: string, args: string[] = []): Promise<string> {
        return this.execute('tool', [toolName, ...args]);
    }

    /**
     * Get paths to installed SDK components
     */
    public async getSdkPaths(): Promise<string> {
        try {
            return await this.execute('get-winapp-path');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get SDK paths: ${error}`);
            return '';
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}

export interface PackageOptions {
    inputDir?: string;
    outputPath?: string;
    manifestPath?: string;
}

export interface CertificateOptions {
    subjectName?: string;
    outputPath?: string;
    password?: string;
}

export interface SignOptions {
    inputPath?: string;
    certPath?: string;
    password?: string;
    timestampUrl?: string;
}
