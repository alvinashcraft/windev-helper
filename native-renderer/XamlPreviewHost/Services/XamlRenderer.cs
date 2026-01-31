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
using System.Linq;
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
    private ResourceDictionary? _appResources;
    private string? _lastAppXamlContent;
    private readonly Dictionary<string, ResourceDictionary> _loadedDictionaries = new();

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

            // Load project resources if provided
            await LoadProjectResourcesAsync(options, warnings);

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

            // Apply loaded resources to the element
            if (element is FrameworkElement frameElement && _appResources != null)
            {
                // Merge app resources into the element's resources
                foreach (var key in _appResources.Keys)
                {
                    if (!frameElement.Resources.ContainsKey(key))
                    {
                        try
                        {
                            frameElement.Resources[key] = _appResources[key];
                        }
                        catch
                        {
                            // Skip resources that can't be added
                        }
                    }
                }
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
    /// Load project resources (App.xaml and resource dictionaries).
    /// </summary>
    private async Task LoadProjectResourcesAsync(RenderOptions options, List<string> warnings)
    {
        // Check if we need to reload resources
        var appXamlContent = options.AppXamlContent;
        if (string.IsNullOrEmpty(appXamlContent))
        {
            return;
        }

        // Skip if already loaded and unchanged
        if (_appResources != null && _lastAppXamlContent == appXamlContent)
        {
            return;
        }

        Console.Error.WriteLine("[XamlRenderer] Loading project resources...");
        
        _appResources = new ResourceDictionary();
        _lastAppXamlContent = appXamlContent;
        _loadedDictionaries.Clear();

        // Load resource dictionaries first
        if (options.ResourceDictionaries != null)
        {
            foreach (var dictInfo in options.ResourceDictionaries)
            {
                try
                {
                    Console.Error.WriteLine($"[XamlRenderer] Loading resource dictionary: {dictInfo.Source}");
                    var dict = LoadResourceDictionary(dictInfo.Content, dictInfo.Source, warnings);
                    if (dict != null)
                    {
                        _appResources.MergedDictionaries.Add(dict);
                        _loadedDictionaries[dictInfo.Source] = dict;
                        Console.Error.WriteLine($"[XamlRenderer] Loaded {dict.Count} resources from {dictInfo.Source}");
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[XamlRenderer] Failed to load resource dictionary {dictInfo.Source}: {ex.Message}");
                    warnings.Add($"Could not load resource dictionary: {dictInfo.Source}");
                }
            }
        }

        // Extract resources directly from App.xaml content
        try
        {
            // Parse App.xaml and extract Application.Resources section
            var resourcesXaml = ExtractApplicationResources(appXamlContent);
            if (!string.IsNullOrEmpty(resourcesXaml))
            {
                Console.Error.WriteLine("[XamlRenderer] Loading App.xaml resources...");
                var appDict = LoadResourceDictionary(resourcesXaml, "App.xaml", warnings);
                if (appDict != null)
                {
                    foreach (var key in appDict.Keys)
                    {
                        if (!_appResources.ContainsKey(key))
                        {
                            try
                            {
                                _appResources[key] = appDict[key];
                            }
                            catch
                            {
                                // Skip
                            }
                        }
                    }
                    Console.Error.WriteLine($"[XamlRenderer] Loaded {appDict.Count} resources from App.xaml");
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[XamlRenderer] Failed to parse App.xaml resources: {ex.Message}");
            warnings.Add("Could not load App.xaml resources");
        }

        await Task.CompletedTask; // Keep async signature for future async operations
    }

    /// <summary>
    /// Extract the Application.Resources section from App.xaml content.
    /// </summary>
    private static string? ExtractApplicationResources(string appXaml)
    {
        // Look for <Application.Resources>...</Application.Resources>
        var match = Regex.Match(appXaml, @"<Application\.Resources>(.*?)</Application\.Resources>", RegexOptions.Singleline);
        if (!match.Success)
        {
            return null;
        }

        var innerContent = match.Groups[1].Value.Trim();

        // If it's wrapped in a ResourceDictionary, extract just the inner content
        var dictMatch = Regex.Match(innerContent, @"<ResourceDictionary[^>]*>(.*?)</ResourceDictionary>", RegexOptions.Singleline);
        if (dictMatch.Success)
        {
            // Check for MergedDictionaries - skip them, we load those separately
            var mergedMatch = Regex.Match(dictMatch.Groups[1].Value, @"<ResourceDictionary\.MergedDictionaries>.*?</ResourceDictionary\.MergedDictionaries>", RegexOptions.Singleline);
            var content = dictMatch.Groups[1].Value;
            if (mergedMatch.Success)
            {
                content = content.Replace(mergedMatch.Value, "");
            }
            innerContent = content;
        }

        if (string.IsNullOrWhiteSpace(innerContent))
        {
            return null;
        }

        // Wrap in a ResourceDictionary with required namespaces
        return $@"<ResourceDictionary 
            xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
            xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml"">
            {innerContent}
        </ResourceDictionary>";
    }

    /// <summary>
    /// Load a resource dictionary from XAML content.
    /// </summary>
    private static ResourceDictionary? LoadResourceDictionary(string xaml, string source, List<string> warnings)
    {
        try
        {
            // Preprocess the XAML
            var processed = PreprocessResourceDictionary(xaml);
            
            var dict = XamlReader.Load(processed) as ResourceDictionary;
            return dict;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[XamlRenderer] Error loading {source}: {ex.Message}");
            warnings.Add($"Resource dictionary '{source}' could not be loaded: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Preprocess a resource dictionary for dynamic loading.
    /// </summary>
    private static string PreprocessResourceDictionary(string xaml)
    {
        var result = xaml;

        // Remove x:Class if present
        result = Regex.Replace(result, @"\s+x:Class\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        
        // Remove design-time namespaces and attributes
        result = Regex.Replace(result, @"\s+mc:Ignorable\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+xmlns:d\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+xmlns:mc\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+d:\w+\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);

        // Remove Source references in nested ResourceDictionary (we load those separately)
        result = Regex.Replace(result, @"<ResourceDictionary\s+Source\s*=\s*""[^""]*""\s*/?>", "", RegexOptions.IgnoreCase);

        return result;
    }

    /// <summary>
    /// Encode pixels to PNG format.
    /// </summary>
    private static async Task<byte[]> EncodeToPngAsync(IBuffer pixels, uint width, uint height)
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
    private static (int? line, int? column) ExtractLineColumn(string message)
    {
        int? line = null;
        int? column = null;

        var lineMatch = Regex.Match(message, @"[Ll]ine[:\s]+(\d+)", RegexOptions.IgnoreCase);
        if (lineMatch.Success && int.TryParse(lineMatch.Groups[1].Value, out var l))
        {
            line = l;
        }

        var colMatch = Regex.Match(message, @"[Cc]olumn[:\s]+(\d+)|[Pp]osition[:\s]+(\d+)", RegexOptions.IgnoreCase);
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
    /// Preprocess XAML to remove compile-time only attributes.
    /// </summary>
    private static string PreprocessXaml(string xaml, List<string> warnings)
    {
        var result = xaml;

        // Remove x:Class attribute
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
        }

        // Remove design-time namespaces and attributes
        result = Regex.Replace(result, @"\s+mc:Ignorable\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+xmlns:d\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+xmlns:mc\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+d:\w+\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);

        return result;
    }

    /// <summary>
    /// Strip custom resource references that aren't available at runtime.
    /// </summary>
    private static string StripCustomResourceReferences(string xaml, List<string> warnings)
    {
        var result = xaml;
        var removedResources = new HashSet<string>();

        // Remove Style attributes with custom StaticResource/ThemeResource references
        var styleMatches = Regex.Matches(result, @"\s+Style\s*=\s*""\{(?:StaticResource|ThemeResource)\s+([^}]+)\}""", RegexOptions.IgnoreCase);
        foreach (Match match in styleMatches.Cast<Match>().Reverse())
        {
            var resourceName = match.Groups[1].Value.Trim();
            removedResources.Add(resourceName);
            result = result.Remove(match.Index, match.Length);
        }

        // Remove x:Bind expressions (require compiled code-behind)
        var xBindMatches = Regex.Matches(result, @"(\w+)\s*=\s*""\{x:Bind\s+[^}]+\}""", RegexOptions.IgnoreCase);
        foreach (Match match in xBindMatches.Cast<Match>().Reverse())
        {
            var propertyName = match.Groups[1].Value;
            var replacement = propertyName.ToLowerInvariant() switch
            {
                "text" => $" {propertyName}=\"[Binding]\"",
                "content" => $" {propertyName}=\"[Binding]\"",
                "itemssource" => "",
                "command" => "",
                _ => ""
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
