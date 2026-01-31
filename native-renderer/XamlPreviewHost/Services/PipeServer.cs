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
                await using var pipeServer = new NamedPipeServerStream(
                    _pipeName,
                    PipeDirection.InOut,
                    1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                Console.Error.WriteLine($"[PipeServer] Waiting for connection on pipe: {_pipeName}");
                await pipeServer.WaitForConnectionAsync(_cts.Token);
                Console.Error.WriteLine("[PipeServer] Client connected");

                await HandleConnectionAsync(pipeServer);
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
                    Console.Error.WriteLine("[PipeServer] Client disconnected (null read)");
                    break;
                }

                if (string.IsNullOrWhiteSpace(line))
                {
                    continue;
                }

                var response = await ProcessRequestAsync(line);
                await writer.WriteLineAsync(response);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (IOException ex)
            {
                Console.Error.WriteLine($"[PipeServer] IO error (client likely disconnected): {ex.Message}");
                break;
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

        Console.Error.WriteLine("[PipeServer] Connection handler exiting");
    }

    /// <summary>
    /// Process an incoming request.
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

        if (request == null || string.IsNullOrEmpty(request.RequestId))
        {
            return JsonSerializer.Serialize(new RenderResponse
            {
                Type = "renderResult",
                RequestId = request?.RequestId ?? "",
                Success = false,
                Error = new RenderErrorInfo
                {
                    Code = "INVALID_REQUEST",
                    Message = "Invalid request or missing request ID"
                }
            }, JsonOptions.Default);
        }

        // Handle ping request
        if (request.Type == "ping")
        {
            Console.Error.WriteLine($"[PipeServer] Ping received: {request.RequestId}");
            return JsonSerializer.Serialize(new PongResponse
            {
                Type = "pong",
                RequestId = request.RequestId,
                Success = true
            }, JsonOptions.Default);
        }

        // Handle render request
        if (request.Type != "render")
        {
            return JsonSerializer.Serialize(new RenderResponse
            {
                Type = "renderResult",
                RequestId = request.RequestId,
                Success = false,
                Error = new RenderErrorInfo
                {
                    Code = "INVALID_REQUEST",
                    Message = $"Unknown request type: {request.Type}"
                }
            }, JsonOptions.Default);
        }

        // Render on UI thread
        var tcs = new TaskCompletionSource<RenderResponse>();

        _dispatcherQueue.TryEnqueue(async () =>
        {
            try
            {
                Console.Error.WriteLine($"[PipeServer] Processing render request: {request.RequestId}");
                
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
                    LayoutWidth = result.LayoutWidth,
                    LayoutHeight = result.LayoutHeight,
                    Elements = result.Elements,
                    Warnings = result.Warnings,
                    RenderTimeMs = result.RenderTimeMs,
                    Error = result.Error
                });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[PipeServer] Render exception: {ex.Message}");
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
        Console.Error.WriteLine($"[PipeServer] Render complete: {request.RequestId}, success={response.Success}");
        return JsonSerializer.Serialize(response, JsonOptions.Default);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        _cts.Cancel();
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
    public string? AppXamlContent { get; set; }
    public ResourceDictionaryInfo[]? ResourceDictionaries { get; set; }
}

public class ResourceDictionaryInfo
{
    public string Source { get; set; } = "";
    public string Content { get; set; } = "";
}

public class RenderResponse
{
    public string Type { get; set; } = "renderResult";
    public string RequestId { get; set; } = "";
    public bool Success { get; set; }
    public string? ImageBase64 { get; set; }
    public int? ImageWidth { get; set; }
    public int? ImageHeight { get; set; }
    public double? LayoutWidth { get; set; }
    public double? LayoutHeight { get; set; }
    public ElementInfo[]? Elements { get; set; }
    public string[]? Warnings { get; set; }
    public long? RenderTimeMs { get; set; }
    public RenderErrorInfo? Error { get; set; }
}

public class PongResponse
{
    public string Type { get; set; } = "pong";
    public string RequestId { get; set; } = "";
    public bool Success { get; set; } = true;
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
