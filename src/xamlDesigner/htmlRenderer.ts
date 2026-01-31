// WinDev Helper - XAML to HTML Renderer
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import { XamlElement } from './xamlParser';

/**
 * Options for HTML rendering
 */
export interface RenderOptions {
    /** Whether to include element IDs for selection */
    includeElementIds: boolean;
    /** Base font size in pixels */
    baseFontSize: number;
    /** Theme: 'light' or 'dark' */
    theme: 'light' | 'dark';
}

/**
 * Mapping of a rendered HTML element back to its XAML source
 */
export interface ElementMapping {
    elementId: string;
    xamlElement: XamlElement;
}

/**
 * Result of rendering XAML to HTML
 */
export interface RenderResult {
    html: string;
    elementMappings: ElementMapping[];
}

/**
 * Renders XAML elements to HTML/CSS approximations
 */
export class XamlHtmlRenderer {
    private elementCounter: number = 0;
    private elementMappings: ElementMapping[] = [];

    /**
     * Render a XAML element tree to HTML
     */
    public render(element: XamlElement, options: RenderOptions): RenderResult {
        this.elementCounter = 0;
        this.elementMappings = [];

        const html = this.renderElement(element, options);

        return {
            html,
            elementMappings: this.elementMappings
        };
    }

    /**
     * Render a single element and its children
     */
    private renderElement(element: XamlElement, options: RenderOptions): string {
        const elementId = `xaml-el-${this.elementCounter++}`;
        
        // Store mapping for later selection sync
        if (options.includeElementIds) {
            this.elementMappings.push({
                elementId,
                xamlElement: element
            });
        }

        // Get the appropriate renderer for this control
        const renderer = this.getControlRenderer(element.tagName);
        return renderer.call(this, element, elementId, options);
    }

    /**
     * Get the renderer function for a specific control type
     */
    private getControlRenderer(tagName: string): (element: XamlElement, id: string, options: RenderOptions) => string {
        const renderers: Record<string, (element: XamlElement, id: string, options: RenderOptions) => string> = {
            // Layout controls
            'Page': this.renderPage.bind(this),
            'Window': this.renderWindow.bind(this),
            'UserControl': this.renderUserControl.bind(this),
            'Grid': this.renderGrid.bind(this),
            'StackPanel': this.renderStackPanel.bind(this),
            'Border': this.renderBorder.bind(this),
            'ScrollViewer': this.renderScrollViewer.bind(this),
            'Canvas': this.renderCanvas.bind(this),
            'RelativePanel': this.renderRelativePanel.bind(this),
            'Viewbox': this.renderViewbox.bind(this),

            // Basic controls
            'TextBlock': this.renderTextBlock.bind(this),
            'TextBox': this.renderTextBox.bind(this),
            'PasswordBox': this.renderPasswordBox.bind(this),
            'Button': this.renderButton.bind(this),
            'HyperlinkButton': this.renderHyperlinkButton.bind(this),
            'ToggleButton': this.renderToggleButton.bind(this),
            'CheckBox': this.renderCheckBox.bind(this),
            'RadioButton': this.renderRadioButton.bind(this),
            'ComboBox': this.renderComboBox.bind(this),
            'ComboBoxItem': this.renderComboBoxItem.bind(this),
            'ListBox': this.renderListBox.bind(this),
            'ListBoxItem': this.renderListBoxItem.bind(this),
            'ListView': this.renderListView.bind(this),
            'ListViewItem': this.renderListViewItem.bind(this),
            'Image': this.renderImage.bind(this),
            'Slider': this.renderSlider.bind(this),
            'ProgressBar': this.renderProgressBar.bind(this),
            'ProgressRing': this.renderProgressRing.bind(this),
            'ToggleSwitch': this.renderToggleSwitch.bind(this),

            // Navigation
            'NavigationView': this.renderNavigationView.bind(this),
            'NavigationViewItem': this.renderNavigationViewItem.bind(this),
            'Frame': this.renderFrame.bind(this),
            'Pivot': this.renderPivot.bind(this),
            'PivotItem': this.renderPivotItem.bind(this),
            'TabView': this.renderTabView.bind(this),
            'TabViewItem': this.renderTabViewItem.bind(this),

            // Containers
            'Expander': this.renderExpander.bind(this),
            'GroupBox': this.renderGroupBox.bind(this),
            'SplitView': this.renderSplitView.bind(this),

            // Shapes (basic)
            'Rectangle': this.renderRectangle.bind(this),
            'Ellipse': this.renderEllipse.bind(this),
            'Line': this.renderLine.bind(this),

            // Icons
            'FontIcon': this.renderFontIcon.bind(this),
            'SymbolIcon': this.renderSymbolIcon.bind(this),
            'PathIcon': this.renderPathIcon.bind(this),

            // Other
            'MenuBar': this.renderMenuBar.bind(this),
            'MenuBarItem': this.renderMenuBarItem.bind(this),
            'MenuFlyoutItem': this.renderMenuFlyoutItem.bind(this),
            'AppBarButton': this.renderAppBarButton.bind(this),
            'CommandBar': this.renderCommandBar.bind(this),
            'InfoBar': this.renderInfoBar.bind(this),
            'CalendarView': this.renderCalendarView.bind(this),
            'DatePicker': this.renderDatePicker.bind(this),
            'TimePicker': this.renderTimePicker.bind(this),
        };

        return renderers[tagName] || this.renderUnknownControl.bind(this);
    }

    // ==================== Layout Controls ====================

    private renderPage(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('min-height: 100%');
        style.push('background: var(--vscode-editor-background)');
        
        const children = this.renderChildren(element, options);
        
        return `<div id="${id}" class="xaml-page" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderWindow(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('min-height: 100%');
        style.push('background: var(--vscode-editor-background)');
        
        const children = this.renderChildren(element, options);
        const title = element.attributes.get('Title') || 'Window';
        
        return `<div id="${id}" class="xaml-window" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <div class="xaml-window-title">${this.escapeHtml(title)}</div>
            <div class="xaml-window-content">${children}</div>
        </div>`;
    }

    private renderUserControl(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const children = this.renderChildren(element, options);
        
        return `<div id="${id}" class="xaml-usercontrol" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderGrid(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: grid');

        // Parse RowDefinitions and ColumnDefinitions
        const rowDefs = this.parseGridDefinitions(element, 'Grid.RowDefinitions', 'RowDefinition');
        const colDefs = this.parseGridDefinitions(element, 'Grid.ColumnDefinitions', 'ColumnDefinition');

        if (rowDefs.length > 0) {
            style.push(`grid-template-rows: ${rowDefs.join(' ')}`);
        }
        if (colDefs.length > 0) {
            style.push(`grid-template-columns: ${colDefs.join(' ')}`);
        }

        const children = this.renderGridChildren(element, options);
        
        return `<div id="${id}" class="xaml-grid" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private parseGridDefinitions(element: XamlElement, containerName: string, itemName: string): string[] {
        const definitions: string[] = [];
        
        for (const child of element.children) {
            if (child.tagName === containerName || child.fullName === containerName) {
                for (const def of child.children) {
                    if (def.tagName === itemName) {
                        const size = def.attributes.get('Height') || def.attributes.get('Width') || '*';
                        definitions.push(this.convertGridSize(size));
                    }
                }
            }
        }
        
        return definitions;
    }

    private convertGridSize(size: string): string {
        if (size === 'Auto') {
            return 'auto';
        }
        if (size === '*') {
            return '1fr';
        }
        if (size.endsWith('*')) {
            const multiplier = size.slice(0, -1) || '1';
            return `${multiplier}fr`;
        }
        // Numeric value - assume pixels
        const num = parseFloat(size);
        if (!isNaN(num)) {
            return `${num}px`;
        }
        return size;
    }

    private renderGridChildren(element: XamlElement, options: RenderOptions): string {
        return element.children
            .flatMap(child => this.unwrapPropertyElement(child, element.tagName))
            .map(child => {
                const row = child.attributes.get('Grid.Row') || '0';
                const col = child.attributes.get('Grid.Column') || '0';
                const rowSpan = child.attributes.get('Grid.RowSpan') || '1';
                const colSpan = child.attributes.get('Grid.ColumnSpan') || '1';

                const gridStyle = `grid-row: ${parseInt(row) + 1} / span ${rowSpan}; grid-column: ${parseInt(col) + 1} / span ${colSpan}`;
                const html = this.renderElement(child, options);
                
                // Wrap in a container with grid positioning
                return `<div style="${gridStyle}">${html}</div>`;
            })
            .join('');
    }

    private renderStackPanel(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: flex');
        
        const orientation = element.attributes.get('Orientation') || 'Vertical';
        if (orientation === 'Horizontal') {
            style.push('flex-direction: row');
        } else {
            style.push('flex-direction: column');
        }

        const spacing = element.attributes.get('Spacing');
        if (spacing) {
            style.push(`gap: ${spacing}px`);
        }

        const children = this.renderChildren(element, options);
        
        return `<div id="${id}" class="xaml-stackpanel" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderBorder(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const borderThickness = element.attributes.get('BorderThickness') || '0';
        const borderBrush = element.attributes.get('BorderBrush');
        const cornerRadius = element.attributes.get('CornerRadius');
        const background = element.attributes.get('Background');

        style.push(`border-width: ${this.parseThickness(borderThickness)}`);
        style.push('border-style: solid');
        if (borderBrush) {
            style.push(`border-color: ${this.convertBrush(borderBrush)}`);
        }
        if (cornerRadius) {
            style.push(`border-radius: ${this.parseCornerRadius(cornerRadius)}`);
        }
        if (background) {
            style.push(`background: ${this.convertBrush(background)}`);
        }

        const children = this.renderChildren(element, options);
        
        return `<div id="${id}" class="xaml-border" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderScrollViewer(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('overflow: auto');
        
        const children = this.renderChildren(element, options);
        
        return `<div id="${id}" class="xaml-scrollviewer" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderCanvas(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('position: relative');
        
        const children = element.children
            .flatMap(child => this.unwrapPropertyElement(child, element.tagName))
            .map(child => {
                const left = child.attributes.get('Canvas.Left') || '0';
                const top = child.attributes.get('Canvas.Top') || '0';
                const html = this.renderElement(child, options);
                return `<div style="position: absolute; left: ${left}px; top: ${top}px">${html}</div>`;
            }).join('');
        
        return `<div id="${id}" class="xaml-canvas" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderRelativePanel(element: XamlElement, id: string, options: RenderOptions): string {
        // RelativePanel is complex - render as basic container for POC
        const style = this.buildCommonStyles(element);
        style.push('position: relative');
        
        const children = this.renderChildren(element, options);
        
        return `<div id="${id}" class="xaml-relativepanel" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderViewbox(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const children = this.renderChildren(element, options);
        
        return `<div id="${id}" class="xaml-viewbox" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    // ==================== Basic Controls ====================

    private renderTextBlock(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const text = element.attributes.get('Text') || element.textContent || '';
        const fontSize = element.attributes.get('FontSize');
        const fontWeight = element.attributes.get('FontWeight');
        const foreground = element.attributes.get('Foreground');
        const textWrapping = element.attributes.get('TextWrapping');

        if (fontSize) {
            style.push(`font-size: ${fontSize}px`);
        }
        if (fontWeight) {
            style.push(`font-weight: ${this.convertFontWeight(fontWeight)}`);
        }
        if (foreground) {
            style.push(`color: ${this.convertBrush(foreground)}`);
        }
        if (textWrapping === 'Wrap' || textWrapping === 'WrapWholeWords') {
            style.push('white-space: normal');
        }

        const displayText = this.formatTextOrBinding(text, 'Text');
        return `<span id="${id}" class="xaml-textblock" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${displayText}</span>`;
    }

    private renderTextBox(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const text = element.attributes.get('Text') || '';
        const placeholder = element.attributes.get('PlaceholderText') || '';
        const isReadOnly = element.attributes.get('IsReadOnly') === 'True';

        // For TextBox with binding, show a placeholder in the input
        const displayValue = this.isBindingExpression(text) 
            ? `[${this.extractBindingPath(text)}]` 
            : this.escapeHtml(text);
        const displayPlaceholder = this.isBindingExpression(text)
            ? displayValue
            : this.escapeHtml(placeholder);

        return `<input id="${id}" type="text" class="xaml-textbox" data-xaml-line="${element.sourceLocation.startLine}" value="${this.isBindingExpression(text) ? '' : displayValue}" placeholder="${displayPlaceholder}" ${isReadOnly ? 'readonly' : ''} style="${style.join('; ')}" title="${this.isBindingExpression(text) ? this.escapeHtml(text) : ''}" />`;
    }

    private renderPasswordBox(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const placeholder = element.attributes.get('PlaceholderText') || '';

        return `<input id="${id}" type="password" class="xaml-passwordbox" data-xaml-line="${element.sourceLocation.startLine}" placeholder="${this.escapeHtml(placeholder)}" style="${style.join('; ')}" />`;
    }

    private renderButton(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const content = element.attributes.get('Content') || element.textContent || '';
        const children = element.children.length > 0 ? this.renderChildren(element, options) : this.formatTextOrBinding(content, 'Content');

        return `<button id="${id}" class="xaml-button" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</button>`;
    }

    private renderHyperlinkButton(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const content = element.attributes.get('Content') || element.textContent || '';
        const uri = element.attributes.get('NavigateUri') || '#';

        return `<a id="${id}" href="${this.escapeHtml(uri)}" class="xaml-hyperlinkbutton" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${this.escapeHtml(content)}</a>`;
    }

    private renderToggleButton(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const content = element.attributes.get('Content') || element.textContent || '';
        const isChecked = element.attributes.get('IsChecked') === 'True';

        return `<button id="${id}" class="xaml-togglebutton ${isChecked ? 'checked' : ''}" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${this.escapeHtml(content)}</button>`;
    }

    private renderCheckBox(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: flex');
        style.push('align-items: center');
        style.push('gap: 8px');
        
        const content = element.attributes.get('Content') || '';
        const isChecked = element.attributes.get('IsChecked') === 'True';

        return `<label id="${id}" class="xaml-checkbox" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <input type="checkbox" ${isChecked ? 'checked' : ''} />
            <span>${this.escapeHtml(content)}</span>
        </label>`;
    }

    private renderRadioButton(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: flex');
        style.push('align-items: center');
        style.push('gap: 8px');
        
        const content = element.attributes.get('Content') || '';
        const isChecked = element.attributes.get('IsChecked') === 'True';
        const groupName = element.attributes.get('GroupName') || 'default';

        return `<label id="${id}" class="xaml-radiobutton" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <input type="radio" name="${groupName}" ${isChecked ? 'checked' : ''} />
            <span>${this.escapeHtml(content)}</span>
        </label>`;
    }

    private renderComboBox(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const children = this.renderChildren(element, options);

        return `<select id="${id}" class="xaml-combobox" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</select>`;
    }

    private renderComboBoxItem(element: XamlElement, id: string, _options: RenderOptions): string {
        const content = element.attributes.get('Content') || element.textContent || '';
        const isSelected = element.attributes.get('IsSelected') === 'True';

        return `<option id="${id}" data-xaml-line="${element.sourceLocation.startLine}" ${isSelected ? 'selected' : ''}>${this.escapeHtml(content)}</option>`;
    }

    private renderListBox(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('border: 1px solid var(--vscode-input-border)');
        style.push('overflow: auto');
        
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-listbox" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderListBoxItem(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('padding: 4px 8px');
        style.push('cursor: pointer');
        
        const content = element.attributes.get('Content') || element.textContent || '';
        const children = element.children.length > 0 ? this.renderChildren(element, options) : this.escapeHtml(content);

        return `<div id="${id}" class="xaml-listboxitem" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderListView(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-listview" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderListViewItem(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-listviewitem" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderImage(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const source = element.attributes.get('Source') || '';
        const stretch = element.attributes.get('Stretch') || 'Uniform';

        // Map WinUI Stretch to CSS object-fit
        const objectFit = this.convertStretchToObjectFit(stretch);
        style.push(`object-fit: ${objectFit}`);

        // Show placeholder for missing images
        const placeholder = source ? '' : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ccc" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23666">Image</text></svg>');

        return `<img id="${id}" class="xaml-image" data-xaml-line="${element.sourceLocation.startLine}" src="${source || placeholder}" style="${style.join('; ')}" />`;
    }

    private renderSlider(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const min = element.attributes.get('Minimum') || '0';
        const max = element.attributes.get('Maximum') || '100';
        const value = element.attributes.get('Value') || '0';

        return `<input id="${id}" type="range" class="xaml-slider" data-xaml-line="${element.sourceLocation.startLine}" min="${min}" max="${max}" value="${value}" style="${style.join('; ')}" />`;
    }

    private renderProgressBar(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const value = element.attributes.get('Value') || '0';
        const max = element.attributes.get('Maximum') || '100';
        const isIndeterminate = element.attributes.get('IsIndeterminate') === 'True';

        if (isIndeterminate) {
            return `<progress id="${id}" class="xaml-progressbar indeterminate" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}"></progress>`;
        }

        return `<progress id="${id}" class="xaml-progressbar" data-xaml-line="${element.sourceLocation.startLine}" value="${value}" max="${max}" style="${style.join('; ')}"></progress>`;
    }

    private renderProgressRing(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('width: 32px');
        style.push('height: 32px');

        return `<div id="${id}" class="xaml-progressring" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60 40" /></svg>
        </div>`;
    }

    private renderToggleSwitch(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: flex');
        style.push('align-items: center');
        style.push('gap: 8px');
        
        const isOn = element.attributes.get('IsOn') === 'True';
        const header = element.attributes.get('Header') || '';
        const onContent = element.attributes.get('OnContent') || 'On';
        const offContent = element.attributes.get('OffContent') || 'Off';

        return `<label id="${id}" class="xaml-toggleswitch" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            ${header ? `<span class="header">${this.escapeHtml(header)}</span>` : ''}
            <input type="checkbox" ${isOn ? 'checked' : ''} />
            <span class="toggle-label">${isOn ? this.escapeHtml(onContent) : this.escapeHtml(offContent)}</span>
        </label>`;
    }

    // ==================== Navigation Controls ====================

    private renderNavigationView(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: flex');
        style.push('min-height: 200px');
        
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-navigationview" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <nav class="nav-pane">${children}</nav>
            <div class="nav-content"></div>
        </div>`;
    }

    private renderNavigationViewItem(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const content = element.attributes.get('Content') || element.textContent || '';

        return `<div id="${id}" class="xaml-navigationviewitem" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${this.escapeHtml(content)}</div>`;
    }

    private renderFrame(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('border: 1px dashed var(--vscode-editorWidget-border)');
        style.push('min-height: 50px');
        style.push('display: flex');
        style.push('align-items: center');
        style.push('justify-content: center');

        return `<div id="${id}" class="xaml-frame" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <span class="placeholder-text">Frame</span>
        </div>`;
    }

    private renderPivot(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-pivot" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderPivotItem(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const header = element.attributes.get('Header') || '';
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-pivotitem" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <div class="pivot-header">${this.escapeHtml(header)}</div>
            <div class="pivot-content">${children}</div>
        </div>`;
    }

    private renderTabView(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-tabview" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderTabViewItem(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const header = element.attributes.get('Header') || '';
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-tabviewitem" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <div class="tab-header">${this.escapeHtml(header)}</div>
            <div class="tab-content">${children}</div>
        </div>`;
    }

    // ==================== Container Controls ====================

    private renderExpander(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const header = element.attributes.get('Header') || 'Expander';
        const isExpanded = element.attributes.get('IsExpanded') === 'True';
        const children = this.renderChildren(element, options);

        return `<details id="${id}" class="xaml-expander" data-xaml-line="${element.sourceLocation.startLine}" ${isExpanded ? 'open' : ''} style="${style.join('; ')}">
            <summary>${this.escapeHtml(header)}</summary>
            <div class="expander-content">${children}</div>
        </details>`;
    }

    private renderGroupBox(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const header = element.attributes.get('Header') || '';
        const children = this.renderChildren(element, options);

        return `<fieldset id="${id}" class="xaml-groupbox" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <legend>${this.escapeHtml(header)}</legend>
            ${children}
        </fieldset>`;
    }

    private renderSplitView(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: flex');
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-splitview" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    // ==================== Shapes ====================

    private renderRectangle(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        
        const fill = element.attributes.get('Fill');
        const stroke = element.attributes.get('Stroke');
        const strokeThickness = element.attributes.get('StrokeThickness') || '1';
        const radiusX = element.attributes.get('RadiusX') || '0';
        const radiusY = element.attributes.get('RadiusY') || '0';

        if (fill) {
            style.push(`background: ${this.convertBrush(fill)}`);
        }
        if (stroke) {
            style.push(`border: ${strokeThickness}px solid ${this.convertBrush(stroke)}`);
        }
        style.push(`border-radius: ${radiusX}px ${radiusY}px`);

        return `<div id="${id}" class="xaml-rectangle" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}"></div>`;
    }

    private renderEllipse(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('border-radius: 50%');
        
        const fill = element.attributes.get('Fill');
        const stroke = element.attributes.get('Stroke');
        const strokeThickness = element.attributes.get('StrokeThickness') || '1';

        if (fill) {
            style.push(`background: ${this.convertBrush(fill)}`);
        }
        if (stroke) {
            style.push(`border: ${strokeThickness}px solid ${this.convertBrush(stroke)}`);
        }

        return `<div id="${id}" class="xaml-ellipse" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}"></div>`;
    }

    private renderLine(element: XamlElement, id: string, _options: RenderOptions): string {
        const x1 = element.attributes.get('X1') || '0';
        const y1 = element.attributes.get('Y1') || '0';
        const x2 = element.attributes.get('X2') || '100';
        const y2 = element.attributes.get('Y2') || '0';
        const stroke = element.attributes.get('Stroke') || 'currentColor';
        const strokeThickness = element.attributes.get('StrokeThickness') || '1';

        return `<svg id="${id}" class="xaml-line" data-xaml-line="${element.sourceLocation.startLine}">
            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${this.convertBrush(stroke)}" stroke-width="${strokeThickness}" />
        </svg>`;
    }

    // ==================== Icons ====================

    private renderFontIcon(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const glyph = element.attributes.get('Glyph') || '';
        const fontSize = element.attributes.get('FontSize') || '16';
        
        style.push(`font-size: ${fontSize}px`);
        style.push('font-family: "Segoe Fluent Icons", "Segoe MDL2 Assets"');

        return `<span id="${id}" class="xaml-fonticon" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${glyph}</span>`;
    }

    private renderSymbolIcon(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const symbol = element.attributes.get('Symbol') || 'Emoji';

        // Map common symbols to Unicode
        const symbolMap: Record<string, string> = {
            'Accept': '✓',
            'Add': '+',
            'Back': '←',
            'Cancel': '✕',
            'Delete': '🗑',
            'Edit': '✏',
            'Forward': '→',
            'Home': '🏠',
            'Mail': '✉',
            'Refresh': '↻',
            'Save': '💾',
            'Search': '🔍',
            'Setting': '⚙',
            'Share': '↗',
            'Sync': '🔄',
        };

        const char = symbolMap[symbol] || '?';

        return `<span id="${id}" class="xaml-symbolicon" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}" title="${symbol}">${char}</span>`;
    }

    private renderPathIcon(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const data = element.attributes.get('Data') || '';

        return `<svg id="${id}" class="xaml-pathicon" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}" viewBox="0 0 24 24">
            <path d="${data}" fill="currentColor" />
        </svg>`;
    }

    // ==================== Other Controls ====================

    private renderMenuBar(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: flex');
        style.push('gap: 4px');
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-menubar" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderMenuBarItem(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const title = element.attributes.get('Title') || '';
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-menubaritem" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <span class="menu-title">${this.escapeHtml(title)}</span>
            <div class="menu-flyout">${children}</div>
        </div>`;
    }

    private renderMenuFlyoutItem(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const text = element.attributes.get('Text') || '';

        return `<div id="${id}" class="xaml-menuflyoutitem" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${this.escapeHtml(text)}</div>`;
    }

    private renderAppBarButton(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const label = element.attributes.get('Label') || '';

        return `<button id="${id}" class="xaml-appbarbutton" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${this.escapeHtml(label)}</button>`;
    }

    private renderCommandBar(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('display: flex');
        style.push('gap: 4px');
        style.push('padding: 4px');
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-commandbar" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">${children}</div>`;
    }

    private renderInfoBar(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const title = element.attributes.get('Title') || '';
        const message = element.attributes.get('Message') || '';
        const severity = element.attributes.get('Severity') || 'Informational';

        const severityClass = severity.toLowerCase();

        return `<div id="${id}" class="xaml-infobar ${severityClass}" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <strong>${this.escapeHtml(title)}</strong>
            <span>${this.escapeHtml(message)}</span>
        </div>`;
    }

    private renderCalendarView(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);

        return `<div id="${id}" class="xaml-calendarview" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            <div class="calendar-placeholder">📅 Calendar</div>
        </div>`;
    }

    private renderDatePicker(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const header = element.attributes.get('Header') || '';

        return `<div id="${id}" class="xaml-datepicker" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            ${header ? `<label>${this.escapeHtml(header)}</label>` : ''}
            <input type="date" />
        </div>`;
    }

    private renderTimePicker(element: XamlElement, id: string, _options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        const header = element.attributes.get('Header') || '';

        return `<div id="${id}" class="xaml-timepicker" data-xaml-line="${element.sourceLocation.startLine}" style="${style.join('; ')}">
            ${header ? `<label>${this.escapeHtml(header)}</label>` : ''}
            <input type="time" />
        </div>`;
    }

    // ==================== Unknown Control ====================

    private renderUnknownControl(element: XamlElement, id: string, options: RenderOptions): string {
        const style = this.buildCommonStyles(element);
        style.push('border: 1px dashed var(--vscode-editorWidget-border)');
        style.push('padding: 8px');
        style.push('min-height: 24px');
        style.push('background: var(--vscode-editorWidget-background)');
        
        const children = this.renderChildren(element, options);

        return `<div id="${id}" class="xaml-unknown" data-xaml-line="${element.sourceLocation.startLine}" title="Unknown control: ${element.fullName}" style="${style.join('; ')}">
            <span class="control-label">${element.fullName}</span>
            ${children}
        </div>`;
    }

    // ==================== Helper Methods ====================

    private renderChildren(element: XamlElement, options: RenderOptions): string {
        return element.children
            .flatMap(child => this.unwrapPropertyElement(child, element.tagName))
            .map(child => this.renderElement(child, options))
            .join('');
    }

    /**
     * Unwraps property element syntax (e.g., Page.Content, Button.Content)
     * and returns the actual child elements to render.
     * Skips definition elements like Grid.RowDefinitions.
     */
    private unwrapPropertyElement(child: XamlElement, parentTagName: string): XamlElement[] {
        // Check if this is a property element (contains a dot)
        if (!child.tagName.includes('.')) {
            return [child];
        }

        // Parse the property element: "Parent.Property" format
        const dotIndex = child.tagName.indexOf('.');
        const ownerType = child.tagName.substring(0, dotIndex);
        const propertyName = child.tagName.substring(dotIndex + 1);

        // Check if this is a content/child property of the parent element
        // e.g., Page.Content, Border.Child, Button.Content, etc.
        const contentProperties = ['Content', 'Child', 'Children', 'Items', 'Header', 'Footer', 'Pane', 'MenuItems'];
        
        if (ownerType === parentTagName && contentProperties.includes(propertyName)) {
            // Unwrap and return the children of this property element
            return child.children;
        }

        // Skip definition elements like Grid.RowDefinitions, Grid.ColumnDefinitions
        const definitionProperties = ['RowDefinitions', 'ColumnDefinitions', 'Resources', 'Triggers', 'Styles'];
        if (definitionProperties.includes(propertyName)) {
            return [];
        }

        // For other property elements, try to unwrap their content
        // This handles cases like custom attached properties with content
        if (child.children.length > 0) {
            return child.children;
        }

        return [];
    }

    private buildCommonStyles(element: XamlElement): string[] {
        const styles: string[] = [];

        // Width and Height
        const width = element.attributes.get('Width');
        const height = element.attributes.get('Height');
        const minWidth = element.attributes.get('MinWidth');
        const minHeight = element.attributes.get('MinHeight');
        const maxWidth = element.attributes.get('MaxWidth');
        const maxHeight = element.attributes.get('MaxHeight');

        if (width) {
            styles.push(`width: ${this.parseDimension(width)}`);
        }
        if (height) {
            styles.push(`height: ${this.parseDimension(height)}`);
        }
        if (minWidth) {
            styles.push(`min-width: ${this.parseDimension(minWidth)}`);
        }
        if (minHeight) {
            styles.push(`min-height: ${this.parseDimension(minHeight)}`);
        }
        if (maxWidth) {
            styles.push(`max-width: ${this.parseDimension(maxWidth)}`);
        }
        if (maxHeight) {
            styles.push(`max-height: ${this.parseDimension(maxHeight)}`);
        }

        // Margin and Padding
        const margin = element.attributes.get('Margin');
        const padding = element.attributes.get('Padding');

        if (margin) {
            styles.push(`margin: ${this.parseThickness(margin)}`);
        }
        if (padding) {
            styles.push(`padding: ${this.parseThickness(padding)}`);
        }

        // Alignment
        const hAlign = element.attributes.get('HorizontalAlignment');
        const vAlign = element.attributes.get('VerticalAlignment');

        if (hAlign) {
            styles.push(`justify-self: ${this.convertHorizontalAlignment(hAlign)}`);
        }
        if (vAlign) {
            styles.push(`align-self: ${this.convertVerticalAlignment(vAlign)}`);
        }

        // Visibility
        const visibility = element.attributes.get('Visibility');
        if (visibility === 'Collapsed') {
            styles.push('display: none');
        }

        // Opacity
        const opacity = element.attributes.get('Opacity');
        if (opacity) {
            styles.push(`opacity: ${opacity}`);
        }

        // Background (for non-layout controls)
        const background = element.attributes.get('Background');
        if (background) {
            styles.push(`background: ${this.convertBrush(background)}`);
        }

        return styles;
    }

    private parseDimension(value: string): string {
        if (value === 'Auto') {
            return 'auto';
        }
        const num = parseFloat(value);
        if (!isNaN(num)) {
            return `${num}px`;
        }
        return value;
    }

    private parseThickness(value: string): string {
        // WinUI thickness can be: "10" or "10,20" or "10,20,30,40"
        const parts = value.split(',').map(p => p.trim());
        
        if (parts.length === 1) {
            return `${parts[0]}px`;
        } else if (parts.length === 2) {
            return `${parts[1]}px ${parts[0]}px`; // Top/Bottom, Left/Right
        } else if (parts.length === 4) {
            // WinUI: Left,Top,Right,Bottom -> CSS: Top,Right,Bottom,Left
            return `${parts[1]}px ${parts[2]}px ${parts[3]}px ${parts[0]}px`;
        }
        return value;
    }

    private parseCornerRadius(value: string): string {
        const parts = value.split(',').map(p => p.trim());
        
        if (parts.length === 1) {
            return `${parts[0]}px`;
        } else if (parts.length === 4) {
            // WinUI: TopLeft,TopRight,BottomRight,BottomLeft
            return `${parts[0]}px ${parts[1]}px ${parts[2]}px ${parts[3]}px`;
        }
        return value;
    }

    private convertBrush(brush: string): string {
        // Handle StaticResource/ThemeResource references
        if (brush.startsWith('{')) {
            // Extract resource key for display
            const match = brush.match(/\{(?:StaticResource|ThemeResource)\s+(\w+)\}/);
            if (match) {
                // Return a placeholder color with the resource name
                return `var(--xaml-resource-${match[1]}, #888)`;
            }
            return '#888';
        }

        // Handle common named colors
        const colorMap: Record<string, string> = {
            'Transparent': 'transparent',
            'White': '#ffffff',
            'Black': '#000000',
            'Red': '#ff0000',
            'Green': '#008000',
            'Blue': '#0000ff',
            'Yellow': '#ffff00',
            'Gray': '#808080',
            'LightGray': '#d3d3d3',
            'DarkGray': '#a9a9a9',
        };

        if (colorMap[brush]) {
            return colorMap[brush];
        }

        // Assume it's a hex color or valid CSS color
        return brush;
    }

    private convertHorizontalAlignment(align: string): string {
        const map: Record<string, string> = {
            'Left': 'start',
            'Center': 'center',
            'Right': 'end',
            'Stretch': 'stretch'
        };
        return map[align] || 'stretch';
    }

    private convertVerticalAlignment(align: string): string {
        const map: Record<string, string> = {
            'Top': 'start',
            'Center': 'center',
            'Bottom': 'end',
            'Stretch': 'stretch'
        };
        return map[align] || 'stretch';
    }

    private convertFontWeight(weight: string): string {
        const map: Record<string, string> = {
            'Thin': '100',
            'ExtraLight': '200',
            'Light': '300',
            'Normal': '400',
            'Medium': '500',
            'SemiBold': '600',
            'Bold': '700',
            'ExtraBold': '800',
            'Black': '900'
        };
        return map[weight] || weight;
    }

    private convertStretchToObjectFit(stretch: string): string {
        const map: Record<string, string> = {
            'None': 'none',
            'Fill': 'fill',
            'Uniform': 'contain',
            'UniformToFill': 'cover'
        };
        return map[stretch] || 'contain';
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Check if a value is a binding expression
     */
    private isBindingExpression(value: string): boolean {
        if (!value) return false;
        const trimmed = value.trim();
        return trimmed.startsWith('{Binding') || 
               trimmed.startsWith('{x:Bind') ||
               trimmed.startsWith('{TemplateBinding') ||
               trimmed.startsWith('{RelativeSource');
    }

    /**
     * Extract the binding path from a binding expression
     */
    private extractBindingPath(value: string): string {
        if (!value) return '';
        const trimmed = value.trim();
        
        // Match patterns like {Binding Path}, {x:Bind Path}, {x:Bind Path, Mode=...}
        const match = trimmed.match(/\{(?:x:Bind|Binding|TemplateBinding)\s+([^,}]+)/i);
        if (match) {
            return match[1].trim();
        }
        
        // Try to match {Binding} or {x:Bind} with Path= syntax
        const pathMatch = trimmed.match(/Path\s*=\s*([^,}]+)/i);
        if (pathMatch) {
            return pathMatch[1].trim();
        }
        
        return 'bound';
    }

    /**
     * Format a text value, showing a placeholder for binding expressions
     */
    private formatTextOrBinding(value: string, _propertyName: string = 'value'): string {
        if (!value) return '';
        
        if (this.isBindingExpression(value)) {
            const bindingPath = this.extractBindingPath(value);
            const displayPath = bindingPath.length > 25 ? bindingPath.substring(0, 22) + '...' : bindingPath;
            return `<span class="xaml-binding-placeholder" title="${this.escapeHtml(value)}">` +
                   `<span class="binding-icon">⟷</span> ${this.escapeHtml(displayPath)}</span>`;
        }
        
        return this.escapeHtml(value);
    }
}

