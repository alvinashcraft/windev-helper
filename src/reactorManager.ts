// WinDev Helper - Reactor Manager
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import { CONFIG, EXTERNAL_URLS, OUTPUT_CHANNELS } from './constants';

/**
 * Light-touch integration for Microsoft.UI.Reactor — a declarative,
 * component-based C# framework for building WinUI 3 desktop apps without XAML
 * (https://microsoft.github.io/microsoft-ui-reactor/).
 *
 * Reactor is experimental and does not ship a signed NuGet package yet, so the
 * framework, the `mur` CLI, and the `dotnet new reactorapp` template are built
 * from source via the repository's `bootstrap.ps1`. This manager helps users
 * run that bootstrap, scaffold a Reactor app once the template is registered,
 * open the documentation, and install the Reactor agent plugin for AI coding
 * hosts. It deliberately does not bundle or ship any Reactor binaries.
 */
export class ReactorManager {
    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.REACTOR);
    }

    /**
     * Scaffolds a new Reactor app using `dotnet new reactorapp`. If the
     * template is not registered, offers to run the bootstrap that installs it.
     */
    public async createReactorApp(): Promise<void> {
        if (!(await this.isReactorTemplateInstalled())) {
            const action = await vscode.window.showWarningMessage(
                'The `reactorapp` template is not installed. Reactor is experimental and is built from source — run the bootstrap to install the template and the `mur` CLI.',
                'Run Bootstrap',
                'Open Docs',
                'Cancel',
            );
            if (action === 'Run Bootstrap') {
                await this.runBootstrap();
            } else if (action === 'Open Docs') {
                await this.openDocs();
            }
            return;
        }

        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter Reactor app name',
            placeHolder: 'MyReactorApp',
            validateInput: (value) => {
                if (!value) {
                    return 'Project name is required';
                }
                if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
                    return 'Project name must start with a letter and contain only letters, numbers, and underscores';
                }
                return undefined;
            },
        });

        if (!projectName) {
            return;
        }

        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select folder for new Reactor app',
        });

        if (!folderUri || folderUri.length === 0) {
            return;
        }

        const targetDir = folderUri[0].fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating Reactor app: ${projectName}...`,
            cancellable: false,
        }, async () => {
            try {
                await this.executeCommand(`dotnet new reactorapp -n ${projectName}`, targetDir);

                // The template may create a subfolder named after the project.
                const subfolderPath = path.join(targetDir, projectName);
                const projectPath = fs.existsSync(subfolderPath) ? subfolderPath : targetDir;

                const action = await vscode.window.showInformationMessage(
                    `Reactor app '${projectName}' created successfully.`,
                    'Open Project',
                    'Open in New Window',
                );

                if (action === 'Open Project') {
                    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), false);
                } else if (action === 'Open in New Window') {
                    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), true);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create Reactor app: ${error}`);
            }
        });
    }

    /**
     * Guides the user through running the Reactor `bootstrap.ps1`, which packs
     * the `mur` CLI as a global tool, packs the framework + templates into
     * `local-nupkgs/`, registers the `dotnet new reactorapp` template, and
     * installs the Reactor agent plugin.
     *
     * The bootstrap runs from a clone of the Reactor repository. The user
     * points at an existing clone via `windevHelper.reactor.repoPath`, picks a
     * folder, or is sent to the repo to clone it first. Cloning is never done
     * destructively on the user's behalf.
     */
    public async runBootstrap(): Promise<void> {
        const repoPath = await this.resolveRepoPath();
        if (!repoPath) {
            return;
        }

        const bootstrap = path.join(repoPath, 'bootstrap.ps1');
        if (!fs.existsSync(bootstrap)) {
            const action = await vscode.window.showErrorMessage(
                `Could not find bootstrap.ps1 in '${repoPath}'. Make sure this is a clone of microsoft/microsoft-ui-reactor.`,
                'Open Repo',
            );
            if (action === 'Open Repo') {
                await vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.REACTOR_REPO));
            }
            return;
        }

        this.outputChannel.show(true);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('=== Reactor Bootstrap ===');
        this.outputChannel.appendLine(`Running bootstrap.ps1 in: ${repoPath}`);
        this.outputChannel.appendLine('This packs the `mur` CLI, the framework + templates, registers the');
        this.outputChannel.appendLine('`dotnet new reactorapp` template, and installs the Reactor agent plugin.');
        this.outputChannel.appendLine('Verify the install afterwards with: mur doctor');
        this.outputChannel.appendLine('');

        // Reactor's bootstrap is a PowerShell script. Run it in a terminal so
        // the user sees progress and any prompts. `pwsh`/`powershell` resolve
        // on PATH on Windows; the recommended invocation bypasses execution
        // policy for the single script without changing machine policy.
        const terminal = vscode.window.createTerminal({ name: 'Reactor Bootstrap', cwd: repoPath });
        terminal.show();
        terminal.sendText('powershell -ExecutionPolicy Bypass -File ./bootstrap.ps1');
    }

    /**
     * Opens the Reactor documentation site in the default browser.
     */
    public async openDocs(): Promise<void> {
        await vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.REACTOR_DOCS));
    }

    /**
     * Installs the Reactor agent plugin for AI coding hosts (GitHub Copilot CLI
     * or Claude Code). The plugin lives under `plugins/reactor` in the Reactor
     * repository; `bootstrap.ps1` installs it automatically, but this command
     * lets users (re)install it directly.
     */
    public async installReactorPlugin(): Promise<void> {
        const marketplaceCommand = 'copilot plugin marketplace add microsoft/microsoft-ui-reactor';
        const installCommand = 'copilot plugin install reactor@microsoft-ui-reactor';

        const choice = await vscode.window.showInformationMessage(
            'Install the Reactor agent plugin for the GitHub Copilot CLI? This opens a terminal and runs the plugin install commands.',
            { modal: false },
            'Install in Terminal',
            'Copy Commands',
            'Open Docs',
        );

        if (!choice) { return; }

        if (choice === 'Open Docs') {
            await this.openDocs();
            return;
        }

        if (choice === 'Copy Commands') {
            await vscode.env.clipboard.writeText(`${marketplaceCommand}\n${installCommand}`);
            vscode.window.showInformationMessage('Reactor plugin install commands copied to clipboard.');
            return;
        }

        this.outputChannel.show(true);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('=== Reactor Agent Plugin ===');
        this.outputChannel.appendLine('Running the Copilot CLI plugin install commands in a new terminal:');
        this.outputChannel.appendLine(`    ${marketplaceCommand}`);
        this.outputChannel.appendLine(`    ${installCommand}`);
        this.outputChannel.appendLine('Note: running bootstrap.ps1 also installs the Reactor agent plugin.');
        this.outputChannel.appendLine('');

        const terminal = vscode.window.createTerminal({ name: 'Reactor Plugin' });
        terminal.show();
        terminal.sendText(marketplaceCommand);
        terminal.sendText(installCommand);
    }

    /**
     * Resolves the path to a local clone of the Reactor repository, preferring
     * the `windevHelper.reactor.repoPath` setting and otherwise prompting the
     * user to pick a folder (or open the repo to clone it first).
     */
    private async resolveRepoPath(): Promise<string | undefined> {
        const configured = vscode.workspace
            .getConfiguration(CONFIG.SECTION)
            .get<string>(CONFIG.REACTOR_REPO_PATH, '')
            .trim();

        if (configured && fs.existsSync(path.join(configured, 'bootstrap.ps1'))) {
            return configured;
        }

        const choice = await vscode.window.showInformationMessage(
            'Reactor is built from a clone of microsoft/microsoft-ui-reactor. Select your local clone, or open the repository to clone it first.',
            'Select Clone Folder',
            'Open Repo to Clone',
        );

        if (choice === 'Open Repo to Clone') {
            await vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.REACTOR_REPO));
            return undefined;
        }

        if (choice !== 'Select Clone Folder') {
            return undefined;
        }

        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select your microsoft-ui-reactor clone',
        });

        return folderUri?.[0]?.fsPath;
    }

    /**
     * Returns true when the `reactorapp` template is registered with
     * `dotnet new` (the bootstrap installs it from `local-nupkgs/`).
     */
    private async isReactorTemplateInstalled(): Promise<boolean> {
        try {
            const output = await this.executeCommand('dotnet new list reactorapp', undefined, true);
            return /reactorapp/i.test(output);
        } catch {
            return false;
        }
    }

    /**
     * Executes a command, optionally silently. Mirrors the helper used by the
     * template manager so output is surfaced consistently.
     */
    private executeCommand(command: string, cwd?: string, silent: boolean = false): Promise<string> {
        return new Promise((resolve, reject) => {
            const workingDir = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            if (!silent) {
                this.outputChannel.appendLine(`> ${command}`);
                this.outputChannel.show();
            }

            cp.exec(command, { cwd: workingDir }, (error, stdout, stderr) => {
                if (!silent) {
                    if (stdout) {
                        this.outputChannel.appendLine(stdout);
                    }
                    if (stderr) {
                        this.outputChannel.appendLine(stderr);
                    }
                }

                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * Disposes the output channel.
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
