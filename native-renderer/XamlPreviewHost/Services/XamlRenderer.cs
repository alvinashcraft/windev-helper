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
/// Information about a data binding found in XAML
/// </summary>
public class BindingInfo
{
    public string Property { get; set; } = "";
    public string Path { get; set; } = "";
    public string Mode { get; set; } = "";
    public string FullExpression { get; set; } = "";
    public bool IsXBind { get; set; }
}

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

    // Binding indicator character (double-headed arrow)
    private const string BindingIndicator = "⟷";

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

        // Activate but keep the window hidden using managed APIs
        _renderWindow.Activate();

        var appWindow = _renderWindow.AppWindow;
        if (appWindow is not null)
        {
            appWindow.Hide();
        }
    }
    /// <summary>
    /// Render XAML content to a PNG image.
    /// </summary>
    public async Task<RenderResult> RenderAsync(string xaml, RenderOptions options)
    {
        var stopwatch = Stopwatch.StartNew();
        var warnings = new List<string>();
        var bindings = new List<BindingInfo>();
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

            // Replace bindings with visible placeholders and collect binding info
            processedXaml = ReplaceBindingsWithPlaceholders(processedXaml, bindings, warnings);

            // Parse XAML with retry logic for missing resources
            UIElement element;
            try
            {
                element = (UIElement)XamlReader.Load(processedXaml);
            }
            catch (Exception ex) when (ex.Message.Contains("Cannot find a Resource"))
            {
                // Resource not found - strip custom StaticResource references and retry
                warnings.Add("Some custom resources not available in preview.");
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
                foreach (var key in _appResources.Keys.Where(key => !frameElement.Resources.ContainsKey(key)))
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

            // Build element mappings with bounds relative to the container (which is what gets rendered)
            var elements = new List<ElementInfo>();
            BuildElementMappings(container, element, elements);

            // Add binding summary to warnings if any bindings found
            if (bindings.Count > 0)
            {
                var bindingSummary = FormatBindingSummary(bindings);
                warnings.Insert(0, bindingSummary);
            }

            stopwatch.Stop();

            return new RenderResult
            {
                Success = true,
                ImageBase64 = Convert.ToBase64String(pngBytes),
                ImageWidth = renderTarget.PixelWidth,
                ImageHeight = renderTarget.PixelHeight,
                // Report layout size (DIPs) for element bounds scaling, not pixel size
                LayoutWidth = options.Width,
                LayoutHeight = options.Height,
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
    /// Replace binding expressions with visible placeholder text showing the binding path.
    /// </summary>
    private string ReplaceBindingsWithPlaceholders(string xaml, List<BindingInfo> bindings, List<string> warnings)
    {
        var result = xaml;

        // Match x:Bind expressions: Property="{x:Bind Path, Mode=...}"
        // Property names can include dots for attached properties (e.g., Grid.Row, ToolTipService.ToolTip)
        var xBindPattern = @"([\w.]+)\s*=\s*""\{x:Bind\s+([^}]+)\}""";
        result = Regex.Replace(result, xBindPattern, match =>
        {
            var property = match.Groups[1].Value;
            var bindingContent = match.Groups[2].Value;
            var bindingInfo = ParseBindingExpression(property, bindingContent, isXBind: true, match.Value);
            bindings.Add(bindingInfo);

            return GetBindingReplacement(property, bindingInfo);
        }, RegexOptions.IgnoreCase);

        // Match Binding expressions: Property="{Binding Path, Mode=...}"
        // Property names can include dots for attached properties
        var bindingPattern = @"([\w.]+)\s*=\s*""\{Binding\s+([^}]*)\}""";
        result = Regex.Replace(result, bindingPattern, match =>
        {
            var property = match.Groups[1].Value;
            var bindingContent = match.Groups[2].Value;
            var bindingInfo = ParseBindingExpression(property, bindingContent, isXBind: false, match.Value);
            bindings.Add(bindingInfo);

            return GetBindingReplacement(property, bindingInfo);
        }, RegexOptions.IgnoreCase);

        // Match TemplateBinding expressions
        // Property names can include dots for attached properties
        var templateBindingPattern = @"([\w.]+)\s*=\s*""\{TemplateBinding\s+([^}]+)\}""";
        result = Regex.Replace(result, templateBindingPattern, match =>
        {
            var property = match.Groups[1].Value;
            var path = match.Groups[2].Value.Trim();
            var bindingInfo = new BindingInfo
            {
                Property = property,
                Path = path,
                FullExpression = match.Value,
                IsXBind = false
            };
            bindings.Add(bindingInfo);

            return GetBindingReplacement(property, bindingInfo);
        }, RegexOptions.IgnoreCase);

        return result;
    }

    /// <summary>
    /// Parse a binding expression to extract path and mode.
    /// </summary>
    private static BindingInfo ParseBindingExpression(string property, string content, bool isXBind, string fullExpression)
    {
        var info = new BindingInfo
        {
            Property = property,
            IsXBind = isXBind,
            FullExpression = fullExpression
        };

        // Split by comma to get parts
        var parts = content.Split(',').Select(p => p.Trim()).ToArray();

        foreach (var part in parts)
        {
            if (part.StartsWith("Path=", StringComparison.OrdinalIgnoreCase))
            {
                info.Path = part.Substring(5).Trim();
            }
            else if (part.StartsWith("Mode=", StringComparison.OrdinalIgnoreCase))
            {
                info.Mode = part.Substring(5).Trim();
            }
            else if (!part.Contains('=') && string.IsNullOrEmpty(info.Path))
            {
                // First unnamed parameter is the path
                info.Path = part;
            }
        }

        // Clean up path (remove any trailing Mode= etc that might be captured)
        if (!string.IsNullOrEmpty(info.Path))
        {
            var modeIndex = info.Path.IndexOf(" Mode=", StringComparison.OrdinalIgnoreCase);
            if (modeIndex > 0)
            {
                info.Path = info.Path.Substring(0, modeIndex).Trim();
            }
        }

        return info;
    }

    /// <summary>
    /// Get the replacement attribute for a binding based on the property type.
    /// </summary>
    private static string GetBindingReplacement(string property, BindingInfo bindingInfo)
    {
        var displayPath = FormatBindingPath(bindingInfo);
        var indicator = bindingInfo.IsXBind ? $"{BindingIndicator} " : $"{BindingIndicator} ";

        return property.ToLowerInvariant() switch
        {
            // Text properties - show binding path as content
            "text" => $" {property}=\"{indicator}{displayPath}\"",
            "content" => $" {property}=\"{indicator}{displayPath}\"",
            "header" => $" {property}=\"{indicator}{displayPath}\"",
            "title" => $" {property}=\"{indicator}{displayPath}\"",
            "placeholder" or "placeholdertext" => $" {property}=\"{indicator}{displayPath}\"",
            "description" => $" {property}=\"{indicator}{displayPath}\"",
            "label" => $" {property}=\"{indicator}{displayPath}\"",
            
            // Tooltip - show binding info
            "tooltip" or "tooltipservice.tooltip" => $" {property}=\"Bound: {displayPath}\"",
            
            // Collections - remove but add to warnings
            "itemssource" => "", // Remove, will show in binding summary
            "items" => "",
            
            // Commands - remove but add to warnings
            "command" => "",
            "click" => "",
            
            // Visibility - keep a reasonable default
            "visibility" => $" {property}=\"Visible\"",
            
            // Boolean properties - keep reasonable defaults
            "isenabled" => $" {property}=\"True\"",
            "ischecked" => "",
            "isselected" => "",
            
            // Numeric properties - show placeholder
            "value" => $" {property}=\"0\"",
            "selectedindex" => $" {property}=\"0\"",
            "maximum" => $" {property}=\"100\"",
            "minimum" => $" {property}=\"0\"",
            
            // Image sources - can't show, remove
            "source" => "",
            
            // Default - try to show as text if possible, otherwise remove
            _ when IsTextLikeProperty(property) => $" {property}=\"{indicator}{displayPath}\"",
            _ => "" // Remove unknown binding types
        };
    }

    /// <summary>
    /// Check if a property is text-like and can display a string.
    /// </summary>
    private static bool IsTextLikeProperty(string property)
    {
        var textLike = new[] { "text", "content", "header", "title", "label", "caption", "name", "displayname" };
        return textLike.Any(t => property.EndsWith(t, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Format a binding path for display (truncate if too long).
    /// </summary>
    private static string FormatBindingPath(BindingInfo info)
    {
        var path = info.Path;
        if (string.IsNullOrEmpty(path))
        {
            path = "(self)";
        }

        // Add mode indicator if two-way
        var suffix = "";
        if (info.Mode?.Equals("TwoWay", StringComparison.OrdinalIgnoreCase) == true)
        {
            suffix = " ↔";
        }
        else if (info.Mode?.Equals("OneWayToSource", StringComparison.OrdinalIgnoreCase) == true)
        {
            suffix = " →";
        }

        // Truncate long paths
        if (path.Length > 20)
        {
            path = path.Substring(0, 17) + "...";
        }

        return path + suffix;
    }

    /// <summary>
    /// Format a summary of all bindings found for the warnings list.
    /// </summary>
    private static string FormatBindingSummary(List<BindingInfo> bindings)
    {
        var grouped = bindings.GroupBy(b => b.Property).ToList();
        var parts = new List<string>();

        foreach (var group in grouped.Take(5)) // Limit to 5 properties
        {
            var paths = group.Select(b => b.Path).Distinct().Take(3);
            var pathList = string.Join(", ", paths);
            if (group.Count() > 3)
            {
                pathList += $" (+{group.Count() - 3} more)";
            }
            parts.Add($"{group.Key}: {pathList}");
        }

        if (grouped.Count > 5)
        {
            parts.Add($"(+{grouped.Count - 5} more properties)");
        }

        var bindType = bindings.Any(b => b.IsXBind) ? "x:Bind" : "Binding";
        return $"Data bindings ({bindType}): {string.Join("; ", parts)}";
    }

    /// <summary>
    /// Load project resources (App.xaml and resource dictionaries).
    /// </summary>
    private async Task LoadProjectResourcesAsync(RenderOptions options, List<string> warnings)
    {
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
            var resourcesXaml = ExtractApplicationResources(appXamlContent);
            if (!string.IsNullOrEmpty(resourcesXaml))
            {
                Console.Error.WriteLine("[XamlRenderer] Loading App.xaml resources...");
                var appDict = LoadResourceDictionary(resourcesXaml, "App.xaml", warnings);
                if (appDict != null)
                {
                    foreach (var key in appDict.Keys.Where(key => !_appResources.ContainsKey(key)))
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
                    Console.Error.WriteLine($"[XamlRenderer] Loaded {appDict.Count} resources from App.xaml");
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[XamlRenderer] Failed to parse App.xaml resources: {ex.Message}");
            warnings.Add("Could not load App.xaml resources");
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Extract the Application.Resources section from App.xaml content.
    /// </summary>
    private static string? ExtractApplicationResources(string appXaml)
    {
        var match = Regex.Match(appXaml, @"<Application\.Resources>(.*?)</Application\.Resources>", RegexOptions.Singleline);
        if (!match.Success)
        {
            return null;
        }

        var innerContent = match.Groups[1].Value.Trim();

        var dictMatch = Regex.Match(innerContent, @"<ResourceDictionary[^>]*>(.*?)</ResourceDictionary>", RegexOptions.Singleline);
        if (dictMatch.Success)
        {
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

        result = Regex.Replace(result, @"\s+x:Class\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+mc:Ignorable\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+xmlns:d\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+xmlns:mc\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"\s+d:\w+\s*=\s*""[^""]*""", "", RegexOptions.IgnoreCase);
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
            96 * 1,
            96 * 1,
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
    private void BuildElementMappings(UIElement rootElement, UIElement currentElement, List<ElementInfo> elements)
    {
        if (currentElement is not FrameworkElement fe) 
        {
            // Still recurse into non-FrameworkElement children
            int childCount = VisualTreeHelper.GetChildrenCount(currentElement);
            for (int i = 0; i < childCount; i++)
            {
                var child = VisualTreeHelper.GetChild(currentElement, i);
                if (child is UIElement childElement)
                {
                    BuildElementMappings(rootElement, childElement, elements);
                }
            }
            return;
        }

        try
        {
            // Transform bounds relative to the root element (the rendered container)
            var transform = fe.TransformToVisual(rootElement);
            var bounds = transform.TransformBounds(new Windows.Foundation.Rect(
                0, 0,
                fe.ActualWidth,
                fe.ActualHeight));

            var elementId = $"el-{_elementCounter++}";
            var name = fe.Name;
            var typeName = fe.GetType().Name;

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
                XamlLine = 0,  // TODO: Implement XAML source location tracking
                XamlColumn = 0
            });
        }
        catch
        {
            // Transform can fail if element is not in visual tree yet
        }

        int count = VisualTreeHelper.GetChildrenCount(currentElement);
        for (int i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(currentElement, i);
            if (child is UIElement childElement)
            {
                BuildElementMappings(rootElement, childElement, elements);
            }
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

        var classMatch = Regex.Match(result, @"\s+x:Class\s*=\s*""[^""]*""", RegexOptions.IgnoreCase);
        if (classMatch.Success)
        {
            result = result.Remove(classMatch.Index, classMatch.Length);
        }

        var classModifierMatch = Regex.Match(result, @"\s+x:ClassModifier\s*=\s*""[^""]*""", RegexOptions.IgnoreCase);
        if (classModifierMatch.Success)
        {
            result = result.Remove(classModifierMatch.Index, classModifierMatch.Length);
        }

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

        var styleMatches = Regex.Matches(result, @"\s+Style\s*=\s*""\{(?:StaticResource|ThemeResource)\s+([^}]+)\}""", RegexOptions.IgnoreCase);
        foreach (Match match in styleMatches.Cast<Match>().Reverse())
        {
            var resourceName = match.Groups[1].Value.Trim();
            removedResources.Add(resourceName);
            result = result.Remove(match.Index, match.Length);
        }

        if (removedResources.Count > 0)
        {
            warnings.Add($"Removed unavailable resources: {string.Join(", ", removedResources.Take(5))}{(removedResources.Count > 5 ? $" (+{removedResources.Count - 5} more)" : "")}");
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
    /// <summary>Layout width in DIPs (for element bounds scaling)</summary>
    public double LayoutWidth { get; set; }
    /// <summary>Layout height in DIPs (for element bounds scaling)</summary>
    public double LayoutHeight { get; set; }
    public ElementInfo[]? Elements { get; set; }
    public string[]? Warnings { get; set; }
    public long RenderTimeMs { get; set; }
    public RenderErrorInfo? Error { get; set; }
}
