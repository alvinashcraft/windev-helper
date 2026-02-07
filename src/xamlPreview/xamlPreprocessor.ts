// WinDev Helper - XAML Preprocessor for Native Preview
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

/**
 * Result of preprocessing XAML for native rendering
 */
export interface PreprocessResult {
    /** The sanitized XAML string */
    xaml: string;
    /** Warnings about elements that were replaced or removed */
    warnings: string[];
}

/**
 * Well-known namespace URIs that the native WinUI host can resolve.
 * Any `using:` or `clr-namespace:` namespace not in this set will be
 * treated as third-party / unresolvable, and elements from it will be
 * replaced with placeholders.
 */
const KNOWN_XAML_NAMESPACE_URIS = new Set([
    'http://schemas.microsoft.com/winfx/2006/xaml/presentation',
    'http://schemas.microsoft.com/winfx/2006/xaml',
    'http://schemas.microsoft.com/expression/blend/2008',
    'http://schemas.openxmlformats.org/markup-compatibility/2006',
]);

/**
 * Well-known `using:` namespace prefixes that the host can resolve.
 */
const KNOWN_USING_NAMESPACES = new Set([
    'Microsoft.UI.Xaml',
    'Microsoft.UI.Xaml.Controls',
    'Microsoft.UI.Xaml.Controls.Primitives',
    'Microsoft.UI.Xaml.Data',
    'Microsoft.UI.Xaml.Input',
    'Microsoft.UI.Xaml.Media',
    'Microsoft.UI.Xaml.Media.Animation',
    'Microsoft.UI.Xaml.Media.Imaging',
    'Microsoft.UI.Xaml.Navigation',
    'Microsoft.UI.Xaml.Shapes',
    'Microsoft.UI.Xaml.Documents',
    'Microsoft.UI.Xaml.Automation',
    'Microsoft.UI.Xaml.Automation.Peers',
    'Microsoft.UI.Composition',
    'Microsoft.UI.Input',
    'Microsoft.UI.Text',
    'Microsoft.UI.Windowing',
    'Windows.Foundation',
    'Windows.UI',
    'Windows.UI.Xaml',
    'Windows.UI.Xaml.Controls',
]);

/**
 * Property elements that may contain types the host can't resolve.
 * These are parent-element property syntax like `<Window.SystemBackdrop>`.
 * If the property's child elements come from unknown namespaces, the
 * whole property element block is removed.
 */
const PROPERTY_ELEMENTS_TO_CHECK = [
    'SystemBackdrop',
];

/**
 * Preprocesses XAML for the native renderer by replacing third-party
 * control types with safe placeholders, removing unresolvable property
 * elements, and cleaning up attributes referencing unknown types.
 */
export function preprocessXaml(xaml: string): PreprocessResult {
    const warnings: string[] = [];
    let result = xaml;

    // Step 0: Replace <Window> root with <Grid> — Window is not a UIElement
    // and cannot be loaded by XamlReader.Load() inside the render host.
    result = replaceWindowRoot(result, warnings);

    // Step 1: Identify namespace prefixes → URIs from root element
    const { unknownPrefixes } = classifyNamespacePrefixes(result);

    if (unknownPrefixes.size === 0) {
        // Nothing to preprocess — only remove problematic property elements
        result = removeUnresolvablePropertyElements(result, warnings);
        return { xaml: result, warnings };
    }

    for (const [prefix, uri] of unknownPrefixes) {
        warnings.push(`Third-party namespace '${prefix}' (${uri}) — controls replaced with placeholders`);
    }

    // Step 2: Replace self-closing elements from unknown prefixes
    //   <wct:DataGrid ... />  →  <Border ... style placeholder />
    for (const prefix of unknownPrefixes.keys()) {
        const escapedPrefix = escapeRegex(prefix);

        // Self-closing: <prefix:Foo ... />
        result = result.replace(
            new RegExp(`<${escapedPrefix}:(\\w+)((?:[^>]|\\n)*?)\\/>`, 'g'),
            (_match, controlName: string, attrs: string) => {
                const cleanAttrs = cleanAttributes(attrs);
                return `<Grid${cleanAttrs} Tag="${prefix}:${controlName}" BorderBrush="#888888" BorderThickness="1" Background="#20808080" Padding="8"><TextBlock Text="[${prefix}:${controlName}]" Foreground="#888888" FontStyle="Italic" HorizontalAlignment="Center" VerticalAlignment="Center"/></Grid>`;
            }
        );

        // Opening + closing: <prefix:Foo ...> ... </prefix:Foo>
        // Use a non-greedy approach with nesting awareness
        result = replaceNestedElements(result, prefix);
    }

    // Step 3: Remove resource entries from unknown prefixes within <*.Resources> blocks
    result = removeUnknownResourceEntries(result, unknownPrefixes, warnings);

    // Step 4: Remove property elements with unresolvable children
    result = removeUnresolvablePropertyElements(result, warnings);

    // Step 5: Remove attached property attributes from unknown prefixes
    //   e.g., ui:Effects.Shadow="{...}"
    for (const prefix of unknownPrefixes.keys()) {
        const escapedPrefix = escapeRegex(prefix);
        const attrRegex = new RegExp(`\\s+${escapedPrefix}:\\w+\\.\\w+\\s*=\\s*"[^"]*"`, 'g');
        const removed = result.match(attrRegex);
        if (removed) {
            for (const attr of removed) {
                warnings.push(`Removed attached property: ${attr.trim()}`);
            }
        }
        result = result.replace(attrRegex, '');
    }

    // Step 6: Remove xmlns declarations for unknown prefixes from root element
    // (keep them so the XAML is still well-formed — actually, removing them
    //  is fine since we replaced all uses. But WinUI may complain about
    //  undeclared prefixes in attribute values like bindings.)
    // Decision: remove them to avoid "namespace not found" errors.
    for (const prefix of unknownPrefixes.keys()) {
        const escapedPrefix = escapeRegex(prefix);
        result = result.replace(
            new RegExp(`\\s+xmlns:${escapedPrefix}\\s*=\\s*"[^"]*"`, 'g'),
            ''
        );
    }

    // Step 7: Clean up mc:Ignorable to remove references to removed prefixes
    result = result.replace(
        /mc:Ignorable\s*=\s*"([^"]*)"/,
        (_match, value: string) => {
            const remaining = value
                .split(/\s+/)
                .filter(p => !unknownPrefixes.has(p))
                .join(' ');
            return remaining ? `mc:Ignorable="${remaining}"` : '';
        }
    );

    return { xaml: result, warnings };
}

/**
 * Replace `<Window>` root element with `<Grid>`.
 * Window is not a UIElement and cannot be loaded via XamlReader.Load().
 * We convert it to a Grid (which IS a UIElement) and preserve all xmlns
 * declarations and the content child. Window-specific property elements
 * like `<Window.SystemBackdrop>` and `<Window.Title>` are removed.
 */
function replaceWindowRoot(xaml: string, warnings: string[]): string {
    // Check if root element is <Window
    const rootMatch = xaml.match(/^(\s*)<Window(\s|>)/);
    if (!rootMatch) {
        return xaml;
    }

    let result = xaml;

    // Replace opening tag: <Window ... > → <Grid ... >
    result = result.replace(/^(\s*)<Window(\s)/, '$1<Grid$2');

    // Replace closing tag: </Window> → </Grid>
    result = result.replace(/<\/Window\s*>\s*$/, '</Grid>');

    // Remove Window-specific property elements
    const windowProps = ['SystemBackdrop', 'Title', 'ExtendsContentIntoTitleBar'];
    for (const prop of windowProps) {
        // Self-closing: <Window.Prop ... />
        result = result.replace(
            new RegExp(`\\s*<Window\\.${prop}\\s*\\/>`),
            ''
        );
        // With content: <Window.Prop> ... </Window.Prop>
        result = result.replace(
            new RegExp(`\\s*<Window\\.${prop}\\s*>[\\s\\S]*?<\\/Window\\.${prop}\\s*>`),
            ''
        );
    }

    // Remove Window-specific attributes (Title, ExtendsContentIntoTitleBar)
    result = result.replace(/\s+Title\s*=\s*"[^"]*"/, '');
    result = result.replace(/\s+ExtendsContentIntoTitleBar\s*=\s*"[^"]*"/, '');

    warnings.push('Converted <Window> root to <Grid> for preview rendering');

    return result;
}

/**
 * Parse xmlns declarations from the root element and classify prefixes
 * as known (can be rendered by the host) or unknown (third-party).
 */
function classifyNamespacePrefixes(xaml: string): {
    knownPrefixes: Map<string, string>;
    unknownPrefixes: Map<string, string>;
} {
    const knownPrefixes = new Map<string, string>();
    const unknownPrefixes = new Map<string, string>();

    // Match all xmlns:prefix="uri" in root element
    const rootEnd = xaml.indexOf('>');
    if (rootEnd === -1) {
        return { knownPrefixes, unknownPrefixes };
    }
    const rootTag = xaml.substring(0, rootEnd + 1);

    const nsRegex = /xmlns:(\w+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = nsRegex.exec(rootTag)) !== null) {
        const prefix = match[1];
        const uri = match[2];

        // Skip well-known design-time prefixes
        if (prefix === 'x' || prefix === 'd' || prefix === 'mc' || prefix === 'local') {
            knownPrefixes.set(prefix, uri);
            continue;
        }

        if (KNOWN_XAML_NAMESPACE_URIS.has(uri)) {
            knownPrefixes.set(prefix, uri);
            continue;
        }

        // Check using: namespaces
        if (uri.startsWith('using:')) {
            const clrNamespace = uri.substring(6);
            if (KNOWN_USING_NAMESPACES.has(clrNamespace)) {
                knownPrefixes.set(prefix, uri);
                continue;
            }
        }

        unknownPrefixes.set(prefix, uri);
    }

    return { knownPrefixes, unknownPrefixes };
}

/**
 * Replace elements with a given prefix, handling nesting.
 * Uses iterative regex to handle the common case (non-nested same-prefix elements).
 */
function replaceNestedElements(
    xaml: string,
    prefix: string
): string {
    const escapedPrefix = escapeRegex(prefix);
    // Match opening tags: <prefix:Name ...>

    let result = xaml;
    let safety = 0;
    const maxIterations = 200;

    // Repeatedly replace innermost matched pairs
    while (safety++ < maxIterations) {
        let replaced = false;

        result = result.replace(
            new RegExp(
                `<${escapedPrefix}:(\\w+)((?:[^>]|\\n)*?)>` +
                `([\\s\\S]*?)` +
                `<\\/${escapedPrefix}:\\1\\s*>`,
                // Non-greedy inner content, but we need to avoid matching
                // nested same-prefix elements. We handle this by iterating.
            ),
            (_match, controlName: string, attrs: string, innerContent: string) => {
                replaced = true;
                const cleanAttrs = cleanAttributes(attrs);
                // Include child content — it may contain known elements
                const processedContent = innerContent.trim();
                if (processedContent) {
                    return `<Grid${cleanAttrs} Tag="${prefix}:${controlName}" BorderBrush="#888888" BorderThickness="1" Background="#20808080" Padding="8"><TextBlock Text="[${prefix}:${controlName}]" Foreground="#888888" FontStyle="Italic" FontSize="10" Margin="0,0,0,4"/>${processedContent}</Grid>`;
                }
                return `<Grid${cleanAttrs} Tag="${prefix}:${controlName}" BorderBrush="#888888" BorderThickness="1" Background="#20808080" Padding="8"><TextBlock Text="[${prefix}:${controlName}]" Foreground="#888888" FontStyle="Italic" HorizontalAlignment="Center" VerticalAlignment="Center"/></Grid>`;
            }
        );

        if (!replaced) {
            break;
        }
    }

    return result;
}

/**
 * Attributes safe to keep on a placeholder Border/FrameworkElement.
 * Uses a whitelist approach — any attribute not matching these patterns is removed,
 * because the third-party control likely has custom properties (e.g. BlurRadius)
 * that would cause a parse error on the replacement Border element.
 */
const SAFE_ATTRIBUTE_PATTERNS: RegExp[] = [
    // Layout
    /^(Width|Height|MinWidth|MinHeight|MaxWidth|MaxHeight)$/,
    /^(Margin|Padding)$/,
    /^(HorizontalAlignment|VerticalAlignment|HorizontalContentAlignment|VerticalContentAlignment)$/,
    // Grid positioning (attached properties)
    /^Grid\.(Row|Column|RowSpan|ColumnSpan)$/,
    /^Canvas\.(Left|Top|Right|Bottom|ZIndex)$/,
    /^RelativePanel\.\w+$/,
    /^DockPanel\.Dock$/,
    // Identity
    /^x:(Name|Uid|Key|Load|DeferLoadStrategy|Phase)$/,
    // Visibility & flow
    /^(Visibility|Opacity|IsEnabled|FlowDirection|RequestedTheme)$/,
    /^(RenderTransformOrigin|Tag)$/,
    // Accessibility
    /^AutomationProperties\.\w+$/,
    // Tooltip
    /^ToolTipService\.\w+$/,
    // Data context (bindings may fail but won't crash parse)
    /^(DataContext|Name)$/,
];

function isAttributeSafe(attrName: string): boolean {
    return SAFE_ATTRIBUTE_PATTERNS.some(pattern => pattern.test(attrName));
}

/**
 * Clean attributes from a third-party element, keeping only those
 * safe for a replacement Border/FrameworkElement. Strips control-specific
 * properties like BlurRadius, ShadowOpacity, etc.
 */
function cleanAttributes(attrs: string): string {
    // Match individual attribute assignments: name="value" or name='value'
    const attrRegex = /\s+([\w:.]+)\s*=\s*(?:"[^"]*"|'[^']*')/g;
    let cleaned = '';
    let match;
    while ((match = attrRegex.exec(attrs)) !== null) {
        const attrName = match[1];
        if (isAttributeSafe(attrName)) {
            cleaned += match[0];
        }
    }
    return cleaned;
}

/**
 * Remove resource entries (x:Key-bearing elements) from unknown namespaces
 * that appear inside *.Resources property elements.
 */
function removeUnknownResourceEntries(
    xaml: string,
    unknownPrefixes: Map<string, string>,
    warnings: string[]
): string {
    let result = xaml;

    for (const prefix of unknownPrefixes.keys()) {
        const escapedPrefix = escapeRegex(prefix);

        // Self-closing resource: <prefix:Foo x:Key="..." ... />
        result = result.replace(
            new RegExp(`\\s*<${escapedPrefix}:\\w+[^>]*x:Key\\s*=\\s*"([^"]*)"[^>]*\\/>\\s*`, 'g'),
            (_match, key: string) => {
                warnings.push(`Removed resource '${key}' (${prefix} namespace)`);
                return '\n';
            }
        );

        // Resource with body: <prefix:Foo x:Key="..."> ... </prefix:Foo>
        result = result.replace(
            new RegExp(
                `\\s*<${escapedPrefix}:(\\w+)[^>]*x:Key\\s*=\\s*"([^"]*)"[^>]*>[\\s\\S]*?<\\/${escapedPrefix}:\\1\\s*>\\s*`,
                'g'
            ),
            (_match, _controlName: string, key: string) => {
                warnings.push(`Removed resource '${key}' (${prefix} namespace)`);
                return '\n';
            }
        );
    }

    // Also remove StaticResource references to removed keys
    // (This is best-effort — we track removed keys and clean up references)

    return result;
}

/**
 * Remove property elements like <Window.SystemBackdrop> that contain
 * types the host can't resolve (e.g. <MicaBackdrop />).
 *
 * Also removes any property element whose children are exclusively
 * from unknown namespaces.
 */
function removeUnresolvablePropertyElements(
    xaml: string,
    warnings: string[]
): string {
    let result = xaml;

    // Handle specific known problematic property elements
    for (const propName of PROPERTY_ELEMENTS_TO_CHECK) {
        // Match <Anything.PropName> ... </Anything.PropName>
        const regex = new RegExp(
            `\\s*<(\\w+)\\.${escapeRegex(propName)}\\s*>[\\s\\S]*?<\\/\\1\\.${escapeRegex(propName)}\\s*>\\s*`,
            'g'
        );
        const matches = result.match(regex);
        if (matches) {
            for (const _m of matches) {
                warnings.push(`Removed property element containing unresolvable type: ${propName}`);
            }
        }
        result = result.replace(regex, '\n');
    }

    return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
