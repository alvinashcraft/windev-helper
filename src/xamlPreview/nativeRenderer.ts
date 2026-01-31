// WinDev Helper - Native XAML Renderer (Windows)
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as net from 'net';
import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { IXamlRenderer, RenderOptions, RenderResult, RendererType } from './types';

/**
 * Request sent to the native renderer process
 */
interface NativeRenderRequest {
    type: 'render';
    requestId: string;
    xaml: string;
    options: {
        width: number;
        height: number;
        theme: 'light' | 'dark';
        scale: number;
        projectPath?: string;
    };
}

/**
 * Response from the native renderer process
 */
interface NativeRenderResponse {
    type: 'renderResult';
    requestId: string;
    success: boolean;
    imageBase64?: string;
    imageWidth?: number;
    imageHeight?: number;
    elements?: Array<{
        id: string;
        name?: string;
        type: string;
        bounds: { x: number; y: number; width: number; height: number };
        xamlLine: number;
        xamlColumn: number;
    }>;
    warnings?: string[];
    renderTimeMs?: number;
    error?: {
        code: string;
        message: string;
        line?: number;
        column?: number;
    };
}

/**
 * Native XAML renderer using a local WinUI host process
 * Only available on Windows
 */
export class NativeXamlRenderer implements IXamlRenderer {
    public readonly type: RendererType = 'native';
    public readonly supportsCustomControls = false; // v1 limitation
    public readonly displayName = 'Native WinUI';
    
    private readonly extensionPath: string;
    private readonly pipeName: string;
    private process: ChildProcess | null = null;
    private pipeClient: net.Socket | null = null;
    private pendingRequests = new Map<string, {
        resolve: (result: RenderResult) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }>();
    private initialized = false;
    private initPromise: Promise<void> | null = null;
    private responseBuffer = '';

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
        this.pipeName = `WinDevHelper.XamlPreview.${process.pid}`;
    }

    /**
     * Check if native renderer is available (Windows only)
     */
    public get available(): boolean {
        return process.platform === 'win32';
    }

    /**
     * Initialize the native renderer process
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInitialize();
        
        try {
            await this.initPromise;
            this.initialized = true;
        } finally {
            this.initPromise = null;
        }
    }

    private async doInitialize(): Promise<void> {
        if (!this.available) {
            throw new Error('Native renderer is only available on Windows');
        }

        // Find the renderer executable
        const rendererPath = this.findRendererExecutable();
        if (!rendererPath) {
            throw new Error('Native renderer executable not found. Please build the XamlPreviewHost project.');
        }

        // Start the renderer process
        await this.startRendererProcess(rendererPath);

        // Connect to the named pipe
        await this.connectToPipe();
    }

    /**
     * Find the native renderer executable
     */
    private findRendererExecutable(): string | null {
        // Check for the renderer in the extension's native-renderer folder
        const possiblePaths = [
            // Development: built locally
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Release', 'net8.0-windows10.0.19041.0', 'win-x64', 'publish', 'XamlPreviewHost.exe'),
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Debug', 'net8.0-windows10.0.19041.0', 'win-x64', 'XamlPreviewHost.exe'),
            // Production: bundled with extension
            path.join(this.extensionPath, 'bin', 'XamlPreviewHost.exe'),
        ];

        for (const p of possiblePaths) {
            try {
                const fs = require('fs');
                if (fs.existsSync(p)) {
                    return p;
                }
            } catch {
                // Ignore errors, try next path
            }
        }

        return null;
    }

    /**
     * Start the renderer process
     */
    private async startRendererProcess(rendererPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = ['--pipe', this.pipeName];
            
            this.process = spawn(rendererPath, args, {
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let startupError = '';

            this.process.stderr?.on('data', (data: Buffer) => {
                startupError += data.toString();
                console.error('[XamlPreviewHost]', data.toString());
            });

            this.process.stdout?.on('data', (data: Buffer) => {
                const msg = data.toString().trim();
                if (msg === 'READY') {
                    resolve();
                }
            });

            this.process.on('error', (err) => {
                reject(new Error(`Failed to start renderer: ${err.message}`));
            });

            this.process.on('exit', (code, signal) => {
                if (!this.initialized) {
                    reject(new Error(`Renderer exited during startup: code=${code}, signal=${signal}, stderr=${startupError}`));
                } else {
                    console.error(`[XamlPreviewHost] Process exited: code=${code}, signal=${signal}`);
                    this.handleProcessExit();
                }
            });

            // Timeout for startup
            setTimeout(() => {
                if (!this.initialized && this.process) {
                    this.process.kill();
                    reject(new Error('Renderer startup timed out'));
                }
            }, 10000);
        });
    }

    /**
     * Connect to the renderer's named pipe
     */
    private async connectToPipe(): Promise<void> {
        return new Promise((resolve, reject) => {
            const pipePath = `\\\\.\\pipe\\${this.pipeName}`;
            
            this.pipeClient = net.createConnection(pipePath, () => {
                console.log('[NativeRenderer] Connected to pipe');
                resolve();
            });

            this.pipeClient.on('data', (data: Buffer) => {
                this.handlePipeData(data);
            });

            this.pipeClient.on('error', (err) => {
                if (!this.initialized) {
                    reject(new Error(`Failed to connect to pipe: ${err.message}`));
                } else {
                    console.error('[NativeRenderer] Pipe error:', err);
                    this.handlePipeError(err);
                }
            });

            this.pipeClient.on('close', () => {
                console.log('[NativeRenderer] Pipe closed');
            });
        });
    }

    /**
     * Handle incoming data from the pipe
     */
    private handlePipeData(data: Buffer): void {
        this.responseBuffer += data.toString('utf-8');

        // Messages are newline-delimited JSON
        let newlineIndex: number;
        while ((newlineIndex = this.responseBuffer.indexOf('\n')) !== -1) {
            const message = this.responseBuffer.substring(0, newlineIndex);
            this.responseBuffer = this.responseBuffer.substring(newlineIndex + 1);

            try {
                const response = JSON.parse(message) as NativeRenderResponse;
                this.handleResponse(response);
            } catch (err) {
                console.error('[NativeRenderer] Failed to parse response:', err);
            }
        }
    }

    /**
     * Handle a parsed response from the renderer
     */
    private handleResponse(response: NativeRenderResponse): void {
        const pending = this.pendingRequests.get(response.requestId);
        if (!pending) {
            console.warn('[NativeRenderer] Received response for unknown request:', response.requestId);
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.requestId);

        if (response.success) {
            pending.resolve({
                success: true,
                type: 'image',
                data: response.imageBase64 || '',
                imageWidth: response.imageWidth,
                imageHeight: response.imageHeight,
                elementMappings: (response.elements || []).map(el => ({
                    id: el.id,
                    name: el.name,
                    type: el.type,
                    bounds: el.bounds,
                    xamlLine: el.xamlLine,
                    xamlColumn: el.xamlColumn
                })),
                warnings: response.warnings || [],
                renderTimeMs: response.renderTimeMs || 0
            });
        } else {
            pending.resolve({
                success: false,
                code: response.error?.code || 'UNKNOWN_ERROR',
                message: response.error?.message || 'Unknown error',
                line: response.error?.line,
                column: response.error?.column
            });
        }
    }

    /**
     * Handle pipe errors
     */
    private handlePipeError(err: Error): void {
        // Reject all pending requests
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(err);
        }
        this.pendingRequests.clear();
    }

    /**
     * Handle renderer process exit
     */
    private handleProcessExit(): void {
        this.initialized = false;
        this.pipeClient = null;
        this.process = null;

        // Reject all pending requests
        const error = new Error('Renderer process exited');
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pendingRequests.clear();
    }

    /**
     * Render XAML content
     */
    public async render(xaml: string, options: RenderOptions): Promise<RenderResult> {
        if (!this.available) {
            return {
                success: false,
                code: 'NOT_AVAILABLE',
                message: 'Native renderer is only available on Windows'
            };
        }

        // Ensure initialized
        try {
            await this.initialize();
        } catch (err) {
            return {
                success: false,
                code: 'INIT_FAILED',
                message: `Failed to initialize renderer: ${err instanceof Error ? err.message : String(err)}`
            };
        }

        if (!this.pipeClient) {
            return {
                success: false,
                code: 'NOT_CONNECTED',
                message: 'Not connected to renderer'
            };
        }

        const requestId = randomUUID();
        const request: NativeRenderRequest = {
            type: 'render',
            requestId,
            xaml,
            options: {
                width: options.width,
                height: options.height,
                theme: options.theme,
                scale: options.scale,
                projectPath: options.projectPath
            }
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                resolve({
                    success: false,
                    code: 'TIMEOUT',
                    message: 'Render request timed out'
                });
            }, 30000);

            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            const message = JSON.stringify(request) + '\n';
            this.pipeClient!.write(message, 'utf-8', (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    resolve({
                        success: false,
                        code: 'WRITE_ERROR',
                        message: `Failed to send request: ${err.message}`
                    });
                }
            });
        });
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        // Reject all pending requests
        const error = new Error('Renderer disposed');
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pendingRequests.clear();

        // Close pipe
        if (this.pipeClient) {
            this.pipeClient.destroy();
            this.pipeClient = null;
        }

        // Kill process
        if (this.process) {
            this.process.kill();
            this.process = null;
        }

        this.initialized = false;
    }
}
