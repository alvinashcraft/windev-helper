// XamlPreviewHost - XAML Renderer
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Markup;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;

namespace XamlPreviewHost.Services;

/// <summary>
/// Renders XAML content to PNG images.
/// </summary>
public class XamlRenderer
{
    private Window? _renderWindow;
    private Grid? _renderHost;
    private int _elementCounter;

    /// <summary>
    /// Initialize the renderer with a hidden window for rendering.
    /// </summary>
    private void EnsureRenderWindow()
    {
        if (_renderWindow != null) return;

        _renderWindow = new Window
        {
            Title = "XamlPreviewHost Render Window"
        };

        _renderHost = new Grid
        {
            Background = new SolidColorBrush(Microsoft.UI.Colors.Transparent)
        };

        _renderWindow.Content = _renderHost;

        // Activate but keep hidden
        // Note: WinUI 3 doesn't have a true "hidden" mode, but we can minimize
        // For now, we'll use a small off-screen position
        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(_renderWindow);
        SetWindowPos(hwnd, IntPtr.Zero, -10000, -10000, 1, 1, 0x0080 /* SWP_HIDEWINDOW */);
        
        _renderWindow.Activate();
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    /// <summary>
    /// Render XAML content to a PNG image.
    /// </summary>
    public async Task<RenderResult> RenderAsync(string xaml, RenderOptions options)
    {
        var stopwatch = Stopwatch.StartNew();
        var warnings = new List<string>();
        _elementCounter = 0;

        try
        {
            EnsureRenderWindow();

            // Apply theme
            if (_renderWindow?.Content is FrameworkElement fe)
            {
                fe.RequestedTheme = options.Theme?.ToLowerInvariant() == "light" 
                    ? ElementTheme.Light 
                    : ElementTheme.Dark;
            }

            // Preprocess XAML to remove compile-time attributes
            var processedXaml = PreprocessXaml(xaml, warnings);

            // Parse XAML with retry logic for missing resources
            UIElement element;
            try
            {
                element = (UIElement)XamlReader.Load(processedXaml);
            }
            catch (Exception ex) when (ex.Message.Contains("Cannot find a Resource"))
            {
                // Resource not found - strip custom StaticResource references and retry
                warnings.Add("Custom resources not available in preview. Some styles may differ from runtime appearance.");
                var strippedXaml = StripCustomResourceReferences(processedXaml, warnings);
                
                try
                {
                    element = (UIElement)XamlReader.Load(strippedXaml);
                }
                catch (Exception retryEx)
                {
                    var (line, column) = ExtractLineColumn(retryEx.Message);
                    return new RenderResult
                    {
                        Success = false,
                        Error = new RenderErrorInfo
                        {
                            Code = "XAML_PARSE_ERROR",
                            Message = retryEx.Message,
                            Line = line,
                            Column = column
                        }
                    };
                }
            }
            catch (Exception ex)
            {
                // Extract line/column from XamlParseException if possible
                var (line, column) = ExtractLineColumn(ex.Message);
                return new RenderResult
                {
                    Success = false,
                    Error = new RenderErrorInfo
                    {
                        Code = "XAML_PARSE_ERROR",
                        Message = ex.Message,
                        Line = line,
                        Column = column
                    }
                };
            }

            // Set up the render host
            _renderHost!.Children.Clear();

            // Wrap in a container with specified size
            var container = new Border
            {
                Width = options.Width,
                Height = options.Height,
                Child = element
            };

            _renderHost.Children.Add(container);

            // Force layout
            _renderHost.UpdateLayout();
            container.UpdateLayout();

            // Wait for layout to complete
            await Task.Delay(50);

            // Render to bitmap
            var renderTarget = new RenderTargetBitmap();
            await renderTarget.RenderAsync(container, 
                (int)(options.Width * options.Scale), 
                (int)(options.Height * options.Scale));

            // Get pixels and encode to PNG
            var pixels = await renderTarget.GetPixelsAsync();
            var pngBytes = await EncodeToPngAsync(
                pixels, 
                (uint)renderTarget.PixelWidth, 
                (uint)renderTarget.PixelHeight);

            // Build element mappings
            var elements = new List<ElementInfo>();
            BuildElementMappings(element, elements, 0, 0);

            stopwatch.Stop();

            return new RenderResult
            {
                Success = true,
                ImageBase64 = Convert.ToBase64String(pngBytes),
                ImageWidth = renderTarget.PixelWidth,
                ImageHeight = renderTarget.PixelHeight,
                Elements = elements.ToArray(),
                Warnings = warnings.ToArray(),
                RenderTimeMs = stopwatch.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            return new RenderResult
            {
                Success = false,
                RenderTimeMs = stopwatch.ElapsedMilliseconds,
                Error = new RenderErrorInfo
                {
                    Code = "RENDER_ERROR",
                    Message = ex.Message
                }
            };
        }
    }

    /// <summary>
    /// Encode pixels to PNG format.
    /// </summary>
    private async Task<byte[]> EncodeToPngAsync(IBuffer pixels, uint width, uint height)
    {
        using var stream = new InMemoryRandomAccessStream();
        var encoder = await BitmapEncoder.CreateAsync(BitmapEncoder.PngEncoderId, stream);
        
        encoder.SetPixelData(
            BitmapPixelFormat.Bgra8,
            BitmapAlphaMode.Premultiplied,
            width,
            height,
            96 * 1, // DPI X
            96 * 1, // DPI Y
            pixels.ToArray());

        await encoder.FlushAsync();

        using var ms = new MemoryStream();
        stream.Seek(0);
        await stream.AsStreamForRead().CopyToAsync(ms);
        return ms.ToArray();
    }

    /// <summary>
    /// Build element mappings by walking the visual tree.
    /// </summary>
    private void BuildElementMappings(DependencyObject obj, List<ElementInfo> elements, double offsetX, double offsetY)
    {
        if (obj is not UIElement uiElement) return;

        // Get element bounds relative to root
        var transform = uiElement.TransformToVisual(null);
        var bounds = transform.TransformBounds(new Windows.Foundation.Rect(
            0, 0,
            uiElement is FrameworkElement fe ? fe.ActualWidth : 0,
            uiElement is FrameworkElement fe2 ? fe2.ActualHeight : 0));

        var elementId = $"el-{_elementCounter++}";
        var name = uiElement is FrameworkElement fwe ? fwe.Name : null;
        var typeName = uiElement.GetType().Name;

        elements.Add(new ElementInfo
        {
            Id = elementId,
            Name = string.IsNullOrEmpty(name) ? null : name,
            Type = typeName,
            Bounds = new BoundsInfo
            {
                X = bounds.X,
                Y = bounds.Y,
                Width = bounds.Width,
                Height = bounds.Height
            },
            // Note: We don't have source location info from XamlReader.Load()
            // This would require a custom XAML parser or source map
            XamlLine = 0,
            XamlColumn = 0
        });

        // Recurse into children
        int childCount = VisualTreeHelper.GetChildrenCount(obj);
        for (int i = 0; i < childCount; i++)
        {
            var child = VisualTreeHelper.GetChild(obj, i);
            BuildElementMappings(child, elements, offsetX, offsetY);
        }
    }

    /// <summary>
    /// Try to extract line/column from XAML parse error message.
    /// </summary>
    private (int? line, int? column) ExtractLineColumn(string message)
    {
        // Common patterns: "Line 15", "line 15, column 10", "[Line: 15 Position: 10]"
        // This is a simplified extraction - real parsing would be more robust
        int? line = null;
        int? column = null;

        var lineMatch = System.Text.RegularExpressions.Regex.Match(
            message, @"[Ll]ine[:\s]+(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (lineMatch.Success && int.TryParse(lineMatch.Groups[1].Value, out var l))
        {
            line = l;
        }

        var colMatch = System.Text.RegularExpressions.Regex.Match(
            message, @"[Cc]olumn[:\s]+(\d+)|[Pp]osition[:\s]+(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (colMatch.Success)
        {
            var colStr = colMatch.Groups[1].Success ? colMatch.Groups[1].Value : colMatch.Groups[2].Value;
            if (int.TryParse(colStr, out var c))
            {
                column = c;
            }
        }

        return (line, column);
    }

    /// <summary>
    /// Preprocess XAML to remove compile-time only attributes that XamlReader.Load doesn't support.
    /// </summary>
    private static string PreprocessXaml(string xaml, List<string> warnings)
    {
        var result = xaml;

        // Remove x:Class attribute (only valid for compiled XAML with LoadComponent)
        var classMatch = Regex.Match(result, @"\s+x:Class\s*=\s*""[^""]*""", RegexOptions.IgnoreCase);
        if (classMatch.Success)
        {
            result = result.Remove(classMatch.Index, classMatch.Length);
            warnings.Add("Removed x:Class attribute (not supported in dynamic XAML loading)");
        }

        // Remove x:ClassModifier attribute
        var classModifierMatch = Regex.Match(result, @"\s+x:ClassModifier\s*=\s*""[^""]*""", RegexOptions.IgnoreCase);
        if (classModifierMatch.Success)
        {
            result = result.Remove(classModifierMatch.Index, classModifierMatch.Length);
            warnings.Add("Removed x:ClassModifier attribute (not supported in dynamic XAML loading)");
        }

        // Remove mc:Ignorable attribute and d: design-time namespace declarations
        var mcIgnorableMatch = Regex.Match(result, @"\s+mc:Ignorable\s*=\s*""[^""]*""", RegexOptions.IgnoreCase);
        if (mcIgnorableMatch.Success)
        {
            result = result.Remove(mcIgnorableMatch.Index, mcIgnorableMatch.Length);
        }

        // Remove d: namespace declaration
        var dNamespaceMatch = Regex.Match(result, @"\s+xmlns:d\s*=\s*""[^""]*""", RegexOptions.IgnoreCase);
        if (dNamespaceMatch.Success)
        {
            result = result.Remove(dNamespaceMatch.Index, dNamespaceMatch.Length);
        }

        // Remove mc: namespace declaration
        var mcNamespaceMatch = Regex.Match(result, @"\s+xmlns:mc\s*=\s*""[^""]*""", RegexOptions.IgnoreCase);
        if (mcNamespaceMatch.Success)
        {
            result = result.Remove(mcNamespaceMatch.Index, mcNamespaceMatch.Length);
        }

        // Remove d: prefixed attributes (design-time attributes like d:DesignHeight)
        result = Regex.Replace(result, @"\s+d:\w+\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);

        return result;
    }

    /// <summary>
    /// Strip custom StaticResource and ThemeResource references that aren't available at runtime.
    /// This is called when rendering fails due to missing resources.
    /// </summary>
    private static string StripCustomResourceReferences(string xaml, List<string> warnings)
    {
        var result = xaml;
        var removedResources = new HashSet<string>();

        // Remove Style attributes with StaticResource/ThemeResource references
        // These are the most common source of "Cannot find a Resource" errors
        var styleMatches = Regex.Matches(result, @"\s+Style\s*=\s*""\{(?:StaticResource|ThemeResource)\s+([^}]+)\}""", RegexOptions.IgnoreCase);
        foreach (Match match in styleMatches.Cast<Match>().Reverse()) // Reverse to preserve indices
        {
            var resourceName = match.Groups[1].Value.Trim();
            removedResources.Add(resourceName);
            result = result.Remove(match.Index, match.Length);
        }

        // Also handle x:Bind and Binding that might reference unavailable data
        // Remove Text="{x:Bind ...}" style bindings as they require compiled code-behind
        var xBindMatches = Regex.Matches(result, @"(\w+)\s*=\s*""\{x:Bind\s+[^}]+\}""", RegexOptions.IgnoreCase);
        foreach (Match match in xBindMatches.Cast<Match>().Reverse())
        {
            var propertyName = match.Groups[1].Value;
            // Replace with a placeholder value based on property type
            var replacement = propertyName.ToLowerInvariant() switch
            {
                "text" => $" {propertyName}=\"[Binding]\"",
                "content" => $" {propertyName}=\"[Binding]\"",
                "itemssource" => "", // Remove entirely
                "command" => "", // Remove entirely
                _ => "" // Remove unknown bindings
            };
            result = result.Remove(match.Index, match.Length);
            if (!string.IsNullOrEmpty(replacement))
            {
                result = result.Insert(match.Index, replacement);
            }
        }

        if (removedResources.Count > 0)
        {
            warnings.Add($"Removed custom resources not available in preview: {string.Join(", ", removedResources)}");
        }

        return result;
    }
}

/// <summary>
/// Result of a render operation.
/// </summary>
public class RenderResult
{
    public bool Success { get; set; }
    public string? ImageBase64 { get; set; }
    public int ImageWidth { get; set; }
    public int ImageHeight { get; set; }
    public ElementInfo[]? Elements { get; set; }
    public string[]? Warnings { get; set; }
    public long RenderTimeMs { get; set; }
    public RenderErrorInfo? Error { get; set; }
}
