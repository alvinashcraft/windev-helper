// WinDev Helper - Package Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WinAppCli, CertificateOptions, SignOptions } from './winAppCli';
import { CONFIG, OUTPUT_CHANNELS, DEFAULTS } from './constants';

/**
 * Manages MSIX packaging, signing, and NuGet operations
 */
export class PackageManager {
    private readonly winAppCli: WinAppCli;
    private readonly outputChannel: vscode.OutputChannel;

    constructor(winAppCli: WinAppCli) {
        this.winAppCli = winAppCli;
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.PACKAGING);
    }

    /**
     * Restores NuGet packages
     */
    public async restorePackages(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Restoring NuGet packages...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.restore();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restore packages: ${error}`);
            }
        });
    }

    /**
     * Updates NuGet packages to latest versions
     */
    public async updatePackages(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating NuGet packages...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.update();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to update packages: ${error}`);
            }
        });
    }

    /**
     * Creates an MSIX package from the project
     */
    public async createMsixPackage(projectUri?: vscode.Uri): Promise<void> {
        if (!projectUri) {
            vscode.window.showErrorMessage('No project selected.');
            return;
        }

        const projectDir = path.dirname(projectUri.fsPath);

        // Ask for output path
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(projectDir, 'AppPackages', 'Package.msix')),
            filters: {
                'MSIX Package': ['msix'],
                'MSIX Bundle': ['msixbundle']
            },
            title: 'Save MSIX Package'
        });

        if (!outputUri) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating MSIX package...',
            cancellable: false
        }, async () => {
            try {
                // First, publish the project
                this.outputChannel.appendLine('Publishing project...');
                this.outputChannel.show();

                // Look for the manifest
                const manifestPath = await this.findManifest(projectDir);

                await this.winAppCli.package({
                    inputDir: projectDir,
                    outputPath: outputUri.fsPath,
                    ...(manifestPath && { manifestPath })
                });

                const action = await vscode.window.showInformationMessage(
                    'MSIX package created successfully.',
                    'Open Location',
                    'Sign Package'
                );

                if (action === 'Open Location') {
                    vscode.commands.executeCommand('revealFileInOS', outputUri);
                } else if (action === 'Sign Package') {
                    await this.signPackage(outputUri.fsPath);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create MSIX package: ${error}`);
            }
        });
    }

    /**
     * Signs an MSIX package
     * @param packagePath - Optional path to the package file
     */
    public async signPackage(packagePath?: string): Promise<void> {
        // Get package path if not provided
        if (!packagePath) {
            const fileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'MSIX/MSIXBUNDLE': ['msix', 'msixbundle'],
                    'Executable': ['exe']
                },
                title: 'Select Package to Sign'
            });

            if (!fileUri || fileUri.length === 0) {
                return;
            }
            packagePath = fileUri[0].fsPath;
        }

        // Get certificate path
        const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
        let certPath = config.get<string>(CONFIG.CERTIFICATE_PATH);

        if (!certPath) {
            const certUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'Certificate': ['pfx', 'p12']
                },
                title: 'Select Certificate'
            });

            if (!certUri || certUri.length === 0) {
                return;
            }
            certPath = certUri[0].fsPath;
        }

        // Get password
        const password = await vscode.window.showInputBox({
            prompt: 'Enter certificate password',
            password: true,
            title: 'Certificate Password'
        });

        if (password === undefined) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Signing package...',
            cancellable: false
        }, async () => {
            try {
                const options: SignOptions = {
                    inputPath: packagePath,
                    certPath: certPath,
                    password: password,
                    timestampUrl: DEFAULTS.TIMESTAMP_URL
                };

                await this.winAppCli.sign(options);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to sign package: ${error}`);
            }
        });
    }

    /**
     * Generates a development certificate
     * @returns Promise that resolves when certificate generation is complete
     */
    public async generateCertificate(): Promise<void> {
        // Get subject name
        const subjectName = await vscode.window.showInputBox({
            prompt: 'Enter certificate subject name (e.g., CN=MyCompany)',
            value: 'CN=Development',
            title: 'Certificate Subject'
        });

        if (!subjectName) {
            return;
        }

        // Get output path
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('DevCert.pfx'),
            filters: {
                'PFX Certificate': ['pfx']
            },
            title: 'Save Certificate'
        });

        if (!outputUri) {
            return;
        }

        // Get password
        const password = await vscode.window.showInputBox({
            prompt: 'Enter password for the certificate',
            password: true,
            title: 'Certificate Password'
        });

        if (password === undefined) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating certificate...',
            cancellable: false
        }, async () => {
            try {
                const exportCer = await vscode.window.showQuickPick(
                    ['No', 'Yes'],
                    { placeHolder: 'Export public key as .cer file?' }
                );

                const options: CertificateOptions = {
                    subjectName: subjectName,
                    outputPath: outputUri.fsPath,
                    password: password,
                    ...(exportCer === 'Yes' && { exportCer: true })
                };

                await this.winAppCli.generateCertificate(options);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate certificate: ${error}`);
            }
        });
    }

    /**
     * View certificate information (v0.2.1+)
     */
    public async viewCertificateInfo(): Promise<void> {
        const certUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: {
                'PFX Certificate': ['pfx', 'p12']
            },
            title: 'Select Certificate to Inspect'
        });

        if (!certUri || certUri.length === 0) {
            return;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Enter certificate password',
            password: true,
            title: 'Certificate Password'
        });

        if (password === undefined) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Reading certificate info...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.certInfo(certUri[0].fsPath, password || undefined);
            if (result) {
                this.outputChannel.appendLine('--- Certificate Information ---');
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Installs a development certificate
     */
    public async installCertificate(): Promise<void> {
        const certUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: {
                'Certificate': ['pfx', 'p12', 'cer']
            },
            title: 'Select Certificate to Install'
        });

        if (!certUri || certUri.length === 0) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Installing certificate...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.installCertificate(certUri[0].fsPath);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to install certificate: ${error}`);
            }
        });
    }

    /**
     * Creates a debug identity for the app
     */
    public async createDebugIdentity(projectUri?: vscode.Uri): Promise<void> {
        const projectPath = projectUri?.fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating debug identity...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.createDebugIdentity(projectPath);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create debug identity: ${error}`);
            }
        });
    }

    /**
     * Generates an app manifest
     */
    public async generateManifest(projectUri?: vscode.Uri): Promise<void> {
        const projectPath = projectUri ? path.dirname(projectUri.fsPath) : undefined;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating app manifest...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.manifest('generate', projectPath);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate manifest: ${error}`);
            }
        });
    }

    /**
     * Finds the app manifest in the project
     */
    private async findManifest(projectDir: string): Promise<string | undefined> {
        const manifestPath = path.join(projectDir, 'Package.appxmanifest');
        
        try {
            await fs.promises.access(manifestPath);
            return manifestPath;
        } catch {
            // Look for any appxmanifest file
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(projectDir, '**/*.appxmanifest'),
                '**/bin/**',
                1
            );
            return files.length > 0 ? files[0].fsPath : undefined;
        }
    }

    // ============================================
    // Microsoft Store Operations (v0.2.0+)
    // ============================================

    /**
     * Configure Microsoft Store credentials
     */
    public async configureStore(): Promise<void> {
        const tenantId = await vscode.window.showInputBox({
            prompt: 'Enter your Azure AD Tenant ID',
            placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            ignoreFocusOut: true
        });
        if (!tenantId) { return; }

        const sellerId = await vscode.window.showInputBox({
            prompt: 'Enter your Partner Center Seller ID',
            placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            ignoreFocusOut: true
        });
        if (!sellerId) { return; }

        const clientId = await vscode.window.showInputBox({
            prompt: 'Enter your Azure AD Application (Client) ID',
            placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            ignoreFocusOut: true
        });
        if (!clientId) { return; }

        const clientSecret = await vscode.window.showInputBox({
            prompt: 'Enter your Client Secret',
            password: true,
            ignoreFocusOut: true
        });
        if (!clientSecret) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Configuring Microsoft Store credentials...',
            cancellable: false
        }, async () => {
            await this.winAppCli.storeConfigure({
                tenantId,
                sellerId,
                clientId,
                clientSecret
            });
        });
    }

    /**
     * List all apps in the Microsoft Store account
     */
    public async listStoreApps(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching Microsoft Store apps...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.storeListApps();
            if (result) {
                this.outputChannel.appendLine('--- Microsoft Store Apps ---');
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Get submission status for a Store app
     */
    public async getStoreSubmissionStatus(): Promise<void> {
        const productId = await vscode.window.showInputBox({
            prompt: 'Enter the Store Product ID',
            placeHolder: '9NXXXXXXXX',
            ignoreFocusOut: true
        });
        if (!productId) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Checking submission status...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.storeGetSubmissionStatus(productId);
            if (result) {
                this.outputChannel.appendLine(`--- Submission Status for ${productId} ---`);
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Publish to Microsoft Store
     */
    public async publishToStore(projectUri?: vscode.Uri): Promise<void> {
        const projectPath = projectUri ? path.dirname(projectUri.fsPath) : 
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (!projectPath) {
            vscode.window.showErrorMessage('No project selected.');
            return;
        }

        // Ask for optional app ID
        const appId = await vscode.window.showInputBox({
            prompt: 'Enter the Store App ID (leave empty if previously initialized with msstore init)',
            placeHolder: '9NXXXXXXXX (optional)',
            ignoreFocusOut: true
        });

        // Ask about rollout
        const rolloutChoice = await vscode.window.showQuickPick(
            ['Full release (100%)', 'Gradual rollout (specify percentage)', 'Draft only (don\'t commit)'],
            { placeHolder: 'Select release type' }
        );
        if (!rolloutChoice) { return; }

        let rolloutPercentage: number | undefined;
        let noCommit = false;

        if (rolloutChoice.includes('Gradual')) {
            const percentStr = await vscode.window.showInputBox({
                prompt: 'Enter rollout percentage (1-100)',
                placeHolder: '10',
                ignoreFocusOut: true,
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 100) {
                        return 'Please enter a number between 1 and 100';
                    }
                    return null;
                }
            });
            if (!percentStr) { return; }
            rolloutPercentage = parseInt(percentStr);
        } else if (rolloutChoice.includes('Draft')) {
            noCommit = true;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Publishing to Microsoft Store...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.storePublish({
                    projectPath,
                    ...(appId && { appId }),
                    noCommit,
                    ...(rolloutPercentage !== undefined && { rolloutPercentage })
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to publish to Store: ${error}`);
            }
        });
    }

    /**
     * Create external catalog for asset management
     */
    public async createExternalCatalog(): Promise<void> {
        const outputUris = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Select output folder for external catalog',
            title: 'Select output folder for external catalog'
        });

        if (!outputUris || outputUris.length === 0) {
            return;
        }

        const outputPath = outputUris[0].fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating external catalog...',
            cancellable: false
        }, async () => {
            await this.winAppCli.createExternalCatalog(outputPath);
        });
    }

    // ============================================
    // Run & Manage Operations (v0.3.0+)
    // ============================================

    /**
     * Run application as a packaged app (v0.3.0+)
     */
    public async runPackagedApp(projectUri?: vscode.Uri): Promise<void> {
        const projectPath = projectUri ? path.dirname(projectUri.fsPath) :
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (!projectPath) {
            vscode.window.showErrorMessage('No project selected.');
            return;
        }

        // Ask for build output folder
        const folderUris = await vscode.window.showOpenDialog({
            defaultUri: vscode.Uri.file(projectPath),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Select build output folder',
            title: 'Select the folder containing your built app'
        });

        if (!folderUris || folderUris.length === 0) {
            return;
        }

        const inputFolder = folderUris[0].fsPath;

        // Ask for run options
        type RunModePick = vscode.QuickPickItem & {
            mode: 'wait' | 'detach' | 'debugOutput';
        };

        const runMode = await vscode.window.showQuickPick<RunModePick>(
            [
                { label: 'Run (wait for exit)', description: 'Launch and wait for the app to close', mode: 'wait' },
                { label: 'Run detached', description: 'Launch and return control immediately', mode: 'detach' },
                { label: 'Run with debug output', description: 'Capture OutputDebugString and crash dumps', mode: 'debugOutput' },
            ],
            { placeHolder: 'Select run mode' }
        );
        if (!runMode) { return; }

        const unregisterOnExit = await vscode.window.showQuickPick(
            ['Yes', 'No'],
            { placeHolder: 'Unregister package when app exits?' }
        );
        if (!unregisterOnExit) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Launching packaged app...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.run({
                    inputFolder,
                    detach: runMode.mode === 'detach',
                    debugOutput: runMode.mode === 'debugOutput',
                    unregisterOnExit: unregisterOnExit === 'Yes',
                }, projectPath);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to run packaged app: ${error}`);
            }
        });
    }

    /**
     * Unregister a sideloaded dev package (v0.3.0+)
     */
    public async unregisterPackage(projectUri?: vscode.Uri): Promise<void> {
        const projectPath = projectUri ? path.dirname(projectUri.fsPath) :
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (!projectPath) {
            vscode.window.showErrorMessage('No WinUI project selected or workspace folder open');
            return;
        }

        const packageName = await vscode.window.showInputBox({
            prompt: 'Enter the package name to unregister (leave empty to let the CLI discover it)',
            placeHolder: 'Package name (optional)',
            ignoreFocusOut: true
        });

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Unregistering dev package...',
            cancellable: false
        }, async () => {
            await this.winAppCli.unregister(packageName || undefined, projectPath);
        });
    }

    /**
     * Add an app execution alias to the manifest (v0.3.0+)
     */
    public async addManifestAlias(projectUri?: vscode.Uri): Promise<void> {
        const projectPath = projectUri ? path.dirname(projectUri.fsPath) :
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const alias = await vscode.window.showInputBox({
            prompt: 'Enter the app execution alias (e.g., "myapp")',
            placeHolder: 'myapp',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Alias cannot be empty';
                }
                if (/[^a-zA-Z0-9._-]/.test(value)) {
                    return 'Alias can only contain letters, numbers, dots, hyphens, and underscores';
                }
                return null;
            }
        });
        if (!alias) { return; }

        // Resolve manifest path from the project
        const manifestPath = projectPath ? await this.findManifest(projectPath) : undefined;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Adding app execution alias...',
            cancellable: false
        }, async () => {
            await this.winAppCli.manifestAddAlias(alias, manifestPath, projectPath);
        });
    }

    // ============================================
    // UI Automation Operations (v0.3.0+)
    // ============================================

    /**
     * List all visible windows (v0.3.0+)
     */
    public async uiListWindows(): Promise<void> {
        const appName = await vscode.window.showInputBox({
            prompt: 'Enter app name to filter (leave empty for all windows)',
            placeHolder: 'App name (optional)',
            ignoreFocusOut: true
        });

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Listing windows...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.uiListWindows(appName || undefined);
            if (result) {
                this.outputChannel.appendLine('--- Windows ---');
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Inspect UI tree of a running app (v0.3.0+)
     */
    public async uiInspect(): Promise<void> {
        const appName = await vscode.window.showInputBox({
            prompt: 'Enter the app name to inspect',
            placeHolder: 'App name',
            ignoreFocusOut: true
        });
        if (!appName) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Inspecting UI tree...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.uiInspect(appName);
            if (result) {
                this.outputChannel.appendLine(`--- UI Tree: ${appName} ---`);
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Take a screenshot of an app window (v0.3.0+)
     */
    public async uiScreenshot(): Promise<void> {
        const appName = await vscode.window.showInputBox({
            prompt: 'Enter the app name to screenshot',
            placeHolder: 'App name',
            ignoreFocusOut: true
        });
        if (!appName) { return; }

        const outputUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('screenshot.png'),
            filters: {
                'PNG Image': ['png']
            },
            title: 'Save Screenshot'
        });
        if (!outputUri) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Taking screenshot...',
            cancellable: false
        }, async () => {
            await this.winAppCli.uiScreenshot(appName, outputUri.fsPath);
        });
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
