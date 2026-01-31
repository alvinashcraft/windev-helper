// WinDev Helper - HTML Fallback XAML Renderer
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import { IXamlRenderer, RenderOptions, RenderResult, RendererType } from './types';
import { XamlParser } from '../xamlDesigner/xamlParser';
import { XamlHtmlRenderer, RenderOptions as HtmlRenderOptions } from '../xamlDesigner/htmlRenderer';

/**
 * HTML-based XAML renderer that converts XAML to HTML/CSS approximations.
 * Available on all platforms as a fallback when native rendering is not available.
 */
export class HtmlXamlRenderer implements IXamlRenderer {
    public readonly type: RendererType = 'html';
    public readonly available = true; // Always available
    public readonly supportsCustomControls = false;
    public readonly displayName = 'HTML Preview';

    private readonly parser: XamlParser;
    private readonly renderer: XamlHtmlRenderer;

    constructor() {
        this.parser = new XamlParser();
        this.renderer = new XamlHtmlRenderer();
    }

    /**
     * Initialize the renderer (no-op for HTML renderer)
     */
    public async initialize(): Promise<void> {
        // Nothing to initialize
    }

    /**
     * Render XAML to HTML
     */
    public async render(xaml: string, options: RenderOptions): Promise<RenderResult> {
        const startTime = Date.now();

        try {
            // Parse XAML
            const parseResult = this.parser.parse(xaml);

            if (parseResult.errors.length > 0) {
                const firstError = parseResult.errors[0];
                return {
                    success: false,
                    code: 'XAML_PARSE_ERROR',
                    message: firstError.message,
                    line: firstError.line,
                    column: firstError.column
                };
            }

            if (!parseResult.root) {
                return {
                    success: false,
                    code: 'NO_CONTENT',
                    message: 'No content to render'
                };
            }

            // Render to HTML
            const htmlOptions: HtmlRenderOptions = {
                includeElementIds: true,
                baseFontSize: 14,
                theme: options.theme
            };

            const renderResult = this.renderer.render(parseResult.root, htmlOptions);

            const renderTimeMs = Date.now() - startTime;

            return {
                success: true,
                type: 'html',
                data: renderResult.html,
                elementMappings: renderResult.elementMappings.map((m) => ({
                    id: m.elementId,
                    // name is omitted - HTML renderer doesn't track x:Name
                    type: m.xamlElement.tagName,
                    bounds: {
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 0
                    },
                    xamlLine: m.xamlElement.sourceLocation.startLine,
                    xamlColumn: m.xamlElement.sourceLocation.startColumn
                })),
                warnings: [],
                renderTimeMs
            };
        } catch (err) {
            return {
                success: false,
                code: 'RENDER_ERROR',
                message: err instanceof Error ? err.message : String(err)
            };
        }
    }

    /**
     * Dispose of resources (no-op for HTML renderer)
     */
    public dispose(): void {
        // Nothing to dispose
    }
}
