// WinDev Helper - Cancellation Utilities
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as cp from 'child_process';

/**
 * Result of a cancellable operation.
 */
export interface CancellableResult<T> {
    /** Whether the operation was cancelled */
    cancelled: boolean;
    /** The result value (undefined if cancelled) */
    result?: T;
    /** Error if the operation failed */
    error?: Error;
}

/**
 * Options for running a cancellable process.
 */
export interface CancellableProcessOptions {
    /** The command to run */
    command: string;
    /** Arguments for the command */
    args: string[];
    /** Working directory */
    cwd: string;
    /** Cancellation token */
    token: vscode.CancellationToken;
    /** Optional output channel for logging */
    outputChannel?: vscode.OutputChannel;
    /** Whether to show the output channel */
    showOutput?: boolean;
}

/**
 * Runs a child process with cancellation support.
 * @param options - The process options including cancellation token
 * @returns A promise that resolves with the result or cancellation status
 */
export async function runCancellableProcess(
    options: CancellableProcessOptions
): Promise<CancellableResult<string>> {
    const { command, args, cwd, token, outputChannel, showOutput } = options;

    return new Promise((resolve) => {
        // Check if already cancelled
        if (token.isCancellationRequested) {
            resolve({ cancelled: true });
            return;
        }

        const displayCommand = `${command} ${args.join(' ')}`;
        
        if (outputChannel) {
            outputChannel.appendLine(`> ${displayCommand}`);
            if (showOutput) {
                outputChannel.show();
            }
        }

        const childProcess = cp.spawn(command, args, {
            cwd,
            shell: false,
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';

        // Handle cancellation
        const cancellationListener = token.onCancellationRequested(() => {
            childProcess.kill('SIGTERM');
            if (outputChannel) {
                outputChannel.appendLine('Operation cancelled by user.');
            }
        });

        childProcess.stdout?.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            if (outputChannel) {
                outputChannel.append(text);
            }
        });

        childProcess.stderr?.on('data', (data) => {
            const text = data.toString();
            stderr += text;
            if (outputChannel) {
                outputChannel.append(text);
            }
        });

        childProcess.on('close', (code, signal) => {
            cancellationListener.dispose();

            if (signal === 'SIGTERM' || token.isCancellationRequested) {
                resolve({ cancelled: true });
            } else if (code === 0) {
                resolve({ cancelled: false, result: stdout });
            } else {
                const errorMessage = stderr || `Process exited with code ${code}`;
                if (outputChannel) {
                    outputChannel.appendLine(`Error: ${errorMessage}`);
                }
                resolve({ 
                    cancelled: false, 
                    error: new Error(errorMessage) 
                });
            }
        });

        childProcess.on('error', (error) => {
            cancellationListener.dispose();
            if (outputChannel) {
                outputChannel.appendLine(`Error: ${error.message}`);
            }
            resolve({ cancelled: false, error });
        });
    });
}

/**
 * Wraps an async operation with progress and cancellation support.
 * @param title - The progress title
 * @param operation - The async operation to run
 * @param options - Additional options
 * @returns The result of the operation or undefined if cancelled
 */
export async function withCancellableProgress<T>(
    title: string,
    operation: (
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken
    ) => Promise<T>,
    options: {
        location?: vscode.ProgressLocation;
        cancellable?: boolean;
    } = {}
): Promise<CancellableResult<T>> {
    const {
        location = vscode.ProgressLocation.Notification,
        cancellable = true
    } = options;

    try {
        const result = await vscode.window.withProgress(
            {
                location,
                title,
                cancellable
            },
            async (progress, token) => {
                if (token.isCancellationRequested) {
                    return { cancelled: true } as CancellableResult<T>;
                }

                try {
                    const value = await operation(progress, token);
                    
                    if (token.isCancellationRequested) {
                        return { cancelled: true } as CancellableResult<T>;
                    }
                    
                    return { cancelled: false, result: value } as CancellableResult<T>;
                } catch (error) {
                    return { 
                        cancelled: false, 
                        error: error instanceof Error ? error : new Error(String(error))
                    } as CancellableResult<T>;
                }
            }
        );

        return result;
    } catch (error) {
        return {
            cancelled: false,
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Creates a timeout promise that respects cancellation.
 * @param ms - Milliseconds to wait
 * @param token - Cancellation token
 * @returns Promise that resolves when timeout completes or rejects on cancellation
 */
export function cancellableTimeout(
    ms: number, 
    token: vscode.CancellationToken
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (token.isCancellationRequested) {
            reject(new Error('Operation cancelled'));
            return;
        }

        const timeoutId = setTimeout(resolve, ms);
        
        const listener = token.onCancellationRequested(() => {
            clearTimeout(timeoutId);
            listener.dispose();
            reject(new Error('Operation cancelled'));
        });
    });
}
