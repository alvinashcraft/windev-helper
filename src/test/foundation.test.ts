import * as assert from 'assert';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mock } from 'node:test';
import * as vscode from 'vscode';
import { CliResult, WinAppCli } from '../winAppCli';
import { WinUIProjectManager } from '../projectManager';
import { PackageManager } from '../packageManager';
import { BuildManager } from '../buildManager';
import { DebugConfigurationProvider } from '../debugConfigurationProvider';

class FakeCli extends WinAppCli {
    public result: CliResult = { stdout: '', stderr: '' };
    public failure: Error | undefined;
    public calls: { command: string; args: string[]; cwd?: string }[] = [];

    public override async executeWithResult(command: string, args: string[] = [], cwd?: string): Promise<CliResult> {
        this.calls.push({ command, args, ...(cwd && { cwd }) });
        if (this.failure) {
            throw this.failure;
        }
        return this.result;
    }
}

suite('Release foundation', () => {
    let cli: FakeCli;

    setup(() => {
        mock.method(vscode.window, 'createOutputChannel', (name: string): vscode.OutputChannel => ({
            name, append: () => {}, appendLine: () => {}, replace: () => {},
            clear: () => {}, show: () => {}, hide: () => {}, dispose: () => {}
        }));
        cli = new FakeCli();
    });

    teardown(() => {
        mock.restoreAll();
        cli.dispose();
    });

    suite('CLI capability checks', () => {
        test('probes the configured executable without a workspace and caches its version', async () => {
            const nodePath = cp.execFileSync('node', ['-p', 'process.execPath'], { encoding: 'utf8' }).trim();
            const nodeVersion = cp.execFileSync(nodePath, ['--version'], { encoding: 'utf8' }).trim();
            mock.getter(vscode.workspace, 'workspaceFolders', () => undefined);
            mock.method(vscode.workspace, 'getConfiguration', () => ({ get: () => nodePath }));
            const realCli = new WinAppCli();
            const execute = mock.method(realCli, 'execute');
            try {
                const [major, minor, patch] = nodeVersion.slice(1).split('.').map(Number);
                assert.deepStrictEqual(await realCli.getVersion(), { major, minor, patch });
                assert.strictEqual(await realCli.supportsV070Features(), true);
                assert.strictEqual(execute.mock.callCount(), 1);
                assert.deepStrictEqual(execute.mock.calls[0]?.arguments, ['--version', [], os.tmpdir()]);
                await assert.rejects(realCli.execute('store', ['apps', 'list']), /No workspace folder found/);
            } finally {
                realCli.dispose();
            }
        });

        test('uses the workspace directory for version probing when available', async () => {
            const workspace = vscode.Uri.file(os.tmpdir());
            mock.getter(vscode.workspace, 'workspaceFolders', () => [{ uri: workspace, name: 'Test', index: 0 }]);
            cli.result.stdout = '0.7.1';
            await cli.getVersion();
            assert.strictEqual(cli.calls[0]?.cwd, workspace.fsPath);
        });

        test('uses the installed standalone version rather than an update banner and caches it', async () => {
            cli.result.stdout = 'Update available: 0.8.0\n0.7.1\n';
            assert.deepStrictEqual(await cli.getVersion(), { major: 0, minor: 7, patch: 1 });
            assert.strictEqual(await cli.supportsV070Features(), true);
            assert.strictEqual(await cli.supportsVersion(0, 7, 1), true);
            assert.strictEqual(await cli.supportsVersion(0, 7, 2), false);
            assert.strictEqual(cli.calls.length, 1);
        });

        test('retains older CLI feature boundaries', async () => {
            cli.result.stdout = '0.3.1';
            assert.strictEqual(await cli.supportsRunAppArgs(), true);
            assert.strictEqual(await cli.supportsScreenshotFocus(), false);
            assert.strictEqual(await cli.supportsUiV040Features(), false);
            assert.strictEqual(await cli.supportsV070Features(), false);
        });

        test('compares major versions before minor versions', async () => {
            cli.result.stdout = '1.0.0';
            assert.strictEqual(await cli.supportsVersion(0, 7, 1), true);
            assert.strictEqual(await cli.supportsVersion(1, 0, 1), false);
        });

        test('keeps unknown-version behavior conservative for new features', async () => {
            cli.result.stdout = 'unknown';
            assert.strictEqual(await cli.supportsV070Features(), false);
            assert.strictEqual(await cli.supportsScreenshotFocus(), false);
            assert.strictEqual(await cli.supportsRunAppArgs(), true);
        });

        test('does not mistake an update banner alone for an installed version', async () => {
            cli.result.stdout = 'Update available: 0.8.0';
            assert.strictEqual(await cli.getVersion(), null);
            assert.strictEqual(await cli.supportsV070Features(), false);
        });

        test('caches failed version detection without enabling new features', async () => {
            cli.failure = new Error('not installed');
            assert.strictEqual(await cli.supportsV070Features(), false);
            assert.strictEqual(await cli.supportsUiV040Features(), false);
            assert.strictEqual(cli.calls.length, 1);
        });
    });

    suite('Store contracts', () => {
        test('retains stderr tables while generic execution returns only stdout', async () => {
            cli.result = { stdout: '', stderr: 'Product ID    Name\n9NTEST        Test App\n' };
            assert.strictEqual(await cli.storeListApps(), cli.result.stderr);
            assert.strictEqual(await cli.execute('store', ['apps', 'list']), '');
            assert.deepStrictEqual(cli.calls[0]?.args, ['apps', 'list']);
        });

        test('retains both streams for human status output without contaminating JSON payloads', async () => {
            cli.result = { stdout: '{"status":"Pending"}', stderr: 'Checking submission...\n' };
            const status = await cli.storeGetSubmissionStatus('9NTEST');
            assert.ok(status.includes(cli.result.stdout));
            assert.ok(status.includes(cli.result.stderr));
            assert.deepStrictEqual(JSON.parse(await cli.execute('store', ['submission', 'get', '9NTEST'])),
                { status: 'Pending' });
        });

        test('propagates every Store failure to the caller', async () => {
            cli.failure = new Error('authentication failed');
            await assert.rejects(cli.storeConfigure({}), /authentication failed/);
            await assert.rejects(cli.storeListApps(), /authentication failed/);
            await assert.rejects(cli.storeGetSubmissionStatus('9NTEST'), /authentication failed/);
            await assert.rejects(cli.storePublish({ projectPath: os.tmpdir() }), /authentication failed/);
            await assert.rejects(cli.storePackage(os.tmpdir()), /authentication failed/);
        });

        test('uses the selected project directory and preserves publishing options', async () => {
            const projectPath = path.join(os.tmpdir(), 'Store App');
            await cli.storePublish({
                projectPath, inputFile: 'App.msixupload', appId: '9NTEST',
                flightId: 'beta', noCommit: true, rolloutPercentage: 10
            });
            assert.deepStrictEqual(cli.calls[0], {
                command: 'store',
                args: ['publish', projectPath, '--inputFile', 'App.msixupload', '--appId', '9NTEST',
                    '--flightId', 'beta', '--noCommit', '--packageRolloutPercentage', '10'],
                cwd: projectPath
            });
        });

        test('initializes and updates packages in the selected project directory', async () => {
            const projectPath = path.join(os.tmpdir(), 'Selected App');
            mock.method(vscode.window, 'showInformationMessage', async () => undefined);
            assert.strictEqual(await cli.init(projectPath), true);
            await cli.update(projectPath);
            assert.deepStrictEqual(cli.calls, [
                { command: 'init', args: [projectPath, '--no-prompt'], cwd: projectPath },
                { command: 'update', args: [projectPath], cwd: projectPath }
            ]);
        });

        test('displays Store read failures once at the command boundary', async () => {
            const errors: string[] = [];
            mock.method(vscode.window, 'showErrorMessage', async (message: string) => { errors.push(message); });
            mock.method(vscode.window, 'showInputBox', async () => '9NTEST');
            cli.failure = new Error('access denied');
            const manager = new PackageManager(cli);
            try {
                await manager.listStoreApps();
                await manager.getStoreSubmissionStatus();
                assert.strictEqual(errors.length, 2);
                assert.ok(errors.every(message => message.includes('access denied')));
            } finally {
                manager.dispose();
            }
        });

        for (const draft of [false, true]) {
            test(`reports ${draft ? 'draft' : 'submitted'} without claiming Store availability`, async () => {
                const messages: string[] = [];
                mock.method(vscode.window, 'showInputBox', async () => '');
                mock.method(vscode.window, 'showQuickPick', async (items: string[]) =>
                    items[0] === 'Build project package' ? 'Build project package' :
                        items[0] === 'Production' ? 'Production' :
                            draft ? 'Draft only (don\'t commit)' : 'Full release (100%)');
                mock.method(vscode.window, 'showWarningMessage', async () => 'Submit');
                mock.method(vscode.window, 'showInformationMessage', async (message: string) => {
                    messages.push(message);
                });
                const manager = new PackageManager(cli);
                try {
                    await manager.publishToStore(vscode.Uri.file(path.join(os.tmpdir(), 'App.csproj')));
                    assert.strictEqual(messages.length, 1);
                    assert.ok(messages[0]?.includes(draft ? 'saved as a draft' : 'Check submission status'));
                    assert.ok(!messages[0]?.includes('published'));
                } finally {
                    manager.dispose();
                }
            });
        }

        test('does not publish or notify success after cancellation or failure', async () => {
            const messages: string[] = [];
            const errors: string[] = [];
            mock.method(vscode.window, 'showInformationMessage', async (message: string) => {
                messages.push(message);
            });

            mock.method(vscode.window, 'showErrorMessage', async (message: string) => {
                errors.push(message);
            });
            const input = mock.method(vscode.window, 'showInputBox', async () => undefined);
            mock.method(vscode.window, 'showQuickPick', async () => 'Full release (100%)');
            mock.method(vscode.window, 'showWarningMessage', async () => 'Submit');
            const manager = new PackageManager(cli);
            try {
                const project = vscode.Uri.file(path.join(os.tmpdir(), 'App.csproj'));
                await manager.publishToStore(project);
                assert.strictEqual(cli.calls.length, 0);
                input.mock.mockImplementation(async () => '');
                cli.failure = new Error('submission rejected');
                await manager.publishToStore(project);
                assert.deepStrictEqual(messages, []);
                assert.strictEqual(errors.length, 1);
                assert.ok(errors[0]?.includes('submission rejected'));
            } finally {
                manager.dispose();
            }
        });

        test('requires a whole rollout percentage rather than truncating invalid input', async () => {
            let inputs = 0;
            mock.method(vscode.window, 'showInputBox', async (options: vscode.InputBoxOptions) => {
                if (inputs++ === 0) { return ''; }
                assert.strictEqual(options.validateInput?.('10'), null);
                for (const value of ['10.5', '10abc', '0', '101', '']) {
                    assert.ok(options.validateInput?.(value));
                }
                return undefined;
            });
            mock.method(vscode.window, 'showQuickPick', async () => 'Gradual rollout (specify percentage)');
            const manager = new PackageManager(cli);
            try {
                await manager.publishToStore(vscode.Uri.file(path.join(os.tmpdir(), 'App.csproj')));
                assert.strictEqual(inputs, 2);
                assert.strictEqual(cli.calls.length, 0);
            } finally {
                manager.dispose();
            }
        });
    });

    suite('Project routing', () => {
        let subscriptions: vscode.Disposable[];
        let manager: WinUIProjectManager;
        let projects: vscode.Uri[];

        setup(() => {
            subscriptions = [];
            manager = new WinUIProjectManager({ subscriptions }, cli);
            projects = [
                vscode.Uri.file(path.join(os.tmpdir(), 'root-one', 'App', 'App.csproj')),
                vscode.Uri.file(path.join(os.tmpdir(), 'root-two', 'App', 'App.csproj'))
            ];
            mock.method(manager, 'getAllProjects', async () => projects);
        });

        teardown(() => {
            subscriptions.forEach(disposable => disposable.dispose());
        });

        test('routes explicit files to the owning project across roots', async () => {
            const project = projects[1]!;
            assert.strictEqual(await manager.selectProject(vscode.Uri.file(
                path.join(path.dirname(project.fsPath), 'Views', 'MainPage.xaml'))), project);
            assert.strictEqual(manager.currentProject, project);
        });

        test('uses the active file when no explicit resource is supplied', async () => {
            const project = projects[1]!;
            mock.getter(vscode.window, 'activeTextEditor', () => ({
                document: { uri: vscode.Uri.file(path.join(path.dirname(project.fsPath), 'MainWindow.xaml')) }
            }));
            assert.strictEqual(await manager.selectProject(), project);
        });

        test('honors an explicit project when projects share a directory', async () => {
            const project = projects[0]!;
            projects.push(vscode.Uri.file(path.join(path.dirname(project.fsPath), 'Other.csproj')));
            assert.strictEqual(await manager.selectProject(project), project);
        });

        test('selects the nearest owning project for nested projects', async () => {
            const nested = vscode.Uri.file(path.join(path.dirname(projects[0]!.fsPath), 'Nested', 'Nested.csproj'));
            projects.push(nested);
            assert.strictEqual(await manager.selectProject(vscode.Uri.file(
                path.join(path.dirname(nested.fsPath), 'MainWindow.xaml'))), nested);
        });

        test('prompts for ambiguous folders with distinguishable paths', async () => {
            const picker = mock.method(vscode.window, 'showQuickPick',
                async (items: { uri: vscode.Uri; description: string }[]) => {
                    assert.strictEqual(items.length, 2);
                    assert.notStrictEqual(items[0]?.description, items[1]?.description);
                    return items[1];
                });
            assert.strictEqual(await manager.selectProject(vscode.Uri.file(os.tmpdir())), projects[1]);
            assert.strictEqual(picker.mock.callCount(), 1);
        });

        test('does not fall back to another project when selection is cancelled', async () => {
            mock.method(vscode.window, 'showQuickPick', async () => undefined);
            assert.strictEqual(await manager.selectProject(vscode.Uri.file(os.tmpdir())), undefined);
        });

        test('warns rather than targeting an unrelated project', async () => {
            const warning = mock.method(vscode.window, 'showWarningMessage', async () => undefined);
            assert.strictEqual(await manager.selectProject(vscode.Uri.file(
                path.join(os.tmpdir(), 'unrelated', 'Main.xaml'))), undefined);
            assert.strictEqual(warning.mock.callCount(), 1);
        });

        test('reads metadata from the requested project instead of the last selection', async () => {
            const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'windev-project-info-'));
            const project = vscode.Uri.file(path.join(directory, 'Requested.csproj'));
            try {
                fs.writeFileSync(project.fsPath, '<Project><PropertyGroup>' +
                    '<TargetFramework>net10.0-windows10.0.26100.0</TargetFramework>' +
                    '<WindowsPackageType>None</WindowsPackageType></PropertyGroup></Project>');
                await manager.selectProject(projects[0]);
                const info = await manager.getProjectInfo(project);
                assert.strictEqual(info?.name, 'Requested');
                assert.strictEqual(info?.path, project.fsPath);
                assert.strictEqual(info?.windowsPackageType, 'None');
                assert.strictEqual(info?.targetFramework, 'net10.0-windows10.0.26100.0');
            } finally {
                fs.unlinkSync(project.fsPath);
                fs.rmdirSync(directory);
            }
        });

        test('debugs the explicitly configured project using its own metadata', async () => {
            const project = projects[1]!;
            await manager.selectProject(projects[0]);
            const info = mock.method(manager, 'getProjectInfo', async (requested: vscode.Uri) => {
                assert.strictEqual(requested.fsPath, project.fsPath);
                return {
                    path: project.fsPath, name: 'App', platforms: ['x64'], runtimeIdentifiers: [],
                    targetFramework: 'net10.0-windows10.0.26100.0', windowsPackageType: 'None'
                };
            });
            const build = new BuildManager(cli);
            const builder = mock.method(build, 'build', async () => true);
            try {
                const provider = new DebugConfigurationProvider(manager, build);
                const result = await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                    type: 'winui', request: 'launch', name: 'Requested project', project: project.fsPath
                });
                assert.strictEqual(result?.type, 'coreclr');
                assert.strictEqual(result?.cwd, path.dirname(project.fsPath));
                assert.ok(result?.program.includes('net10.0-windows10.0.26100.0'));
                assert.strictEqual(builder.mock.calls[0]?.arguments[0]?.fsPath, project.fsPath);
                assert.strictEqual(info.mock.callCount(), 2);
            } finally {
                build.dispose();
            }
        });

        test('limits manifest lookup to the selected project directory', async () => {
            const project = projects[1]!;
            const finder = mock.method(vscode.workspace, 'findFiles', async (pattern: vscode.RelativePattern) => {
                assert.strictEqual(pattern.baseUri.fsPath, path.dirname(project.fsPath));
                return [];
            });
            mock.method(vscode.window, 'showWarningMessage', async () => undefined);
            await manager.openManifest(project);
            assert.strictEqual(finder.mock.callCount(), 3);
        });

        test('does not select the first project during multi-project background detection', async () => {
            mock.getter(vscode.workspace, 'workspaceFolders', () => [
                { uri: vscode.Uri.file(os.tmpdir()), name: 'workspace', index: 0 }
            ]);
            const finder = mock.method(vscode.workspace, 'findFiles', async () => projects);
            mock.method(fs.promises, 'readFile', async () => '<Project><UseWinUI>true</UseWinUI></Project>');
            assert.strictEqual(await manager.detectWinUIProject(), true);
            assert.strictEqual(manager.currentProject, undefined);
            await manager.selectProject(projects[1]);
            await manager.detectWinUIProject();
            assert.strictEqual(manager.currentProject, projects[1]);
            assert.ok(String(finder.mock.calls[0]?.arguments[1]).includes('obj'));
            assert.ok(String(finder.mock.calls[0]?.arguments[1]).includes('node_modules'));
            finder.mock.mockImplementation(async () => []);
            await manager.detectWinUIProject();
            assert.strictEqual(manager.currentProject, undefined);
            assert.strictEqual(manager.isWinUIProject, false);
        });

        test('resets stale selection when the workspace is closed', async () => {
            await manager.selectProject(projects[0]);
            mock.getter(vscode.workspace, 'workspaceFolders', () => undefined);
            await manager.detectWinUIProject();
            assert.strictEqual(manager.currentProject, undefined);
        });
    });

    test('captures real process streams separately and rejects nonzero exit codes', async () => {
        const nodePath = cp.execFileSync('node', ['-p', 'process.execPath'], { encoding: 'utf8' }).trim();
        mock.method(vscode.workspace, 'getConfiguration', () => ({ get: () => nodePath }));
        const realCli = new WinAppCli();
        try {
            const script = 'process.stdout.write(\'{"ok":true}\'); process.stderr.write("progress");';
            assert.deepStrictEqual(await realCli.executeWithResult('-e', [script], os.tmpdir()),
                { stdout: '{"ok":true}', stderr: 'progress' });
            assert.strictEqual(await realCli.execute('-e', [script], os.tmpdir()), '{"ok":true}');
            await assert.rejects(realCli.executeWithResult('-e',
                ['process.stderr.write("failed"); process.exit(3);'], os.tmpdir()), /failed/);
        } finally {
            realCli.dispose();
        }
    });

    test('does not hard-depend on Marketplace-only extensions', () => {
        const manifestPath = path.resolve(__dirname, '..', '..', 'package.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        assert.deepStrictEqual(manifest.extensionDependencies ?? [], []);
        assert.deepStrictEqual(manifest.extensionPack ?? [], []);
    });
});
