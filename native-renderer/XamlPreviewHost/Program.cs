// XamlPreviewHost - WinUI XAML Preview Renderer
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using System;
using System.Threading;

namespace XamlPreviewHost;

/// <summary>
/// Entry point for the XAML Preview Host application.
/// This is a headless WinUI app that renders XAML and returns images.
/// </summary>
public class Program
{
    private static string? _pipeName;
    private static readonly ManualResetEvent _exitEvent = new(false);

    [STAThread]
    public static int Main(string[] args)
    {
        // Parse command line arguments
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--pipe" && i + 1 < args.Length)
            {
                _pipeName = args[i + 1];
            }
        }

        if (string.IsNullOrEmpty(_pipeName))
        {
            Console.Error.WriteLine("Usage: XamlPreviewHost --pipe <pipe-name>");
            return 1;
        }

        // Initialize WinUI
        WinRT.ComWrappersSupport.InitializeComWrappers();
        Application.Start(p =>
        {
            var context = new Microsoft.UI.Dispatching.DispatcherQueueSynchronizationContext(
                Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread());
            SynchronizationContext.SetSynchronizationContext(context);

            _ = new App(_pipeName, _exitEvent);
        });

        return 0;
    }
}
