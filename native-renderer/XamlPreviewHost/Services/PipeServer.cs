// XamlPreviewHost - Named Pipe Server
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;

namespace XamlPreviewHost.Services;

/// <summary>
/// Named pipe server for receiving render requests from VS Code extension.
/// </summary>
public class PipeServer : IDisposable
{
    private readonly string _pipeName;
    private readonly XamlRenderer _renderer;
    private readonly CancellationTokenSource _cts = new();
    private readonly DispatcherQueue _dispatcherQueue;
    private NamedPipeServerStream? _pipeServer;
    private bool _disposed;

    public PipeServer(string pipeName, XamlRenderer renderer)
    {
        _pipeName = pipeName;
        _renderer = renderer;
        _dispatcherQueue = DispatcherQueue.GetForCurrentThread();
    }

    /// <summary>
    /// Start listening for connections.
    /// </summary>
    public async Task StartAsync()
    {
        while (!_cts.Token.IsCancellationRequested)
        {
            try
            {
                _pipeServer = new NamedPipeServerStream(
                    _pipeName,
                    PipeDirection.InOut,
                    1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                await _pipeServer.WaitForConnectionAsync(_cts.Token);
                Console.Error.WriteLine("[PipeServer] Client connected");

                await HandleConnectionAsync(_pipeServer);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[PipeServer] Error: {ex.Message}");
                await Task.Delay(1000, _cts.Token);
            }
            finally
            {
                _pipeServer?.Dispose();
                _pipeServer = null;
            }
        }
    }

    /// <summary>
    /// Handle a connected client.
    /// </summary>
    private async Task HandleConnectionAsync(NamedPipeServerStream pipe)
    {
        using var reader = new StreamReader(pipe, Encoding.UTF8, leaveOpen: true);
        using var writer = new StreamWriter(pipe, Encoding.UTF8, leaveOpen: true) { AutoFlush = true };

        while (pipe.IsConnected && !_cts.Token.IsCancellationRequested)
        {
            try
            {
                var line = await reader.ReadLineAsync(_cts.Token);
                if (line == null)
                {
                    break; // Client disconnected
                }

                var response = await ProcessRequestAsync(line);
                await writer.WriteLineAsync(response);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[PipeServer] Request error: {ex.Message}");
                
                var errorResponse = new RenderResponse
                {
                    Type = "renderResult",
                    RequestId = "",
                    Success = false,
                    Error = new RenderErrorInfo
                    {
                        Code = "INTERNAL_ERROR",
                        Message = ex.Message
                    }
                };

                try
                {
                    await writer.WriteLineAsync(JsonSerializer.Serialize(errorResponse, JsonOptions.Default));
                }
                catch
                {
                    // Connection lost, exit loop
                    break;
                }
            }
        }
    }

    /// <summary>
    /// Process a render request.
    /// </summary>
    private async Task<string> ProcessRequestAsync(string json)
    {
        RenderRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<RenderRequest>(json, JsonOptions.Default);
        }
        catch (JsonException ex)
        {
            return JsonSerializer.Serialize(new RenderResponse
            {
                Type = "renderResult",
                RequestId = "",
                Success = false,
                Error = new RenderErrorInfo
                {
                    Code = "INVALID_REQUEST",
                    Message = $"Failed to parse request: {ex.Message}"
                }
            }, JsonOptions.Default);
        }

        if (request?.Type != "render" || string.IsNullOrEmpty(request.RequestId))
        {
            return JsonSerializer.Serialize(new RenderResponse
            {
                Type = "renderResult",
                RequestId = request?.RequestId ?? "",
                Success = false,
                Error = new RenderErrorInfo
                {
                    Code = "INVALID_REQUEST",
                    Message = "Invalid request type or missing request ID"
                }
            }, JsonOptions.Default);
        }

        // Render on UI thread
        var tcs = new TaskCompletionSource<RenderResponse>();

        _dispatcherQueue.TryEnqueue(async () =>
        {
            try
            {
                var result = await _renderer.RenderAsync(
                    request.Xaml ?? "",
                    request.Options ?? new RenderOptions());

                tcs.SetResult(new RenderResponse
                {
                    Type = "renderResult",
                    RequestId = request.RequestId,
                    Success = result.Success,
                    ImageBase64 = result.ImageBase64,
                    ImageWidth = result.ImageWidth,
                    ImageHeight = result.ImageHeight,
                    Elements = result.Elements,
                    Warnings = result.Warnings,
                    RenderTimeMs = result.RenderTimeMs,
                    Error = result.Error
                });
            }
            catch (Exception ex)
            {
                tcs.SetResult(new RenderResponse
                {
                    Type = "renderResult",
                    RequestId = request.RequestId,
                    Success = false,
                    Error = new RenderErrorInfo
                    {
                        Code = "RENDER_ERROR",
                        Message = ex.Message
                    }
                });
            }
        });

        var response = await tcs.Task;
        return JsonSerializer.Serialize(response, JsonOptions.Default);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        _cts.Cancel();
        _pipeServer?.Dispose();
        _cts.Dispose();
    }
}

#region Request/Response Models

public class RenderRequest
{
    public string? Type { get; set; }
    public string? RequestId { get; set; }
    public string? Xaml { get; set; }
    public RenderOptions? Options { get; set; }
}

public class RenderOptions
{
    public int Width { get; set; } = 800;
    public int Height { get; set; } = 600;
    public string Theme { get; set; } = "dark";
    public double Scale { get; set; } = 1.0;
    public string? ProjectPath { get; set; }
}

public class RenderResponse
{
    public string Type { get; set; } = "renderResult";
    public string RequestId { get; set; } = "";
    public bool Success { get; set; }
    public string? ImageBase64 { get; set; }
    public int? ImageWidth { get; set; }
    public int? ImageHeight { get; set; }
    public ElementInfo[]? Elements { get; set; }
    public string[]? Warnings { get; set; }
    public long? RenderTimeMs { get; set; }
    public RenderErrorInfo? Error { get; set; }
}

public class ElementInfo
{
    public string Id { get; set; } = "";
    public string? Name { get; set; }
    public string Type { get; set; } = "";
    public BoundsInfo Bounds { get; set; } = new();
    public int XamlLine { get; set; }
    public int XamlColumn { get; set; }
}

public class BoundsInfo
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
}

public class RenderErrorInfo
{
    public string Code { get; set; } = "";
    public string Message { get; set; } = "";
    public int? Line { get; set; }
    public int? Column { get; set; }
}

#endregion

/// <summary>
/// JSON serialization options for consistent casing.
/// </summary>
internal static class JsonOptions
{
    public static JsonSerializerOptions Default { get; } = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };
}
