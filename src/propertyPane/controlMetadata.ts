// WinDev Helper - WinUI 3 Control Property Metadata
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.
//
// This file contains metadata for WinUI 3 controls, including their properties,
// default values, types, and inheritance hierarchy. This enables the property pane
// to show all available properties for a selected element, not just those explicitly
// set in the XAML markup.
//
// Source: Microsoft Learn - Windows App SDK API Reference
// https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls

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
 * Metadata for a single property on a WinUI control
 */
export interface PropertyMetadata {
    /** Property name as used in XAML */
    name: string;
    /** Property type (e.g., "double", "Brush", "Thickness") */
    type: string;
    /** Default value as a display string */
    defaultValue: string;
    /** Category for grouping in the property pane */
    category: PropertyCategory;
}

/**
 * Metadata for a WinUI control type
 */
export interface ControlTypeMetadata {
    /** The base type this control inherits from (null for root types) */
    baseType: string | null;
    /** Brief description of the control */
    description: string;
    /** Properties defined directly on this type (not inherited) */
    properties: PropertyMetadata[];
}

/**
 * Well-known attached properties that can be set on child elements
 */
export interface AttachedPropertyMetadata {
    /** The owning type (e.g., "Grid", "Canvas") */
    ownerType: string;
    /** The property name (e.g., "Row", "Column") */
    name: string;
    /** Full XAML syntax (e.g., "Grid.Row") */
    xamlName: string;
    /** Property type */
    type: string;
    /** Default value */
    defaultValue: string;
    /** Category */
    category: PropertyCategory;
}

// ============================================================================
// Control Type Metadata Registry
// ============================================================================

const C = PropertyCategory;

export const CONTROL_METADATA: Record<string, ControlTypeMetadata> = {

    // ========================================================================
    // Base Types
    // ========================================================================

    'UIElement': {
        baseType: null,
        description: 'Base class for most visual UI objects.',
        properties: [
            { name: 'Opacity', type: 'double', defaultValue: '1', category: C.Appearance },
            { name: 'Visibility', type: 'Visibility', defaultValue: 'Visible', category: C.Appearance },
            { name: 'IsHitTestVisible', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'AllowDrop', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'CanDrag', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'RenderTransform', type: 'Transform', defaultValue: '', category: C.Appearance },
            { name: 'RenderTransformOrigin', type: 'Point', defaultValue: '0,0', category: C.Appearance },
            { name: 'Projection', type: 'Projection', defaultValue: '', category: C.Appearance },
            { name: 'Clip', type: 'RectangleGeometry', defaultValue: '', category: C.Appearance },
            { name: 'UseLayoutRounding', type: 'bool', defaultValue: 'True', category: C.Layout },
            { name: 'CacheMode', type: 'CacheMode', defaultValue: '', category: C.Miscellaneous },
            { name: 'Transitions', type: 'TransitionCollection', defaultValue: '', category: C.Appearance },
            { name: 'Shadow', type: 'Shadow', defaultValue: '', category: C.Appearance },
            { name: 'Translation', type: 'Vector3', defaultValue: '0,0,0', category: C.Layout },
            { name: 'Rotation', type: 'float', defaultValue: '0', category: C.Appearance },
            { name: 'Scale', type: 'Vector3', defaultValue: '1,1,1', category: C.Appearance },
            { name: 'CenterPoint', type: 'Vector3', defaultValue: '0,0,0', category: C.Layout },
            { name: 'RotationAxis', type: 'Vector3', defaultValue: '0,0,1', category: C.Appearance },
            { name: 'ManipulationMode', type: 'ManipulationModes', defaultValue: 'System', category: C.Interaction },
            { name: 'IsTapEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'IsDoubleTapEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'IsRightTapEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'IsHoldingEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'AccessKey', type: 'string', defaultValue: '', category: C.Accessibility },
            { name: 'HighContrastAdjustment', type: 'ElementHighContrastAdjustment', defaultValue: 'Application', category: C.Accessibility },
            { name: 'TabFocusNavigation', type: 'KeyboardNavigationMode', defaultValue: 'Local', category: C.Interaction },
            { name: 'XYFocusKeyboardNavigation', type: 'XYFocusKeyboardNavigationMode', defaultValue: 'Auto', category: C.Interaction },
            { name: 'CanBeScrollAnchor', type: 'bool', defaultValue: 'False', category: C.Layout },
            { name: 'ContextFlyout', type: 'FlyoutBase', defaultValue: '', category: C.Interaction },
            { name: 'KeyTipPlacementMode', type: 'KeyTipPlacementMode', defaultValue: 'Auto', category: C.Accessibility },
        ]
    },

    'FrameworkElement': {
        baseType: 'UIElement',
        description: 'Base class with layout, data binding, and style support.',
        properties: [
            { name: 'Width', type: 'double', defaultValue: 'Auto', category: C.Layout },
            { name: 'Height', type: 'double', defaultValue: 'Auto', category: C.Layout },
            { name: 'MinWidth', type: 'double', defaultValue: '0', category: C.Layout },
            { name: 'MinHeight', type: 'double', defaultValue: '0', category: C.Layout },
            { name: 'MaxWidth', type: 'double', defaultValue: 'Infinity', category: C.Layout },
            { name: 'MaxHeight', type: 'double', defaultValue: 'Infinity', category: C.Layout },
            { name: 'Margin', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'HorizontalAlignment', type: 'HorizontalAlignment', defaultValue: 'Stretch', category: C.Layout },
            { name: 'VerticalAlignment', type: 'VerticalAlignment', defaultValue: 'Stretch', category: C.Layout },
            { name: 'Name', type: 'string', defaultValue: '', category: C.Common },
            { name: 'Tag', type: 'object', defaultValue: '', category: C.Common },
            { name: 'DataContext', type: 'object', defaultValue: '', category: C.Common },
            { name: 'Style', type: 'Style', defaultValue: '', category: C.Appearance },
            { name: 'FlowDirection', type: 'FlowDirection', defaultValue: 'LeftToRight', category: C.Layout },
            { name: 'RequestedTheme', type: 'ElementTheme', defaultValue: 'Default', category: C.Appearance },
            { name: 'Language', type: 'string', defaultValue: '', category: C.Miscellaneous },
            { name: 'Resources', type: 'ResourceDictionary', defaultValue: '', category: C.Miscellaneous },
            { name: 'FocusVisualPrimaryBrush', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'FocusVisualSecondaryBrush', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'FocusVisualPrimaryThickness', type: 'Thickness', defaultValue: '2', category: C.Appearance },
            { name: 'FocusVisualSecondaryThickness', type: 'Thickness', defaultValue: '1', category: C.Appearance },
            { name: 'FocusVisualMargin', type: 'Thickness', defaultValue: '0', category: C.Appearance },
            { name: 'AllowFocusOnInteraction', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'AllowFocusWhenDisabled', type: 'bool', defaultValue: 'False', category: C.Interaction },
        ]
    },

    'Control': {
        baseType: 'FrameworkElement',
        description: 'Base class for UI elements that use a ControlTemplate.',
        properties: [
            { name: 'Background', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'Foreground', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'BorderBrush', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'BorderThickness', type: 'Thickness', defaultValue: '0', category: C.Appearance },
            { name: 'Padding', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'FontFamily', type: 'FontFamily', defaultValue: '', category: C.Text },
            { name: 'FontSize', type: 'double', defaultValue: '', category: C.Text },
            { name: 'FontWeight', type: 'FontWeight', defaultValue: 'Normal', category: C.Text },
            { name: 'FontStyle', type: 'FontStyle', defaultValue: 'Normal', category: C.Text },
            { name: 'FontStretch', type: 'FontStretch', defaultValue: 'Normal', category: C.Text },
            { name: 'CharacterSpacing', type: 'int', defaultValue: '0', category: C.Text },
            { name: 'IsEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsTabStop', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'TabIndex', type: 'int', defaultValue: '', category: C.Interaction },
            { name: 'Template', type: 'ControlTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'HorizontalContentAlignment', type: 'HorizontalAlignment', defaultValue: 'Center', category: C.Layout },
            { name: 'VerticalContentAlignment', type: 'VerticalAlignment', defaultValue: 'Center', category: C.Layout },
            { name: 'IsTextScaleFactorEnabled', type: 'bool', defaultValue: 'True', category: C.Text },
            { name: 'CornerRadius', type: 'CornerRadius', defaultValue: '0', category: C.Appearance },
            { name: 'BackgroundSizing', type: 'BackgroundSizing', defaultValue: 'InnerBorderEdge', category: C.Appearance },
            { name: 'ElementSoundMode', type: 'ElementSoundMode', defaultValue: 'Default', category: C.Miscellaneous },
        ]
    },

    'ContentControl': {
        baseType: 'Control',
        description: 'Control that displays a single piece of content.',
        properties: [
            { name: 'Content', type: 'object', defaultValue: '', category: C.Common },
            { name: 'ContentTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'ContentTemplateSelector', type: 'DataTemplateSelector', defaultValue: '', category: C.Miscellaneous },
            { name: 'ContentTransitions', type: 'TransitionCollection', defaultValue: '', category: C.Appearance },
        ]
    },

    'UserControl': {
        baseType: 'Control',
        description: 'Base class for user-defined controls with XAML UI.',
        properties: [
            { name: 'Content', type: 'UIElement', defaultValue: '', category: C.Common },
        ]
    },

    'Panel': {
        baseType: 'FrameworkElement',
        description: 'Base class for layout panel elements.',
        properties: [
            { name: 'Background', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'ChildrenTransitions', type: 'TransitionCollection', defaultValue: '', category: C.Appearance },
        ]
    },

    'ItemsControl': {
        baseType: 'Control',
        description: 'Base class for controls that present a collection of items.',
        properties: [
            { name: 'ItemsSource', type: 'object', defaultValue: '', category: C.Common },
            { name: 'ItemTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'ItemTemplateSelector', type: 'DataTemplateSelector', defaultValue: '', category: C.Miscellaneous },
            { name: 'ItemsPanel', type: 'ItemsPanelTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'DisplayMemberPath', type: 'string', defaultValue: '', category: C.Common },
            { name: 'ItemContainerTransitions', type: 'TransitionCollection', defaultValue: '', category: C.Appearance },
        ]
    },

    'RangeBase': {
        baseType: 'Control',
        description: 'Base class for controls that have a value within a range.',
        properties: [
            { name: 'Minimum', type: 'double', defaultValue: '0', category: C.Common },
            { name: 'Maximum', type: 'double', defaultValue: '100', category: C.Common },
            { name: 'Value', type: 'double', defaultValue: '0', category: C.Common },
            { name: 'SmallChange', type: 'double', defaultValue: '1', category: C.Common },
            { name: 'LargeChange', type: 'double', defaultValue: '10', category: C.Common },
        ]
    },

    'Selector': {
        baseType: 'ItemsControl',
        description: 'Base class for controls that allow selection from a collection.',
        properties: [
            { name: 'SelectedIndex', type: 'int', defaultValue: '-1', category: C.Common },
            { name: 'SelectedItem', type: 'object', defaultValue: '', category: C.Common },
            { name: 'SelectedValue', type: 'object', defaultValue: '', category: C.Common },
            { name: 'SelectedValuePath', type: 'string', defaultValue: '', category: C.Common },
            { name: 'IsSynchronizedWithCurrentItem', type: 'bool?', defaultValue: '', category: C.Common },
        ]
    },

    // ========================================================================
    // Button Controls
    // ========================================================================

    'ButtonBase': {
        baseType: 'ContentControl',
        description: 'Base class for button controls.',
        properties: [
            { name: 'ClickMode', type: 'ClickMode', defaultValue: 'Release', category: C.Interaction },
            { name: 'Command', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'CommandParameter', type: 'object', defaultValue: '', category: C.Interaction },
        ]
    },

    'Button': {
        baseType: 'ButtonBase',
        description: 'A standard push button.',
        properties: [
            { name: 'Flyout', type: 'FlyoutBase', defaultValue: '', category: C.Interaction },
        ]
    },

    'ToggleButton': {
        baseType: 'ButtonBase',
        description: 'A button that can toggle between two states.',
        properties: [
            { name: 'IsChecked', type: 'bool?', defaultValue: 'False', category: C.Common },
            { name: 'IsThreeState', type: 'bool', defaultValue: 'False', category: C.Common },
        ]
    },

    'CheckBox': {
        baseType: 'ToggleButton',
        description: 'A check box control.',
        properties: []
    },

    'RadioButton': {
        baseType: 'ToggleButton',
        description: 'A radio button control for mutually exclusive selection.',
        properties: [
            { name: 'GroupName', type: 'string', defaultValue: '', category: C.Common },
        ]
    },

    'HyperlinkButton': {
        baseType: 'ButtonBase',
        description: 'A button that displays as a hyperlink.',
        properties: [
            { name: 'NavigateUri', type: 'Uri', defaultValue: '', category: C.Common },
        ]
    },

    'RepeatButton': {
        baseType: 'ButtonBase',
        description: 'A button that fires Click repeatedly while pressed.',
        properties: [
            { name: 'Delay', type: 'int', defaultValue: '250', category: C.Interaction },
            { name: 'Interval', type: 'int', defaultValue: '250', category: C.Interaction },
        ]
    },

    'AppBarButton': {
        baseType: 'Button',
        description: 'A button for use in a CommandBar.',
        properties: [
            { name: 'Icon', type: 'IconElement', defaultValue: '', category: C.Appearance },
            { name: 'Label', type: 'string', defaultValue: '', category: C.Common },
            { name: 'IsCompact', type: 'bool', defaultValue: 'False', category: C.Appearance },
            { name: 'DynamicOverflowOrder', type: 'int', defaultValue: '0', category: C.Layout },
            { name: 'KeyboardAcceleratorTextOverride', type: 'string', defaultValue: '', category: C.Accessibility },
        ]
    },

    'AppBarToggleButton': {
        baseType: 'ToggleButton',
        description: 'A toggle button for use in a CommandBar.',
        properties: [
            { name: 'Icon', type: 'IconElement', defaultValue: '', category: C.Appearance },
            { name: 'Label', type: 'string', defaultValue: '', category: C.Common },
            { name: 'IsCompact', type: 'bool', defaultValue: 'False', category: C.Appearance },
            { name: 'DynamicOverflowOrder', type: 'int', defaultValue: '0', category: C.Layout },
            { name: 'KeyboardAcceleratorTextOverride', type: 'string', defaultValue: '', category: C.Accessibility },
        ]
    },

    'SplitButton': {
        baseType: 'ContentControl',
        description: 'A button with a primary action and a secondary flyout.',
        properties: [
            { name: 'Command', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'CommandParameter', type: 'object', defaultValue: '', category: C.Interaction },
            { name: 'Flyout', type: 'FlyoutBase', defaultValue: '', category: C.Interaction },
        ]
    },

    'ToggleSplitButton': {
        baseType: 'SplitButton',
        description: 'A split button that can toggle between two states.',
        properties: [
            { name: 'IsChecked', type: 'bool', defaultValue: 'False', category: C.Common },
        ]
    },

    'DropDownButton': {
        baseType: 'Button',
        description: 'A button with a chevron indicating a dropdown flyout.',
        properties: []
    },

    // ========================================================================
    // Text Input Controls
    // ========================================================================

    'TextBox': {
        baseType: 'Control',
        description: 'A single-line or multi-line text input field.',
        properties: [
            { name: 'Text', type: 'string', defaultValue: '', category: C.Common },
            { name: 'PlaceholderText', type: 'string', defaultValue: '', category: C.Text },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'Description', type: 'object', defaultValue: '', category: C.Common },
            { name: 'AcceptsReturn', type: 'bool', defaultValue: 'False', category: C.Text },
            { name: 'IsReadOnly', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'IsSpellCheckEnabled', type: 'bool', defaultValue: 'False', category: C.Text },
            { name: 'MaxLength', type: 'int', defaultValue: '0', category: C.Text },
            { name: 'TextWrapping', type: 'TextWrapping', defaultValue: 'NoWrap', category: C.Text },
            { name: 'TextAlignment', type: 'TextAlignment', defaultValue: 'Left', category: C.Text },
            { name: 'InputScope', type: 'InputScope', defaultValue: '', category: C.Text },
            { name: 'SelectionHighlightColor', type: 'SolidColorBrush', defaultValue: '', category: C.Appearance },
            { name: 'IsColorFontEnabled', type: 'bool', defaultValue: 'True', category: C.Text },
        ]
    },

    'PasswordBox': {
        baseType: 'Control',
        description: 'A text input field for entering passwords.',
        properties: [
            { name: 'Password', type: 'string', defaultValue: '', category: C.Common },
            { name: 'PlaceholderText', type: 'string', defaultValue: '', category: C.Text },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'Description', type: 'object', defaultValue: '', category: C.Common },
            { name: 'MaxLength', type: 'int', defaultValue: '0', category: C.Text },
            { name: 'PasswordRevealMode', type: 'PasswordRevealMode', defaultValue: 'Peek', category: C.Common },
            { name: 'PasswordChar', type: 'string', defaultValue: '●', category: C.Text },
        ]
    },

    'RichEditBox': {
        baseType: 'Control',
        description: 'A rich text editing control.',
        properties: [
            { name: 'PlaceholderText', type: 'string', defaultValue: '', category: C.Text },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'Description', type: 'object', defaultValue: '', category: C.Common },
            { name: 'IsReadOnly', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'IsSpellCheckEnabled', type: 'bool', defaultValue: 'True', category: C.Text },
            { name: 'AcceptsReturn', type: 'bool', defaultValue: 'True', category: C.Text },
            { name: 'TextWrapping', type: 'TextWrapping', defaultValue: 'Wrap', category: C.Text },
        ]
    },

    'AutoSuggestBox': {
        baseType: 'ItemsControl',
        description: 'A text input with auto-suggestion support.',
        properties: [
            { name: 'Text', type: 'string', defaultValue: '', category: C.Common },
            { name: 'PlaceholderText', type: 'string', defaultValue: '', category: C.Text },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'Description', type: 'object', defaultValue: '', category: C.Common },
            { name: 'QueryIcon', type: 'IconElement', defaultValue: '', category: C.Appearance },
            { name: 'UpdateTextOnSelect', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsSuggestionListOpen', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'AutoMaximizeSuggestionArea', type: 'bool', defaultValue: 'True', category: C.Layout },
            { name: 'TextBoxStyle', type: 'Style', defaultValue: '', category: C.Appearance },
        ]
    },

    'NumberBox': {
        baseType: 'Control',
        description: 'A numeric input control with increment/decrement buttons.',
        properties: [
            { name: 'Value', type: 'double', defaultValue: 'NaN', category: C.Common },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'Description', type: 'object', defaultValue: '', category: C.Common },
            { name: 'PlaceholderText', type: 'string', defaultValue: '', category: C.Text },
            { name: 'Text', type: 'string', defaultValue: '', category: C.Common },
            { name: 'Minimum', type: 'double', defaultValue: '-Infinity', category: C.Common },
            { name: 'Maximum', type: 'double', defaultValue: 'Infinity', category: C.Common },
            { name: 'SmallChange', type: 'double', defaultValue: '1', category: C.Common },
            { name: 'LargeChange', type: 'double', defaultValue: '10', category: C.Common },
            { name: 'SpinButtonPlacementMode', type: 'NumberBoxSpinButtonPlacementMode', defaultValue: 'Hidden', category: C.Appearance },
            { name: 'IsWrapEnabled', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'AcceptsExpression', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'ValidationMode', type: 'NumberBoxValidationMode', defaultValue: 'InvalidInputOverwritten', category: C.Common },
        ]
    },

    // ========================================================================
    // Text Display Controls
    // ========================================================================

    'TextBlock': {
        baseType: 'FrameworkElement',
        description: 'Displays read-only text.',
        properties: [
            { name: 'Text', type: 'string', defaultValue: '', category: C.Common },
            { name: 'Foreground', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'FontFamily', type: 'FontFamily', defaultValue: '', category: C.Text },
            { name: 'FontSize', type: 'double', defaultValue: '14', category: C.Text },
            { name: 'FontWeight', type: 'FontWeight', defaultValue: 'Normal', category: C.Text },
            { name: 'FontStyle', type: 'FontStyle', defaultValue: 'Normal', category: C.Text },
            { name: 'FontStretch', type: 'FontStretch', defaultValue: 'Normal', category: C.Text },
            { name: 'CharacterSpacing', type: 'int', defaultValue: '0', category: C.Text },
            { name: 'TextWrapping', type: 'TextWrapping', defaultValue: 'NoWrap', category: C.Text },
            { name: 'TextTrimming', type: 'TextTrimming', defaultValue: 'None', category: C.Text },
            { name: 'TextAlignment', type: 'TextAlignment', defaultValue: 'Left', category: C.Text },
            { name: 'HorizontalTextAlignment', type: 'TextAlignment', defaultValue: 'Left', category: C.Text },
            { name: 'LineHeight', type: 'double', defaultValue: '0', category: C.Text },
            { name: 'MaxLines', type: 'int', defaultValue: '0', category: C.Text },
            { name: 'Padding', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'IsTextSelectionEnabled', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'IsColorFontEnabled', type: 'bool', defaultValue: 'True', category: C.Text },
            { name: 'TextDecorations', type: 'TextDecorations', defaultValue: 'None', category: C.Text },
            { name: 'LineStackingStrategy', type: 'LineStackingStrategy', defaultValue: 'MaxHeight', category: C.Text },
            { name: 'SelectionHighlightColor', type: 'SolidColorBrush', defaultValue: '', category: C.Appearance },
        ]
    },

    'RichTextBlock': {
        baseType: 'FrameworkElement',
        description: 'Displays formatted rich text.',
        properties: [
            { name: 'Foreground', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'FontFamily', type: 'FontFamily', defaultValue: '', category: C.Text },
            { name: 'FontSize', type: 'double', defaultValue: '14', category: C.Text },
            { name: 'FontWeight', type: 'FontWeight', defaultValue: 'Normal', category: C.Text },
            { name: 'FontStyle', type: 'FontStyle', defaultValue: 'Normal', category: C.Text },
            { name: 'FontStretch', type: 'FontStretch', defaultValue: 'Normal', category: C.Text },
            { name: 'CharacterSpacing', type: 'int', defaultValue: '0', category: C.Text },
            { name: 'TextWrapping', type: 'TextWrapping', defaultValue: 'Wrap', category: C.Text },
            { name: 'TextTrimming', type: 'TextTrimming', defaultValue: 'None', category: C.Text },
            { name: 'TextAlignment', type: 'TextAlignment', defaultValue: 'Left', category: C.Text },
            { name: 'HorizontalTextAlignment', type: 'TextAlignment', defaultValue: 'Left', category: C.Text },
            { name: 'LineHeight', type: 'double', defaultValue: '0', category: C.Text },
            { name: 'MaxLines', type: 'int', defaultValue: '0', category: C.Text },
            { name: 'Padding', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'IsTextSelectionEnabled', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'IsColorFontEnabled', type: 'bool', defaultValue: 'True', category: C.Text },
            { name: 'TextDecorations', type: 'TextDecorations', defaultValue: 'None', category: C.Text },
            { name: 'LineStackingStrategy', type: 'LineStackingStrategy', defaultValue: 'MaxHeight', category: C.Text },
            { name: 'SelectionHighlightColor', type: 'SolidColorBrush', defaultValue: '', category: C.Appearance },
        ]
    },

    // ========================================================================
    // Layout Panels
    // ========================================================================

    'Grid': {
        baseType: 'Panel',
        description: 'A layout panel with rows and columns.',
        properties: [
            { name: 'ColumnSpacing', type: 'double', defaultValue: '0', category: C.Layout },
            { name: 'RowSpacing', type: 'double', defaultValue: '0', category: C.Layout },
            { name: 'BorderBrush', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'BorderThickness', type: 'Thickness', defaultValue: '0', category: C.Appearance },
            { name: 'CornerRadius', type: 'CornerRadius', defaultValue: '0', category: C.Appearance },
            { name: 'Padding', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'BackgroundSizing', type: 'BackgroundSizing', defaultValue: 'InnerBorderEdge', category: C.Appearance },
        ]
    },

    'StackPanel': {
        baseType: 'Panel',
        description: 'A layout panel that arranges children in a single line.',
        properties: [
            { name: 'Orientation', type: 'Orientation', defaultValue: 'Vertical', category: C.Layout },
            { name: 'Spacing', type: 'double', defaultValue: '0', category: C.Layout },
            { name: 'BorderBrush', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'BorderThickness', type: 'Thickness', defaultValue: '0', category: C.Appearance },
            { name: 'CornerRadius', type: 'CornerRadius', defaultValue: '0', category: C.Appearance },
            { name: 'Padding', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'BackgroundSizing', type: 'BackgroundSizing', defaultValue: 'InnerBorderEdge', category: C.Appearance },
        ]
    },

    'Canvas': {
        baseType: 'Panel',
        description: 'A layout panel for absolute positioning of child elements.',
        properties: []
    },

    'RelativePanel': {
        baseType: 'Panel',
        description: 'A layout panel that positions children relative to each other.',
        properties: [
            { name: 'BorderBrush', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'BorderThickness', type: 'Thickness', defaultValue: '0', category: C.Appearance },
            { name: 'CornerRadius', type: 'CornerRadius', defaultValue: '0', category: C.Appearance },
            { name: 'Padding', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'BackgroundSizing', type: 'BackgroundSizing', defaultValue: 'InnerBorderEdge', category: C.Appearance },
        ]
    },

    'Border': {
        baseType: 'FrameworkElement',
        description: 'Draws a border, background, or both around a child element.',
        properties: [
            { name: 'Background', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'BorderBrush', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'BorderThickness', type: 'Thickness', defaultValue: '0', category: C.Appearance },
            { name: 'CornerRadius', type: 'CornerRadius', defaultValue: '0', category: C.Appearance },
            { name: 'Padding', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'Child', type: 'UIElement', defaultValue: '', category: C.Common },
            { name: 'ChildTransitions', type: 'TransitionCollection', defaultValue: '', category: C.Appearance },
            { name: 'BackgroundSizing', type: 'BackgroundSizing', defaultValue: 'InnerBorderEdge', category: C.Appearance },
            { name: 'BackgroundTransition', type: 'BrushTransition', defaultValue: '', category: C.Appearance },
        ]
    },

    'Viewbox': {
        baseType: 'FrameworkElement',
        description: 'Scales a single child to fill the available space.',
        properties: [
            { name: 'Stretch', type: 'Stretch', defaultValue: 'Uniform', category: C.Layout },
            { name: 'StretchDirection', type: 'StretchDirection', defaultValue: 'Both', category: C.Layout },
            { name: 'Child', type: 'UIElement', defaultValue: '', category: C.Common },
        ]
    },

    // ========================================================================
    // Scroll Controls
    // ========================================================================

    'ScrollViewer': {
        baseType: 'ContentControl',
        description: 'A scrollable container for content.',
        properties: [
            { name: 'HorizontalScrollBarVisibility', type: 'ScrollBarVisibility', defaultValue: 'Disabled', category: C.Layout },
            { name: 'VerticalScrollBarVisibility', type: 'ScrollBarVisibility', defaultValue: 'Visible', category: C.Layout },
            { name: 'HorizontalScrollMode', type: 'ScrollMode', defaultValue: 'Enabled', category: C.Layout },
            { name: 'VerticalScrollMode', type: 'ScrollMode', defaultValue: 'Enabled', category: C.Layout },
            { name: 'IsHorizontalRailEnabled', type: 'bool', defaultValue: 'True', category: C.Layout },
            { name: 'IsVerticalRailEnabled', type: 'bool', defaultValue: 'True', category: C.Layout },
            { name: 'IsScrollInertiaEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'IsZoomInertiaEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'ZoomMode', type: 'ZoomMode', defaultValue: 'Disabled', category: C.Interaction },
            { name: 'MinZoomFactor', type: 'float', defaultValue: '0.1', category: C.Layout },
            { name: 'MaxZoomFactor', type: 'float', defaultValue: '10', category: C.Layout },
            { name: 'IsHorizontalScrollChainingEnabled', type: 'bool', defaultValue: 'True', category: C.Layout },
            { name: 'IsVerticalScrollChainingEnabled', type: 'bool', defaultValue: 'True', category: C.Layout },
            { name: 'IsZoomChainingEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'IsDeferredScrollingEnabled', type: 'bool', defaultValue: 'False', category: C.Layout },
            { name: 'BringIntoViewOnFocusChange', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'CanContentRenderOutsideBounds', type: 'bool', defaultValue: 'False', category: C.Layout },
        ]
    },

    'ScrollView': {
        baseType: 'Control',
        description: 'A modern scrollable container for content.',
        properties: [
            { name: 'Content', type: 'UIElement', defaultValue: '', category: C.Common },
            { name: 'HorizontalScrollBarVisibility', type: 'ScrollingScrollBarVisibility', defaultValue: 'Auto', category: C.Layout },
            { name: 'VerticalScrollBarVisibility', type: 'ScrollingScrollBarVisibility', defaultValue: 'Auto', category: C.Layout },
            { name: 'ContentOrientation', type: 'ScrollingContentOrientation', defaultValue: 'Vertical', category: C.Layout },
            { name: 'HorizontalScrollMode', type: 'ScrollingScrollMode', defaultValue: 'Enabled', category: C.Layout },
            { name: 'VerticalScrollMode', type: 'ScrollingScrollMode', defaultValue: 'Enabled', category: C.Layout },
            { name: 'ZoomMode', type: 'ScrollingZoomMode', defaultValue: 'Disabled', category: C.Interaction },
            { name: 'MinZoomFactor', type: 'double', defaultValue: '0.1', category: C.Layout },
            { name: 'MaxZoomFactor', type: 'double', defaultValue: '10', category: C.Layout },
            { name: 'IgnoredInputKinds', type: 'ScrollingInputKinds', defaultValue: 'None', category: C.Interaction },
        ]
    },

    // ========================================================================
    // List / Collection Controls
    // ========================================================================

    'ListViewBase': {
        baseType: 'Selector',
        description: 'Base class for list view controls.',
        properties: [
            { name: 'SelectionMode', type: 'ListViewSelectionMode', defaultValue: 'Single', category: C.Common },
            { name: 'IsItemClickEnabled', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'CanDragItems', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'CanReorderItems', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'Footer', type: 'object', defaultValue: '', category: C.Common },
            { name: 'FooterTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'IsSwipeEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'IsMultiSelectCheckBoxEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'SingleSelectionFollowsFocus', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'ShowsScrollingPlaceholders', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IncrementalLoadingTrigger', type: 'IncrementalLoadingTrigger', defaultValue: 'Edge', category: C.Common },
        ]
    },

    'ListView': {
        baseType: 'ListViewBase',
        description: 'Displays items in a vertical list.',
        properties: []
    },

    'GridView': {
        baseType: 'ListViewBase',
        description: 'Displays items in a grid layout.',
        properties: []
    },

    'ComboBox': {
        baseType: 'Selector',
        description: 'A dropdown list for selecting an item.',
        properties: [
            { name: 'IsEditable', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'IsDropDownOpen', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'MaxDropDownHeight', type: 'double', defaultValue: 'Infinity', category: C.Layout },
            { name: 'PlaceholderText', type: 'string', defaultValue: '', category: C.Text },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'Description', type: 'object', defaultValue: '', category: C.Common },
            { name: 'IsTextSearchEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'LightDismissOverlayMode', type: 'LightDismissOverlayMode', defaultValue: 'Auto', category: C.Appearance },
            { name: 'PlaceholderForeground', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'SelectionChangedTrigger', type: 'ComboBoxSelectionChangedTrigger', defaultValue: 'Committed', category: C.Interaction },
        ]
    },

    'ListBox': {
        baseType: 'Selector',
        description: 'A list of selectable items.',
        properties: [
            { name: 'SelectionMode', type: 'SelectionMode', defaultValue: 'Single', category: C.Common },
            { name: 'SingleSelectionFollowsFocus', type: 'bool', defaultValue: 'True', category: C.Interaction },
        ]
    },

    // ========================================================================
    // Navigation Controls
    // ========================================================================

    'NavigationView': {
        baseType: 'ContentControl',
        description: 'A navigation container with a collapsible pane.',
        properties: [
            { name: 'IsPaneOpen', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'PaneDisplayMode', type: 'NavigationViewPaneDisplayMode', defaultValue: 'Auto', category: C.Appearance },
            { name: 'CompactModeThresholdWidth', type: 'double', defaultValue: '641', category: C.Layout },
            { name: 'ExpandedModeThresholdWidth', type: 'double', defaultValue: '1008', category: C.Layout },
            { name: 'PaneHeader', type: 'UIElement', defaultValue: '', category: C.Common },
            { name: 'PaneFooter', type: 'UIElement', defaultValue: '', category: C.Common },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'AlwaysShowHeader', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsBackButtonVisible', type: 'NavigationViewBackButtonVisible', defaultValue: 'Auto', category: C.Appearance },
            { name: 'IsBackEnabled', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'IsPaneToggleButtonVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsSettingsVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'MenuItemsSource', type: 'object', defaultValue: '', category: C.Common },
            { name: 'FooterMenuItemsSource', type: 'object', defaultValue: '', category: C.Common },
            { name: 'SelectedItem', type: 'object', defaultValue: '', category: C.Common },
            { name: 'SelectionFollowsFocus', type: 'NavigationViewSelectionFollowsFocus', defaultValue: 'Disabled', category: C.Interaction },
            { name: 'CompactPaneLength', type: 'double', defaultValue: '48', category: C.Layout },
            { name: 'OpenPaneLength', type: 'double', defaultValue: '320', category: C.Layout },
            { name: 'PaneTitle', type: 'string', defaultValue: '', category: C.Common },
            { name: 'IsTitleBarAutoPaddingEnabled', type: 'bool', defaultValue: 'True', category: C.Layout },
            { name: 'OverflowLabelMode', type: 'NavigationViewOverflowLabelMode', defaultValue: 'MoreLabel', category: C.Appearance },
            { name: 'AutoSuggestBox', type: 'AutoSuggestBox', defaultValue: '', category: C.Common },
        ]
    },

    'NavigationViewItem': {
        baseType: 'ContentControl',
        description: 'An item in a NavigationView menu.',
        properties: [
            { name: 'Icon', type: 'IconElement', defaultValue: '', category: C.Appearance },
            { name: 'IsExpanded', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'SelectsOnInvoked', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'HasUnrealizedChildren', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'MenuItemsSource', type: 'object', defaultValue: '', category: C.Common },
            { name: 'InfoBadge', type: 'InfoBadge', defaultValue: '', category: C.Appearance },
        ]
    },

    'Frame': {
        baseType: 'ContentControl',
        description: 'Displays Page instances and supports navigation.',
        properties: [
            { name: 'SourcePageType', type: 'Type', defaultValue: '', category: C.Common },
            { name: 'CacheSize', type: 'int', defaultValue: '10', category: C.Common },
            { name: 'IsNavigationStackEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
        ]
    },

    'Page': {
        baseType: 'UserControl',
        description: 'A page of content for navigation.',
        properties: [
            { name: 'TopAppBar', type: 'AppBar', defaultValue: '', category: C.Common },
            { name: 'BottomAppBar', type: 'AppBar', defaultValue: '', category: C.Common },
            { name: 'NavigationCacheMode', type: 'NavigationCacheMode', defaultValue: 'Disabled', category: C.Common },
        ]
    },

    // ========================================================================
    // Media & Visual Controls
    // ========================================================================

    'Image': {
        baseType: 'FrameworkElement',
        description: 'Displays an image.',
        properties: [
            { name: 'Source', type: 'ImageSource', defaultValue: '', category: C.Common },
            { name: 'Stretch', type: 'Stretch', defaultValue: 'Uniform', category: C.Appearance },
            { name: 'NineGrid', type: 'Thickness', defaultValue: '0', category: C.Appearance },
        ]
    },

    'MediaPlayerElement': {
        baseType: 'Control',
        description: 'Displays video and audio content.',
        properties: [
            { name: 'Source', type: 'IMediaPlaybackSource', defaultValue: '', category: C.Common },
            { name: 'PosterSource', type: 'ImageSource', defaultValue: '', category: C.Appearance },
            { name: 'AreTransportControlsEnabled', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'AutoPlay', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsFullWindow', type: 'bool', defaultValue: 'False', category: C.Layout },
            { name: 'Stretch', type: 'Stretch', defaultValue: 'Uniform', category: C.Appearance },
        ]
    },

    'WebView2': {
        baseType: 'FrameworkElement',
        description: 'Displays web content using Microsoft Edge.',
        properties: [
            { name: 'Source', type: 'Uri', defaultValue: '', category: C.Common },
            { name: 'DefaultBackgroundColor', type: 'Color', defaultValue: '', category: C.Appearance },
        ]
    },

    // ========================================================================
    // Shape Controls
    // ========================================================================

    'Shape': {
        baseType: 'FrameworkElement',
        description: 'Base class for shape elements.',
        properties: [
            { name: 'Fill', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'Stroke', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'StrokeThickness', type: 'double', defaultValue: '1', category: C.Appearance },
            { name: 'StrokeDashArray', type: 'DoubleCollection', defaultValue: '', category: C.Appearance },
            { name: 'StrokeDashCap', type: 'PenLineCap', defaultValue: 'Flat', category: C.Appearance },
            { name: 'StrokeDashOffset', type: 'double', defaultValue: '0', category: C.Appearance },
            { name: 'StrokeEndLineCap', type: 'PenLineCap', defaultValue: 'Flat', category: C.Appearance },
            { name: 'StrokeLineJoin', type: 'PenLineJoin', defaultValue: 'Miter', category: C.Appearance },
            { name: 'StrokeMiterLimit', type: 'double', defaultValue: '10', category: C.Appearance },
            { name: 'StrokeStartLineCap', type: 'PenLineCap', defaultValue: 'Flat', category: C.Appearance },
            { name: 'Stretch', type: 'Stretch', defaultValue: 'None', category: C.Layout },
        ]
    },

    'Rectangle': {
        baseType: 'Shape',
        description: 'Draws a rectangle shape.',
        properties: [
            { name: 'RadiusX', type: 'double', defaultValue: '0', category: C.Appearance },
            { name: 'RadiusY', type: 'double', defaultValue: '0', category: C.Appearance },
        ]
    },

    'Ellipse': {
        baseType: 'Shape',
        description: 'Draws an ellipse shape.',
        properties: []
    },

    'Line': {
        baseType: 'Shape',
        description: 'Draws a straight line.',
        properties: [
            { name: 'X1', type: 'double', defaultValue: '0', category: C.Layout },
            { name: 'Y1', type: 'double', defaultValue: '0', category: C.Layout },
            { name: 'X2', type: 'double', defaultValue: '0', category: C.Layout },
            { name: 'Y2', type: 'double', defaultValue: '0', category: C.Layout },
        ]
    },

    'Path': {
        baseType: 'Shape',
        description: 'Draws a series of connected lines and curves.',
        properties: [
            { name: 'Data', type: 'Geometry', defaultValue: '', category: C.Common },
        ]
    },

    'Polygon': {
        baseType: 'Shape',
        description: 'Draws a closed polygon shape.',
        properties: [
            { name: 'Points', type: 'PointCollection', defaultValue: '', category: C.Common },
            { name: 'FillRule', type: 'FillRule', defaultValue: 'EvenOdd', category: C.Appearance },
        ]
    },

    'Polyline': {
        baseType: 'Shape',
        description: 'Draws a series of connected straight lines.',
        properties: [
            { name: 'Points', type: 'PointCollection', defaultValue: '', category: C.Common },
            { name: 'FillRule', type: 'FillRule', defaultValue: 'EvenOdd', category: C.Appearance },
        ]
    },

    // ========================================================================
    // Progress & Range Controls
    // ========================================================================

    'ProgressBar': {
        baseType: 'RangeBase',
        description: 'Displays a progress bar.',
        properties: [
            { name: 'IsIndeterminate', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'ShowError', type: 'bool', defaultValue: 'False', category: C.Appearance },
            { name: 'ShowPaused', type: 'bool', defaultValue: 'False', category: C.Appearance },
        ]
    },

    'ProgressRing': {
        baseType: 'Control',
        description: 'Displays a circular progress indicator.',
        properties: [
            { name: 'IsActive', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsIndeterminate', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'Minimum', type: 'double', defaultValue: '0', category: C.Common },
            { name: 'Maximum', type: 'double', defaultValue: '100', category: C.Common },
            { name: 'Value', type: 'double', defaultValue: '0', category: C.Common },
        ]
    },

    'Slider': {
        baseType: 'RangeBase',
        description: 'Selects a value from a range by dragging a thumb.',
        properties: [
            { name: 'Orientation', type: 'Orientation', defaultValue: 'Horizontal', category: C.Layout },
            { name: 'StepFrequency', type: 'double', defaultValue: '1', category: C.Common },
            { name: 'TickFrequency', type: 'double', defaultValue: '0', category: C.Appearance },
            { name: 'TickPlacement', type: 'TickPlacement', defaultValue: 'None', category: C.Appearance },
            { name: 'IsThumbToolTipEnabled', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'SnapsTo', type: 'SliderSnapsTo', defaultValue: 'StepValues', category: C.Common },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'IsDirectionReversed', type: 'bool', defaultValue: 'False', category: C.Layout },
        ]
    },

    // ========================================================================
    // Picker & Toggle Controls
    // ========================================================================

    'ToggleSwitch': {
        baseType: 'Control',
        description: 'A switch that toggles between on and off states.',
        properties: [
            { name: 'IsOn', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'OnContent', type: 'object', defaultValue: 'On', category: C.Common },
            { name: 'OffContent', type: 'object', defaultValue: 'Off', category: C.Common },
            { name: 'OnContentTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'OffContentTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
        ]
    },

    'CalendarDatePicker': {
        baseType: 'Control',
        description: 'A dropdown calendar for selecting a date.',
        properties: [
            { name: 'Date', type: 'DateTimeOffset?', defaultValue: '', category: C.Common },
            { name: 'PlaceholderText', type: 'string', defaultValue: '', category: C.Text },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'Description', type: 'object', defaultValue: '', category: C.Common },
            { name: 'MinDate', type: 'DateTimeOffset', defaultValue: '', category: C.Common },
            { name: 'MaxDate', type: 'DateTimeOffset', defaultValue: '', category: C.Common },
            { name: 'IsTodayHighlighted', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsOutOfScopeEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsGroupLabelVisible', type: 'bool', defaultValue: 'False', category: C.Appearance },
            { name: 'DayOfWeekFormat', type: 'string', defaultValue: '', category: C.Appearance },
            { name: 'CalendarIdentifier', type: 'string', defaultValue: '', category: C.Common },
            { name: 'FirstDayOfWeek', type: 'DayOfWeek', defaultValue: '', category: C.Common },
            { name: 'DateFormat', type: 'string', defaultValue: '', category: C.Appearance },
        ]
    },

    'DatePicker': {
        baseType: 'Control',
        description: 'A control for selecting a date.',
        properties: [
            { name: 'Date', type: 'DateTimeOffset', defaultValue: '', category: C.Common },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'DayVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'MonthVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'YearVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'MinYear', type: 'DateTimeOffset', defaultValue: '', category: C.Common },
            { name: 'MaxYear', type: 'DateTimeOffset', defaultValue: '', category: C.Common },
            { name: 'DayFormat', type: 'string', defaultValue: '', category: C.Appearance },
            { name: 'MonthFormat', type: 'string', defaultValue: '', category: C.Appearance },
            { name: 'YearFormat', type: 'string', defaultValue: '', category: C.Appearance },
            { name: 'Orientation', type: 'Orientation', defaultValue: 'Horizontal', category: C.Layout },
        ]
    },

    'TimePicker': {
        baseType: 'Control',
        description: 'A control for selecting a time.',
        properties: [
            { name: 'Time', type: 'TimeSpan', defaultValue: '', category: C.Common },
            { name: 'SelectedTime', type: 'TimeSpan?', defaultValue: '', category: C.Common },
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'ClockIdentifier', type: 'string', defaultValue: '12HourClock', category: C.Common },
            { name: 'MinuteIncrement', type: 'int', defaultValue: '1', category: C.Common },
        ]
    },

    'ColorPicker': {
        baseType: 'Control',
        description: 'A control for selecting a color.',
        properties: [
            { name: 'Color', type: 'Color', defaultValue: 'White', category: C.Common },
            { name: 'IsAlphaEnabled', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'IsAlphaSliderVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsAlphaTextInputVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsColorChannelTextInputVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsColorPreviewVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsColorSliderVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsColorSpectrumVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsHexInputVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsMoreButtonVisible', type: 'bool', defaultValue: 'False', category: C.Appearance },
            { name: 'ColorSpectrumShape', type: 'ColorSpectrumShape', defaultValue: 'Box', category: C.Appearance },
            { name: 'Orientation', type: 'Orientation', defaultValue: 'Vertical', category: C.Layout },
            { name: 'MinHue', type: 'int', defaultValue: '0', category: C.Common },
            { name: 'MaxHue', type: 'int', defaultValue: '359', category: C.Common },
            { name: 'MinSaturation', type: 'int', defaultValue: '0', category: C.Common },
            { name: 'MaxSaturation', type: 'int', defaultValue: '100', category: C.Common },
            { name: 'MinValue', type: 'int', defaultValue: '0', category: C.Common },
            { name: 'MaxValue', type: 'int', defaultValue: '100', category: C.Common },
        ]
    },

    'RatingControl': {
        baseType: 'Control',
        description: 'A control for displaying and setting star ratings.',
        properties: [
            { name: 'Value', type: 'double', defaultValue: '-1', category: C.Common },
            { name: 'MaxRating', type: 'int', defaultValue: '5', category: C.Common },
            { name: 'IsReadOnly', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'IsClearEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'PlaceholderValue', type: 'double', defaultValue: '-1', category: C.Common },
            { name: 'Caption', type: 'string', defaultValue: '', category: C.Common },
            { name: 'InitialSetValue', type: 'int', defaultValue: '1', category: C.Common },
        ]
    },

    // ========================================================================
    // App Bar & Menu Controls
    // ========================================================================

    'AppBar': {
        baseType: 'ContentControl',
        description: 'A toolbar for displaying commands.',
        properties: [
            { name: 'IsOpen', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'IsSticky', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'ClosedDisplayMode', type: 'AppBarClosedDisplayMode', defaultValue: 'Compact', category: C.Appearance },
            { name: 'LightDismissOverlayMode', type: 'LightDismissOverlayMode', defaultValue: 'Auto', category: C.Appearance },
        ]
    },

    'CommandBar': {
        baseType: 'AppBar',
        description: 'An app bar with primary and secondary commands.',
        properties: [
            { name: 'DefaultLabelPosition', type: 'CommandBarDefaultLabelPosition', defaultValue: 'Bottom', category: C.Appearance },
            { name: 'IsDynamicOverflowEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'OverflowButtonVisibility', type: 'CommandBarOverflowButtonVisibility', defaultValue: 'Auto', category: C.Appearance },
        ]
    },

    'MenuFlyoutItem': {
        baseType: 'Control',
        description: 'A command item in a menu flyout.',
        properties: [
            { name: 'Text', type: 'string', defaultValue: '', category: C.Common },
            { name: 'Icon', type: 'IconElement', defaultValue: '', category: C.Appearance },
            { name: 'Command', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'CommandParameter', type: 'object', defaultValue: '', category: C.Interaction },
            { name: 'KeyboardAcceleratorTextOverride', type: 'string', defaultValue: '', category: C.Accessibility },
        ]
    },

    'ToggleMenuFlyoutItem': {
        baseType: 'MenuFlyoutItem',
        description: 'A toggleable command item in a menu flyout.',
        properties: [
            { name: 'IsChecked', type: 'bool', defaultValue: 'False', category: C.Common },
        ]
    },

    'MenuBar': {
        baseType: 'Control',
        description: 'A horizontal menu bar.',
        properties: []
    },

    'MenuBarItem': {
        baseType: 'Control',
        description: 'An item in a menu bar.',
        properties: [
            { name: 'Title', type: 'string', defaultValue: '', category: C.Common },
        ]
    },

    // ========================================================================
    // Dialog & Info Controls
    // ========================================================================

    'ContentDialog': {
        baseType: 'ContentControl',
        description: 'A modal dialog with customizable buttons.',
        properties: [
            { name: 'Title', type: 'object', defaultValue: '', category: C.Common },
            { name: 'TitleTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'PrimaryButtonText', type: 'string', defaultValue: '', category: C.Common },
            { name: 'SecondaryButtonText', type: 'string', defaultValue: '', category: C.Common },
            { name: 'CloseButtonText', type: 'string', defaultValue: '', category: C.Common },
            { name: 'PrimaryButtonCommand', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'SecondaryButtonCommand', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'CloseButtonCommand', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'PrimaryButtonCommandParameter', type: 'object', defaultValue: '', category: C.Interaction },
            { name: 'SecondaryButtonCommandParameter', type: 'object', defaultValue: '', category: C.Interaction },
            { name: 'CloseButtonCommandParameter', type: 'object', defaultValue: '', category: C.Interaction },
            { name: 'DefaultButton', type: 'ContentDialogButton', defaultValue: 'None', category: C.Common },
            { name: 'IsPrimaryButtonEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsSecondaryButtonEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'FullSizeDesired', type: 'bool', defaultValue: 'False', category: C.Layout },
            { name: 'PrimaryButtonStyle', type: 'Style', defaultValue: '', category: C.Appearance },
            { name: 'SecondaryButtonStyle', type: 'Style', defaultValue: '', category: C.Appearance },
            { name: 'CloseButtonStyle', type: 'Style', defaultValue: '', category: C.Appearance },
        ]
    },

    'TeachingTip': {
        baseType: 'ContentControl',
        description: 'A contextual notification tip.',
        properties: [
            { name: 'Title', type: 'string', defaultValue: '', category: C.Common },
            { name: 'Subtitle', type: 'string', defaultValue: '', category: C.Common },
            { name: 'IsOpen', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'Target', type: 'FrameworkElement', defaultValue: '', category: C.Common },
            { name: 'PreferredPlacement', type: 'TeachingTipPlacementMode', defaultValue: 'Auto', category: C.Layout },
            { name: 'IsLightDismissEnabled', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'ActionButtonContent', type: 'object', defaultValue: '', category: C.Common },
            { name: 'ActionButtonCommand', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'CloseButtonContent', type: 'object', defaultValue: '', category: C.Common },
            { name: 'CloseButtonCommand', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'PlacementMargin', type: 'Thickness', defaultValue: '0', category: C.Layout },
            { name: 'ShouldConstrainToRootBounds', type: 'bool', defaultValue: 'True', category: C.Layout },
            { name: 'IconSource', type: 'IconSource', defaultValue: '', category: C.Appearance },
            { name: 'HeroContent', type: 'UIElement', defaultValue: '', category: C.Common },
            { name: 'HeroContentPlacement', type: 'TeachingTipHeroContentPlacementMode', defaultValue: 'Auto', category: C.Layout },
        ]
    },

    'InfoBar': {
        baseType: 'Control',
        description: 'An inline notification bar.',
        properties: [
            { name: 'IsOpen', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'Severity', type: 'InfoBarSeverity', defaultValue: 'Informational', category: C.Appearance },
            { name: 'Title', type: 'string', defaultValue: '', category: C.Common },
            { name: 'Message', type: 'string', defaultValue: '', category: C.Common },
            { name: 'IsClosable', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsIconVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'ActionButton', type: 'ButtonBase', defaultValue: '', category: C.Common },
            { name: 'Content', type: 'object', defaultValue: '', category: C.Common },
            { name: 'ContentTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'IconSource', type: 'IconSource', defaultValue: '', category: C.Appearance },
        ]
    },

    // ========================================================================
    // Tab & Expander Controls
    // ========================================================================

    'TabView': {
        baseType: 'Control',
        description: 'A tabbed container for multiple views.',
        properties: [
            { name: 'TabItemsSource', type: 'object', defaultValue: '', category: C.Common },
            { name: 'SelectedItem', type: 'object', defaultValue: '', category: C.Common },
            { name: 'SelectedIndex', type: 'int', defaultValue: '0', category: C.Common },
            { name: 'TabWidthMode', type: 'TabViewWidthMode', defaultValue: 'Equal', category: C.Appearance },
            { name: 'CloseButtonOverlayMode', type: 'TabViewCloseButtonOverlayMode', defaultValue: 'Auto', category: C.Appearance },
            { name: 'TabStripHeader', type: 'object', defaultValue: '', category: C.Common },
            { name: 'TabStripFooter', type: 'object', defaultValue: '', category: C.Common },
            { name: 'IsAddTabButtonVisible', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'AddTabButtonCommand', type: 'ICommand', defaultValue: '', category: C.Interaction },
            { name: 'CanDragTabs', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'CanReorderTabs', type: 'bool', defaultValue: 'True', category: C.Interaction },
            { name: 'AllowDropTabs', type: 'bool', defaultValue: 'False', category: C.Interaction },
        ]
    },

    'TabViewItem': {
        baseType: 'ContentControl',
        description: 'An item in a TabView.',
        properties: [
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'IconSource', type: 'IconSource', defaultValue: '', category: C.Appearance },
            { name: 'IsClosable', type: 'bool', defaultValue: 'True', category: C.Common },
        ]
    },

    'Expander': {
        baseType: 'ContentControl',
        description: 'A collapsible content container.',
        properties: [
            { name: 'Header', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'IsExpanded', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'ExpandDirection', type: 'ExpandDirection', defaultValue: 'Down', category: C.Layout },
        ]
    },

    'TreeView': {
        baseType: 'Control',
        description: 'A hierarchical tree of expandable items.',
        properties: [
            { name: 'ItemsSource', type: 'object', defaultValue: '', category: C.Common },
            { name: 'ItemTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'ItemTemplateSelector', type: 'DataTemplateSelector', defaultValue: '', category: C.Miscellaneous },
            { name: 'ItemContainerStyle', type: 'Style', defaultValue: '', category: C.Appearance },
            { name: 'SelectionMode', type: 'TreeViewSelectionMode', defaultValue: 'Single', category: C.Common },
            { name: 'CanDragItems', type: 'bool', defaultValue: 'False', category: C.Interaction },
            { name: 'CanReorderItems', type: 'bool', defaultValue: 'False', category: C.Interaction },
        ]
    },

    'TreeViewItem': {
        baseType: 'ContentControl',
        description: 'An item in a TreeView.',
        properties: [
            { name: 'IsExpanded', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'HasUnrealizedChildren', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'ItemsSource', type: 'object', defaultValue: '', category: C.Common },
            { name: 'GlyphBrush', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'GlyphOpacity', type: 'double', defaultValue: '1', category: C.Appearance },
            { name: 'GlyphSize', type: 'double', defaultValue: '12', category: C.Appearance },
            { name: 'CollapsedGlyph', type: 'string', defaultValue: '', category: C.Appearance },
            { name: 'ExpandedGlyph', type: 'string', defaultValue: '', category: C.Appearance },
        ]
    },

    // ========================================================================
    // Other Common Controls
    // ========================================================================

    'SplitView': {
        baseType: 'Control',
        description: 'A container with a dismissible pane and a content area.',
        properties: [
            { name: 'IsPaneOpen', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'DisplayMode', type: 'SplitViewDisplayMode', defaultValue: 'Overlay', category: C.Appearance },
            { name: 'PanePlacement', type: 'SplitViewPanePlacement', defaultValue: 'Left', category: C.Layout },
            { name: 'OpenPaneLength', type: 'double', defaultValue: '320', category: C.Layout },
            { name: 'CompactPaneLength', type: 'double', defaultValue: '48', category: C.Layout },
            { name: 'Pane', type: 'UIElement', defaultValue: '', category: C.Common },
            { name: 'Content', type: 'UIElement', defaultValue: '', category: C.Common },
            { name: 'PaneBackground', type: 'Brush', defaultValue: '', category: C.Appearance },
            { name: 'LightDismissOverlayMode', type: 'LightDismissOverlayMode', defaultValue: 'Auto', category: C.Appearance },
        ]
    },

    'PersonPicture': {
        baseType: 'Control',
        description: 'Displays the avatar image for a person.',
        properties: [
            { name: 'DisplayName', type: 'string', defaultValue: '', category: C.Common },
            { name: 'Initials', type: 'string', defaultValue: '', category: C.Common },
            { name: 'ProfilePicture', type: 'ImageSource', defaultValue: '', category: C.Appearance },
            { name: 'BadgeNumber', type: 'int', defaultValue: '0', category: C.Common },
            { name: 'BadgeGlyph', type: 'string', defaultValue: '', category: C.Appearance },
            { name: 'BadgeText', type: 'string', defaultValue: '', category: C.Common },
            { name: 'BadgeImageSource', type: 'ImageSource', defaultValue: '', category: C.Appearance },
            { name: 'IsGroup', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'PreferSmallImage', type: 'bool', defaultValue: 'False', category: C.Appearance },
        ]
    },

    'CalendarView': {
        baseType: 'Control',
        description: 'Displays a calendar for date browsing and selection.',
        properties: [
            { name: 'SelectionMode', type: 'CalendarViewSelectionMode', defaultValue: 'Single', category: C.Common },
            { name: 'IsTodayHighlighted', type: 'bool', defaultValue: 'True', category: C.Appearance },
            { name: 'IsOutOfScopeEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsGroupLabelVisible', type: 'bool', defaultValue: 'False', category: C.Appearance },
            { name: 'DayOfWeekFormat', type: 'string', defaultValue: '', category: C.Appearance },
            { name: 'CalendarIdentifier', type: 'string', defaultValue: '', category: C.Common },
            { name: 'FirstDayOfWeek', type: 'DayOfWeek', defaultValue: '', category: C.Common },
            { name: 'MinDate', type: 'DateTimeOffset', defaultValue: '', category: C.Common },
            { name: 'MaxDate', type: 'DateTimeOffset', defaultValue: '', category: C.Common },
        ]
    },

    'SemanticZoom': {
        baseType: 'Control',
        description: 'A control for switching between zoomed-in and zoomed-out views.',
        properties: [
            { name: 'IsZoomedInViewActive', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'CanChangeViews', type: 'bool', defaultValue: 'True', category: C.Common },
            { name: 'IsZoomOutButtonEnabled', type: 'bool', defaultValue: 'True', category: C.Common },
        ]
    },

    'Pivot': {
        baseType: 'ItemsControl',
        description: 'A tabbed navigation control.',
        properties: [
            { name: 'Title', type: 'object', defaultValue: '', category: C.Common },
            { name: 'TitleTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'SelectedIndex', type: 'int', defaultValue: '0', category: C.Common },
            { name: 'SelectedItem', type: 'object', defaultValue: '', category: C.Common },
            { name: 'HeaderTemplate', type: 'DataTemplate', defaultValue: '', category: C.Miscellaneous },
            { name: 'IsLocked', type: 'bool', defaultValue: 'False', category: C.Common },
            { name: 'IsHeaderItemsCarouselEnabled', type: 'bool', defaultValue: 'True', category: C.Appearance },
        ]
    },

    'PipsPager': {
        baseType: 'Control',
        description: 'A pager displaying dots for page navigation.',
        properties: [
            { name: 'NumberOfPages', type: 'int', defaultValue: '-1', category: C.Common },
            { name: 'SelectedPageIndex', type: 'int', defaultValue: '0', category: C.Common },
            { name: 'MaxVisiblePips', type: 'int', defaultValue: '5', category: C.Appearance },
            { name: 'Orientation', type: 'Orientation', defaultValue: 'Horizontal', category: C.Layout },
            { name: 'PreviousButtonVisibility', type: 'PipsPagerButtonVisibility', defaultValue: 'Collapsed', category: C.Appearance },
            { name: 'NextButtonVisibility', type: 'PipsPagerButtonVisibility', defaultValue: 'Collapsed', category: C.Appearance },
        ]
    },

    'BreadcrumbBar': {
        baseType: 'Control',
        description: 'A breadcrumb navigation trail.',
        properties: [
            { name: 'ItemsSource', type: 'object', defaultValue: '', category: C.Common },
            { name: 'ItemTemplate', type: 'object', defaultValue: '', category: C.Miscellaneous },
        ]
    },
};

// ============================================================================
// Attached Properties
// ============================================================================

export const ATTACHED_PROPERTIES: AttachedPropertyMetadata[] = [
    // Grid attached properties
    { ownerType: 'Grid', name: 'Row', xamlName: 'Grid.Row', type: 'int', defaultValue: '0', category: C.Layout },
    { ownerType: 'Grid', name: 'Column', xamlName: 'Grid.Column', type: 'int', defaultValue: '0', category: C.Layout },
    { ownerType: 'Grid', name: 'RowSpan', xamlName: 'Grid.RowSpan', type: 'int', defaultValue: '1', category: C.Layout },
    { ownerType: 'Grid', name: 'ColumnSpan', xamlName: 'Grid.ColumnSpan', type: 'int', defaultValue: '1', category: C.Layout },

    // Canvas attached properties
    { ownerType: 'Canvas', name: 'Left', xamlName: 'Canvas.Left', type: 'double', defaultValue: '0', category: C.Layout },
    { ownerType: 'Canvas', name: 'Top', xamlName: 'Canvas.Top', type: 'double', defaultValue: '0', category: C.Layout },
    { ownerType: 'Canvas', name: 'ZIndex', xamlName: 'Canvas.ZIndex', type: 'int', defaultValue: '0', category: C.Layout },

    // RelativePanel attached properties
    { ownerType: 'RelativePanel', name: 'AlignLeftWithPanel', xamlName: 'RelativePanel.AlignLeftWithPanel', type: 'bool', defaultValue: 'False', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignRightWithPanel', xamlName: 'RelativePanel.AlignRightWithPanel', type: 'bool', defaultValue: 'False', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignTopWithPanel', xamlName: 'RelativePanel.AlignTopWithPanel', type: 'bool', defaultValue: 'False', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignBottomWithPanel', xamlName: 'RelativePanel.AlignBottomWithPanel', type: 'bool', defaultValue: 'False', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignHorizontalCenterWithPanel', xamlName: 'RelativePanel.AlignHorizontalCenterWithPanel', type: 'bool', defaultValue: 'False', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignVerticalCenterWithPanel', xamlName: 'RelativePanel.AlignVerticalCenterWithPanel', type: 'bool', defaultValue: 'False', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'LeftOf', xamlName: 'RelativePanel.LeftOf', type: 'object', defaultValue: '', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'RightOf', xamlName: 'RelativePanel.RightOf', type: 'object', defaultValue: '', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'Above', xamlName: 'RelativePanel.Above', type: 'object', defaultValue: '', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'Below', xamlName: 'RelativePanel.Below', type: 'object', defaultValue: '', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignLeftWith', xamlName: 'RelativePanel.AlignLeftWith', type: 'object', defaultValue: '', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignRightWith', xamlName: 'RelativePanel.AlignRightWith', type: 'object', defaultValue: '', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignTopWith', xamlName: 'RelativePanel.AlignTopWith', type: 'object', defaultValue: '', category: C.Layout },
    { ownerType: 'RelativePanel', name: 'AlignBottomWith', xamlName: 'RelativePanel.AlignBottomWith', type: 'object', defaultValue: '', category: C.Layout },

    // ScrollViewer attached properties
    { ownerType: 'ScrollViewer', name: 'HorizontalScrollBarVisibility', xamlName: 'ScrollViewer.HorizontalScrollBarVisibility', type: 'ScrollBarVisibility', defaultValue: 'Disabled', category: C.Layout },
    { ownerType: 'ScrollViewer', name: 'VerticalScrollBarVisibility', xamlName: 'ScrollViewer.VerticalScrollBarVisibility', type: 'ScrollBarVisibility', defaultValue: 'Visible', category: C.Layout },
    { ownerType: 'ScrollViewer', name: 'HorizontalScrollMode', xamlName: 'ScrollViewer.HorizontalScrollMode', type: 'ScrollMode', defaultValue: 'Enabled', category: C.Layout },
    { ownerType: 'ScrollViewer', name: 'VerticalScrollMode', xamlName: 'ScrollViewer.VerticalScrollMode', type: 'ScrollMode', defaultValue: 'Enabled', category: C.Layout },
    { ownerType: 'ScrollViewer', name: 'IsHorizontalRailEnabled', xamlName: 'ScrollViewer.IsHorizontalRailEnabled', type: 'bool', defaultValue: 'True', category: C.Layout },
    { ownerType: 'ScrollViewer', name: 'IsVerticalRailEnabled', xamlName: 'ScrollViewer.IsVerticalRailEnabled', type: 'bool', defaultValue: 'True', category: C.Layout },
    { ownerType: 'ScrollViewer', name: 'IsScrollInertiaEnabled', xamlName: 'ScrollViewer.IsScrollInertiaEnabled', type: 'bool', defaultValue: 'True', category: C.Interaction },
    { ownerType: 'ScrollViewer', name: 'ZoomMode', xamlName: 'ScrollViewer.ZoomMode', type: 'ZoomMode', defaultValue: 'Disabled', category: C.Interaction },
    { ownerType: 'ScrollViewer', name: 'IsDeferredScrollingEnabled', xamlName: 'ScrollViewer.IsDeferredScrollingEnabled', type: 'bool', defaultValue: 'False', category: C.Layout },
    { ownerType: 'ScrollViewer', name: 'BringIntoViewOnFocusChange', xamlName: 'ScrollViewer.BringIntoViewOnFocusChange', type: 'bool', defaultValue: 'True', category: C.Interaction },

    // AutomationProperties
    { ownerType: 'AutomationProperties', name: 'Name', xamlName: 'AutomationProperties.Name', type: 'string', defaultValue: '', category: C.Accessibility },
    { ownerType: 'AutomationProperties', name: 'LabeledBy', xamlName: 'AutomationProperties.LabeledBy', type: 'UIElement', defaultValue: '', category: C.Accessibility },
    { ownerType: 'AutomationProperties', name: 'HelpText', xamlName: 'AutomationProperties.HelpText', type: 'string', defaultValue: '', category: C.Accessibility },
    { ownerType: 'AutomationProperties', name: 'LiveSetting', xamlName: 'AutomationProperties.LiveSetting', type: 'AutomationLiveSetting', defaultValue: 'Off', category: C.Accessibility },
    { ownerType: 'AutomationProperties', name: 'AutomationId', xamlName: 'AutomationProperties.AutomationId', type: 'string', defaultValue: '', category: C.Accessibility },
    { ownerType: 'AutomationProperties', name: 'IsRequiredForForm', xamlName: 'AutomationProperties.IsRequiredForForm', type: 'bool', defaultValue: 'False', category: C.Accessibility },
    { ownerType: 'AutomationProperties', name: 'Headings', xamlName: 'AutomationProperties.HeadingLevel', type: 'AutomationHeadingLevel', defaultValue: 'None', category: C.Accessibility },

    // ToolTipService
    { ownerType: 'ToolTipService', name: 'ToolTip', xamlName: 'ToolTipService.ToolTip', type: 'object', defaultValue: '', category: C.Accessibility },
    { ownerType: 'ToolTipService', name: 'Placement', xamlName: 'ToolTipService.Placement', type: 'PlacementMode', defaultValue: 'Top', category: C.Accessibility },
];

// ============================================================================
// Resolution Helpers
// ============================================================================

/** Cache for resolved property chains (control type -> all properties including inherited) */
const resolvedPropertiesCache = new Map<string, PropertyMetadata[]>();

/**
 * Resolves all properties for a given control type, including inherited properties
 * from the entire base type chain.
 *
 * @param typeName The XAML element tag name (e.g., "Button", "TextBox", "Grid")
 * @returns All available properties, or empty array if the type is unknown
 */
export function resolveAllProperties(typeName: string): PropertyMetadata[] {
    // Check cache first
    const cached = resolvedPropertiesCache.get(typeName);
    if (cached) {
        return cached;
    }

    const allProperties: PropertyMetadata[] = [];
    const seenNames = new Set<string>();
    let currentType: string | null = typeName;

    // Walk up the inheritance chain
    while (currentType) {
        const metadata: ControlTypeMetadata | undefined = CONTROL_METADATA[currentType];
        if (!metadata) {
            break;
        }

        // Add properties from this type (child properties override parent properties)
        for (const prop of metadata.properties) {
            if (!seenNames.has(prop.name)) {
                seenNames.add(prop.name);
                allProperties.push(prop);
            }
        }

        currentType = metadata.baseType;
    }

    // Cache the result
    resolvedPropertiesCache.set(typeName, allProperties);
    return allProperties;
}

/**
 * Checks if a given tag name is a known WinUI control type.
 */
export function isKnownControlType(typeName: string): boolean {
    return typeName in CONTROL_METADATA;
}

/**
 * Gets the inheritance chain for a control type.
 * Returns an array from the most derived type to the base type.
 *
 * @example getInheritanceChain('Button') => ['Button', 'ButtonBase', 'ContentControl', 'Control', 'FrameworkElement', 'UIElement']
 */
export function getInheritanceChain(typeName: string): string[] {
    const chain: string[] = [];
    let currentType: string | null = typeName;

    while (currentType) {
        chain.push(currentType);
        const metadata: ControlTypeMetadata | undefined = CONTROL_METADATA[currentType];
        if (!metadata) {
            break;
        }
        currentType = metadata.baseType;
    }

    return chain;
}

/**
 * Gets the description for a control type.
 */
export function getControlDescription(typeName: string): string | undefined {
    return CONTROL_METADATA[typeName]?.description;
}
