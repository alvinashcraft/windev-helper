import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as cp from 'child_process';
import { mock } from 'node:test';
import * as vscode from 'vscode';
import { CliResult, WinAppCli } from '../winAppCli';
import { WinAppDebugConfigurationProvider } from '../winAppDebugProvider';
import { PackageManager } from '../packageManager';
import { TemplateManager } from '../templateManager';
import { COMMANDS } from '../constants';
import { runCancellableProcess } from '../cancellation';
import { WinUIProjectManager } from '../projectManager';
import { BuildManager } from '../buildManager';
import { DebugConfigurationProvider } from '../debugConfigurationProvider';

const windowsTest = process.platform === 'win32' ? test : test.skip;

class TestCli extends WinAppCli {
    public version = '0.7.1';
    public output = '{"ProcessId":4321}';
    public calls: { command: string; args: string[]; cwd?: string }[] = [];
    public override async executeWithResult(command: string, args: string[] = [], cwd?: string): Promise<CliResult> {
        this.calls.push({ command, args, ...(cwd && { cwd }) });
        return { stdout: command === '--version' ? this.version : this.output, stderr: '' };
    }
}

suite('Release 4.4 workflows', () => {
    let cli: TestCli;
    let directory: string;
    let errors: string[];

    setup(() => {
        errors = [];
        mock.method(vscode.window, 'createOutputChannel', (name: string): vscode.OutputChannel => ({
            name, append: () => {}, appendLine: () => {}, replace: () => {},
            clear: () => {}, show: () => {}, hide: () => {}, dispose: () => {}
        }));
        mock.method(vscode.window, 'showInformationMessage', async () => undefined);
        mock.method(vscode.window, 'showErrorMessage', async (message: string) => { errors.push(message); });
        cli = new TestCli();
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'windev-debug-'));
        fs.writeFileSync(path.join(directory, 'App.csproj'), '<Project><OutputType>WinExe</OutputType></Project>');
    });

    teardown(() => {
        cli.dispose();
        mock.restoreAll();
        fs.unlinkSync(path.join(directory, 'App.csproj'));
        fs.rmdirSync(directory);
    });

    test('launches with JSON and exact PID rather than process-name lookup', async () => {
        assert.strictEqual(await cli.runForDebug({
            inputPath: path.join(directory, 'App.csproj'), configuration: 'Release',
            architecture: 'arm64', runtime: 'win-arm64', framework: 'net10.0-windows',
            properties: ['DefineConstants=TEST'], appArgs: ['two words', '--flag'],
            project: 'App', clean: true, noRestore: true
        }, directory), 4321);
        const call = cli.calls.find(item => item.command === 'run')!;
        assert.strictEqual(call.cwd, directory);
        for (const flag of ['--json', '--detach', '--without-alias', '--runtime', '--framework',
            '--property', '--project', '--configuration', '--clean', '--no-restore']) {
            assert.ok(call.args.includes(flag), `Missing ${flag}`);
        }
        assert.deepStrictEqual(call.args.slice(-3), ['--', 'two words', '--flag']);
        assert.ok(!call.args.includes('--debug-output'));
    });

    test('rejects malformed, missing, and failed launch results', async () => {
        for (const result of ['not json', '{}', '{"ProcessId":0}', '{"ProcessId":"123"}', '{"ProcessId":1.2}', 'null']) {
            cli.output = result;
            await assert.rejects(cli.runForDebug({ inputPath: directory }, directory));
        }
        cli.output = '{"Error":"registration failed"}';
        await assert.rejects(cli.runForDebug({ inputPath: directory }, directory), /registration failed/);
    });

    test('version gates project launch and Native AOT before running', async () => {
        cli.version = '0.5.0';
        await assert.rejects(cli.runForDebug({ inputPath: directory }, directory), /v0.6.0/);
        assert.ok(!cli.calls.some(call => call.command === 'run'));
        const older = new TestCli();
        try {
            older.version = '0.6.0';
            await assert.rejects(older.runForDebug({ inputPath: directory, aot: true }, directory), /v0.7.0/);
            assert.strictEqual(await older.runForDebug({ inputPath: directory }, directory), 4321);
            const run = older.calls.find(call => call.command === 'run')!;
            assert.ok(run.args.includes('--json'));
            assert.ok(!run.args.includes('--without-alias'), 'v0.6 has no --without-alias option');
        } finally {
            older.dispose();
        }
    });

    for (const aot of [false, true]) {
        windowsTest(`F5 attaches ${aot ? 'native' : 'managed'} debugger to the returned PID`, async () => {
            mock.method(vscode.extensions, 'getExtension', () => ({ id: 'debugger' }));
            const attach = mock.method(vscode.debug, 'startDebugging', async () => true);
            const provider = new WinAppDebugConfigurationProvider(cli);
            try {
                await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                    type: 'winapp', name: 'App', request: 'launch',
                    input: path.join(directory, 'App.csproj'), aot,
                    noBuild: true, noRestore: true, properties: { TestProperty: 'a b' },
                    args: ['first', 'two words']
                });
                assert.deepStrictEqual(errors, []);
                const config = attach.mock.calls[0]?.arguments[1];
                assert.ok(config && typeof config === 'object');
                assert.strictEqual(config.type, aot ? 'cppvsdbg' : 'coreclr');
                assert.strictEqual(config.processId, 4321);
                assert.ok(!('processName' in config));
                assert.ok(cli.calls.find(call => call.command === 'run')?.args.includes('--no-build'));
            } finally {
                provider.dispose();
            }
        });
    }

    windowsTest('keeps inputFolder compatibility and gives input precedence', async () => {
        mock.method(vscode.extensions, 'getExtension', () => ({ id: 'debugger' }));
        mock.method(vscode.debug, 'startDebugging', async () => true);
        const provider = new WinAppDebugConfigurationProvider(cli);
        try {
            await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                type: 'winapp', name: 'Legacy', request: 'launch', inputFolder: directory
            });
            assert.strictEqual(cli.calls.find(call => call.command === 'run')?.args[0], directory);
            cli.calls = [];
            await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                type: 'winapp', name: 'Modern', request: 'launch',
                input: path.join(directory, 'App.csproj'), inputFolder: 'does-not-exist'
            });
            assert.strictEqual(cli.calls.find(call => call.command === 'run')?.args[0], path.join(directory, 'App.csproj'));
        } finally {
            provider.dispose();
        }
    });

    windowsTest('does not launch if debugger consent is declined', async () => {
        mock.method(vscode.extensions, 'getExtension', () => undefined);
        mock.method(vscode.window, 'showWarningMessage', async () => 'Cancel');
        const provider = new WinAppDebugConfigurationProvider(cli);
        try {
            await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                type: 'winapp', name: 'No debugger', request: 'launch', input: directory
            });
            assert.strictEqual(cli.calls.length, 0);
        } finally {
            provider.dispose();
        }
    });

    windowsTest('rejects competing debuggers and invalid AOT combinations before launch', async () => {
        const provider = new WinAppDebugConfigurationProvider(cli);
        try {
            for (const options of [{ debugOutput: true }, { noLaunch: true }, { aot: true, debuggerType: 'coreclr' }]) {
                await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                    type: 'winapp', name: 'Invalid', request: 'launch', input: directory, ...options
                });
            }
            assert.strictEqual(cli.calls.length, 0);
            assert.strictEqual(errors.length, 3);
        } finally {
            provider.dispose();
        }
    });

    windowsTest('does not attach on CLI failure and reports attach failures explicitly', async () => {
        mock.method(vscode.extensions, 'getExtension', () => ({ id: 'debugger' }));
        const attach = mock.method(vscode.debug, 'startDebugging', async () => false);
        const provider = new WinAppDebugConfigurationProvider(cli);
        try {
            cli.output = '{"Error":"build failed"}';
            await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                type: 'winapp', name: 'App', request: 'launch', input: directory
            });
            assert.strictEqual(attach.mock.callCount(), 0);
            cli.output = '{"ProcessId":4321}';
            await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                type: 'winapp', name: 'App', request: 'launch', input: directory
            });
            assert.ok(errors.some(message => message.includes('build failed')));
            assert.ok(errors.some(message => message.includes('failed to attach')));
        } finally {
            provider.dispose();
        }
    });

    windowsTest('passes solution inputs and project selection through to the CLI', async () => {
        mock.method(vscode.extensions, 'getExtension', () => ({ id: 'debugger' }));
        mock.method(vscode.debug, 'startDebugging', async () => true);
        const solution = path.join(directory, 'Apps.slnx');
        fs.writeFileSync(solution, '<Solution />');
        const provider = new WinAppDebugConfigurationProvider(cli);
        try {
            await provider.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                type: 'winapp', request: 'launch', name: 'Solution', input: solution, project: 'App'
            });
            const args = cli.calls.find(call => call.command === 'run')!.args;
            assert.strictEqual(args[0], solution);
            assert.strictEqual(args[args.indexOf('--project') + 1], 'App');
        } finally {
            provider.dispose();
            fs.unlinkSync(solution);
        }
    });

    for (const host of ['copilot', 'claude', 'codex']) {
        test(`copies verified ${host} skills commands without executing them`, async () => {
            let picks = 0;
            mock.method(vscode.window, 'showQuickPick', async () => picks++ === 0
                ? { label: host, value: host } : { label: 'WinApp', value: 'winappcli' });
            mock.method(vscode.window, 'showInformationMessage', async () => 'Copy Commands');
            const copy = mock.fn(async (_text: string) => {});
            mock.getter(vscode.env, 'clipboard', () => ({ writeText: copy, readText: async () => '' }));
            const terminal = mock.method(vscode.window, 'createTerminal', () => { throw new Error('Must not run commands'); });
            const manager = new TemplateManager();
            try {
                await manager.installCopilotPlugin();
                assert.strictEqual(copy.mock.calls[0]?.arguments[0],
                    `${host} plugin marketplace add microsoft/win-dev-skills\n${host} plugin ${host === 'codex' ? 'add' : 'install'} winappcli@win-dev-skills`);
                assert.strictEqual(terminal.mock.callCount(), 0);
            } finally {
                manager.dispose();
            }
        });
    }

    test('submits an existing package to a flight only after explicit confirmation', async () => {
        mock.method(vscode.window, 'showInputBox', async (options: vscode.InputBoxOptions) =>
            options.prompt?.includes('flight') ? 'flight-1' : '9NTEST');
        let picks = 0;
        mock.method(vscode.window, 'showQuickPick', async () =>
            ['Use existing package', 'Package flight', 'Draft only (don\'t commit)'][picks++]);
        mock.method(vscode.window, 'showOpenDialog', async () => [vscode.Uri.file(path.join(directory, 'App.msixupload'))]);
        const confirmation = mock.method(vscode.window, 'showWarningMessage', async () => 'Submit');
        const manager = new PackageManager(cli);
        try {
            await manager.publishToStore(vscode.Uri.file(path.join(directory, 'App.csproj')));
            const args = cli.calls.find(call => call.command === 'store')!.args;
            assert.ok(args.includes('--inputFile'));
            assert.strictEqual(args[args.indexOf('--flightId') + 1], 'flight-1');
            assert.ok(args.includes('--noCommit'));
            assert.ok(confirmation.mock.calls[0]?.arguments[0]?.includes('draft only'));
        } finally {
            manager.dispose();
        }
    });

    test('cancelling the final submission confirmation never calls the CLI', async () => {
        mock.method(vscode.window, 'showInputBox', async () => '');
        let picks = 0;
        mock.method(vscode.window, 'showQuickPick', async () =>
            ['Build project package', 'Production', 'Full release (100%)'][picks++]);
        mock.method(vscode.window, 'showWarningMessage', async () => undefined);
        const manager = new PackageManager(cli);
        try {
            await manager.publishToStore(vscode.Uri.file(path.join(directory, 'App.csproj')));
            assert.strictEqual(cli.calls.length, 0);
        } finally {
            manager.dispose();
        }
    });

    test('launches interactive Store initialization as a process task, not captured stdin', async () => {
        const start = mock.method(vscode.tasks, 'executeTask', async () => ({}));
        await cli.storeInit(directory);
        const task = start.mock.calls[0]?.arguments[0];
        assert.ok(task?.execution instanceof vscode.ProcessExecution);
        assert.deepStrictEqual(task.execution.args, ['store', 'init', directory]);
        assert.strictEqual(cli.calls.length, 0);
    });

    windowsTest('legacy packaged debugging delegates without a second build', async () => {
        const subscriptions: vscode.Disposable[] = [];
        const projects = new WinUIProjectManager({ subscriptions }, cli);
        const build = new BuildManager(cli);
        const debuggerProvider = new WinAppDebugConfigurationProvider(cli);
        mock.method(projects, 'getProjectInfo', async () => ({
            path: path.join(directory, 'App.csproj'), name: 'App',
            platforms: ['ARM64'], runtimeIdentifiers: [], windowsPackageType: 'MSIX'
        }));
        const builder = mock.method(build, 'build', async () => true);
        mock.method(vscode.extensions, 'getExtension', () => ({ id: 'debugger' }));
        const attach = mock.method(vscode.debug, 'startDebugging', async () => true);
        try {
            const legacy = new DebugConfigurationProvider(projects, build, debuggerProvider);
            await legacy.resolveDebugConfigurationWithSubstitutedVariables(undefined, {
                type: 'winui', name: 'Legacy', request: 'launch',
                project: path.join(directory, 'App.csproj'), configuration: 'Release', platform: 'ARM64'
            });
            assert.strictEqual(builder.mock.callCount(), 0);
            assert.strictEqual(attach.mock.callCount(), 1);
            const run = cli.calls.find(call => call.command === 'run')!;
            assert.strictEqual(run.args[run.args.indexOf('--configuration') + 1], 'Release');
            assert.strictEqual(run.args[run.args.indexOf('--arch') + 1], 'arm64');
        } finally {
            subscriptions.forEach(subscription => subscription.dispose());
            build.dispose();
            debuggerProvider.dispose();
        }
    });

    test('pre-cancelled processes never start', async () => {
        const cancellation = new vscode.CancellationTokenSource();
        cancellation.cancel();
        try {
            const result = await runCancellableProcess({
                command: 'not-a-command', args: [], cwd: directory, token: cancellation.token
            });
            assert.deepStrictEqual(result, { cancelled: true });
        } finally {
            cancellation.dispose();
        }
    });

    test('Windows cancellation terminates a real wrapper and its child process', async function () {
        if (process.platform !== 'win32') { this.skip(); }
        const node = cp.execFileSync('node', ['-p', 'process.execPath'], { encoding: 'utf8' }).trim();
        const cancellation = new vscode.CancellationTokenSource();
        let childPid: number | undefined;
        let output = '';
        const channel = vscode.window.createOutputChannel('Cancellation test');
        mock.method(channel, 'append', (text: string) => {
            output += text;
            const match = /READY:(\d+)\n/.exec(output);
            if (match) {
                childPid = Number(match[1]);
                cancellation.cancel();
            }
        });
        const childScript = 'console.log("READY:" + process.pid); setTimeout(() => {}, 8000);';
        const wrapperScript = `require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(childScript)}], {stdio: "inherit"}); setTimeout(() => {}, 8000);`;
        try {
            const result = await runCancellableProcess({
                command: node, args: ['-e', wrapperScript], cwd: directory,
                token: cancellation.token, outputChannel: channel
            });
            const terminatedPid = childPid;
            assert.ok(terminatedPid, 'Child process did not signal readiness');
            assert.deepStrictEqual(result, { cancelled: true });
            assert.throws(() => process.kill(terminatedPid, 0), { code: 'ESRCH' });
        } finally {
            cancellation.dispose();
            channel.dispose();
        }
    });

    test('Store details, packages, and sparse identity use the expected CLI arguments', async () => {
        await cli.storeGetDetails('9NTEST', 'submission');
        await cli.storePackage(directory, { arch: ['x64', 'arm64'], output: directory });
        await cli.embedIdentity(path.join(directory, 'App.exe'), path.join(directory, 'Package.appxmanifest'));
        assert.deepStrictEqual(cli.calls[0]?.args, ['submission', 'get', '9NTEST']);
        assert.deepStrictEqual(cli.calls[1]?.args, ['package', directory, '--output', directory, '--arch', 'x64,arm64']);
        assert.deepStrictEqual(cli.calls[2]?.args, [path.join(directory, 'App.exe'), '--manifest', path.join(directory, 'Package.appxmanifest')]);
    });

    test('new commands have titles/categories and aligned versions without hard dependencies', () => {
        const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8'));
        for (const id of [COMMANDS.STORE_INIT, COMMANDS.STORE_PACKAGE, COMMANDS.STORE_DETAILS, COMMANDS.STORE_POLL, COMMANDS.EMBED_IDENTITY]) {
            const command = manifest.contributes.commands.find((item: { command: string }) => item.command === id);
            assert.ok(command?.title);
            assert.strictEqual(command?.category, 'WinDev');
        }
        assert.deepStrictEqual(manifest.extensionDependencies ?? [], []);
        const lock = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package-lock.json'), 'utf8'));
        assert.strictEqual(manifest.version, lock.version);
        assert.strictEqual(manifest.version, lock.packages[''].version);
    });
});
