// WinDev Helper - XAML Preview Controller
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { IXamlRenderer, RenderOptions, RenderResult, RendererType, RendererStatus } from './types';
import { NativeXamlRenderer } from './nativeRenderer';
import { HtmlXamlRenderer } from './htmlFallbackRenderer';
import { ProjectContextProvider } from './projectContext';
// import { AzureXamlRenderer } from './azureRenderer';  // Future

/**
 * Extended render options that include project context
 */
export interface RenderWithContextOptions {
    width: number;
    height: number;
    theme: 'light' | 'dark';
    scale: number;
    /** Path to the XAML file being rendered (for project context resolution) */
    xamlFilePath?: string;
}

/**
 * Manages XAML preview renderers and routes requests to the appropriate one
 */
export class XamlPreviewController implements vscode.Disposable {
    private renderers: Map<RendererType, IXamlRenderer> = new Map();
    private activeRenderer: IXamlRenderer | null = null;
    private projectContextProvider: ProjectContextProvider;
    private disposables: vscode.Disposable[] = [];
    private renderCache = new Map<string, { result: RenderResult; timestamp: number }>();
    private readonly cacheMaxAge = 5000; // 5 seconds
    private readonly cacheMaxSize = 20;

    private readonly _onRendererChanged = new vscode.EventEmitter<RendererStatus>();
    public readonly onRendererChanged = this._onRendererChanged.event;

    constructor(private readonly extensionPath: string) {
        this.projectContextProvider = new ProjectContextProvider();
        this.projectContextProvider.setupWatchers();
        this.initializeRenderers();
        this.setupConfigurationListener();
        this.setupContextInvalidationListener();
    }

    /**
     * Initialize available renderers
     */
    private initializeRenderers(): void {
        // Native renderer (Windows only)
        const nativeRenderer = new NativeXamlRenderer(this.extensionPath);
        this.renderers.set('native', nativeRenderer);

        // HTML fallback renderer (always available)
        const htmlRenderer = new HtmlXamlRenderer();
        this.renderers.set('html', htmlRenderer);

        // TODO: Add Azure renderer
        // const azureRenderer = new AzureXamlRenderer();
        // this.renderers.set('azure', azureRenderer);
    }

    /**
     * Listen for configuration changes
     */
    private setupConfigurationListener(): void {
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('windevHelper.preview')) {
                    this.selectRenderer();
                }
            })
        );
    }

    /**
     * Listen for project context invalidation (App.xaml or resource changes)
     */
    private setupContextInvalidationListener(): void {
        this.disposables.push(
            this.projectContextProvider.onContextInvalidated(() => {
                // Clear render cache when project resources change
                this.renderCache.clear();
                console.log('[PreviewController] Render cache cleared due to project context change');
            })
        );
    }

    /**
     * Get the current renderer status
     */
    public getStatus(): RendererStatus {
        if (!this.activeRenderer) {
            return {
                type: 'html',
                displayName: 'HTML Fallback',
                status: 'unavailable'
            };
        }

        return {
            type: this.activeRenderer.type,
            displayName: this.activeRenderer.displayName,
            status: 'ready'
        };
    }

    /**
     * Select the best available renderer based on platform and settings
     */
    public async selectRenderer(): Promise<void> {
        const config = vscode.workspace.getConfiguration('windevHelper.preview');
        const preferredRenderer = config.get<string>('renderer', 'auto');

        let selected: IXamlRenderer | null = null;

        switch (preferredRenderer) {
            case 'native':
                selected = this.renderers.get('native') || null;
                if (selected && !selected.available) {
                    vscode.window.showWarningMessage(
                        'Native XAML renderer is only available on Windows. Falling back to HTML.'
                    );
                    selected = this.renderers.get('html') || null;
                }
                break;

            case 'azure':
                selected = this.renderers.get('azure') || null;
                if (!selected || !selected.available) {
                    vscode.window.showWarningMessage(
                        'Azure XAML renderer is not configured. Falling back to HTML.'
                    );
                    selected = this.renderers.get('html') || null;
                }
                break;

            case 'html':
                selected = this.renderers.get('html') || null;
                break;

            case 'auto':
            default:
                // Try native first (if on Windows), then Azure, then HTML
                const native = this.renderers.get('native');
                if (native?.available) {
                    selected = native;
                } else {
                    const azure = this.renderers.get('azure');
                    if (azure?.available) {
                        selected = azure;
                    } else {
                        selected = this.renderers.get('html') || null;
                    }
                }
                break;
        }

        if (selected !== this.activeRenderer) {
            // Dispose old renderer if switching away
            // (but keep it in the map for potential future use)

            this.activeRenderer = selected;

            // Notify listeners
            this._onRendererChanged.fire(this.getStatus());
        }

        // Pre-initialize the selected renderer so first render doesn't have to wait
        // for process startup. Fire-and-forget — if it fails, render() will retry.
        if (this.activeRenderer) {
            this.activeRenderer.initialize().catch(err => {
                console.warn('[PreviewController] Pre-initialization failed (will retry on render):', err);
            });
        }
    }

    /**
     * Render XAML content with project context
     */
    public async render(xaml: string, options: RenderWithContextOptions): Promise<RenderResult> {
        // Ensure we have a renderer
        if (!this.activeRenderer) {
            await this.selectRenderer();
        }

        if (!this.activeRenderer) {
            return {
                success: false,
                code: 'NO_RENDERER',
                message: 'No XAML renderer available'
            };
        }

        // Build full render options with project context
        const fullOptions = await this.buildRenderOptions(options);

        // Check cache (include project path in cache key for context-aware caching)
        const cacheKey = this.getCacheKey(xaml, fullOptions);
        const cached = this.renderCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
            return cached.result;
        }

        // Render
        try {
            const result = await this.activeRenderer.render(xaml, fullOptions);

            // Cache successful renders
            if (result.success) {
                this.addToCache(cacheKey, result);
            }

            return result;
        } catch (err) {
            return {
                success: false,
                code: 'RENDER_ERROR',
                message: err instanceof Error ? err.message : String(err)
            };
        }
    }

    /**
     * Build full render options including project context
     */
    private async buildRenderOptions(options: RenderWithContextOptions): Promise<RenderOptions> {
        // Check if user has explicitly set a theme preference
        const config = vscode.workspace.getConfiguration('windevHelper.preview');
        const userTheme = config.get<string>('theme', 'auto');
        
        // If user explicitly chose light/dark, use that; otherwise use the passed-in theme (from VS Code)
        let theme: 'light' | 'dark' = options.theme;
        if (userTheme === 'light' || userTheme === 'dark') {
            theme = userTheme;
        }

        const fullOptions: RenderOptions = {
            width: options.width,
            height: options.height,
            theme,
            scale: options.scale
        };

        // Add xamlFilePath if provided
        if (options.xamlFilePath) {
            fullOptions.xamlFilePath = options.xamlFilePath;
        }

        // Try to get project context if we have a file path
        if (options.xamlFilePath) {
            try {
                const context = await this.projectContextProvider.getContext(options.xamlFilePath);
                if (context) {
                    fullOptions.projectPath = context.projectPath;
                    if (context.appXamlContent) {
                        fullOptions.appXamlContent = context.appXamlContent;
                    }
                    fullOptions.resourceDictionaries = context.resourceDictionaries.map(rd => ({
                        source: rd.source,
                        content: rd.content
                    }));

                    // Use project's requested theme if available and we're in auto mode
                    if (userTheme === 'auto' && context.requestedTheme && context.requestedTheme !== 'Default') {
                        fullOptions.theme = context.requestedTheme.toLowerCase() as 'light' | 'dark';
                    }

                    console.log(`[PreviewController] Loaded project context: ${context.resourceDictionaries.length} resource dictionaries`);
                }
            } catch (err) {
                console.error('[PreviewController] Failed to get project context:', err);
                // Continue without project context
            }
        }

        return fullOptions;
    }

    /**
     * Generate a cache key for a render request
     */
    private getCacheKey(xaml: string, options: RenderOptions): string {
        return JSON.stringify({
            xaml,
            width: options.width,
            height: options.height,
            theme: options.theme,
            scale: options.scale,
            projectPath: options.projectPath
        });
    }

    /**
     * Add a result to the cache, evicting old entries if needed
     */
    private addToCache(key: string, result: RenderResult): void {
        // Evict oldest entries if cache is full
        if (this.renderCache.size >= this.cacheMaxSize) {
            let oldestKey: string | null = null;
            let oldestTime = Infinity;
            for (const [k, v] of this.renderCache) {
                if (v.timestamp < oldestTime) {
                    oldestTime = v.timestamp;
                    oldestKey = k;
                }
            }
            if (oldestKey) {
                this.renderCache.delete(oldestKey);
            }
        }

        this.renderCache.set(key, {
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Clear the render cache
     */
    public clearCache(): void {
        this.renderCache.clear();
        this.projectContextProvider.invalidateCache();
    }

    /**
     * Get available renderer types
     */
    public getAvailableRenderers(): RendererStatus[] {
        const statuses: RendererStatus[] = [];

        for (const [type, renderer] of this.renderers) {
            statuses.push({
                type,
                displayName: renderer.displayName,
                status: renderer.available ? 'ready' : 'unavailable'
            });
        }

        return statuses;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        for (const renderer of this.renderers.values()) {
            renderer.dispose();
        }
        this.renderers.clear();
        this.activeRenderer = null;

        this.projectContextProvider.dispose();

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];

        this._onRendererChanged.dispose();
    }
}
