// XamlPreviewHost - WinUI XAML Preview Renderer
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using System;
using System.Threading;
using System.Threading.Tasks;
using XamlPreviewHost.Services;

namespace XamlPreviewHost;

/// <summary>
/// Main application class for the XAML Preview Host.
/// Runs as a headless WinUI application that processes render requests via named pipe.
/// </summary>
public partial class App : Application
{
    private readonly string _pipeName;
    private readonly ManualResetEvent _exitEvent;
    private PipeServer? _pipeServer;
    private XamlRenderer? _renderer;

    public App(string pipeName, ManualResetEvent exitEvent)
    {
        _pipeName = pipeName;
        _exitEvent = exitEvent;

        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        // Don't create any visible windows - we run headless
        
        // Initialize renderer
        _renderer = new XamlRenderer();

        // Start pipe server
        _pipeServer = new PipeServer(_pipeName, _renderer);
        _ = _pipeServer.StartAsync();

        // Signal that we're ready
        Console.WriteLine("READY");
    }
}
