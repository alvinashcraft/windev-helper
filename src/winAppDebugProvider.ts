// WinDev Helper - WinApp Debug Configuration Provider
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RunOptions, WinAppCli } from './winAppCli';
import { DEBUG_TYPES, OUTPUT_CHANNELS } from './constants';

interface WinAppDebugConfiguration extends vscode.DebugConfiguration {
    input?: string;
    inputFolder?: string;
    manifest?: string;
    debuggerType?: 'coreclr' | 'cppvsdbg' | 'node';
    workingDirectory?: string;
    args?: string | string[];
    outputAppxDirectory?: string;
    project?: string;
    configuration?: string;
    arch?: 'x86' | 'x64' | 'arm64';
    framework?: string;
    runtime?: string;
    properties?: Record<string, string>;
    noBuild?: boolean;
    noRestore?: boolean;
    aot?: boolean;
    clean?: boolean;
    executable?: string;
}

/** Launches projects or existing layouts with identity, then attaches to the CLI-reported PID. */
export class WinAppDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    private readonly outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.WINAPP_DEBUG);

    constructor(private readonly winAppCli: WinAppCli) {}

    /** Provides an F5 configuration without requiring a launch.json file. */
    public provideDebugConfigurations(): vscode.DebugConfiguration[] {
        return [{ type: DEBUG_TYPES.WINAPP, request: 'launch', name: 'WinApp: Launch and Attach' }];
    }

    /** Supplies defaults before VS Code substitutes workspace variables. */
    public resolveDebugConfiguration(
        _folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration
    ): vscode.DebugConfiguration {
        if (!config.type && !config.request && !config.name) {
            Object.assign(config, this.provideDebugConfigurations()[0]);
        }
        return config;
    }

    /** Builds and launches via winapp; the child session owns the actual debugger. */
    public async resolveDebugConfigurationWithSubstitutedVariables(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | undefined> {
        if (config.type !== DEBUG_TYPES.WINAPP) { return config; }
        if (process.platform !== 'win32') {
            void vscode.window.showErrorMessage('WinApp debugging requires Windows.');
            return undefined;
        }
        const launch: WinAppDebugConfiguration = config;
        try {
            if (launch.detach || launch.noLaunch || launch.debugOutput || launch.symbols ||
                launch.unregisterOnExit || launch.withAlias) {
                throw new Error('IDE debugging cannot use detach, noLaunch, debugOutput, symbols, unregisterOnExit, or withAlias. Use Run as Packaged App instead.');
            }
            if (launch.aot && launch.debuggerType && launch.debuggerType !== 'cppvsdbg') {
                throw new Error('Native AOT has no managed CLR. Select the cppvsdbg debugger.');
            }
            const input = await this.resolveInput(launch, folder);
            if (!input || token?.isCancellationRequested) { return undefined; }
            const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(input)) ?? folder;
            const cwd = launch.workingDirectory ?? workspace?.uri.fsPath ??
                (fs.statSync(input).isDirectory() ? input : path.dirname(input));
            const debuggerType = launch.aot ? 'cppvsdbg' : launch.debuggerType ?? 'coreclr';
            if (!await this.ensureDebugger(debuggerType) || token?.isCancellationRequested) { return undefined; }
            const options: RunOptions = {
                inputPath: input,
                ...(launch.manifest && { manifest: launch.manifest }),
                ...(launch.outputAppxDirectory && { outputAppxDirectory: launch.outputAppxDirectory }),
                ...(launch.project && { project: launch.project }),
                ...(launch.configuration && { configuration: launch.configuration }),
                ...(launch.arch && { architecture: launch.arch }),
                ...(launch.framework && { framework: launch.framework }),
                ...(launch.runtime && { runtime: launch.runtime }),
                ...(launch.executable && { executable: launch.executable }),
                ...(launch.properties && { properties: Object.entries(launch.properties).map(([key, value]) => `${key}=${value}`) }),
                noBuild: launch.noBuild ?? false,
                noRestore: launch.noRestore ?? false,
                aot: launch.aot ?? false,
                clean: launch.clean ?? false,
                appArgs: typeof launch.args === 'string' ? [launch.args] : launch.args ?? []
            };
            this.outputChannel.appendLine(`Launching ${input} via winapp run.`);
            const pid = await this.winAppCli.runForDebug(options, cwd);
            if (token?.isCancellationRequested) {
                void vscode.window.showWarningMessage(`Debugging cancelled after launch. The app (PID ${pid}) is still running.`);
                return undefined;
            }
            const child: vscode.DebugConfiguration = {
                type: debuggerType === 'node' ? 'pwa-node' : debuggerType,
                request: 'attach',
                name: `${config.name}: Attach (${pid})`,
                processId: debuggerType === 'node' ? String(pid) : pid,
                ...(debuggerType === 'coreclr' && { cwd })
            };
            if (!await vscode.debug.startDebugging(workspace, child)) {
                throw new Error(`App launched (PID ${pid}), but ${debuggerType} failed to attach. Check debugger availability and editor licensing restrictions.`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Debug launch failed: ${error}`);
            void vscode.window.showErrorMessage(`Failed to debug via winapp: ${error}`);
        }
        return undefined;
    }

    private async ensureDebugger(type: 'coreclr' | 'cppvsdbg' | 'node'): Promise<boolean> {
        if (type === 'node') { return true; }
        const extensionId = type === 'cppvsdbg' ? 'ms-vscode.cpptools' : 'ms-dotnettools.csharp';
        if (vscode.extensions.getExtension(extensionId)) { return true; }
        const choice = await vscode.window.showWarningMessage(
            `${type} requires a debugger extension (${extensionId}). Its availability and license depend on your editor. C# Dev Kit is not required.`,
            'Install Debugger', 'Cancel');
        if (choice !== 'Install Debugger') { return false; }
        await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId);
        if (!vscode.extensions.getExtension(extensionId)) {
            throw new Error('Debugger installation did not become available. Install a compatible debugger and retry.');
        }
        return true;
    }

    private async resolveInput(
        config: WinAppDebugConfiguration, folder?: vscode.WorkspaceFolder
    ): Promise<string | undefined> {
        const configured = config.input ?? config.inputFolder;
        if (configured) {
            const resolved = path.resolve(folder?.uri.fsPath ?? process.cwd(), configured);
            if (!fs.existsSync(resolved)) {
                throw new Error(`Configured input does not exist: ${resolved}`);
            }
            return resolved;
        }
        const files = await vscode.workspace.findFiles('**/*.{csproj,sln,slnx}',
            '**/{bin,obj,node_modules,.git,.vs,.winapp,packages}/**');
        const candidates: vscode.Uri[] = [];
        for (const file of files) {
            if (folder && vscode.workspace.getWorkspaceFolder(file)?.uri.toString() !== folder.uri.toString()) {
                continue;
            }
            if (!file.fsPath.toLowerCase().endsWith('.csproj') ||
                /<OutputType>\s*(?:WinExe|Exe|AppContainerExe)\s*<\/OutputType>/i.test(
                    await fs.promises.readFile(file.fsPath, 'utf8'))) {
                candidates.push(file);
            }
        }
        if (candidates.length === 1) { return candidates[0]!.fsPath; }
        if (candidates.length > 1) {
            const pick = await vscode.window.showQuickPick([
                ...candidates.map(uri => ({ label: path.basename(uri.fsPath),
                    description: vscode.workspace.asRelativePath(uri), uri })),
                { label: 'Browse...', description: 'Choose a project, solution, or build output folder', uri: undefined }
            ], { placeHolder: 'Select the app to debug' });
            if (!pick) { return undefined; }
            if (pick.uri) { return pick.uri.fsPath; }
        }
        const kind = await vscode.window.showQuickPick(['Project or solution', 'Build output folder'],
            { placeHolder: 'Choose the debug input type' });
        if (!kind) { return undefined; }
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: kind === 'Project or solution', canSelectFolders: kind === 'Build output folder',
            canSelectMany: false, title: 'Select WinApp debug input',
            ...(kind === 'Project or solution' && { filters: { 'Projects and solutions': ['csproj', 'sln', 'slnx'] } })
        });
        return selected?.[0]?.fsPath;
    }

    /** Releases the debug output channel. */
    public dispose(): void { this.outputChannel.dispose(); }
}
