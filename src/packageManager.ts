// WinDev Helper - Package Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AzureSignOptions, CertificateOptions, FindUiOptions, SignOptions, WinAppCli } from './winAppCli';
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
    public async restorePackages(projectUri?: vscode.Uri): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Restoring NuGet packages...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.restore(projectUri?.fsPath);
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

        // Supplying multiple input folders (one per architecture) produces an
        // MSIX bundle. Prompt for them when the user chose a .msixbundle output;
        // otherwise package the single project directory.
        let inputDirs: string[] = [projectDir];
        if (outputUri.fsPath.toLowerCase().endsWith('.msixbundle')) {
            const folderUris = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: true,
                defaultUri: vscode.Uri.file(projectDir),
                title: 'Select build-output folders to bundle (one per architecture)'
            });
            if (!folderUris || folderUris.length === 0) {
                return;
            }
            inputDirs = folderUris.map(u => u.fsPath);
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

                // Look for the manifest. When bundling, the user's selection order
                // is not guaranteed, so scan all input folders and use the first
                // that actually contains a manifest (falling back to the first folder).
                let manifestPath: string | undefined;
                for (const dir of inputDirs) {
                    manifestPath = await this.findManifest(dir);
                    if (manifestPath) {
                        break;
                    }
                }

                await this.winAppCli.package({
                    inputDirs,
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
     * Creates a sparse identity-only MSIX package from an app manifest
     * (winapp CLI v0.6.0+).
     */
    public async createSparsePackage(projectUri?: vscode.Uri): Promise<void> {
        if (!await this.ensureWinAppV060Support('Sparse MSIX packaging')) { return; }

        const projectDir = projectUri ? path.dirname(projectUri.fsPath) :
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const manifestDialogOptions: vscode.OpenDialogOptions = {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'App manifest': ['xml', 'appxmanifest']
            },
            title: 'Select sparse package appxmanifest.xml'
        };
        if (projectDir) {
            manifestDialogOptions.defaultUri = vscode.Uri.file(projectDir);
        }
        const manifestUris = await vscode.window.showOpenDialog(manifestDialogOptions);
        if (!manifestUris || manifestUris.length === 0) { return; }

        const manifestUri = manifestUris[0];
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(
                path.dirname(manifestUri.fsPath),
                'AppPackages',
                'SparsePackage.msix'
            )),
            filters: {
                'MSIX Package': ['msix']
            },
            title: 'Save Sparse MSIX Package'
        });
        if (!outputUri) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating sparse MSIX package...',
            cancellable: false
        }, async () => {
            await this.winAppCli.package({
                inputPaths: [manifestUri.fsPath],
                outputPath: outputUri.fsPath
            });
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
     * Sign a package or executable with Azure Trusted Signing (v0.6.0+).
     */
    public async azureSignPackage(): Promise<void> {
        if (!await this.ensureWinAppV060Support('Azure Trusted Signing')) { return; }

        const fileUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Signable files': ['exe', 'msix', 'msixbundle']
            },
            title: 'Select file to sign with Azure Trusted Signing'
        });
        if (!fileUris || fileUris.length === 0) { return; }

        type SigningConfigurationPick = vscode.QuickPickItem & {
            mode: 'metadata' | 'account';
        };
        const configuration = await vscode.window.showQuickPick<SigningConfigurationPick>([
            {
                label: 'Use metadata file',
                description: 'Use a prepared Azure Trusted Signing metadata.json file',
                mode: 'metadata'
            },
            {
                label: 'Specify signing account',
                description: 'Enter subscription, resource group, account, and certificate profile',
                mode: 'account'
            }
        ], {
            title: 'Azure Trusted Signing Configuration',
            placeHolder: 'Select how to identify the signing profile'
        });
        if (!configuration) { return; }

        let options: AzureSignOptions;
        if (configuration.mode === 'metadata') {
            const metadataUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Trusted Signing metadata': ['json']
                },
                title: 'Select Azure Trusted Signing metadata.json'
            });
            if (!metadataUris || metadataUris.length === 0) { return; }
            options = { metadataFile: metadataUris[0].fsPath };
        } else {
            const subscription = await this.promptRequiredInput('Enter Azure subscription ID', 'Subscription ID');
            if (!subscription) { return; }
            const resourceGroup = await this.promptRequiredInput('Enter Azure resource group name', 'Resource group');
            if (!resourceGroup) { return; }
            const account = await this.promptRequiredInput('Enter Azure Trusted Signing account name', 'Signing account');
            if (!account) { return; }
            const profile = await this.promptRequiredInput('Enter certificate profile name', 'Certificate profile');
            if (!profile) { return; }
            options = { subscription, resourceGroup, account, profile };
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Signing with Azure Trusted Signing...',
            cancellable: false
        }, async () => {
            await this.winAppCli.azureSign(fileUris[0].fsPath, options);
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

        type RunTargetPick = vscode.QuickPickItem & {
            mode: 'project' | 'folder';
        };
        const target = projectUri
            ? await vscode.window.showQuickPick<RunTargetPick>([
                {
                    label: 'Run current WinUI project',
                    description: 'Build and launch the active .csproj using winapp project mode',
                    mode: 'project'
                },
                {
                    label: 'Run build output folder',
                    description: 'Register and launch an existing loose package layout',
                    mode: 'folder'
                }
            ], {
                title: 'Run Target',
                placeHolder: 'Choose a project or existing build output'
            })
            : { mode: 'folder' as const };
        if (!target) { return; }

        let inputPath: string;
        let configuration: string | undefined;
        let architecture: 'x86' | 'x64' | 'arm64' | undefined;
        let noBuild = false;
        if (target.mode === 'project') {
            if (!await this.ensureWinAppV060Support('Project-mode run')) { return; }

            inputPath = projectUri!.fsPath;
            const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
            const defaultConfiguration = config.get<string>(CONFIG.DEFAULT_CONFIGURATION, DEFAULTS.CONFIGURATION);
            type ConfigurationPick = vscode.QuickPickItem & { value: 'Debug' | 'Release' };
            const configurationItems: ConfigurationPick[] = [
                { label: 'Debug', value: 'Debug' },
                { label: 'Release', value: 'Release' }
            ];
            configurationItems.sort((left, right) => Number(right.value === defaultConfiguration) - Number(left.value === defaultConfiguration));
            const configurationChoice = await vscode.window.showQuickPick<ConfigurationPick>(configurationItems, {
                title: 'Project Build Configuration',
                placeHolder: `Select configuration (configured default listed first: ${defaultConfiguration})`
            });
            if (!configurationChoice) { return; }
            configuration = configurationChoice.value;

            const defaultPlatform = config.get<string>(CONFIG.DEFAULT_PLATFORM, DEFAULTS.PLATFORM);
            const defaultArchitecture = defaultPlatform === 'ARM64' ? 'arm64' : defaultPlatform;
            type ArchitecturePick = vscode.QuickPickItem & { value: 'x86' | 'x64' | 'arm64' };
            const architectureItems: ArchitecturePick[] = [
                { label: 'x86', value: 'x86' },
                { label: 'x64', value: 'x64' },
                { label: 'arm64', value: 'arm64' }
            ];
            architectureItems.sort((left, right) => Number(right.value === defaultArchitecture) - Number(left.value === defaultArchitecture));
            const architectureChoice = await vscode.window.showQuickPick<ArchitecturePick>(architectureItems, {
                title: 'Project Architecture',
                placeHolder: `Select architecture (configured default listed first: ${defaultPlatform})`
            });
            if (!architectureChoice) { return; }
            architecture = architectureChoice.value;

            const buildChoice = await vscode.window.showQuickPick(['Build and run', 'Run existing output'], {
                title: 'Project Build Step',
                placeHolder: 'Build the project before launching?'
            });
            if (!buildChoice) { return; }
            noBuild = buildChoice === 'Run existing output';
        } else {
            const folderUris = await vscode.window.showOpenDialog({
                defaultUri: vscode.Uri.file(projectPath),
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select build output folder',
                title: 'Select the folder containing your built app'
            });
            if (!folderUris || folderUris.length === 0) { return; }
            inputPath = folderUris[0].fsPath;
        }

        // Ask for run options
        type RunModePick = vscode.QuickPickItem & {
            mode: 'wait' | 'detach' | 'debugOutput';
        };

        const runMode = await vscode.window.showQuickPick<RunModePick>(
            [
                { label: 'Run (wait for exit)', description: 'Launch and wait for the app to close', mode: 'wait' },
                { label: 'Run detached', description: 'Launch and return control immediately', mode: 'detach' },
                { label: 'Run with debug output', description: 'Capture diagnostics and automatically triage WinUI crashes', mode: 'debugOutput' },
            ],
            { placeHolder: 'Select run mode' }
        );
        if (!runMode) { return; }

        const unregisterOnExit = await vscode.window.showQuickPick(
            ['Yes', 'No'],
            { placeHolder: 'Unregister package when app exits?' }
        );
        if (!unregisterOnExit) { return; }

        let symbols = false;
        if (runMode.mode === 'debugOutput') {
            const symbolsChoice = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Download symbols for fully resolved crash diagnostics?',
                title: 'Resolve Debug Symbols'
            });
            if (!symbolsChoice) { return; }
            symbols = symbolsChoice === 'Yes';
        }

        // v0.3.1+: optional application arguments forwarded after `--`.
        // Only prompt when the installed CLI actually supports the passthrough
        // syntax so users on older CLIs aren't given an unsupported option.
        let appArgs: string[] = [];
        if (await this.winAppCli.supportsRunAppArgs()) {
            const appArgsInput = await vscode.window.showInputBox({
                prompt: 'Optional application arguments (forwarded after --). Quote values with spaces; use \\" or \\\\ to escape. Leave empty for none.',
                placeHolder: '--my-flag value',
                ignoreFocusOut: true
            });
            if (appArgsInput === undefined) { return; }
            appArgs = this.parseAppArgs(appArgsInput);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Launching packaged app...',
            cancellable: false
        }, async () => {
            try {
                await this.winAppCli.run({
                    inputPath,
                    detach: runMode.mode === 'detach',
                    debugOutput: runMode.mode === 'debugOutput',
                    symbols,
                    unregisterOnExit: unregisterOnExit === 'Yes',
                    ...(configuration && { configuration }),
                    ...(architecture && { architecture }),
                    ...(noBuild && { noBuild }),
                    ...(appArgs.length > 0 ? { appArgs } : {}),
                }, projectPath);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to run packaged app: ${error}`);
            }
        });
    }

    /**
     * Tokenize a free-form argument string into argv entries.
     *
     * Rules:
     * - Whitespace separates tokens.
     * - Single (`'`) and double (`"`) quotes group characters into a single
     *   token, including empty strings (e.g. `--name ""` yields two tokens).
     * - Inside double quotes, `\"`, `\\`, and `\'` are recognised as escape
     *   sequences so users can include literal quote characters in a value.
     *   Other backslash sequences are passed through as-is.
     * - Single-quoted segments are treated literally (no escape processing),
     *   matching common POSIX shell behaviour.
     */
    private parseAppArgs(input: string): string[] {
        const trimmed = input.trim();
        if (!trimmed) {
            return [];
        }

        const tokens: string[] = [];
        let current = '';
        let hasToken = false; // true once we have started a token (incl. empty quoted)
        let quote: '"' | "'" | null = null;

        const flush = () => {
            if (hasToken) {
                tokens.push(current);
            }
            current = '';
            hasToken = false;
        };

        for (let i = 0; i < trimmed.length; i++) {
            const ch = trimmed[i];

            if (quote === '"') {
                if (ch === '\\' && i + 1 < trimmed.length) {
                    const next = trimmed[i + 1];
                    if (next === '"' || next === '\\' || next === "'") {
                        current += next;
                        i++;
                        continue;
                    }
                }
                if (ch === '"') {
                    quote = null;
                    continue;
                }
                current += ch;
                continue;
            }

            if (quote === "'") {
                if (ch === "'") {
                    quote = null;
                    continue;
                }
                current += ch;
                continue;
            }

            if (ch === '"' || ch === "'") {
                quote = ch;
                hasToken = true; // even an empty quoted string counts as a token
                continue;
            }
            if (ch === ' ' || ch === '\t') {
                flush();
                continue;
            }
            current += ch;
            hasToken = true;
        }
        flush();
        return tokens;
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

        let showHidden = false;
        if (await this.winAppCli.supportsUiV040Features()) {
            const showHiddenChoice = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Include hidden/untitled zero-size windows?',
                title: 'List Hidden Windows'
            });
            if (!showHiddenChoice) { return; }
            showHidden = showHiddenChoice === 'Yes';
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Listing windows...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.uiListWindows(appName || undefined, showHidden);
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

        // v0.3.2+: optionally bring the target window to the foreground first.
        let focus = false;
        if (await this.winAppCli.supportsScreenshotFocus()) {
            const focusChoice = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Bring the window to the foreground before capturing?',
                title: 'Screenshot Focus'
            });
            if (!focusChoice) { return; }
            focus = focusChoice === 'Yes';
        }

        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const saveDialogOptions: vscode.SaveDialogOptions = {
            filters: {
                'PNG Image': ['png']
            },
            title: 'Save Screenshot'
        };

        if (workspaceUri) {
            saveDialogOptions.defaultUri = vscode.Uri.joinPath(workspaceUri, 'screenshot.png');
        }

        const outputUri = await vscode.window.showSaveDialog(saveDialogOptions);
        if (!outputUri) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Taking screenshot...',
            cancellable: false
        }, async () => {
            await this.winAppCli.uiScreenshot(appName, outputUri.fsPath, focus);
        });
    }

    /**
     * Hover over a UI element to trigger tooltip/flyout behavior (v0.4.0+)
     */
    public async uiHover(): Promise<void> {
        const v = await this.winAppCli.getVersion();
        if (!v) {
            vscode.window.showWarningMessage('Unable to determine winapp CLI version. Ensure winapp CLI is installed and v0.4.0 or newer is available.');
            return;
        }
        if (v.major === 0 && v.minor < 4) {
            vscode.window.showWarningMessage('UI hover requires winapp CLI v0.4.0 or newer.');
            return;
        }

        const selector = await vscode.window.showInputBox({
            prompt: 'Enter UI selector (semantic slug or text)',
            placeHolder: 'btn-minimize-d1a0',
            ignoreFocusOut: true,
            validateInput: (value) => value.trim() ? null : 'Selector is required'
        });
        if (!selector) { return; }

        const appName = await vscode.window.showInputBox({
            prompt: 'Enter app name to target (optional)',
            placeHolder: 'App name (optional)',
            ignoreFocusOut: true
        });

        const dwellInput = await vscode.window.showInputBox({
            prompt: 'Hover dwell time in milliseconds (optional, default 800)',
            placeHolder: '800',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value.trim()) { return null; }
                const num = Number(value);
                if (!Number.isInteger(num) || num < 0) {
                    return 'Enter a non-negative whole number';
                }
                return null;
            }
        });
        if (dwellInput === undefined) { return; }
        const dwellTime = dwellInput.trim() ? Number(dwellInput) : undefined;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Hovering UI element...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.uiHover(selector.trim(), appName?.trim() || undefined, dwellTime);
            if (result) {
                this.outputChannel.appendLine(`--- Hover Result: ${selector.trim()} ---`);
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Send keyboard input to a running app or a specific UI element (v0.5.0+).
     */
    public async uiSendKeys(): Promise<void> {
        if (!await this.ensureUiV050Support()) { return; }

        const keys = await vscode.window.showInputBox({
            prompt: 'Enter text, keys, or chords to send',
            placeHolder: 'ctrl+a delete',
            ignoreFocusOut: true,
            validateInput: value => value.trim().length > 0 ? null : 'Keys or text are required'
        });
        if (keys === undefined || keys.trim().length === 0) { return; }

        const appName = await vscode.window.showInputBox({
            prompt: 'Enter app name to target (optional)',
            placeHolder: 'App name (optional)',
            ignoreFocusOut: true
        });
        if (appName === undefined) { return; }

        const target = await vscode.window.showInputBox({
            prompt: 'Enter a target UI selector (optional)',
            placeHolder: 'txt-name-a1b2',
            ignoreFocusOut: true
        });
        if (target === undefined) { return; }

        type TransportPick = vscode.QuickPickItem & {
            transport: 'post-message' | 'send-input';
        };
        const transport = await vscode.window.showQuickPick<TransportPick>([
            {
                label: 'Send input',
                description: 'Recommended for WinUI; sends real OS keyboard input',
                transport: 'send-input'
            },
            {
                label: 'Post message',
                description: 'Window-scoped; intended for classic Win32 and WinForms controls',
                transport: 'post-message'
            }
        ], {
            placeHolder: 'Select keyboard input transport',
            title: 'Send Keys Transport'
        });
        if (!transport) { return; }

        let allowSystemKeys = false;
        if (transport.transport === 'send-input') {
            const systemKeysChoice = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Allow system-level key combinations?',
                title: 'Allow System Keys'
            });
            if (!systemKeysChoice) { return; }
            allowSystemKeys = systemKeysChoice === 'Yes';
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Sending keyboard input...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.uiSendKeys(
                keys,
                transport.transport,
                appName.trim() || undefined,
                target.trim() || undefined,
                allowSystemKeys
            );
            if (result) {
                this.outputChannel.appendLine('--- Send Keys Result ---');
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Click a UI element in a running app (v0.5.0+).
     */
    public async uiClick(): Promise<void> {
        if (!await this.ensureUiV050Support()) { return; }

        const selector = await vscode.window.showInputBox({
            prompt: 'Enter UI selector to click',
            placeHolder: 'btn-submit-a1b2',
            ignoreFocusOut: true,
            validateInput: value => value.trim() ? null : 'Selector is required'
        });
        if (!selector) { return; }

        const appName = await vscode.window.showInputBox({
            prompt: 'Enter app name to target (optional)',
            placeHolder: 'App name (optional)',
            ignoreFocusOut: true
        });
        if (appName === undefined) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Clicking UI element...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.uiClick(selector.trim(), appName.trim() || undefined);
            if (result) {
                this.outputChannel.appendLine(`--- Click Result: ${selector.trim()} ---`);
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Set the value of an editable UI element (v0.5.0+).
     */
    public async uiSetValue(): Promise<void> {
        if (!await this.ensureUiV050Support()) { return; }

        const selector = await vscode.window.showInputBox({
            prompt: 'Enter UI selector for the editable element',
            placeHolder: 'txt-name-a1b2',
            ignoreFocusOut: true,
            validateInput: value => value.trim() ? null : 'Selector is required'
        });
        if (!selector) { return; }

        const value = await vscode.window.showInputBox({
            prompt: 'Enter the value to set (leave empty to clear the control)',
            placeHolder: 'Value',
            ignoreFocusOut: true
        });
        if (value === undefined) { return; }

        const appName = await vscode.window.showInputBox({
            prompt: 'Enter app name to target (optional)',
            placeHolder: 'App name (optional)',
            ignoreFocusOut: true
        });
        if (appName === undefined) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Setting UI element value...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.uiSetValue(selector.trim(), value, appName.trim() || undefined);
            if (result) {
                this.outputChannel.appendLine(`--- Set Value Result: ${selector.trim()} ---`);
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    /**
     * Record a running app interaction session to an MP4 file (v0.5.0+).
     */
    public async uiRecord(): Promise<void> {
        if (!await this.ensureUiV050Support()) { return; }

        const appName = await vscode.window.showInputBox({
            prompt: 'Enter the app name to record',
            placeHolder: 'App name',
            ignoreFocusOut: true,
            validateInput: value => value.trim() ? null : 'App name is required'
        });
        if (!appName) { return; }

        const durationInput = await vscode.window.showInputBox({
            prompt: 'Enter recording duration in seconds',
            value: '10',
            ignoreFocusOut: true,
            validateInput: value => {
                const duration = Number(value);
                return Number.isInteger(duration) && duration > 0 ? null : 'Enter a positive whole number';
            }
        });
        if (!durationInput) { return; }

        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const saveDialogOptions: vscode.SaveDialogOptions = {
            filters: {
                'MP4 Video': ['mp4']
            },
            title: 'Save UI Recording'
        };
        if (workspaceUri) {
            saveDialogOptions.defaultUri = vscode.Uri.joinPath(workspaceUri, 'recording.mp4');
        }

        const outputUri = await vscode.window.showSaveDialog(saveDialogOptions);
        if (!outputUri) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Recording app interaction...',
            cancellable: false
        }, async () => {
            await this.winAppCli.uiRecord(appName.trim(), Number(durationInput), outputUri.fsPath);
        });
    }

    /**
     * Search the WinUI Gallery, Community Toolkit, Reactor Gallery, or core
     * patterns for controls and working samples (v0.6.0+).
     */
    public async findUi(): Promise<void> {
        if (!await this.ensureWinAppV060Support('Find WinUI Controls & Samples')) { return; }

        const query = await vscode.window.showInputBox({
            prompt: 'Describe the WinUI control or sample you need',
            placeHolder: 'tabbed layout',
            ignoreFocusOut: true,
            validateInput: value => value.trim() ? null : 'A search query is required'
        });
        if (!query?.trim()) { return; }

        type SourcePick = vscode.QuickPickItem & {
            source?: FindUiOptions['source'];
        };
        const source = await vscode.window.showQuickPick<SourcePick>([
            { label: 'All WinUI sources', description: 'Search Gallery and Community Toolkit', source: undefined },
            { label: 'WinUI 3 Gallery', source: 'gallery' },
            { label: 'Windows Community Toolkit', source: 'toolkit' },
            { label: 'Core patterns', description: 'Built-in patterns; works offline', source: 'core' },
            { label: 'Microsoft.UI.Reactor Gallery', description: 'C#-only samples for Reactor/MVU projects', source: 'reactor' }
        ], {
            title: 'Find WinUI Controls & Samples',
            placeHolder: 'Choose a sample source'
        });
        if (!source) { return; }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Searching WinUI controls and samples...',
            cancellable: false
        }, async () => {
            const result = await this.winAppCli.findUi(query, {
                ...(source.source && { source: source.source })
            });
            if (result) {
                this.outputChannel.appendLine(`--- Find UI: ${query.trim()} ---`);
                this.outputChannel.appendLine(result);
                this.outputChannel.show();
            }
        });
    }

    private async ensureWinAppV060Support(feature: string): Promise<boolean> {
        const version = await this.winAppCli.getVersion();
        if (version && ((version.major > 0) || (version.major === 0 && version.minor >= 6))) {
            return true;
        }

        const message = version
            ? `${feature} requires winapp CLI v0.6.0 or newer.`
            : `Unable to determine winapp CLI version. Ensure winapp CLI v0.6.0 or newer is installed.`;
        vscode.window.showWarningMessage(message);
        return false;
    }

    private async promptRequiredInput(prompt: string, placeHolder: string): Promise<string | undefined> {
        const value = await vscode.window.showInputBox({
            prompt,
            placeHolder,
            ignoreFocusOut: true,
            validateInput: input => input.trim() ? null : `${placeHolder} is required`
        });
        return value?.trim() || undefined;
    }

    private async ensureUiV050Support(): Promise<boolean> {
        const version = await this.winAppCli.getVersion();
        if (version && ((version.major > 0) || (version.major === 0 && version.minor >= 5))) {
            return true;
        }

        const message = version
            ? 'This UI automation command requires winapp CLI v0.5.0 or newer.'
            : 'Unable to determine winapp CLI version. Ensure winapp CLI v0.5.0 or newer is installed.';
        vscode.window.showWarningMessage(message);
        return false;
    }

    // ============================================
    // Parity commands with the official Microsoft WinApp VS Code extension
    // ============================================

    /**
     * Auto-generate all required app icon assets from a single source image
     * (PNG, JPG, GIF, BMP, or SVG). Wraps `winapp manifest update-assets`.
     */
    public async manifestUpdateAssets(projectUri?: vscode.Uri): Promise<void> {
        const projectPath = projectUri ? path.dirname(projectUri.fsPath) :
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const imageUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Source images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg']
            },
            title: 'Select source image to generate manifest assets from'
        });
        if (!imageUris || imageUris.length === 0) { return; }

        const manifestPath = projectPath ? await this.findManifest(projectPath) : undefined;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating manifest assets...',
            cancellable: false
        }, async () => {
            await this.winAppCli.manifestUpdateAssets(imageUris[0].fsPath, manifestPath, projectPath);
        });
    }

    /**
     * Run a Windows SDK tool (makeappx, signtool, mt, makepri) with custom
     * arguments. Wraps `winapp tool <name> -- <args>`.
     */
    public async runSdkTool(): Promise<void> {
        const toolName = await vscode.window.showQuickPick(
            [
                { label: 'makeappx', description: 'Create or extract MSIX packages' },
                { label: 'signtool', description: 'Sign packages and executables' },
                { label: 'mt', description: 'Manifest tool' },
                { label: 'makepri', description: 'Build the package resource index' },
            ],
            { placeHolder: 'Select an SDK tool to run' }
        );
        if (!toolName) { return; }

        const argsInput = await vscode.window.showInputBox({
            prompt: `Arguments to pass to ${toolName.label} (leave empty for help)`,
            placeHolder: '/?',
            ignoreFocusOut: true
        });
        if (argsInput === undefined) { return; }

        const args = this.parseAppArgs(argsInput);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Running ${toolName.label}...`,
            cancellable: false
        }, async () => {
            try {
                const output = await this.winAppCli.tool(toolName.label, args);
                if (output) {
                    this.outputChannel.appendLine(`--- ${toolName.label} output ---`);
                    this.outputChannel.appendLine(output);
                    this.outputChannel.show();
                }
            } catch (error) {
                vscode.window.showErrorMessage(`${toolName.label} failed: ${error}`);
            }
        });
    }

    /**
     * Display paths to installed SDK components (winapp get-winapp-path).
     */
    public async getWinAppPath(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Resolving WinApp SDK paths...',
            cancellable: false
        }, async () => {
            try {
                const output = await this.winAppCli.getSdkPaths();
                if (output) {
                    this.outputChannel.appendLine('--- WinApp SDK paths ---');
                    this.outputChannel.appendLine(output);
                    this.outputChannel.show();
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to resolve SDK paths: ${error}`);
            }
        });
    }

    /**
     * Scaffold .vscode/launch.json and .vscode/tasks.json with the recommended
     * `winapp` debug configuration and a build pre-launch task. Mirrors the
     * sample shown in the Microsoft WinApp VS Code extension blog post.
     */
    public async configureWinAppDebug(projectUri?: vscode.Uri): Promise<void> {
        const workspaceFolder = projectUri
            ? vscode.workspace.getWorkspaceFolder(projectUri)
            : vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder is open. Open a folder first.');
            return;
        }

        const projectKindPick = await vscode.window.showQuickPick(
            [
                { label: '.NET (C# / WinUI 3 / WPF / WinForms)', value: 'dotnet' as const, description: 'Uses `dotnet build` and the C# debugger (coreclr)' },
                { label: 'C / C++ (CMake or MSBuild)', value: 'cpp' as const, description: 'Uses MSBuild and the cppvsdbg debugger' },
                { label: 'Node.js / Electron', value: 'node' as const, description: 'Uses npm/yarn build and the node debugger' },
                { label: 'Other (no preLaunchTask)', value: 'other' as const, description: 'Just adds the winapp debug config' },
            ],
            { placeHolder: 'Select your project type' }
        );
        if (!projectKindPick) { return; }

        const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
        try {
            await fs.promises.mkdir(vscodeDir, { recursive: true });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create .vscode folder: ${error}`);
            return;
        }

        const buildTaskLabel = 'winapp: build';

        const buildTask = this.buildTaskForKind(projectKindPick.value, buildTaskLabel);

        const launchConfig: Record<string, unknown> = {
            type: 'winapp',
            request: 'launch',
            name: 'WinApp: Launch and Attach',
        };

        if (buildTask) {
            launchConfig.preLaunchTask = buildTaskLabel;
        }

        switch (projectKindPick.value) {
            case 'cpp':
                launchConfig.debuggerType = 'cppvsdbg';
                break;
            case 'node':
                launchConfig.debuggerType = 'node';
                break;
            // dotnet/other use the default coreclr debugger
        }

        try {
            const launchPath = path.join(vscodeDir, 'launch.json');
            await this.mergeJsonArrayFile(launchPath, {
                version: '0.2.0',
                configurations: [],
            }, 'configurations', launchConfig, (existing) => existing.name === launchConfig.name);

            if (buildTask) {
                const tasksPath = path.join(vscodeDir, 'tasks.json');
                await this.mergeJsonArrayFile(tasksPath, {
                    version: '2.0.0',
                    tasks: [],
                }, 'tasks', buildTask, (existing) => existing.label === buildTaskLabel);
            }

            const action = await vscode.window.showInformationMessage(
                buildTask
                    ? 'WinApp debug configuration and build task added to .vscode/launch.json and .vscode/tasks.json.'
                    : 'WinApp debug configuration added to .vscode/launch.json.',
                'Open launch.json'
            );

            if (action === 'Open launch.json') {
                const doc = await vscode.workspace.openTextDocument(path.join(vscodeDir, 'launch.json'));
                await vscode.window.showTextDocument(doc);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write debug configuration: ${error}`);
        }
    }

    /**
     * Returns the recommended pre-launch build task for the given project
     * kind, or `undefined` when no automated build is appropriate.
     */
    private buildTaskForKind(kind: 'dotnet' | 'cpp' | 'node' | 'other', label: string): Record<string, unknown> | undefined {
        switch (kind) {
            case 'dotnet':
                return {
                    label,
                    command: 'dotnet',
                    type: 'process',
                    args: ['build', '${workspaceFolder}'],
                    problemMatcher: '$msCompile',
                    group: { kind: 'build', isDefault: true },
                };
            case 'cpp':
                return {
                    label,
                    command: 'msbuild',
                    type: 'process',
                    args: ['${workspaceFolder}', '/t:Build', '/p:Configuration=Debug'],
                    problemMatcher: '$msCompile',
                    group: { kind: 'build', isDefault: true },
                };
            case 'node':
                return {
                    label,
                    command: 'npm',
                    type: 'shell',
                    args: ['run', 'build'],
                    problemMatcher: [],
                    group: { kind: 'build', isDefault: true },
                };
            case 'other':
            default:
                return undefined;
        }
    }

    /**
     * Read or create a JSON file shaped as `{ <arrayKey>: [...] }`, then
     * append `entry` to the array unless an existing element already matches
     * `matches(existing)`. Preserves any unrelated keys in the file.
     */
    private async mergeJsonArrayFile(
        filePath: string,
        defaultShape: Record<string, unknown>,
        arrayKey: string,
        entry: Record<string, unknown>,
        matches: (existing: Record<string, unknown>) => boolean
    ): Promise<void> {
        let parsed: Record<string, unknown> = { ...defaultShape };

        try {
            const raw = await fs.promises.readFile(filePath, 'utf-8');
            const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"])\/\/.*$/gm, '$1');
            const existing = JSON.parse(stripped);
            if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
                parsed = existing as Record<string, unknown>;
            }
        } catch {
            // File missing or unparseable — fall back to the default shape.
        }

        const list = Array.isArray(parsed[arrayKey])
            ? (parsed[arrayKey] as Record<string, unknown>[])
            : [];

        const alreadyPresent = list.some(matches);
        if (!alreadyPresent) {
            list.push(entry);
        }
        parsed[arrayKey] = list;

        if (parsed.version === undefined && defaultShape.version !== undefined) {
            parsed.version = defaultShape.version;
        }

        await fs.promises.writeFile(filePath, JSON.stringify(parsed, null, 4) + '\n', 'utf-8');
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
