// WinDev Helper - Windows App Development CLI Integration
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { CONFIG, OUTPUT_CHANNELS } from './constants';

/**
 * Wrapper for the Windows App Development CLI (winapp)
 * Provides methods to interact with the CLI for various WinUI development tasks
 */
export class WinAppCli {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly winAppPath: string;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.WINAPP_CLI);
        this.winAppPath = this.getCliPath();
    }

    /**
     * Gets the path to the winapp CLI executable
     * @returns The CLI path from configuration or default
     */
    private getCliPath(): string {
        const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
        const customPath = config.get<string>(CONFIG.WINAPP_CLI_PATH);
        return customPath || 'winapp';
    }

    /**
     * Executes a winapp CLI command
     * @param command - The CLI command to execute
     * @param args - Arguments to pass to the command
     * @param cwd - Optional working directory
     * @returns Promise<string> - The command output
     * @throws Error if no workspace folder or command fails
     */
    public async execute(command: string, args: string[] = [], cwd?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const workingDir = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            if (!workingDir) {
                reject(new Error('No workspace folder found'));
                return;
            }

            const fullArgs = [command, ...args];
            const displayCommand = `${this.winAppPath} ${fullArgs.join(' ')}`;
            this.outputChannel.appendLine(`> ${displayCommand}`);
            this.outputChannel.show();

            // Use spawn with shell: false for security
            const process = cp.spawn(this.winAppPath, fullArgs, {
                cwd: workingDir,
                shell: false,
                windowsHide: true
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                this.outputChannel.append(text);
            });

            process.stderr?.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                this.outputChannel.append(text);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    const errorMessage = stderr || `Command failed with exit code ${code}`;
                    this.outputChannel.appendLine(`Error: ${errorMessage}`);
                    reject(new Error(errorMessage));
                }
            });

            process.on('error', (error) => {
                this.outputChannel.appendLine(`Error: ${error.message}`);
                reject(error);
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
     * Check if project is initialized with winapp
     * For winapp v0.2.0+: .NET projects configure packages in .csproj directly,
     * non-.NET projects use winapp.yaml
     */
    public isInitialized(workspacePath?: string): boolean {
        const workingDir = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workingDir) {
            return false;
        }
        
        // Check for winapp.yaml (non-.NET projects)
        const winappYamlPath = path.join(workingDir, 'winapp.yaml');
        if (fs.existsSync(winappYamlPath)) {
            return true;
        }
        
        // For .NET projects (v0.2.0+), check for .csproj with Windows App SDK packages
        let csprojFiles: string[] = [];
        try {
            csprojFiles = fs.readdirSync(workingDir).filter(f => f.endsWith('.csproj'));
        } catch {
            // If we can't read the directory, treat as not initialized
            return false;
        }
        for (const csproj of csprojFiles) {
            try {
                const content = fs.readFileSync(path.join(workingDir, csproj), 'utf-8');
                if (content.includes('Microsoft.WindowsAppSDK') || content.includes('Microsoft.Windows.SDK.BuildTools')) {
                    return true;
                }
            } catch {
                // Ignore read errors
            }
        }
        
        return false;
    }

    /**
     * Initialize project with Windows SDK and App SDK
     * Note: As of winapp v0.2.0, init no longer generates a certificate automatically.
     * Use generateCertificate() separately if you need a dev signing certificate.
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
            
            // Offer to generate a certificate since init no longer does this automatically (v0.2.0+)
            const action = await vscode.window.showInformationMessage(
                'Project initialized with Windows SDK successfully. Would you like to generate a development certificate for signing?',
                'Generate Certificate',
                'Skip'
            );
            
            if (action === 'Generate Certificate') {
                await this.generateCertificate();
            }
            
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize project: ${error}`);
            return false;
        }
    }

    /**
     * Restore packages and dependencies
     * Returns true if restore was successful or skipped, false if failed
     * Note: For .NET projects (v0.2.0+), packages are configured in .csproj directly
     */
    public async restore(projectPath?: string): Promise<boolean> {
        const workingDir = projectPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // Check if winapp workspace is initialized
        if (!this.isInitialized(workingDir)) {
            const action = await vscode.window.showWarningMessage(
                'WinApp workspace not initialized. No winapp.yaml or configured .NET project found. Would you like to initialize it now?',
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
            // Input folder is a positional argument (required)
            if (options.inputDir) {
                args.push(options.inputDir);
            }
            // Use long-form options as per CLI spec
            if (options.outputPath) {
                args.push('--output', options.outputPath);
            }
            if (options.manifestPath) {
                args.push('--manifest', options.manifestPath);
            }
            if (options.certPath) {
                args.push('--cert', options.certPath);
            }
            if (options.certPassword) {
                args.push('--cert-password', options.certPassword);
            }
            if (options.generateCert) {
                args.push('--generate-cert');
            }
            if (options.installCert) {
                args.push('--install-cert');
            }
            if (options.selfContained) {
                args.push('--self-contained');
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

    // ============================================
    // Microsoft Store Commands (v0.2.0+)
    // Uses 'winapp store' subcommand which wraps msstore CLI
    // ============================================

    /**
     * Configure Microsoft Store credentials
     * Sets up authentication for Store operations
     */
    public async storeConfigure(options: StoreConfigureOptions): Promise<void> {
        try {
            const args: string[] = ['reconfigure'];
            if (options.tenantId) {
                args.push('--tenantId', options.tenantId);
            }
            if (options.sellerId) {
                args.push('--sellerId', options.sellerId);
            }
            if (options.clientId) {
                args.push('--clientId', options.clientId);
            }
            if (options.clientSecret) {
                args.push('--clientSecret', options.clientSecret);
            }
            await this.execute('store', args);
            vscode.window.showInformationMessage('Microsoft Store credentials configured successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to configure Store credentials: ${error}`);
        }
    }

    /**
     * List all applications in the Microsoft Store account
     */
    public async storeListApps(): Promise<string> {
        try {
            return await this.execute('store', ['apps', 'list']);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to list Store apps: ${error}`);
            return '';
        }
    }

    /**
     * Get submission status for a Store app
     * @param productId The Store product ID
     */
    public async storeGetSubmissionStatus(productId: string): Promise<string> {
        try {
            return await this.execute('store', ['submission', 'status', productId]);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get submission status: ${error}`);
            return '';
        }
    }

    /**
     * Publish application to Microsoft Store
     * @param options Publishing options
     */
    public async storePublish(options: StorePublishOptions): Promise<void> {
        try {
            const args: string[] = ['publish'];
            if (options.projectPath) {
                args.push(options.projectPath);
            }
            if (options.inputFile) {
                args.push('--inputFile', options.inputFile);
            }
            if (options.appId) {
                args.push('--appId', options.appId);
            }
            if (options.flightId) {
                args.push('--flightId', options.flightId);
            }
            if (options.noCommit) {
                args.push('--noCommit');
            }
            if (options.rolloutPercentage !== undefined) {
                args.push('--packageRolloutPercentage', options.rolloutPercentage.toString());
            }
            await this.execute('store', args);
            vscode.window.showInformationMessage('Application published to Microsoft Store successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to publish to Store: ${error}`);
        }
    }

    /**
     * Package application for Microsoft Store submission
     * @param projectPath Path to the project
     * @param options Packaging options
     */
    public async storePackage(projectPath: string, options?: StorePackageOptions): Promise<void> {
        try {
            const args: string[] = ['package', projectPath];
            if (options?.output) {
                args.push('--output', options.output);
            }
            if (options?.arch) {
                args.push('--arch', options.arch.join(','));
            }
            if (options?.version) {
                args.push('--version', options.version);
            }
            await this.execute('store', args);
            vscode.window.showInformationMessage('Application packaged for Store submission.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to package for Store: ${error}`);
        }
    }

    // ============================================
    // External Catalog Command (v0.2.0+)
    // ============================================

    /**
     * Create an external catalog for asset management
     * @param outputPath Optional output directory for the catalog
     */
    public async createExternalCatalog(outputPath?: string): Promise<void> {
        try {
            const args: string[] = [];
            if (outputPath) {
                args.push(outputPath);
            }
            await this.execute('create-external-catalog', args);
            vscode.window.showInformationMessage('External catalog created successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create external catalog: ${error}`);
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
    certPath?: string;
    certPassword?: string;
    generateCert?: boolean;
    installCert?: boolean;
    selfContained?: boolean;
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

// Microsoft Store options (v0.2.0+)

export interface StoreConfigureOptions {
    tenantId?: string;
    sellerId?: string;
    clientId?: string;
    clientSecret?: string;
    certificateThumbprint?: string;
    certificateFilePath?: string;
    certificatePassword?: string;
}

export interface StorePublishOptions {
    projectPath?: string;
    inputFile?: string;
    appId?: string;
    flightId?: string;
    noCommit?: boolean;
    rolloutPercentage?: number;
}

export interface StorePackageOptions {
    output?: string;
    arch?: ('x86' | 'x64' | 'arm64')[];
    version?: string;
}
