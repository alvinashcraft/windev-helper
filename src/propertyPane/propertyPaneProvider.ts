// WinDev Helper - Property Pane Provider
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { XamlElement } from '../xamlDesigner/xamlParser';

/**
 * Property categories for grouping in the tree view
 */
export enum PropertyCategory {
    Common = 'Common',
    Layout = 'Layout',
    Appearance = 'Appearance',
    Text = 'Text',
    Interaction = 'Interaction',
    Accessibility = 'Accessibility',
    Miscellaneous = 'Miscellaneous'
}

/**
 * Represents a property item in the tree view
 */
export class PropertyItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly value: string,
        public readonly isBinding: boolean,
        public readonly bindingPath?: string,
        public readonly fullExpression?: string,
        public readonly category?: PropertyCategory,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(name, collapsibleState);
        
        this.description = this.formatValue();
        this.tooltip = this.formatTooltip();
        this.contextValue = isBinding ? 'boundProperty' : 'property';
        
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
        
        // Truncate long values
        if (this.value.length > 30) {
            return this.value.substring(0, 27) + '...';
        }
        return this.value;
    }

    private formatTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${this.name}**\n\n`);
        
        if (this.isBinding && this.fullExpression) {
            md.appendMarkdown(`*Data Binding*\n\n`);
            md.appendCodeblock(this.fullExpression, 'xml');
        } else {
            md.appendCodeblock(this.value, 'text');
        }
        
        return md;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.isBinding) {
            return new vscode.ThemeIcon('link', new vscode.ThemeColor('charts.purple'));
        }
        return new vscode.ThemeIcon('symbol-property');
    }
}

/**
 * Represents a category node in the tree view
 */
export class CategoryItem extends vscode.TreeItem {
    constructor(
        public readonly category: PropertyCategory,
        public readonly properties: PropertyItem[]
    ) {
        super(category, vscode.TreeItemCollapsibleState.Expanded);
        
        this.description = `(${properties.length})`;
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
        public readonly elementName?: string
    ) {
        const label = elementName ? `${elementType}: ${elementName}` : elementType;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        
        this.description = elementName ? '' : '(no name)';
        this.contextValue = 'element';
        this.iconPath = new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('symbolIcon.classForeground'));
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

    // Property categorization map
    private static readonly PROPERTY_CATEGORIES: Record<string, PropertyCategory> = {
        // Common
        'x:Name': PropertyCategory.Common,
        'Name': PropertyCategory.Common,
        'Content': PropertyCategory.Common,
        'Text': PropertyCategory.Common,
        'Header': PropertyCategory.Common,
        'Title': PropertyCategory.Common,
        'IsEnabled': PropertyCategory.Common,
        'Visibility': PropertyCategory.Common,
        'Tag': PropertyCategory.Common,
        'DataContext': PropertyCategory.Common,

        // Layout
        'Width': PropertyCategory.Layout,
        'Height': PropertyCategory.Layout,
        'MinWidth': PropertyCategory.Layout,
        'MinHeight': PropertyCategory.Layout,
        'MaxWidth': PropertyCategory.Layout,
        'MaxHeight': PropertyCategory.Layout,
        'Margin': PropertyCategory.Layout,
        'Padding': PropertyCategory.Layout,
        'HorizontalAlignment': PropertyCategory.Layout,
        'VerticalAlignment': PropertyCategory.Layout,
        'HorizontalContentAlignment': PropertyCategory.Layout,
        'VerticalContentAlignment': PropertyCategory.Layout,
        'Grid.Row': PropertyCategory.Layout,
        'Grid.Column': PropertyCategory.Layout,
        'Grid.RowSpan': PropertyCategory.Layout,
        'Grid.ColumnSpan': PropertyCategory.Layout,
        'Canvas.Left': PropertyCategory.Layout,
        'Canvas.Top': PropertyCategory.Layout,
        'Canvas.ZIndex': PropertyCategory.Layout,
        'RelativePanel.AlignLeftWithPanel': PropertyCategory.Layout,
        'RelativePanel.AlignRightWithPanel': PropertyCategory.Layout,
        'RelativePanel.AlignTopWithPanel': PropertyCategory.Layout,
        'RelativePanel.AlignBottomWithPanel': PropertyCategory.Layout,

        // Appearance
        'Background': PropertyCategory.Appearance,
        'Foreground': PropertyCategory.Appearance,
        'BorderBrush': PropertyCategory.Appearance,
        'BorderThickness': PropertyCategory.Appearance,
        'CornerRadius': PropertyCategory.Appearance,
        'Opacity': PropertyCategory.Appearance,
        'Style': PropertyCategory.Appearance,
        'RequestedTheme': PropertyCategory.Appearance,

        // Text
        'FontFamily': PropertyCategory.Text,
        'FontSize': PropertyCategory.Text,
        'FontWeight': PropertyCategory.Text,
        'FontStyle': PropertyCategory.Text,
        'TextWrapping': PropertyCategory.Text,
        'TextAlignment': PropertyCategory.Text,
        'TextTrimming': PropertyCategory.Text,
        'PlaceholderText': PropertyCategory.Text,
        'MaxLength': PropertyCategory.Text,
        'AcceptsReturn': PropertyCategory.Text,

        // Interaction
        'Command': PropertyCategory.Interaction,
        'CommandParameter': PropertyCategory.Interaction,
        'Click': PropertyCategory.Interaction,
        'IsHitTestVisible': PropertyCategory.Interaction,
        'AllowDrop': PropertyCategory.Interaction,
        'CanDrag': PropertyCategory.Interaction,
        'IsTabStop': PropertyCategory.Interaction,
        'TabIndex': PropertyCategory.Interaction,

        // Accessibility
        'AutomationProperties.Name': PropertyCategory.Accessibility,
        'AutomationProperties.LabeledBy': PropertyCategory.Accessibility,
        'AutomationProperties.HelpText': PropertyCategory.Accessibility,
        'AutomationProperties.LiveSetting': PropertyCategory.Accessibility,
        'ToolTipService.ToolTip': PropertyCategory.Accessibility,
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
            const header = new ElementHeader(
                this.selectedElement.tagName,
                this.getElementName()
            );
            return Promise.resolve([header]);
        }

        // Element header - show categories or flat list
        if (element instanceof ElementHeader) {
            if (this.groupByCategory) {
                return Promise.resolve(this.getCategoryItems());
            } else {
                return Promise.resolve(this.getAllPropertyItems());
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
    private getCategoryItems(): CategoryItem[] {
        const propertyItems = this.getAllPropertyItems();
        
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
                categoryItems.push(new CategoryItem(category, properties));
            }
        }

        return categoryItems;
    }

    /**
     * Get all properties as a flat list
     */
    private getAllPropertyItems(): PropertyItem[] {
        if (!this.selectedElement) {
            return [];
        }

        const items: PropertyItem[] = [];

        for (const [name, value] of this.selectedElement.attributes) {
            const bindingInfo = this.parseBindingExpression(value);
            const category = PropertyPaneProvider.PROPERTY_CATEGORIES[name] || PropertyCategory.Miscellaneous;

            items.push(new PropertyItem(
                name,
                value,
                bindingInfo.isBinding,
                bindingInfo.path,
                bindingInfo.isBinding ? value : undefined,
                category
            ));
        }

        // Sort alphabetically within categories
        items.sort((a, b) => a.name.localeCompare(b.name));

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
