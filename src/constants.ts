// WinDev Helper - Constants
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

/**
 * Context keys used for when clauses
 */
export const CONTEXT_KEYS = {
    IS_WINUI_PROJECT: 'windevHelper.isWinUIProject',
    IS_REACTOR_PROJECT: 'windevHelper.isReactorProject',
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
    TEMPLATES_SOURCE: 'templates.source',
    TEMPLATES_ALLOW_PRERELEASE: 'templates.allowPrerelease',
    REACTOR_REPO_PATH: 'reactor.repoPath',
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
    ADD_DIALOG: 'windev-helper.addDialog',
    ADD_TEMPLATED_CONTROL: 'windev-helper.addTemplatedControl',
    ADD_RESOURCE_DICTIONARY: 'windev-helper.addResourceDictionary',
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
    INSTALL_COPILOT_PLUGIN: 'windev-helper.installCopilotPlugin',
    CHECK_DEV_ENVIRONMENT: 'windev-helper.checkDevEnvironment',
    OPEN_SKILLS_REPO: 'windev-helper.openSkillsRepo',
    CHECK_WINAPP_CLI: 'windev-helper.checkWinAppCli',
    OPEN_XAML_DESIGNER: 'windev-helper.openXamlDesigner',
    OPEN_XAML_TEXT: 'windev-helper.openXamlText',
    // Microsoft.UI.Reactor commands (v3.1.0+)
    CREATE_REACTOR_APP: 'windev-helper.createReactorApp',
    RUN_REACTOR_BOOTSTRAP: 'windev-helper.runReactorBootstrap',
    OPEN_REACTOR_DOCS: 'windev-helper.openReactorDocs',
    INSTALL_REACTOR_PLUGIN: 'windev-helper.installReactorPlugin',
    // Microsoft Store commands (via winapp store subcommand)
    STORE_LIST_APPS: 'windev-helper.storeListApps',
    STORE_PUBLISH: 'windev-helper.storePublish',
    STORE_SUBMISSION_STATUS: 'windev-helper.storeSubmissionStatus',
    STORE_CONFIGURE: 'windev-helper.storeConfigure',
    // External catalog command
    CREATE_EXTERNAL_CATALOG: 'windev-helper.createExternalCatalog',
    // Certificate info command (v0.2.1+)
    CERTIFICATE_INFO: 'windev-helper.certificateInfo',
    // Run & manage commands (v0.3.0+)
    RUN_PACKAGED_APP: 'windev-helper.runPackagedApp',
    UNREGISTER_PACKAGE: 'windev-helper.unregisterPackage',
    MANIFEST_ADD_ALIAS: 'windev-helper.manifestAddAlias',
    // UI Automation commands (v0.3.0+)
    UI_LIST_WINDOWS: 'windev-helper.uiListWindows',
    UI_INSPECT: 'windev-helper.uiInspect',
    UI_SCREENSHOT: 'windev-helper.uiScreenshot',
    // UI hover command (v0.4.0+)
    UI_HOVER: 'windev-helper.uiHover',
    // Parity commands with the official Microsoft WinApp VS Code extension (v2.10.0+)
    MANIFEST_UPDATE_ASSETS: 'windev-helper.manifestUpdateAssets',
    RUN_SDK_TOOL: 'windev-helper.runSdkTool',
    GET_WINAPP_PATH: 'windev-helper.getWinAppPath',
    CONFIGURE_WINAPP_DEBUG: 'windev-helper.configureWinAppDebug',
} as const;

/**
 * Output channel names
 */
export const OUTPUT_CHANNELS = {
    BUILD: 'WinUI Build',
    PACKAGING: 'WinUI Packaging',
    TEMPLATES: 'WinUI Templates',
    WINAPP_CLI: 'WinApp CLI',
    WINAPP_DEBUG: 'WinApp Debug',
    REACTOR: 'WinUI Reactor',
    DEV_ENVIRONMENT: 'WinDev Environment',
} as const;

/**
 * Debug configuration types
 */
export const DEBUG_TYPES = {
    WINUI: 'winui',
    CORECLR: 'coreclr',
    /**
     * Custom WinApp debug type (parity with the official Microsoft WinApp
     * VS Code extension). Launches the build output via `winapp run` so the
     * app gets package identity, then attaches a child debugger.
     */
    WINAPP: 'winapp',
    CPPVSDBG: 'cppvsdbg',
    NODE: 'node',
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
    /** Microsoft.UI.Reactor package reference marks a Reactor app project. */
    REACTOR_REFERENCE: 'Microsoft.UI.Reactor',
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

/**
 * External resource URLs surfaced through extension commands.
 */
export const EXTERNAL_URLS = {
    /** Microsoft WinUI agent + skills repository for AI coding hosts. */
    WIN_DEV_SKILLS_REPO: 'https://github.com/microsoft/win-dev-skills',
    /** Microsoft.UI.Reactor documentation site. */
    REACTOR_DOCS: 'https://microsoft.github.io/microsoft-ui-reactor/',
    /** Microsoft.UI.Reactor source repository. */
    REACTOR_REPO: 'https://github.com/microsoft/microsoft-ui-reactor',
} as const;

/**
 * Identifiers for the supported `dotnet new` template packages.
 *
 * - `OFFICIAL`: Microsoft.WindowsAppSDK.WinUI.CSharp.Templates ships the
 *   blank-app, MVVM, NavigationView, TabView, library, and unit-test templates
 *   plus the common item templates (page, window, user control, templated
 *   control, resource dictionary, dialog).
 * - `COMMUNITY`: VijayAnand.WinUITemplates is the long-standing community pack
 *   that this extension has used since launch and remains the default for users
 *   who already rely on its short names (`winuilib`, `-mvvm` flag).
 */
export const TEMPLATE_PACKAGES = {
    OFFICIAL: 'Microsoft.WindowsAppSDK.WinUI.CSharp.Templates',
    COMMUNITY: 'VijayAnand.WinUITemplates',
} as const;

/**
 * Project template short names exposed by the supported template packages.
 * The `OFFICIAL` package adds dedicated MVVM, NavigationView, TabView,
 * library, and unit-test templates; the `COMMUNITY` package uses a single
 * `winui` template with a `-mvvm` flag and a `winuilib` library template.
 */
export const TEMPLATE_NAMES = {
    OFFICIAL: {
        BLANK: 'winui',
        MVVM: 'winui-mvvm',
        NAVIGATION_VIEW: 'winui-navview',
        TAB_VIEW: 'winui-tabview',
        LIBRARY: 'winui-lib',
        UNIT_TEST: 'winui-unittest',
        // Item templates
        PAGE: 'winui-page',
        USER_CONTROL: 'winui-usercontrol',
        WINDOW: 'winui-window',
        DIALOG: 'winui-dialog',
        TEMPLATED_CONTROL: 'winui-templatedcontrol',
        RESOURCE_DICTIONARY: 'winui-resourcedictionary',
    },
    COMMUNITY: {
        BLANK: 'winui',
        LIBRARY: 'winuilib',
    },
} as const;

