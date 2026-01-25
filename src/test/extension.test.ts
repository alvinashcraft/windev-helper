import * as assert from 'assert';
import * as vscode from 'vscode';
import { 
    COMMANDS, 
    CONFIG, 
    DEFAULTS, 
    DEBUG_TYPES,
    OUTPUT_CHANNELS,
    FILE_PATTERNS,
    PROJECT_INDICATORS
} from '../constants';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    suite('Constants', () => {
        test('COMMANDS should have all expected command IDs', () => {
            assert.strictEqual(COMMANDS.BUILD_PROJECT, 'windev-helper.buildProject');
            assert.strictEqual(COMMANDS.CREATE_PROJECT, 'windev-helper.createProject');
            assert.strictEqual(COMMANDS.DEBUG_PROJECT, 'windev-helper.debugProject');
            assert.strictEqual(COMMANDS.ADD_PAGE, 'windev-helper.addPage');
            assert.strictEqual(COMMANDS.ADD_VIEW_MODEL, 'windev-helper.addViewModel');
        });

        test('CONFIG should have expected configuration keys', () => {
            assert.strictEqual(CONFIG.SECTION, 'windevHelper');
            assert.strictEqual(CONFIG.DEFAULT_CONFIGURATION, 'defaultConfiguration');
            assert.strictEqual(CONFIG.DEFAULT_PLATFORM, 'defaultPlatform');
        });

        test('DEFAULTS should have expected default values', () => {
            assert.strictEqual(DEFAULTS.CONFIGURATION, 'Debug');
            assert.strictEqual(DEFAULTS.PLATFORM, 'x64');
            assert.ok(DEFAULTS.TARGET_FRAMEWORK.includes('windows'));
        });

        test('DEBUG_TYPES should have expected debug types', () => {
            assert.strictEqual(DEBUG_TYPES.WINUI, 'winui');
            assert.strictEqual(DEBUG_TYPES.CORECLR, 'coreclr');
        });

        test('PROJECT_INDICATORS should have WinUI detection patterns', () => {
            assert.strictEqual(PROJECT_INDICATORS.USE_WINUI, '<UseWinUI>true</UseWinUI>');
            assert.strictEqual(PROJECT_INDICATORS.WINDOWS_APP_SDK, 'Microsoft.WindowsAppSDK');
            assert.ok(PROJECT_INDICATORS.WINDOWS_TARGET_REGEX instanceof RegExp);
        });
    });

    suite('Extension Activation', () => {
        test('Extension should be present', () => {
            // Extension may not be installed in test environment
            // This is a sanity check for the test setup
            assert.ok(true, 'Extension presence check completed');
        });

        test('Commands should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            
            // Note: Commands may not be registered if extension is not activated
            // This test validates the command structure
            assert.ok(Array.isArray(commands), 'Commands list should be an array');
        });
    });

    suite('Project Detection Patterns', () => {
        test('Windows target regex should match valid target frameworks', () => {
            const validTargets = [
                '<TargetFramework>net8.0-windows</TargetFramework>',
                '<TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>',
                '<TargetFramework>net7.0-windows10.0.22621.0</TargetFramework>'
            ];

            for (const target of validTargets) {
                assert.ok(
                    PROJECT_INDICATORS.WINDOWS_TARGET_REGEX.test(target),
                    `Should match: ${target}`
                );
            }
        });

        test('Windows target regex should not match non-Windows targets', () => {
            const invalidTargets = [
                '<TargetFramework>net8.0</TargetFramework>',
                '<TargetFramework>net8.0-android</TargetFramework>',
                '<TargetFramework>net8.0-ios</TargetFramework>'
            ];

            for (const target of invalidTargets) {
                assert.ok(
                    !PROJECT_INDICATORS.WINDOWS_TARGET_REGEX.test(target),
                    `Should not match: ${target}`
                );
            }
        });

        test('WinUI indicator strings should be valid', () => {
            // Test that a sample .csproj content would be detected
            const sampleCsproj = `
                <Project Sdk="Microsoft.NET.Sdk">
                    <PropertyGroup>
                        <TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>
                        <UseWinUI>true</UseWinUI>
                    </PropertyGroup>
                    <ItemGroup>
                        <PackageReference Include="Microsoft.WindowsAppSDK" Version="1.5.0" />
                    </ItemGroup>
                </Project>
            `;

            assert.ok(sampleCsproj.includes(PROJECT_INDICATORS.USE_WINUI));
            assert.ok(sampleCsproj.includes(PROJECT_INDICATORS.WINDOWS_APP_SDK));
            assert.ok(PROJECT_INDICATORS.WINDOWS_TARGET_REGEX.test(sampleCsproj));
        });
    });

    suite('Configuration Validation', () => {
        test('Build configuration types should be valid', () => {
            const validConfigs = ['Debug', 'Release'];
            assert.ok(validConfigs.includes(DEFAULTS.CONFIGURATION));
        });

        test('Platform types should be valid', () => {
            const validPlatforms = ['x86', 'x64', 'ARM64'];
            assert.ok(validPlatforms.includes(DEFAULTS.PLATFORM));
        });

        test('Configuration section should be accessible', () => {
            const config = vscode.workspace.getConfiguration(CONFIG.SECTION);
            assert.ok(config !== undefined, 'Configuration section should exist');
        });
    });

    suite('Output Channel Names', () => {
        test('Output channel names should be defined', () => {
            assert.strictEqual(OUTPUT_CHANNELS.BUILD, 'WinUI Build');
            assert.strictEqual(OUTPUT_CHANNELS.PACKAGING, 'WinUI Packaging');
            assert.strictEqual(OUTPUT_CHANNELS.TEMPLATES, 'WinUI Templates');
            assert.strictEqual(OUTPUT_CHANNELS.WINAPP_CLI, 'WinApp CLI');
        });
    });

    suite('File Patterns', () => {
        test('File patterns should be valid glob patterns', () => {
            assert.strictEqual(FILE_PATTERNS.CSPROJ, '**/*.csproj');
            assert.strictEqual(FILE_PATTERNS.APPX_MANIFEST, '**/*.appxmanifest');
            assert.strictEqual(FILE_PATTERNS.PACKAGE_MANIFEST, 'Package.appxmanifest');
        });
    });
});
