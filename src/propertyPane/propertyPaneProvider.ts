// WinDev Helper - Property Pane Provider
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { XamlElement } from '../xamlDesigner/xamlParser';
import { PropertyCategory, resolveAllProperties, isKnownControlType, getControlDescription, getInheritanceChain, ATTACHED_PROPERTIES, PropertyMetadata } from './controlMetadata';

// Re-export PropertyCategory so existing consumers don't break
export { PropertyCategory };

/**
 * Represents a property item in the tree view
 */
export class PropertyItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value: string,
        public readonly isBinding: boolean,
        public readonly isDefault: boolean = false,
        public readonly propertyType?: string,
        public readonly bindingPath?: string,
        public readonly fullExpression?: string,
        public readonly category?: PropertyCategory,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(name, collapsibleState);
        
        this.description = this.formatValue();
        this.tooltip = this.formatTooltip();
        this.contextValue = isBinding ? 'boundProperty' : (isDefault ? 'defaultProperty' : 'property');
        
        const icon = this.getIcon();
        if (icon) {
            this.iconPath = icon;
        }
    }

    private formatValue(): string {
        if (this.isBinding && this.bindingPath) {
            // Show binding indicator with path
            const displayPath = this.bindingPath.length > 25 
                ? this.bindingPath.substring(0, 22) + '...' 
                : this.bindingPath;
            return `⟷ ${displayPath}`;
        }
        
        const displayValue = this.value.length > 30
            ? this.value.substring(0, 27) + '...'
            : this.value;

        // Default properties show value dimmed with type hint
        if (this.isDefault) {
            if (displayValue) {
                return `= ${displayValue}`;
            }
            return this.propertyType ? `(${this.propertyType})` : '';
        }
        
        return displayValue;
    }

    private formatTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${this.name}**`);
        if (this.propertyType) {
            md.appendMarkdown(` *(${this.propertyType})*`);
        }
        md.appendMarkdown('\n\n');
        
        if (this.isDefault) {
            md.appendMarkdown(`Default value\n\n`);
        }

        if (this.isBinding && this.fullExpression) {
            md.appendMarkdown(`*Data Binding*\n\n`);
            md.appendCodeblock(this.fullExpression, 'xml');
        } else if (this.value) {
            md.appendCodeblock(this.value, 'text');
        }
        
        return md;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.isBinding) {
            return new vscode.ThemeIcon('link', new vscode.ThemeColor('charts.purple'));
        }
        if (this.isDefault) {
            return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('disabledForeground'));
        }
        return new vscode.ThemeIcon('symbol-property', new vscode.ThemeColor('symbolIcon.propertyForeground'));
    }
}

/**
 * Represents a category node in the tree view
 */
export class CategoryItem extends vscode.TreeItem {
    constructor(
        public readonly category: PropertyCategory,
        public readonly properties: PropertyItem[],
        public readonly setCount?: number
    ) {
        super(category, vscode.TreeItemCollapsibleState.Expanded);
        
        if (setCount !== undefined && setCount < properties.length) {
            this.description = `(${setCount} set / ${properties.length} total)`;
        } else {
            this.description = `(${properties.length})`;
        }
        this.contextValue = 'category';
        this.iconPath = this.getCategoryIcon();
    }

    private getCategoryIcon(): vscode.ThemeIcon {
        switch (this.category) {
            case PropertyCategory.Layout:
                return new vscode.ThemeIcon('layout');
            case PropertyCategory.Appearance:
                return new vscode.ThemeIcon('paintcan');
            case PropertyCategory.Text:
                return new vscode.ThemeIcon('text-size');
            case PropertyCategory.Interaction:
                return new vscode.ThemeIcon('hand');
            case PropertyCategory.Accessibility:
                return new vscode.ThemeIcon('accessibility');
            case PropertyCategory.Common:
                return new vscode.ThemeIcon('star');
            default:
                return new vscode.ThemeIcon('symbol-misc');
        }
    }
}

/**
 * Represents the selected element header in the tree view
 */
export class ElementHeader extends vscode.TreeItem {
    constructor(
        public readonly elementType: string,
        public readonly elementName?: string,
        public readonly typeDescription?: string
    ) {
        const label = elementName ? `${elementType}: ${elementName}` : elementType;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        
        this.description = elementName ? '' : '(no name)';
        this.contextValue = 'element';
        this.iconPath = new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('symbolIcon.classForeground'));

        if (typeDescription) {
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**${elementType}**\n\n`);
            md.appendMarkdown(typeDescription);
            if (isKnownControlType(elementType)) {
                const chain = getInheritanceChain(elementType);
                if (chain.length > 1) {
                    md.appendMarkdown(`\n\n*Inherits:* ${chain.join(' → ')}`);
                }
            }
            this.tooltip = md;
        }
    }
}

/**
 * Tree data provider for the XAML Properties pane
 */
export class PropertyPaneProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private selectedElement: XamlElement | null = null;
    private groupByCategory = true;
    private showDefaultProperties = true;

    // Fallback categorization for properties not in the metadata
    private static readonly FALLBACK_CATEGORIES: Record<string, PropertyCategory> = {
        'x:Name': PropertyCategory.Common,
        'x:Bind': PropertyCategory.Common,
        'x:Key': PropertyCategory.Common,
        'x:Class': PropertyCategory.Miscellaneous,
        'x:Uid': PropertyCategory.Miscellaneous,
        'xmlns': PropertyCategory.Miscellaneous,
    };

    constructor() {}

    /**
     * Update the selected element and refresh the tree
     */
    public setSelectedElement(element: XamlElement | null): void {
        this.selectedElement = element;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Toggle grouping by category
     */
    public toggleGrouping(): void {
        this.groupByCategory = !this.groupByCategory;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Toggle display of default (unset) properties
     */
    public toggleDefaultProperties(): void {
        this.showDefaultProperties = !this.showDefaultProperties;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Whether default properties are currently shown
     */
    public get isShowingDefaultProperties(): boolean {
        return this.showDefaultProperties;
    }

    /**
     * Get tree item for display
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children of a tree item
     */
    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this.selectedElement) {
            return Promise.resolve([this.createNoSelectionItem()]);
        }

        // Root level - show element header
        if (!element) {
            const desc = getControlDescription(this.selectedElement.tagName);
            const header = new ElementHeader(
                this.selectedElement.tagName,
                this.getElementName(),
                desc
            );
            return Promise.resolve([header]);
        }

        // Element header - show categories or flat list
        if (element instanceof ElementHeader) {
            const items = this.getAllPropertyItems();
            if (this.groupByCategory) {
                return Promise.resolve(this.getCategoryItems(items));
            } else {
                return Promise.resolve(items);
            }
        }

        // Category - show properties in that category
        if (element instanceof CategoryItem) {
            return Promise.resolve(element.properties);
        }

        return Promise.resolve([]);
    }

    /**
     * Get the x:Name or Name of the selected element
     */
    private getElementName(): string | undefined {
        if (!this.selectedElement) {
            return undefined;
        }
        return this.selectedElement.attributes.get('x:Name') || 
               this.selectedElement.attributes.get('Name');
    }

    /**
     * Create a placeholder item when nothing is selected
     */
    private createNoSelectionItem(): vscode.TreeItem {
        const item = new vscode.TreeItem('No element selected');
        item.description = 'Click an element in the preview';
        item.iconPath = new vscode.ThemeIcon('info');
        return item;
    }

    /**
     * Get all properties as category groups
     */
    private getCategoryItems(propertyItems: PropertyItem[]): CategoryItem[] {
        // Group by category
        const categoryMap = new Map<PropertyCategory, PropertyItem[]>();
        
        for (const item of propertyItems) {
            const category = item.category || PropertyCategory.Miscellaneous;
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category)!.push(item);
        }

        // Create category items in a logical order
        const orderedCategories = [
            PropertyCategory.Common,
            PropertyCategory.Layout,
            PropertyCategory.Appearance,
            PropertyCategory.Text,
            PropertyCategory.Interaction,
            PropertyCategory.Accessibility,
            PropertyCategory.Miscellaneous
        ];

        const categoryItems: CategoryItem[] = [];
        for (const category of orderedCategories) {
            const properties = categoryMap.get(category);
            if (properties && properties.length > 0) {
                // Count set vs default
                const setCount = properties.filter(p => !p.isDefault).length;
                categoryItems.push(new CategoryItem(category, properties, setCount));
            }
        }

        return categoryItems;
    }

    /**
     * Get all properties as a flat list, merging explicit XAML attributes
     * with the full set of available properties from the control metadata.
     */
    private getAllPropertyItems(): PropertyItem[] {
        if (!this.selectedElement) {
            return [];
        }

        const items: PropertyItem[] = [];
        const tagName = this.selectedElement.tagName;
        const explicitAttributes = this.selectedElement.attributes;
        const addedNames = new Set<string>();

        // Build a lookup from metadata properties for the element's type
        const metadataProps = resolveAllProperties(tagName);
        const metadataByName = new Map<string, PropertyMetadata>();
        for (const prop of metadataProps) {
            metadataByName.set(prop.name, prop);
        }

        // Also index attached properties by their XAML name
        const attachedByName = new Map<string, typeof ATTACHED_PROPERTIES[number]>();
        for (const ap of ATTACHED_PROPERTIES) {
            attachedByName.set(ap.xamlName, ap);
        }

        // 1) Add explicitly set attributes (from XAML markup)
        for (const [name, value] of explicitAttributes) {
            const bindingInfo = this.parseBindingExpression(value);
            const meta = metadataByName.get(name);
            const attached = attachedByName.get(name);
            const category = meta?.category
                ?? attached?.category
                ?? PropertyPaneProvider.FALLBACK_CATEGORIES[name]
                ?? PropertyCategory.Miscellaneous;
            const propType = meta?.type ?? attached?.type;

            items.push(new PropertyItem(
                name,
                value,
                bindingInfo.isBinding,
                /* isDefault */ false,
                propType,
                bindingInfo.path,
                bindingInfo.isBinding ? value : undefined,
                category
            ));
            addedNames.add(name);
        }

        // 2) Add remaining metadata properties with default values
        if (this.showDefaultProperties) {
            for (const prop of metadataProps) {
                if (addedNames.has(prop.name)) {
                    continue;
                }
                items.push(new PropertyItem(
                    prop.name,
                    prop.defaultValue,
                    /* isBinding */ false,
                    /* isDefault */ true,
                    prop.type,
                    undefined,
                    undefined,
                    prop.category
                ));
                addedNames.add(prop.name);
            }

            // 3) Add applicable attached properties that are explicitly set
            //    (already handled above), and common ones as defaults
            for (const ap of ATTACHED_PROPERTIES) {
                if (addedNames.has(ap.xamlName)) {
                    continue;
                }
                // Only show attached properties as defaults if they're from
                // common layout providers (Grid, Canvas) — not all of them
                if (ap.ownerType === 'AutomationProperties' || ap.ownerType === 'ToolTipService') {
                    items.push(new PropertyItem(
                        ap.xamlName,
                        ap.defaultValue,
                        /* isBinding */ false,
                        /* isDefault */ true,
                        ap.type,
                        undefined,
                        undefined,
                        ap.category
                    ));
                    addedNames.add(ap.xamlName);
                }
            }
        }

        // Sort: explicitly set properties first, then defaults; alphabetical within each group
        items.sort((a, b) => {
            if (a.isDefault !== b.isDefault) {
                return a.isDefault ? 1 : -1;
            }
            return a.name.localeCompare(b.name);
        });

        return items;
    }

    /**
     * Parse a value to detect if it's a binding expression
     */
    private parseBindingExpression(value: string): { isBinding: boolean; path?: string } {
        const trimmed = value.trim();

        // Check for binding patterns
        const bindingMatch = trimmed.match(/^\{(?:x:Bind|Binding|TemplateBinding)\s*([^}]*)\}$/i);
        if (!bindingMatch) {
            return { isBinding: false };
        }

        const content = bindingMatch[1].trim();
        
        // Extract path
        let path = content;
        
        // Check for Path= syntax
        const pathMatch = content.match(/Path\s*=\s*([^,}]+)/i);
        if (pathMatch) {
            path = pathMatch[1].trim();
        } else {
            // First unnamed parameter is the path
            const firstParam = content.split(',')[0].trim();
            if (firstParam && !firstParam.includes('=')) {
                path = firstParam;
            }
        }

        return {
            isBinding: true,
            path: path || '(self)'
        };
    }

    /**
     * Refresh the tree view
     */
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}
