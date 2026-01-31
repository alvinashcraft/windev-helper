// WinDev Helper - Native XAML Renderer (Windows)
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as net from 'net';
import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { IXamlRenderer, RenderOptions, RenderResult, RendererType, ResourceDictionaryInfo } from './types';

/**
 * Request sent to the native renderer process
 */
interface NativeRenderRequest {
    type: 'render' | 'ping';
    requestId: string;
    xaml?: string;
    options?: {
        width: number;
        height: number;
        theme: 'light' | 'dark';
        scale: number;
        projectPath?: string;
        appXamlContent?: string;
        resourceDictionaries?: ResourceDictionaryInfo[];
    };
}

/**
 * Response from the native renderer process
 */
interface NativeRenderResponse {
    type: 'renderResult' | 'pong';
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

interface PendingRequest {
    resolve: (result: RenderResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    startTime: number;
}

/**
 * Native XAML renderer using a local WinUI host process.
 * Only available on Windows.
 * 
 * Features:
 * - Keeps host process alive between renders
 * - Auto-reconnects on failure
 * - Configurable timeouts
 * - Health check pings
 */
export class NativeXamlRenderer implements IXamlRenderer {
    public readonly type: RendererType = 'native';
    public readonly supportsCustomControls = false; // v1 limitation
    public readonly displayName = 'Native WinUI';
    
    private readonly extensionPath: string;
    private readonly pipeName: string;
    private process: ChildProcess | null = null;
    private pipeClient: net.Socket | null = null;
    private pendingRequests = new Map<string, PendingRequest>();
    private initialized = false;
    private initPromise: Promise<void> | null = null;
    private responseBuffer = '';
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private lastActivityTime = 0;
    private reconnectAttempts = 0;
    private isReconnecting = false;

    // Configurable timeouts
    private readonly startupTimeoutMs = 15000;
    private readonly renderTimeoutMs = 30000;
    private readonly pingTimeoutMs = 5000;
    private readonly healthCheckIntervalMs = 30000;
    private readonly maxReconnectAttempts = 3;
    private readonly reconnectDelayMs = 1000;

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
            this.reconnectAttempts = 0;
            this.startHealthCheck();
        } catch (err) {
            this.initPromise = null;
            throw err;
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

        console.log(`[NativeRenderer] Starting renderer: ${rendererPath}`);

        // Start the renderer process
        await this.startRendererProcess(rendererPath);

        // Connect to the named pipe
        await this.connectToPipe();

        console.log('[NativeRenderer] Initialized successfully');
    }

    /**
     * Find the native renderer executable
     */
    private findRendererExecutable(): string | null {
        const possiblePaths = [
            // Development: built locally (.NET 10)
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Release', 'net10.0-windows10.0.19041.0', 'win-x64', 'publish', 'XamlPreviewHost.exe'),
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Debug', 'net10.0-windows10.0.19041.0', 'win-x64', 'XamlPreviewHost.exe'),
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Release', 'net10.0-windows10.0.19041.0', 'XamlPreviewHost.exe'),
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Debug', 'net10.0-windows10.0.19041.0', 'XamlPreviewHost.exe'),
            // Production: bundled with extension
            path.join(this.extensionPath, 'bin', 'XamlPreviewHost.exe'),
        ];

        for (const p of possiblePaths) {
            try {
                const fs = require('fs');
                if (fs.existsSync(p)) {
                    console.log(`[NativeRenderer] Found renderer at: ${p}`);
                    return p;
                }
            } catch {
                // Ignore errors, try next path
            }
        }

        console.error('[NativeRenderer] Renderer not found. Searched:', possiblePaths);
        return null;
    }

    /**
     * Start the renderer process
     */
    private async startRendererProcess(rendererPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = ['--pipe', this.pipeName];
            
            console.log(`[NativeRenderer] Spawning: ${rendererPath} ${args.join(' ')}`);
            
            this.process = spawn(rendererPath, args, {
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let startupError = '';
            let resolved = false;

            this.process.stderr?.on('data', (data: Buffer) => {
                const msg = data.toString();
                startupError += msg;
                console.error('[XamlPreviewHost stderr]', msg.trim());
            });

            this.process.stdout?.on('data', (data: Buffer) => {
                const msg = data.toString().trim();
                console.log('[XamlPreviewHost stdout]', msg);
                if (msg.includes('READY') && !resolved) {
                    resolved = true;
                    resolve();
                }
            });

            this.process.on('error', (err) => {
                console.error('[NativeRenderer] Process error:', err);
                if (!resolved) {
                    resolved = true;
                    reject(new Error(`Failed to start renderer: ${err.message}`));
                }
            });

            this.process.on('exit', (code, signal) => {
                console.log(`[NativeRenderer] Process exited: code=${code}, signal=${signal}`);
                if (!resolved) {
                    resolved = true;
                    reject(new Error(`Renderer exited during startup: code=${code}, signal=${signal}${startupError ? `, stderr: ${startupError}` : ''}`));
                } else {
                    this.handleProcessExit();
                }
            });

            // Timeout for startup
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.process?.kill();
                    reject(new Error(`Renderer startup timed out after ${this.startupTimeoutMs}ms`));
                }
            }, this.startupTimeoutMs);
        });
    }

    /**
     * Connect to the renderer's named pipe with retry logic
     */
    private async connectToPipe(): Promise<void> {
        const maxAttempts = 5;
        const delayMs = 500;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.doConnectToPipe();
                return;
            } catch (err) {
                console.log(`[NativeRenderer] Pipe connection attempt ${attempt}/${maxAttempts} failed:`, err);
                if (attempt < maxAttempts) {
                    await this.delay(delayMs);
                } else {
                    throw err;
                }
            }
        }
    }

    private async doConnectToPipe(): Promise<void> {
        return new Promise((resolve, reject) => {
            const pipePath = `\\\\.\\pipe\\${this.pipeName}`;
            
            console.log(`[NativeRenderer] Connecting to pipe: ${pipePath}`);
            
            this.pipeClient = net.createConnection(pipePath, () => {
                console.log('[NativeRenderer] Connected to pipe');
                this.lastActivityTime = Date.now();
                resolve();
            });

            this.pipeClient.on('data', (data: Buffer) => {
                this.lastActivityTime = Date.now();
                this.handlePipeData(data);
            });

            this.pipeClient.on('error', (err) => {
                console.error('[NativeRenderer] Pipe error:', err);
                if (!this.initialized) {
                    reject(new Error(`Failed to connect to pipe: ${err.message}`));
                } else {
                    this.handlePipeError(err);
                }
            });

            this.pipeClient.on('close', () => {
                console.log('[NativeRenderer] Pipe closed');
                if (this.initialized && !this.isReconnecting) {
                    this.scheduleReconnect();
                }
            });

            // Connection timeout
            setTimeout(() => {
                if (!this.pipeClient?.connecting === false) {
                    this.pipeClient?.destroy();
                    reject(new Error('Pipe connection timed out'));
                }
            }, 5000);
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

            if (message.trim()) {
                try {
                    const response = JSON.parse(message) as NativeRenderResponse;
                    this.handleResponse(response);
                } catch (err) {
                    console.error('[NativeRenderer] Failed to parse response:', err, 'Message:', message.substring(0, 200));
                }
            }
        }
    }

    /**
     * Handle a parsed response from the renderer
     */
    private handleResponse(response: NativeRenderResponse): void {
        const pending = this.pendingRequests.get(response.requestId);
        if (!pending) {
            // Might be a pong or stale response
            if (response.type === 'pong') {
                console.log('[NativeRenderer] Received pong');
            } else {
                console.warn('[NativeRenderer] Received response for unknown request:', response.requestId);
            }
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.requestId);

        const elapsed = Date.now() - pending.startTime;

        if (response.success) {
            pending.resolve({
                success: true,
                type: 'image',
                data: response.imageBase64 || '',
                ...(response.imageWidth !== undefined && { imageWidth: response.imageWidth }),
                ...(response.imageHeight !== undefined && { imageHeight: response.imageHeight }),
                elementMappings: (response.elements || []).map(el => ({
                    id: el.id,
                    ...(el.name !== undefined && { name: el.name }),
                    type: el.type,
                    bounds: el.bounds,
                    xamlLine: el.xamlLine,
                    xamlColumn: el.xamlColumn
                })),
                warnings: response.warnings || [],
                renderTimeMs: response.renderTimeMs || elapsed
            });
        } else {
            pending.resolve({
                success: false,
                code: response.error?.code || 'UNKNOWN_ERROR',
                message: response.error?.message || 'Unknown error',
                ...(response.error?.line !== undefined && { line: response.error.line }),
                ...(response.error?.column !== undefined && { column: response.error.column })
            });
        }
    }

    /**
     * Handle pipe errors
     */
    private handlePipeError(err: Error): void {
        // Reject all pending requests
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.resolve({
                success: false,
                code: 'PIPE_ERROR',
                message: err.message
            });
        }
        this.pendingRequests.clear();
    }

    /**
     * Handle renderer process exit
     */
    private handleProcessExit(): void {
        this.stopHealthCheck();
        this.initialized = false;
        this.initPromise = null;
        
        if (this.pipeClient) {
            this.pipeClient.destroy();
            this.pipeClient = null;
        }
        this.process = null;

        // Reject all pending requests with a retriable error
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.resolve({
                success: false,
                code: 'PROCESS_EXITED',
                message: 'Renderer process exited. Will restart on next request.'
            });
        }
        this.pendingRequests.clear();

        console.log('[NativeRenderer] Process exited, will reinitialize on next render');
    }

    /**
     * Schedule a reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }

        this.isReconnecting = true;
        this.initialized = false;
        this.initPromise = null;

        console.log(`[NativeRenderer] Scheduling reconnect attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);

        setTimeout(async () => {
            this.reconnectAttempts++;
            try {
                await this.initialize();
                console.log('[NativeRenderer] Reconnected successfully');
            } catch (err) {
                console.error('[NativeRenderer] Reconnect failed:', err);
            }
            this.isReconnecting = false;
        }, this.reconnectDelayMs);
    }

    /**
     * Start health check interval
     */
    private startHealthCheck(): void {
        this.stopHealthCheck();
        
        this.healthCheckInterval = setInterval(async () => {
            if (!this.initialized || !this.pipeClient) {
                return;
            }

            // Only ping if there's been no activity for a while
            const idleTime = Date.now() - this.lastActivityTime;
            if (idleTime < this.healthCheckIntervalMs / 2) {
                return;
            }

            try {
                await this.ping();
            } catch (err) {
                console.error('[NativeRenderer] Health check failed:', err);
                // Connection might be dead, trigger reconnect
                this.scheduleReconnect();
            }
        }, this.healthCheckIntervalMs);
    }

    /**
     * Stop health check interval
     */
    private stopHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Send a ping to check connection health
     */
    private async ping(): Promise<void> {
        return new Promise((resolve, reject) => {
            const requestId = randomUUID();
            const request: NativeRenderRequest = {
                type: 'ping',
                requestId
            };

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Ping timeout'));
            }, this.pingTimeoutMs);

            this.pendingRequests.set(requestId, {
                resolve: () => {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    resolve();
                },
                reject,
                timeout,
                startTime: Date.now()
            });

            const message = JSON.stringify(request) + '\n';
            this.pipeClient?.write(message, 'utf-8', (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    reject(err);
                }
            });
        });
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
                ...(options.projectPath !== undefined && { projectPath: options.projectPath }),
                ...(options.appXamlContent !== undefined && { appXamlContent: options.appXamlContent }),
                ...(options.resourceDictionaries !== undefined && { resourceDictionaries: options.resourceDictionaries })
            }
        };

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                resolve({
                    success: false,
                    code: 'TIMEOUT',
                    message: `Render request timed out after ${this.renderTimeoutMs}ms`
                });
            }, this.renderTimeoutMs);

            this.pendingRequests.set(requestId, { 
                resolve, 
                reject: () => {}, 
                timeout,
                startTime: Date.now()
            });

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
     * Helper delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        console.log('[NativeRenderer] Disposing...');
        
        this.stopHealthCheck();

        // Reject all pending requests
        const error = new Error('Renderer disposed');
        for (const [, pending] of this.pendingRequests) {
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
        this.initPromise = null;
    }
}
