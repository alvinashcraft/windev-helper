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
                const options: CertificateOptions = {
                    subjectName: subjectName,
                    outputPath: outputUri.fsPath,
                    password: password
                };

                await this.winAppCli.generateCertificate(options);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate certificate: ${error}`);
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

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
