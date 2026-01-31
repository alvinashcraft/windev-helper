// WinDev Helper - XAML Preview Controller
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { IXamlRenderer, RenderOptions, RenderResult, RendererType, RendererStatus } from './types';
import { NativeXamlRenderer } from './nativeRenderer';
// import { AzureXamlRenderer } from './azureRenderer';  // Future
// import { HtmlXamlRenderer } from './htmlRenderer';    // Migrate from existing

/**
 * Manages XAML preview renderers and routes requests to the appropriate one
 */
export class XamlPreviewController implements vscode.Disposable {
    private renderers: Map<RendererType, IXamlRenderer> = new Map();
    private activeRenderer: IXamlRenderer | null = null;
    private disposables: vscode.Disposable[] = [];
    private renderCache = new Map<string, { result: RenderResult; timestamp: number }>();
    private readonly cacheMaxAge = 5000; // 5 seconds
    private readonly cacheMaxSize = 20;

    private readonly _onRendererChanged = new vscode.EventEmitter<RendererStatus>();
    public readonly onRendererChanged = this._onRendererChanged.event;

    constructor(private readonly extensionPath: string) {
        this.initializeRenderers();
        this.setupConfigurationListener();
    }

    /**
     * Initialize available renderers
     */
    private initializeRenderers(): void {
        // Native renderer (Windows only)
        const nativeRenderer = new NativeXamlRenderer(this.extensionPath);
        this.renderers.set('native', nativeRenderer);

        // TODO: Add Azure renderer
        // const azureRenderer = new AzureXamlRenderer();
        // this.renderers.set('azure', azureRenderer);

        // TODO: Migrate HTML renderer from existing POC
        // const htmlRenderer = new HtmlXamlRenderer();
        // this.renderers.set('html', htmlRenderer);
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
            // Dispose old renderer
            if (this.activeRenderer) {
                this.activeRenderer.dispose();
            }

            this.activeRenderer = selected;

            // Notify listeners
            this._onRendererChanged.fire(this.getStatus());
        }
    }

    /**
     * Render XAML content
     */
    public async render(xaml: string, options: RenderOptions): Promise<RenderResult> {
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

        // Check cache
        const cacheKey = this.getCacheKey(xaml, options);
        const cached = this.renderCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
            return cached.result;
        }

        // Render
        try {
            const result = await this.activeRenderer.render(xaml, options);

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
     * Generate a cache key for a render request
     */
    private getCacheKey(xaml: string, options: RenderOptions): string {
        return JSON.stringify({
            xaml,
            width: options.width,
            height: options.height,
            theme: options.theme,
            scale: options.scale
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

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];

        this._onRendererChanged.dispose();
    }
}
