// WinDev Helper - XAML Renderer Abstraction
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

/**
 * Resource dictionary for rendering context
 */
export interface ResourceDictionaryInfo {
    /** Source path as specified in XAML */
    source: string;
    /** XAML content of the dictionary */
    content: string;
}

/**
 * Options for rendering XAML
 */
export interface RenderOptions {
    /** Target width in device-independent pixels */
    width: number;
    /** Target height in device-independent pixels */
    height: number;
    /** Theme to apply */
    theme: 'light' | 'dark';
    /** Scale factor for high-DPI (1.0 = 96 DPI) */
    scale: number;
    /** Path to the project for custom control resolution (optional) */
    projectPath?: string;
    /** Path to the XAML file being rendered (for relative resource resolution) */
    xamlFilePath?: string;
    /** App.xaml content (preprocessed) for resource resolution */
    appXamlContent?: string;
    /** Resource dictionaries to load before rendering */
    resourceDictionaries?: ResourceDictionaryInfo[];
}

/**
 * Mapping of a rendered element back to its XAML source
 */
export interface ElementMapping {
    /** Unique identifier for the element */
    id: string;
    /** x:Name if specified */
    name?: string;
    /** Control type (e.g., 'Button', 'TextBox') */
    type: string;
    /** Bounding rectangle in rendered image coordinates */
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** Line number in XAML source (1-based) */
    xamlLine: number;
    /** Column number in XAML source (1-based) */
    xamlColumn: number;
}

/**
 * Result of a successful render
 */
export interface RenderSuccess {
    success: true;
    /** Render output type */
    type: 'image' | 'html';
    /** Base64-encoded PNG (for image) or HTML string (for html) */
    data: string;
    /** Rendered image width in pixels (for image type) */
    imageWidth?: number;
    /** Rendered image height in pixels (for image type) */
    imageHeight?: number;
    /** Element mappings for click-to-source */
    elementMappings: ElementMapping[];
    /** Non-fatal warnings */
    warnings: string[];
    /** Time taken to render in milliseconds */
    renderTimeMs: number;
}

/**
 * Result of a failed render
 */
export interface RenderError {
    success: false;
    /** Error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Line number where error occurred (if applicable) */
    line?: number;
    /** Column number where error occurred (if applicable) */
    column?: number;
}

export type RenderResult = RenderSuccess | RenderError;

/**
 * Renderer type identifier
 */
export type RendererType = 'native' | 'azure' | 'html';

/**
 * Abstract interface for XAML renderers
 */
export interface IXamlRenderer {
    /** Renderer type identifier */
    readonly type: RendererType;
    
    /** Whether this renderer is available on the current platform */
    readonly available: boolean;
    
    /** Whether this renderer supports custom controls */
    readonly supportsCustomControls: boolean;
    
    /** Human-readable description for UI */
    readonly displayName: string;
    
    /**
     * Initialize the renderer (start background process, etc.)
     * Called once when the renderer is first needed
     */
    initialize(): Promise<void>;
    
    /**
     * Render XAML content
     * @param xaml The XAML content to render
     * @param options Rendering options
     * @returns Render result (image data or error)
     */
    render(xaml: string, options: RenderOptions): Promise<RenderResult>;
    
    /**
     * Clean up resources (stop background process, etc.)
     */
    dispose(): void;
}

/**
 * Renderer status for UI display
 */
export interface RendererStatus {
    type: RendererType;
    displayName: string;
    status: 'ready' | 'initializing' | 'error' | 'unavailable';
    errorMessage?: string;
}
