import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { mock } from 'node:test';
import * as vscode from 'vscode';
import { CliResult, WinAppCli } from '../winAppCli';
import { PackageManager } from '../packageManager';
import { TemplateManager } from '../templateManager';
import { WinAppDebugConfigurationProvider } from '../winAppDebugProvider';

class TestCli extends WinAppCli {
    public version = '0.8.0';
    public output = '{"ProcessId":4321}';
    public calls: { command: string; args: string[] }[] = [];

    public override async executeWithResult(command: string, args: string[] = []): Promise<CliResult> {
        this.calls.push({ command, args });
        return { stdout: command === '--version' ? this.version : this.output, stderr: '' };
    }
}

async function onPlatform(platform: NodeJS.Platform, run: () => Promise<void>): Promise<void> {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    assert.ok(descriptor);
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    try {
        await run();
    } finally {
        Object.defineProperty(process, 'platform', descriptor);
    }
}

suite('CLI v0.8 Windows-only workflows', () => {
    let cli: TestCli;
    let errors: string[];

    setup(() => {
        errors = [];
        mock.method(vscode.window, 'createOutputChannel', (name: string): vscode.OutputChannel => ({
            name, append: () => {}, appendLine: () => {}, replace: () => {},
            clear: () => {}, show: () => {}, hide: () => {}, dispose: () => {}
        }));
        mock.method(vscode.window, 'showErrorMessage', async (message: string) => { errors.push(message); });
        mock.method(vscode.window, 'showInformationMessage', async () => undefined);
        cli = new TestCli();
    });

    teardown(() => {
        cli.dispose();
        mock.restoreAll();
    });

    test('places Sandbox, DevTools and identity options before application arguments', async () => {
        await onPlatform('win32', async () => {
            await cli.run({
                inputPath: 'App.csproj', executionTarget: 'sandbox', devTools: 'headless',
                uniqueIdentity: true, detach: true, appArgs: ['--on', 'host', 'two words']
            });
            const run = cli.calls.find(call => call.command === 'run');
            assert.ok(run);
            assert.deepStrictEqual(run.args, [
                'App.csproj', '--on', 'sandbox', '--unique-identity', '--devtools', 'headless',
                '--detach', '--', '--on', 'host', 'two words'
            ]);
        });
    });

    test('preserves older host run behavior and omits the auto DevTools flag', async () => {
        cli.version = '0.7.1';
        await cli.run({ inputPath: 'App.csproj', devTools: 'auto', uniqueIdentity: false });
        assert.deepStrictEqual(cli.calls.find(call => call.command === 'run')?.args, ['App.csproj']);
    });

    for (const version of ['0.7.1', 'unknown']) {
        test(`rejects new launch features for ${version} before running`, async () => {
            await onPlatform('win32', async () => {
                cli.version = version;
                for (const options of [
                    { executionTarget: 'sandbox' as const }, { devTools: 'off' as const }, { uniqueIdentity: true }
                ]) {
                    await assert.rejects(cli.run({ inputPath: 'App.csproj', ...options }), /v0.8.0/);
                }
                assert.ok(!cli.calls.some(call => call.command === 'run'));
            });
        });
    }

    test('scopes every existing UI wrapper to the explicitly selected guest', async () => {
        await onPlatform('win32', async () => {
            await cli.uiListWindows(undefined, true, 'sandbox');
            await cli.uiInspect('4321', false, 'sandbox');
            await cli.uiScreenshot('4321', 'shot.png', false, 'sandbox');
            await cli.uiHover('Save', '4321', 100, 'sandbox');
            await cli.uiSendKeys('ctrl+a', 'send-input', '4321', 'Name', false, 'sandbox');
            await cli.uiClick('Save', '4321', 'sandbox');
            await cli.uiSetValue('Name', '', '4321', 'sandbox');
            await cli.uiRecord('4321', 10, 'recording.mp4', 'sandbox');
            await cli.uiSearch('Save', '4321', 'sandbox');
            const ui = cli.calls.filter(call => call.command === 'ui');
            assert.strictEqual(ui.length, 9);
            for (const call of ui) {
                assert.deepStrictEqual(call.args.slice(-2), ['--on', 'sandbox']);
            }
            assert.deepStrictEqual(errors, []);
        });
    });

    test('does not silently fall back to host UI on older CLI versions', async () => {
        await onPlatform('win32', async () => {
            cli.version = '0.7.1';
            await cli.uiInspect('4321', false, 'sandbox');
            assert.ok(!cli.calls.some(call => call.command === 'ui'));
            assert.ok(errors.some(error => error.includes('v0.8.0')));
        });
    });

    test('snapshot is read-only and DevTools source lookup remains guest-scoped', async () => {
        await onPlatform('win32', async () => {
            await cli.sandboxStatus();
            await cli.devToolsInspect('sandbox:4321', 'sandbox');
            await cli.devToolsInspect('sandbox:4321', 'sandbox', 'SaveButton');
            assert.deepStrictEqual(cli.calls.filter(call => call.command !== '--version'), [
                { command: 'target', args: ['snapshot', 'sandbox', '--json'] },
                { command: 'devtools', args: ['inspect', '-a', 'sandbox:4321', '--on', 'sandbox'] },
                { command: 'devtools', args: ['get-source', 'SaveButton', '-a', 'sandbox:4321', '--on', 'sandbox'] }
            ]);
        });
    });

    test('never returns a guest PID for local debugger attachment', async () => {
        await assert.rejects(cli.runForDebug({ inputPath: 'App.csproj', executionTarget: 'sandbox' }, '.'), /local debugger/);
        assert.strictEqual(cli.calls.length, 0);
        for (const output of [
            '{"ProcessId":4321,"Sandbox":true}',
            '{"ProcessId":4321,"ProcessScope":"sandbox"}',
            '{"ProcessId":4321,"ExecutionTarget":{"Kind":"sandbox"}}'
        ]) {
            cli.output = output;
            await assert.rejects(cli.runForDebug({ inputPath: 'App.csproj' }, '.'), /non-host process/);
        }
    });

    test('F5 rejects guest targets before launching or attaching', async () => {
        await onPlatform('win32', async () => {
            const provider = new WinAppDebugConfigurationProvider(cli);
            const attach = mock.method(vscode.debug, 'startDebugging', async () => true);
            try {
                await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                    type: 'winapp', name: 'Guest', request: 'launch', input: 'App.csproj', on: 'sandbox'
                });
                assert.strictEqual(attach.mock.callCount(), 0);
                assert.strictEqual(cli.calls.length, 0);
                assert.ok(errors.some(error => error.includes('F5 only supports host')));
            } finally {
                provider.dispose();
            }
        });
    });

    test('F5 version-gates new options before offering to install a debugger', async () => {
        await onPlatform('win32', async () => {
            cli.version = '0.7.1';
            const extension = mock.method(vscode.extensions, 'getExtension', () => { throw new Error('Must not check/install debugger'); });
            const provider = new WinAppDebugConfigurationProvider(cli);
            try {
                await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                    type: 'winapp', name: 'Old CLI', request: 'launch', input: __dirname, devTools: 'on'
                });
                assert.strictEqual(extension.mock.callCount(), 0);
                assert.ok(!cli.calls.some(call => call.command === 'run'));
                assert.ok(errors.some(error => error.includes('v0.8.0')));
            } finally {
                provider.dispose();
            }
        });
    });

    for (const platform of ['darwin', 'linux'] as const) {
        test(`blocks Windows-only operations on ${platform} before prompting or executing`, async () => {
            await onPlatform(platform, async () => {
                const picker = mock.method(vscode.window, 'showQuickPick', async () => { throw new Error('Must not prompt'); });
                const manager = new PackageManager(cli);
                try {
                    await assert.rejects(cli.sandboxStatus(), /requires Windows/);
                    await assert.rejects(cli.devToolsInspect('1234'), /requires Windows/);
                    await assert.rejects(cli.run({ inputPath: 'App.csproj', uniqueIdentity: true }), /requires Windows/);
                    await manager.runPackagedApp(undefined, 'sandbox');
                    await manager.sandboxStatus();
                    await manager.inspectDevTools();
                    await manager.uiListWindows();
                    await manager.uiInspect();
                    await manager.uiScreenshot();
                    await manager.uiHover();
                    await manager.uiSendKeys();
                    await manager.uiClick();
                    await manager.uiSetValue();
                    await manager.uiRecord();
                    assert.strictEqual(picker.mock.callCount(), 0);
                    assert.strictEqual(cli.calls.length, 0);
                    assert.strictEqual(errors.length, 11);
                } finally {
                    manager.dispose();
                }
            });
        });
    }

    test('passes the chosen Sandbox target to UI operations without remembering it', async () => {
        await onPlatform('win32', async () => {
            let picks = 0;
            mock.method(vscode.window, 'showQuickPick', async () =>
                picks++ === 0 ? { label: 'Windows Sandbox', target: 'sandbox' } : undefined);
            mock.method(vscode.window, 'showInputBox', async () => '4321');
            const manager = new PackageManager(cli);
            try {
                await manager.uiInspect();
                await manager.uiInspect();
                const ui = cli.calls.filter(call => call.command === 'ui');
                assert.strictEqual(ui.length, 1, 'Cancelling the next target picker must not reuse the previous guest');
                assert.deepStrictEqual(ui[0].args, ['inspect', '-a', '4321', '--on', 'sandbox']);
            } finally {
                manager.dispose();
            }
        });
    });

    test('Sandbox run forwards selected project options only after explicit consent', async () => {
        await onPlatform('win32', async () => {
            mock.method(vscode.window, 'showWarningMessage', async () => 'Continue');
            mock.method(vscode.window, 'showQuickPick', async (_items: unknown, options: vscode.QuickPickOptions) => {
                switch (options.title) {
                    case 'Run Target': return { mode: 'project' };
                    case 'Project Build Configuration': return { value: 'Release' };
                    case 'Project Architecture': return { value: 'x64' };
                    case 'Project Build Step': return 'Build and run';
                    case 'Native AOT': return 'No';
                    case 'Experimental WinUI DevTools': return { mode: 'headless' };
                    case 'Checkout-specific Package Identity': return 'Yes';
                    default: return options.placeHolder === 'Select run mode' ? { mode: 'detach' } : 'No';
                }
            });
            mock.method(vscode.window, 'showInputBox', async () => '--example "two words"');
            const manager = new PackageManager(cli);
            try {
                await manager.runPackagedApp(vscode.Uri.file(path.join(__dirname, 'App.csproj')), 'sandbox');
                const run = cli.calls.find(call => call.command === 'run');
                assert.ok(run);
                for (const flag of ['--on', '--devtools', '--unique-identity', '--detach', '--configuration', '--arch']) {
                    assert.ok(run.args.includes(flag), flag);
                }
                assert.strictEqual(run.args[run.args.indexOf('--on') + 1], 'sandbox');
                assert.strictEqual(run.args[run.args.indexOf('--devtools') + 1], 'headless');
                assert.deepStrictEqual(run.args.slice(-3), ['--', '--example', 'two words']);
            } finally {
                manager.dispose();
            }
        });
    });

    test('declining Sandbox preparation does not prompt for launch or run anything', async () => {
        await onPlatform('win32', async () => {
            mock.method(vscode.window, 'showWarningMessage', async () => undefined);
            const pick = mock.method(vscode.window, 'showQuickPick', async () => { throw new Error('Must not prompt'); });
            const manager = new PackageManager(cli);
            try {
                await manager.runPackagedApp(undefined, 'sandbox');
                assert.strictEqual(pick.mock.callCount(), 0);
                assert.ok(!cli.calls.some(call => call.command === 'run' || call.command === 'target'));
            } finally {
                manager.dispose();
            }
        });
    });

    test('F5 forwards DevTools/identity options for host launch and still attaches locally', async () => {
        await onPlatform('win32', async () => {
            mock.method(vscode.extensions, 'getExtension', () => ({ id: 'debugger' }));
            const attach = mock.method(vscode.debug, 'startDebugging', async () => true);
            const provider = new WinAppDebugConfigurationProvider(cli);
            try {
                await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                    type: 'winapp', name: 'Host', request: 'launch', input: __dirname,
                    devTools: 'off', uniqueIdentity: true
                });
                assert.deepStrictEqual(errors, []);
                const run = cli.calls.find(call => call.command === 'run');
                assert.ok(run);
                assert.ok(run.args.includes('--unique-identity'));
                assert.strictEqual(run.args[run.args.indexOf('--devtools') + 1], 'off');
                assert.ok(!run.args.includes('--on'));
                const config = attach.mock.calls[0]?.arguments[1];
                assert.ok(config && typeof config === 'object');
                assert.strictEqual(config.processId, 4321);
            } finally {
                provider.dispose();
            }
        });
    });

    test('copies current WinApp catalog commands without installing anything', async () => {
        let picks = 0;
        mock.method(vscode.window, 'showQuickPick', async () => [
            { label: 'Copilot', value: 'copilot' },
            { label: 'WinApp', value: 'winappcli' },
            { label: 'WinApp CLI catalog', repository: 'microsoft/winappCli', name: 'winappcli' }
        ][picks++]);
        mock.method(vscode.window, 'showInformationMessage', async () => 'Copy Commands');
        const copy = mock.fn(async (_text: string) => {});
        mock.getter(vscode.env, 'clipboard', () => ({ writeText: copy, readText: async () => '' }));
        const terminal = mock.method(vscode.window, 'createTerminal', () => { throw new Error('Must not install'); });
        const manager = new TemplateManager();
        try {
            await manager.installCopilotPlugin();
            assert.strictEqual(copy.mock.calls[0]?.arguments[0],
                'copilot plugin marketplace add microsoft/winappCli\ncopilot plugin install winappcli@winappcli');
            assert.strictEqual(terminal.mock.callCount(), 0);
        } finally {
            manager.dispose();
        }
    });

    test('Windows-only commands are hidden/disabled and add no platform or marketplace dependencies', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
        const windowsCommands = [
            'runSandbox', 'sandboxStatus', 'devToolsInspect', 'devToolsSource', 'runPackagedApp',
            'uiListWindows', 'uiInspect', 'uiScreenshot', 'uiHover', 'uiSendKeys', 'uiClick', 'uiSetValue', 'uiRecord'
        ].map(name => `windev-helper.${name}`);
        for (const command of windowsCommands) {
            const contribution = manifest.contributes.commands.find((item: { command: string }) => item.command === command);
            assert.strictEqual(contribution?.enablement, 'isWindows', command);
            assert.strictEqual(contribution?.category, 'WinDev', command);
            const palette = manifest.contributes.menus.commandPalette.find((item: { command: string }) => item.command === command);
            assert.strictEqual(palette?.when, 'isWindows', command);
        }
        assert.ok(!manifest.os);
        assert.ok(!manifest.extensionDependencies?.includes('ms-dotnettools.csdevkit'));
        assert.ok(!manifest.dependencies, 'Sandbox/DevTools must not add runtime npm dependencies');
    });
});
