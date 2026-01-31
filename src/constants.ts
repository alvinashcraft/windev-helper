// WinDev Helper - Constants
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

/**
 * Context keys used for when clauses
 */
export const CONTEXT_KEYS = {
    IS_WINUI_PROJECT: 'windevHelper.isWinUIProject',
} as const;

/**
 * Configuration section and property names
 */
export const CONFIG = {
    SECTION: 'windevHelper',
    DEFAULT_CONFIGURATION: 'defaultConfiguration',
    DEFAULT_PLATFORM: 'defaultPlatform',
    WINAPP_CLI_PATH: 'winAppCliPath',
    AUTO_RESTORE_ON_OPEN: 'autoRestoreOnOpen',
    SHOW_STATUS_BAR_ITEMS: 'showStatusBarItems',
    CERTIFICATE_PATH: 'certificatePath',
} as const;

/**
 * Command identifiers
 */
export const COMMANDS = {
    CREATE_PROJECT: 'windev-helper.createProject',
    CREATE_LIBRARY: 'windev-helper.createLibrary',
    ADD_PAGE: 'windev-helper.addPage',
    ADD_USER_CONTROL: 'windev-helper.addUserControl',
    ADD_WINDOW: 'windev-helper.addWindow',
    ADD_VIEW_MODEL: 'windev-helper.addViewModel',
    BUILD_PROJECT: 'windev-helper.buildProject',
    REBUILD_PROJECT: 'windev-helper.rebuildProject',
    CLEAN_PROJECT: 'windev-helper.cleanProject',
    DEBUG_PROJECT: 'windev-helper.debugProject',
    RUN_WITHOUT_DEBUGGING: 'windev-helper.runWithoutDebugging',
    CREATE_MSIX_PACKAGE: 'windev-helper.createMsixPackage',
    SIGN_PACKAGE: 'windev-helper.signPackage',
    GENERATE_CERTIFICATE: 'windev-helper.generateCertificate',
    INSTALL_CERTIFICATE: 'windev-helper.installCertificate',
    CREATE_DEBUG_IDENTITY: 'windev-helper.createDebugIdentity',
    GENERATE_MANIFEST: 'windev-helper.generateManifest',
    OPEN_MANIFEST: 'windev-helper.openManifest',
    RESTORE_PACKAGES: 'windev-helper.restorePackages',
    UPDATE_PACKAGES: 'windev-helper.updatePackages',
    INITIALIZE_PROJECT: 'windev-helper.initializeProject',
    SELECT_BUILD_CONFIGURATION: 'windev-helper.selectBuildConfiguration',
    SELECT_PLATFORM: 'windev-helper.selectPlatform',
    INSTALL_TEMPLATES: 'windev-helper.installTemplates',
    CHECK_WINAPP_CLI: 'windev-helper.checkWinAppCli',
    OPEN_XAML_PREVIEW: 'windev-helper.openXamlPreview',
} as const;

/**
 * Output channel names
 */
export const OUTPUT_CHANNELS = {
    BUILD: 'WinUI Build',
    PACKAGING: 'WinUI Packaging',
    TEMPLATES: 'WinUI Templates',
    WINAPP_CLI: 'WinApp CLI',
} as const;

/**
 * Debug configuration types
 */
export const DEBUG_TYPES = {
    WINUI: 'winui',
    CORECLR: 'coreclr',
} as const;

/**
 * File patterns for project detection
 */
export const FILE_PATTERNS = {
    CSPROJ: '**/*.csproj',
    APPX_MANIFEST: '**/*.appxmanifest',
    PACKAGE_MANIFEST: 'Package.appxmanifest',
} as const;

/**
 * WinUI project indicators in .csproj files
 */
export const PROJECT_INDICATORS = {
    USE_WINUI: '<UseWinUI>true</UseWinUI>',
    WINDOWS_APP_SDK: 'Microsoft.WindowsAppSDK',
    WINUI_REFERENCE: 'Microsoft.WinUI',
    WINDOWS_TARGET_REGEX: /<TargetFramework>.*windows.*<\/TargetFramework>/i,
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
    CONFIGURATION: 'Debug' as const,
    PLATFORM: 'x64' as const,
    TARGET_FRAMEWORK: 'net8.0-windows10.0.19041.0',
    TIMESTAMP_URL: 'http://timestamp.digicert.com',
} as const;
