// WinDev Helper - Native XAML Renderer (Windows)
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as net from 'net';
import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { IXamlRenderer, RenderOptions, RenderResult, RendererType, ResourceDictionaryInfo } from './types';
import { preprocessXaml } from './xamlPreprocessor';

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
    layoutWidth?: number;
    layoutHeight?: number;
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
    resolve: (result: RenderResult | void) => void;
    reject?: (error: Error) => void;
    timeout: NodeJS.Timeout;
    startTime: number;
    /** For ping requests that need rejection on dispose */
    isPing?: boolean;
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
    private disposed = false;

    // Configurable timeouts
    private readonly startupTimeoutMs = 15000;
    private readonly renderTimeoutMs = 30000;
    private readonly pingTimeoutMs = 5000;
    private readonly healthCheckIntervalMs = 30000;
    private cachedAvailable: boolean | null = null;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
        this.pipeName = `WinDevHelper.XamlPreview.${process.pid}`;
    }

    /**
     * Get the Windows RID (Runtime Identifier) for the current architecture
     */
    private static getWindowsRid(): string | null {
        if (process.platform !== 'win32') {
            return null;
        }
        switch (process.arch) {
            case 'x64':
                return 'win-x64';
            case 'arm64':
                return 'win-arm64';
            case 'ia32':
                return 'win-x86';
            default:
                return null;
        }
    }

    /**
     * Check if native renderer is available (Windows with matching architecture binary)
     */
    public get available(): boolean {
        // Cache the result to avoid repeated file system checks
        if (this.cachedAvailable !== null) {
            return this.cachedAvailable;
        }

        // Must be Windows
        if (process.platform !== 'win32') {
            this.cachedAvailable = false;
            return false;
        }

        // Must have a supported architecture
        const rid = NativeXamlRenderer.getWindowsRid();
        if (!rid) {
            console.warn(`[NativeRenderer] Unsupported architecture: ${process.arch}`);
            this.cachedAvailable = false;
            return false;
        }

        // Check if the binary exists
        const executablePath = this.findRendererExecutable();
        this.cachedAvailable = executablePath !== null;
        
        if (!this.cachedAvailable) {
            console.warn(`[NativeRenderer] No native renderer binary found for ${rid}`);
        }
        
        return this.cachedAvailable;
    }

    /**
     * Initialize the native renderer process
     */
    public async initialize(): Promise<void> {
        if (this.initialized && this.isTransportReady()) {
            return;
        }

        if (this.disposed) {
            throw new Error('Native renderer has been disposed');
        }

        if (this.initialized) {
            this.resetTransport('Renderer transport was no longer writable');
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInitialize();
        
        try {
            await this.initPromise;
            if (!this.isTransportReady()) {
                throw new Error('Renderer exited before initialization completed');
            }
            this.initialized = true;
            this.startHealthCheck();
        } catch (err) {
            this.resetTransport(err instanceof Error ? err.message : String(err));
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

        // A successful ping prevents a process that exits after printing READY
        // from being published as an initialized renderer.
        await this.ping();
        console.log('[NativeRenderer] Warm-up ping succeeded');

        console.log('[NativeRenderer] Initialized successfully');
    }

    /**
     * Find the native renderer executable
     */
    private findRendererExecutable(): string | null {
        const rid = NativeXamlRenderer.getWindowsRid();
        if (!rid) {
            return null;
        }

        const possiblePaths = [
            // Development: built locally (.NET 10) - architecture-specific
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Release', 'net10.0-windows10.0.19041.0', rid, 'publish', 'XamlPreviewHost.exe'),
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Debug', 'net10.0-windows10.0.19041.0', rid, 'XamlPreviewHost.exe'),
            // Development: AnyCPU builds
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Release', 'net10.0-windows10.0.19041.0', 'XamlPreviewHost.exe'),
            path.join(this.extensionPath, 'native-renderer', 'XamlPreviewHost', 'bin', 'Debug', 'net10.0-windows10.0.19041.0', 'XamlPreviewHost.exe'),
            // Production: bundled with extension - architecture-specific folder
            path.join(this.extensionPath, 'bin', rid, 'XamlPreviewHost.exe'),
            // Production: bundled with extension - flat folder (current build setup)
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

        console.error(`[NativeRenderer] Renderer not found for ${rid}. Searched:`, possiblePaths);
        return null;
    }

    /**
     * Start the renderer process
     */
    private async startRendererProcess(rendererPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = ['--pipe', this.pipeName];
            
            console.log(`[NativeRenderer] Spawning: ${rendererPath} ${args.join(' ')}`);
            
            const child = spawn(rendererPath, args, {
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            this.process = child;

            let startupError = '';
            let resolved = false;
            const startupTimeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    child.kill();
                    reject(new Error(`Renderer startup timed out after ${this.startupTimeoutMs}ms`));
                }
            }, this.startupTimeoutMs);

            child.stderr?.on('data', (data: Buffer) => {
                const msg = data.toString();
                startupError += msg;
                console.error('[XamlPreviewHost stderr]', msg.trim());
            });

            child.stdout?.on('data', (data: Buffer) => {
                const msg = data.toString().trim();
                console.log('[XamlPreviewHost stdout]', msg);
                if (msg.includes('READY') && !resolved) {
                    resolved = true;
                    clearTimeout(startupTimeout);
                    resolve();
                }
            });

            child.on('error', (err) => {
                console.error('[NativeRenderer] Process error:', err);
                if (!resolved) {
                    resolved = true;
                    clearTimeout(startupTimeout);
                    reject(new Error(`Failed to start renderer: ${err.message}`));
                }
            });

            child.on('exit', (code, signal) => {
                console.log(`[NativeRenderer] Process exited: code=${code}, signal=${signal}`);
                if (!resolved) {
                    resolved = true;
                    clearTimeout(startupTimeout);
                    if (this.process === child) {
                        this.process = null;
                    }
                    reject(new Error(`Renderer exited during startup: code=${code}, signal=${signal}${startupError ? `, stderr: ${startupError}` : ''}`));
                } else {
                    this.handleProcessExit(child);
                }
            });

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
            let connectionResolved = false;
            
            console.log(`[NativeRenderer] Connecting to pipe: ${pipePath}`);
            
            // Connection timeout
            const connectionTimeout = setTimeout(() => {
                if (!connectionResolved) {
                    connectionResolved = true;
                    this.pipeClient?.destroy();
                    reject(new Error('Pipe connection timed out'));
                }
            }, 5000);

            const socket = net.createConnection(pipePath, () => {
                if (!connectionResolved) {
                    connectionResolved = true;
                    clearTimeout(connectionTimeout);
                    console.log('[NativeRenderer] Connected to pipe');
                    this.lastActivityTime = Date.now();
                    resolve();
                }
            });
            this.pipeClient = socket;

            socket.on('data', (data: Buffer) => {
                this.lastActivityTime = Date.now();
                this.handlePipeData(data);
            });

            socket.on('error', (err) => {
                console.error('[NativeRenderer] Pipe error:', err);
                if (!connectionResolved) {
                    connectionResolved = true;
                    clearTimeout(connectionTimeout);
                    reject(new Error(`Failed to connect to pipe: ${err.message}`));
                } else if (this.pipeClient === socket) {
                    this.handleConnectionFailure(err);
                }
            });

            socket.on('close', () => {
                console.log('[NativeRenderer] Pipe closed');
                if (this.pipeClient === socket && !this.disposed) {
                    this.handleConnectionFailure(new Error('Renderer pipe closed'));
                }
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
            const message = this.responseBuffer.substring(0, newlineIndex).replace(/^\uFEFF/, '');
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
                ...(response.layoutWidth !== undefined && { layoutWidth: response.layoutWidth }),
                ...(response.layoutHeight !== undefined && { layoutHeight: response.layoutHeight }),
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
    private handleConnectionFailure(err: Error): void {
        console.error('[NativeRenderer] Connection failed:', err.message);
        this.resetTransport(err.message, 'PIPE_ERROR');
    }

    /**
     * Handle renderer process exit
     */
    private handleProcessExit(child: ChildProcess): void {
        if (this.process !== child) {
            return;
        }
        this.resetTransport('Renderer process exited', 'PROCESS_EXITED', false);
        console.log('[NativeRenderer] Process exited, will reinitialize on next render');
    }

    private resetTransport(message: string, code: string = 'PIPE_ERROR', killProcess: boolean = true): void {
        this.stopHealthCheck();
        this.initialized = false;
        this.initPromise = null;
        this.responseBuffer = '';

        const socket = this.pipeClient;
        this.pipeClient = null;
        if (socket && !socket.destroyed) {
            socket.destroy();
        }

        const child = this.process;
        this.process = null;
        if (killProcess && child && child.exitCode === null && !child.killed) {
            child.kill();
        }

        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            if (pending.isPing) {
                pending.reject?.(new Error(message));
            } else {
                pending.resolve({ success: false, code, message });
            }
        }
        this.pendingRequests.clear();
    }

    private isTransportReady(): boolean {
        return this.process !== null
            && this.process.exitCode === null
            && !this.process.killed
            && this.pipeClient !== null
            && !this.pipeClient.destroyed
            && this.pipeClient.writable;
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
                this.resetTransport(err instanceof Error ? err.message : String(err));
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
                resolve: (_result?: RenderResult | void) => {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    resolve();
                },
                reject,
                timeout,
                startTime: Date.now(),
                isPing: true
            });

            const message = JSON.stringify(request) + '\n';
            if (!this.isTransportReady()) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                reject(new Error('Renderer pipe is not writable'));
                return;
            }
            this.pipeClient!.write(message, 'utf-8', (err) => {
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
        let result = await this.renderOnce(xaml, options);
        if (!result.success && ['WRITE_ERROR', 'PIPE_ERROR', 'PROCESS_EXITED', 'NOT_CONNECTED'].includes(result.code)) {
            console.warn(`[NativeRenderer] Retrying render after transport failure: ${result.code}`);
            this.resetTransport(result.message, result.code);
            result = await this.renderOnce(xaml, options);
        }
        return result;
    }

    private async renderOnce(xaml: string, options: RenderOptions): Promise<RenderResult> {
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

        if (!this.isTransportReady()) {
            return {
                success: false,
                code: 'NOT_CONNECTED',
                message: 'Not connected to renderer'
            };
        }

        // Preprocess XAML to replace third-party controls with placeholders
        const preprocessed = preprocessXaml(xaml);

        const requestId = randomUUID();
        const request: NativeRenderRequest = {
            type: 'render',
            requestId,
            xaml: preprocessed.xaml,
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

        const result = await new Promise<RenderResult>((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                resolve({
                    success: false,
                    code: 'TIMEOUT',
                    message: `Render request timed out after ${this.renderTimeoutMs}ms`
                });
            }, this.renderTimeoutMs);

            this.pendingRequests.set(requestId, { 
                resolve: resolve as (result: RenderResult | void) => void, 
                timeout,
                startTime: Date.now()
            });

            const message = JSON.stringify(request) + '\n';
            if (!this.isTransportReady()) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                resolve({
                    success: false,
                    code: 'NOT_CONNECTED',
                    message: 'Renderer pipe is not writable'
                });
                return;
            }
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

        // Merge preprocessing warnings into the result
        if (preprocessed.warnings.length > 0 && result.success) {
            result.warnings = [...preprocessed.warnings, ...(result.warnings || [])];
        }

        return result;
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
        this.disposed = true;
        this.stopHealthCheck();

        // Resolve all pending requests with appropriate responses
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            if (pending.isPing) {
                // Ping requests just resolve with void - the caller handles errors
                pending.resolve(undefined);
            } else {
                // Render requests get a failure result
                pending.resolve({
                    success: false,
                    code: 'DISPOSED',
                    message: 'Renderer was disposed while request was pending'
                });
            }
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
