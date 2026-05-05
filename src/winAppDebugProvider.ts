// WinDev Helper - WinApp Debug Configuration Provider
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { WinAppCli } from './winAppCli';
import { DEBUG_TYPES, OUTPUT_CHANNELS } from './constants';

/**
 * Shape of a `winapp` launch configuration. Mirrors the configuration
 * properties exposed by the official Microsoft WinApp VS Code extension.
 */
interface WinAppDebugConfiguration extends vscode.DebugConfiguration {
    type: 'winapp';
    request: 'launch';
    /** Build output folder containing the app's `.exe`. */
    inputFolder?: string;
    /** Path to the AppxManifest.xml. Auto-detected when omitted. */
    manifest?: string;
    /** Underlying debugger to use. */
    debuggerType?: 'coreclr' | 'cppvsdbg' | 'node';
    /** Working directory for the launched application. */
    workingDirectory?: string;
    /** Arguments forwarded to the launched application. */
    args?: string | string[];
    /** Output directory for the loose-layout package. */
    outputAppxDirectory?: string;
}

/**
 * Provides resolution and launch handling for the `winapp` debug type.
 *
 * Flow on F5:
 *   1. Resolve / prompt for the build output folder.
 *   2. Locate the application executable inside that folder.
 *   3. Launch via `winapp run --detach` so the app starts with package
 *      identity but our debug session keeps control.
 *   4. Start a child debug session that attaches the requested debugger
 *      (coreclr / cppvsdbg / node) to the running process.
 */
export class WinAppDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    /** Executables that can appear in build output but are never the app itself. */
    private static readonly EXE_BLOCKLIST = new Set<string>([
        'createdump.exe',
        'apphost.exe',
        'singlefilehost.exe',
    ]);

    private readonly winAppCli: WinAppCli;
    private readonly outputChannel: vscode.OutputChannel;

    constructor(winAppCli: WinAppCli) {
        this.winAppCli = winAppCli;
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.WINAPP_DEBUG);
    }

    /**
     * Provides the initial `winapp` configuration shown when a user has no
     * launch.json yet and selects the WinApp debugger.
     */
    public provideDebugConfigurations(
        _folder: vscode.WorkspaceFolder | undefined,
        _token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        return [
            {
                type: DEBUG_TYPES.WINAPP,
                request: 'launch',
                name: 'WinApp: Launch and Attach',
            },
        ];
    }

    /**
     * Fills in defaults when an empty config is supplied (e.g. via the F5
     * prompt before any launch.json exists). Detailed work is deferred to
     * `resolveDebugConfigurationWithSubstitutedVariables` so the user's
     * `${workspaceFolder}` style tokens are already expanded.
     */
    public resolveDebugConfiguration(
        _folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        _token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {
        if (!config.type && !config.request && !config.name) {
            config.type = DEBUG_TYPES.WINAPP;
            config.request = 'launch';
            config.name = 'WinApp: Launch and Attach';
        }
        return config;
    }

    /**
     * Performs the actual launch + attach. Returning `undefined` cancels the
     * top-level debug session, which is what we want once the child session
     * has been started successfully (the user only sees the child).
     */
    public async resolveDebugConfigurationWithSubstitutedVariables(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        _token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | undefined | null> {
        if (config.type !== DEBUG_TYPES.WINAPP) {
            return config;
        }

        const winAppConfig = config as WinAppDebugConfiguration;
        const workspaceFolder = folder ?? vscode.workspace.workspaceFolders?.[0];

        const inputFolder = await this.resolveInputFolder(winAppConfig, workspaceFolder);
        if (!inputFolder) {
            return undefined;
        }

        const exePath = this.findAppExecutable(inputFolder, winAppConfig.manifest);
        if (!exePath) {
            vscode.window.showErrorMessage(
                `No application .exe found under '${inputFolder}'. Build the project first or set 'inputFolder' in launch.json.`
            );
            return undefined;
        }

        this.outputChannel.appendLine(`Launching ${exePath} with package identity via 'winapp run'.`);
        this.outputChannel.show(true);

        try {
            await this.winAppCli.run({
                inputFolder,
                ...(winAppConfig.manifest ? { manifest: winAppConfig.manifest } : {}),
                ...(winAppConfig.outputAppxDirectory ? { outputAppxDirectory: winAppConfig.outputAppxDirectory } : {}),
                detach: true,
                ...(this.normalizeArgs(winAppConfig.args).length > 0
                    ? { appArgs: this.normalizeArgs(winAppConfig.args) }
                    : {}),
            }, workspaceFolder?.uri.fsPath);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to launch app via winapp run: ${error}`);
            return undefined;
        }

        const debuggerType = winAppConfig.debuggerType ?? 'coreclr';
        const exeName = path.basename(exePath);
        const childConfig = await this.buildChildAttachConfig(
            debuggerType,
            exeName,
            inputFolder,
            winAppConfig
        );

        if (!childConfig) {
            // We launched the app but cannot attach a debugger — keep the
            // user informed instead of silently exiting the session.
            vscode.window.showWarningMessage(
                `App launched, but no PID could be resolved for '${exeName}'. Install the matching debugger extension and try again.`
            );
            return undefined;
        }

        const started = await vscode.debug.startDebugging(workspaceFolder, childConfig);
        if (!started) {
            vscode.window.showErrorMessage(
                `App launched, but the '${debuggerType}' debugger failed to attach. Verify the debugger extension is installed.`
            );
        }

        // Returning undefined ends the top-level winapp session; only the
        // child attach session remains visible in the Debug view.
        return undefined;
    }

    /**
     * Returns the build output folder configured in launch.json or prompts
     * the user to pick one. Auto-detects when there is exactly one candidate
     * folder containing an `.exe` under the workspace.
     */
    private async resolveInputFolder(
        config: WinAppDebugConfiguration,
        workspaceFolder: vscode.WorkspaceFolder | undefined
    ): Promise<string | undefined> {
        if (config.inputFolder) {
            const resolved = path.isAbsolute(config.inputFolder)
                ? config.inputFolder
                : path.join(workspaceFolder?.uri.fsPath ?? '', config.inputFolder);
            if (fs.existsSync(resolved)) {
                return resolved;
            }
            vscode.window.showWarningMessage(
                `Configured inputFolder '${resolved}' does not exist; prompting for a folder instead.`
            );
        }

        if (workspaceFolder) {
            const candidates = this.discoverBuildOutputFolders(workspaceFolder.uri.fsPath);
            if (candidates.length === 1) {
                return candidates[0];
            }
            if (candidates.length > 1) {
                const pick = await vscode.window.showQuickPick(
                    candidates.map(c => ({
                        label: path.relative(workspaceFolder.uri.fsPath, c) || c,
                        description: c,
                        value: c,
                    })),
                    { placeHolder: 'Select the build output folder containing your .exe' }
                );
                return pick?.value;
            }
        }

        const picked = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Select build output folder',
            title: 'Select the folder containing your built app',
            ...(workspaceFolder ? { defaultUri: workspaceFolder.uri } : {}),
        });
        return picked?.[0]?.fsPath;
    }

    /**
     * Walks the workspace looking for folders that directly contain a
     * non-blocklisted `.exe`. Skips common noise (node_modules, .git, etc.)
     * and caps recursion depth so initialization stays cheap.
     */
    private discoverBuildOutputFolders(root: string): string[] {
        const skip = new Set<string>(['node_modules', '.git', '.vs', '.vscode', '.winapp', 'obj', 'packages']);
        const found: string[] = [];

        const walk = (dir: string, depth: number): void => {
            if (depth > 8) { return; }

            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }

            const hasAppExe = entries.some(e =>
                e.isFile() &&
                e.name.toLowerCase().endsWith('.exe') &&
                !WinAppDebugConfigurationProvider.EXE_BLOCKLIST.has(e.name.toLowerCase())
            );
            if (hasAppExe) {
                found.push(dir);
            }

            for (const entry of entries) {
                if (entry.isDirectory() && !skip.has(entry.name)) {
                    walk(path.join(dir, entry.name), depth + 1);
                }
            }
        };

        walk(root, 0);
        return found;
    }

    /**
     * Picks the most likely application executable inside `inputFolder`.
     * If a manifest is supplied, prefer the executable referenced by it.
     */
    private findAppExecutable(inputFolder: string, manifestPath?: string): string | undefined {
        const exes = this.listAppExecutables(inputFolder);
        if (exes.length === 0) {
            return undefined;
        }

        const manifestExe = manifestPath ? this.readExecutableFromManifest(manifestPath) : undefined;
        if (manifestExe) {
            const match = exes.find(e => path.basename(e).toLowerCase() === manifestExe.toLowerCase());
            if (match) {
                return match;
            }
        }

        return exes[0];
    }

    /**
     * Lists candidate application executables in a folder, excluding
     * known runtime helpers (createdump, apphost, etc.).
     */
    private listAppExecutables(folder: string): string[] {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(folder, { withFileTypes: true });
        } catch {
            return [];
        }
        return entries
            .filter(e =>
                e.isFile() &&
                e.name.toLowerCase().endsWith('.exe') &&
                !WinAppDebugConfigurationProvider.EXE_BLOCKLIST.has(e.name.toLowerCase())
            )
            .map(e => path.join(folder, e.name));
    }

    /**
     * Best-effort regex parse of `<Application ... Executable="..."/>` from
     * an AppxManifest.xml. Returns `undefined` if the file cannot be read or
     * the attribute is missing — full XML parsing isn't worth the dependency.
     */
    private readExecutableFromManifest(manifestPath: string): string | undefined {
        try {
            const content = fs.readFileSync(manifestPath, 'utf-8');
            const match = content.match(/<Application[^>]*\bExecutable\s*=\s*"([^"]+)"/i);
            if (match) {
                return path.basename(match[1]);
            }
        } catch {
            // ignore
        }
        return undefined;
    }

    /**
     * Returns a child attach configuration for the requested debugger.
     * For `coreclr` we use `processName` (most reliable post-launch).
     * For `cppvsdbg` and `node` we resolve the PID by polling `tasklist`
     * because those debuggers don't accept process names.
     */
    private async buildChildAttachConfig(
        debuggerType: 'coreclr' | 'cppvsdbg' | 'node',
        exeName: string,
        inputFolder: string,
        config: WinAppDebugConfiguration
    ): Promise<vscode.DebugConfiguration | undefined> {
        const sessionName = `WinApp: Attach (${exeName})`;
        const cwd = config.workingDirectory || inputFolder;

        if (debuggerType === 'coreclr') {
            return {
                type: 'coreclr',
                request: 'attach',
                name: sessionName,
                processName: exeName,
                cwd,
            };
        }

        const pid = await this.waitForProcessId(exeName);
        if (!pid) {
            return undefined;
        }

        if (debuggerType === 'cppvsdbg') {
            return {
                type: 'cppvsdbg',
                request: 'attach',
                name: sessionName,
                processId: pid,
            };
        }

        // node
        return {
            type: 'pwa-node',
            request: 'attach',
            name: sessionName,
            processId: String(pid),
        };
    }

    /**
     * Polls `tasklist` for up to ~10 seconds waiting for the launched app
     * to appear, then returns its PID.
     */
    private async waitForProcessId(exeName: string): Promise<number | undefined> {
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
            const pid = this.queryProcessId(exeName);
            if (pid) {
                return pid;
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        return undefined;
    }

    /**
     * Synchronously asks Windows for the PID of the given image name. Returns
     * `undefined` on any failure or when the process is not yet running.
     */
    private queryProcessId(exeName: string): number | undefined {
        try {
            const output = cp.execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH /FO CSV`, {
                windowsHide: true,
                encoding: 'utf-8',
            });
            // Lines look like: "AppName.exe","12345","Console","1","12,345 K"
            const match = output.match(/"[^"]+","(\d+)"/);
            if (match) {
                return parseInt(match[1], 10);
            }
        } catch {
            // tasklist returns non-zero when no matching process exists
        }
        return undefined;
    }

    /**
     * Coerces the `args` configuration option into a string array. Accepts
     * either a string (which is forwarded as-is) or a pre-split array.
     */
    private normalizeArgs(value: string | string[] | undefined): string[] {
        if (!value) { return []; }
        if (Array.isArray(value)) { return value; }
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}
