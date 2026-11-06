// WinDev Helper - Experimental XAML completion and hover
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { getDesignerControlCatalog } from './designer/controlCatalog';
import { CONFIG } from './constants';
import {
    ATTACHED_PROPERTIES,
    CONTROL_METADATA,
    PropertyMetadata,
    getControlDescription,
    resolveAllProperties
} from './propertyPane/controlMetadata';

type CompletionContext =
    | { kind: 'element'; token: string; tokenStart: number; tokenEnd: number; prefix?: string }
    | { kind: 'attribute'; tagName: string; token: string; tokenStart: number; tokenEnd: number; used: Set<string>; hasAssignment: boolean }
    | { kind: 'value'; tagName: string; attributeName: string; token: string; tokenStart: number; tokenEnd: number };

interface OpenTag {
    text: string;
    start: number;
}

const abstractControls = new Set([
    'UIElement', 'FrameworkElement', 'Control', 'ContentControl', 'Panel',
    'ItemsControl', 'RangeBase', 'Selector', 'ButtonBase', 'ToggleButton',
    'ListViewBase', 'Shape'
]);

const xamlDirectives = [
    { name: 'x:Name', description: 'Names an object element for code and binding references.' },
    { name: 'x:Key', description: 'Defines a key for a resource dictionary entry.' },
    { name: 'x:Uid', description: 'Associates the element with a localization resource.' },
    { name: 'x:Class', description: 'Specifies the code-behind class for a XAML root element.' },
    { name: 'x:DataType', description: 'Declares the compiled binding data type.' }
];

const enumValues: Record<string, string[]> = {
    HorizontalAlignment: ['Left', 'Center', 'Right', 'Stretch'],
    VerticalAlignment: ['Top', 'Center', 'Bottom', 'Stretch'],
    Visibility: ['Visible', 'Collapsed'],
    Orientation: ['Horizontal', 'Vertical'],
    TextAlignment: ['Left', 'Center', 'Right', 'Justify', 'DetectFromContent'],
    TextWrapping: ['NoWrap', 'Wrap', 'WrapWholeWords'],
    FlowDirection: ['LeftToRight', 'RightToLeft'],
    RequestedTheme: ['Light', 'Dark', 'Default'],
    ElementTheme: ['Light', 'Dark', 'Default'],
    ScrollBarVisibility: ['Disabled', 'Auto', 'Hidden', 'Visible'],
    ScrollingScrollBarVisibility: ['Auto', 'Visible', 'Hidden'],
    ScrollMode: ['Disabled', 'Enabled', 'Auto'],
    ListViewSelectionMode: ['None', 'Single', 'Multiple', 'Extended'],
    SelectionMode: ['Single', 'Multiple', 'Extended'],
    Stretch: ['None', 'Fill', 'Uniform', 'UniformToFill'],
    GridUnitType: ['Auto', 'Pixel', 'Star'],
    FlyoutPlacementMode: ['Top', 'Bottom', 'Left', 'Right', 'Full'],
    InfoBarSeverity: ['Informational', 'Success', 'Warning', 'Error'],
    TeachingTipPlacementMode: ['Auto', 'Top', 'Bottom', 'Left', 'Right']
};

const boolValues = ['True', 'False'];
const markupExtensions = [
    { name: '{Binding }', detail: 'Binding markup extension' },
    { name: '{x:Bind }', detail: 'Compiled binding markup extension' },
    { name: '{StaticResource }', detail: 'Static resource markup extension' },
    { name: '{ThemeResource }', detail: 'Theme resource markup extension' }
];

const controlDescriptions = new Map(
    Object.keys(CONTROL_METADATA)
        .filter(type => !abstractControls.has(type))
        .map(type => [type, getControlDescription(type) ?? `WinUI ${type} control`])
);

const designerControls = new Map(getDesignerControlCatalog().map(control => [control.type, control]));

/** Provides opt-in metadata-based XAML completions and hover information. */
export class XamlIntelliSenseProvider implements vscode.CompletionItemProvider, vscode.HoverProvider {
    constructor(
        private readonly enabled: () => boolean = () => vscode.workspace.getConfiguration(CONFIG.SECTION)
            .get<boolean>(CONFIG.XAML_INTELLISENSE_ENABLED, false)
    ) {}

    public static register(context: vscode.ExtensionContext): void {
        const provider = new XamlIntelliSenseProvider();
        const selector: vscode.DocumentSelector = [
            { language: 'xaml' },
            { language: 'xml', pattern: '**/*.xaml' }
        ];
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(selector, provider, '.', ':', '{'),
            vscode.languages.registerHoverProvider(selector, provider)
        );
    }

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] | undefined {
        if (!this.isEnabled()) { return undefined; }
        const context = getCompletionContext(document, position);
        if (!context) { return undefined; }

        if (context.kind === 'element') {
            return this.elementCompletions(context, document);
        }
        if (context.kind === 'attribute') {
            return this.attributeCompletions(context, document);
        }
        return this.valueCompletions(context, document);
    }

    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Hover | undefined {
        if (!this.isEnabled()) { return undefined; }
        const hoverPosition = document.getWordRangeAtPosition(position, /[A-Za-z0-9_.:{}-]+/)?.end ?? position;
        const context = getCompletionContext(document, hoverPosition);
        if (!context) { return undefined; }

        if (context.kind === 'element') {
            const type = context.token.split(':').pop() ?? '';
            const description = controlDescriptions.get(type);
            return description
                ? new vscode.Hover(new vscode.MarkdownString(`**${type}** — ${description}`))
                : undefined;
        }

        if (context.kind === 'attribute') {
            const attributeName = context.token;
            const directive = xamlDirectives.find(item => item.name === attributeName);
            if (directive) {
                return new vscode.Hover(new vscode.MarkdownString(`**${directive.name}**  \n${directive.description}`));
            }
            const event = designerControls.get(context.tagName)?.events.find(item => item.name === attributeName);
            if (event) {
                return new vscode.Hover(new vscode.MarkdownString(`**${event.name} event**  \nHandler arguments: \`${event.eventArgsType}\``));
            }
            const property = findProperty(context.tagName, attributeName);
            if (property) {
                return new vscode.Hover(propertyMarkdown(property));
            }
        }

        if (context.kind === 'value') {
            const property = findProperty(context.tagName, context.attributeName);
            if (property) {
                const values = valuesForType(property.type);
                if (values.length > 0) {
                    return new vscode.Hover(new vscode.MarkdownString(
                        `**${property.type}**  \nPossible values: ${values.map(value => `\`${value}\``).join(', ')}`
                    ));
                }
            }
        }
        return undefined;
    }

    private isEnabled(): boolean {
        return this.enabled();
    }

    private elementCompletions(
        context: Extract<CompletionContext, { kind: 'element' }>,
        document: vscode.TextDocument
    ): vscode.CompletionItem[] {
        if (context.prefix === 'x') {
            return [
                { label: 'x:String', description: 'Creates a string value.' }
            ].filter(item => item.label.slice(2).startsWith(context.token))
                .map(item => {
                    const completion = this.item(
                        item.label, item.description, vscode.CompletionItemKind.Keyword,
                        context.tokenStart, context.tokenEnd, document
                    );
                    completion.insertText = item.label.slice(2);
                    return completion;
                });
        }

        return [...controlDescriptions]
            .filter(([type]) => type.toLowerCase().startsWith(context.token.toLowerCase()))
            .map(([type, description]) => {
                const label = context.prefix ? `${context.prefix}:${type}` : type;
                const item = this.item(
                    label, description, vscode.CompletionItemKind.Class,
                    context.tokenStart, context.tokenEnd, document
                );
                if (context.prefix) { item.insertText = type; }
                return item;
            });
    }

    private attributeCompletions(
        context: Extract<CompletionContext, { kind: 'attribute' }>,
        document: vscode.TextDocument
    ): vscode.CompletionItem[] {
        const prefix = context.token.toLowerCase();
        const items: vscode.CompletionItem[] = [];
        const add = (name: string, detail: string, kind: vscode.CompletionItemKind): void => {
            if (!name.toLowerCase().startsWith(prefix) || context.used.has(name)) { return; }
            const item = this.item(name, detail, kind, context.tokenStart, context.tokenEnd, document);
            item.insertText = context.hasAssignment ? name : new vscode.SnippetString(`${name}="$1"`);
            items.push(item);
        };

        for (const directive of xamlDirectives) {
            add(directive.name, directive.description, vscode.CompletionItemKind.Property);
        }
        for (const property of resolveAllProperties(context.tagName)) {
            add(property.name, `${property.type} · ${property.category}`, vscode.CompletionItemKind.Property);
        }
        for (const property of ATTACHED_PROPERTIES) {
            add(property.xamlName, `${property.type} attached property · ${property.ownerType}`, vscode.CompletionItemKind.Property);
        }
        for (const event of designerControls.get(context.tagName)?.events ?? []) {
            add(event.name, `Event · ${event.eventArgsType}`, vscode.CompletionItemKind.Event);
        }
        return items;
    }

    private valueCompletions(
        context: Extract<CompletionContext, { kind: 'value' }>,
        document: vscode.TextDocument
    ): vscode.CompletionItem[] {
        const values = valuesForType(findProperty(context.tagName, context.attributeName)?.type ?? '');
        const candidates = [
            ...values.map(value => ({ label: value, detail: 'XAML enum value' })),
            ...(values.length === 0 && ['bool', 'Boolean'].includes(findProperty(context.tagName, context.attributeName)?.type ?? '')
                ? boolValues.map(value => ({ label: value, detail: 'Boolean value' }))
                : []),
            ...markupExtensions.map(extension => ({ label: extension.name, detail: extension.detail }))
        ];
        return candidates
            .filter(candidate => candidate.label.toLowerCase().startsWith(context.token.toLowerCase()))
            .map(candidate => this.item(
                candidate.label, candidate.detail, vscode.CompletionItemKind.Value,
                context.tokenStart, context.tokenEnd, document
            ));
    }

    private item(
        label: string,
        detail: string,
        kind: vscode.CompletionItemKind,
        tokenStart: number,
        tokenEnd: number,
        document: vscode.TextDocument
    ): vscode.CompletionItem {
        const item = new vscode.CompletionItem(label, kind);
        item.detail = detail;
        item.range = new vscode.Range(
            document.positionAt(tokenStart),
            document.positionAt(tokenEnd)
        );
        return item;
    }
}

function getCompletionContext(document: vscode.TextDocument, position: vscode.Position): CompletionContext | undefined {
    const offset = document.offsetAt(position);
    const text = document.getText();
    const tag = findOpenTag(text, offset);
    if (!tag) { return undefined; }

    const body = tag.text;
    if (/^<\/|^<\?|^<!/.test(body)) { return undefined; }
    const nameMatch = /^<([A-Za-z_][\w:.-]*)?/.exec(body);
    const rawName = nameMatch?.[1] ?? '';
    const nameEnd = tag.start + 1 + rawName.length;
    if (offset <= nameEnd) {
        const nameStart = tag.start + 1;
        const colon = rawName.lastIndexOf(':', Math.max(0, offset - nameStart - 1));
        const tokenStart = colon >= 0 ? nameStart + colon + 1 : nameStart;
        const tokenEnd = nameStart + rawName.length;
        const token = text.slice(tokenStart, offset);
        return {
            kind: 'element',
            token,
            tokenStart,
            tokenEnd,
            ...(colon >= 0 && { prefix: rawName.slice(0, colon) })
        };
    }

    const tagName = rawName.split(':').pop() ?? rawName;
    return parseAttributeContext(
        body.slice(1 + rawName.length), tagName, nameEnd, text, offset
    );
}

function findOpenTag(text: string, cursorOffset: number): OpenTag | undefined {
    const prefix = text.slice(0, cursorOffset);
    let tagStart = -1;
    let quote: string | undefined;
    for (let index = 0; index < prefix.length; index++) {
        if (tagStart < 0) {
            if (prefix.startsWith('<!--', index)) {
                const end = prefix.indexOf('-->', index + 4);
                if (end < 0) { return undefined; }
                index = end + 2;
                continue;
            }
            if (prefix.startsWith('<![CDATA[', index)) {
                const end = prefix.indexOf(']]>', index + 9);
                if (end < 0) { return undefined; }
                index = end + 2;
                continue;
            }
            if (prefix[index] === '<') {
                if (prefix[index + 1] === '!' || prefix[index + 1] === '?') {
                    const end = prefix.indexOf('>', index + 2);
                    if (end < 0) { return undefined; }
                    index = end;
                    continue;
                }
                tagStart = index;
            }
            continue;
        }
        const character = prefix[index];
        if (quote) {
            if (character === quote) { quote = undefined; }
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '>') {
            tagStart = -1;
        }
    }
    if (tagStart < 0) { return undefined; }

    quote = undefined;
    let tagEnd = text.length;
    for (let index = tagStart; index < text.length; index++) {
        const character = text[index];
        if (quote) {
            if (character === quote) { quote = undefined; }
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '>') {
            tagEnd = index + 1;
            break;
        }
    }
    return { text: text.slice(tagStart, tagEnd), start: tagStart };
}

function parseAttributeContext(
    tail: string,
    tagName: string,
    tailOffset: number,
    fullText: string,
    cursorOffset: number
): CompletionContext | undefined {
    const used = new Set<string>();
    let currentAttribute: CompletionContext | undefined;
    let index = 0;
    const cursorIndex = cursorOffset - tailOffset;
    if (tail[cursorIndex] === '/' || tail[cursorIndex] === '>') { return undefined; }

    while (index < tail.length) {
        while (/\s/.test(tail[index] ?? '')) { index++; }
        if (index >= tail.length || tail[index] === '/' || tail[index] === '>') { break; }

        const attributeStart = index;
        while (index < tail.length && !/[\s=/>]/.test(tail[index] ?? '')) { index++; }
        if (index === attributeStart) { index++; continue; }
        const attributeEnd = index;
        const attributeName = tail.slice(attributeStart, attributeEnd);
        const absoluteStart = tailOffset + attributeStart;
        const absoluteEnd = tailOffset + attributeEnd;
        while (/\s/.test(tail[index] ?? '')) { index++; }
        const hasAssignment = tail[index] === '=';

        if (cursorOffset >= absoluteStart && cursorOffset <= absoluteEnd) {
            currentAttribute = {
                kind: 'attribute', tagName, token: fullText.slice(absoluteStart, cursorOffset),
                tokenStart: absoluteStart, tokenEnd: absoluteEnd, used, hasAssignment
            };
        } else {
            used.add(attributeName);
        }

        if (!hasAssignment) { continue; }
        index++;
        while (/\s/.test(tail[index] ?? '')) { index++; }
        let valueStart = index;
        let valueEnd = index;
        const quote = tail[index] === '"' || tail[index] === "'" ? tail[index++] : undefined;
        if (quote) {
            valueStart = index;
            while (index < tail.length && tail[index] !== quote) { index++; }
            valueEnd = index;
            if (index < tail.length) { index++; }
        } else {
            valueStart = index;
            while (index < tail.length && !/[\s/>]/.test(tail[index] ?? '')) { index++; }
            valueEnd = index;
        }

        const absoluteValueStart = tailOffset + valueStart;
        const absoluteValueEnd = tailOffset + valueEnd;
        if (cursorOffset >= absoluteValueStart && cursorOffset <= absoluteValueEnd) {
            const [tokenStart, tokenEnd] = findTokenRange(fullText, cursorOffset);
            currentAttribute = {
                kind: 'value', tagName, attributeName,
                token: fullText.slice(tokenStart, cursorOffset), tokenStart, tokenEnd
            };
        }
    }

    if (currentAttribute) {
        return currentAttribute;
    }

    const [tokenStart, tokenEnd] = findTokenRange(fullText, cursorOffset);
    return {
        kind: 'attribute', tagName, token: fullText.slice(tokenStart, cursorOffset),
        tokenStart, tokenEnd, used, hasAssignment: false
    };
}

function findTokenRange(text: string, offset: number): [number, number] {
    let start = offset;
    let end = offset;
    while (start > 0 && /[A-Za-z0-9_.:{}-]/.test(text[start - 1] ?? '')) { start--; }
    while (end < text.length && /[A-Za-z0-9_.:{}-]/.test(text[end] ?? '')) { end++; }
    return [start, end];
}

function findProperty(tagName: string, attributeName: string): PropertyMetadata | undefined {
    return resolveAllProperties(tagName).find(property => property.name === attributeName)
        ?? ATTACHED_PROPERTIES.find(property => property.xamlName === attributeName);
}

function valuesForType(type: string): string[] {
    if (type === 'bool' || type === 'Boolean') { return boolValues; }
    return enumValues[type] ?? [];
}

function propertyMarkdown(property: PropertyMetadata): vscode.MarkdownString {
    return new vscode.MarkdownString(
        `**${property.name}** · \`${property.type}\`  \n${property.category} property` +
        (property.defaultValue ? `; default: \`${property.defaultValue}\`` : '')
    );
}
