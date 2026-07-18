import {
    ATTACHED_PROPERTIES,
    PropertyMetadata,
    resolveAllProperties
} from '../propertyPane/controlMetadata';

export interface DesignerEventDefinition {
    name: string;
    eventArgsType: string;
}

export interface DesignerControlDefinition {
    type: string;
    section: string;
    description: string;
    width: number;
    height: number;
    container?: boolean;
    attributes?: Record<string, string>;
    properties: PropertyMetadata[];
    events: DesignerEventDefinition[];
    defaultEvent?: string;
}

interface CatalogSeed {
    type: string;
    section: string;
    width: number;
    height: number;
    container?: boolean;
    attributes?: Record<string, string>;
    events?: DesignerEventDefinition[];
    defaultEvent?: string;
}

const routedEvent = 'Microsoft.UI.Xaml.RoutedEventArgs';
const valueChangedEvent = 'Microsoft.UI.Xaml.Controls.Primitives.RangeBaseValueChangedEventArgs';

const catalogSeeds: CatalogSeed[] = [
    { type: 'Grid', section: 'Layout', width: 320, height: 240, container: true },
    { type: 'StackPanel', section: 'Layout', width: 260, height: 180, container: true, attributes: { Spacing: '8' } },
    { type: 'Canvas', section: 'Layout', width: 320, height: 240, container: true },
    { type: 'RelativePanel', section: 'Layout', width: 320, height: 240, container: true },
    { type: 'ScrollViewer', section: 'Layout', width: 320, height: 240, container: true },
    { type: 'Border', section: 'Layout', width: 240, height: 160, container: true, attributes: { BorderThickness: '1' } },
    { type: 'Button', section: 'Common Controls', width: 120, height: 36, attributes: { Content: 'Button' }, events: [{ name: 'Click', eventArgsType: routedEvent }], defaultEvent: 'Click' },
    { type: 'TextBlock', section: 'Common Controls', width: 160, height: 28, attributes: { Text: 'Text' } },
    { type: 'TextBox', section: 'Common Controls', width: 180, height: 36, attributes: { PlaceholderText: 'Enter text' }, events: [{ name: 'TextChanged', eventArgsType: 'Microsoft.UI.Xaml.Controls.TextChangedEventArgs' }], defaultEvent: 'TextChanged' },
    { type: 'RichEditBox', section: 'Common Controls', width: 240, height: 100, events: [{ name: 'TextChanged', eventArgsType: routedEvent }], defaultEvent: 'TextChanged' },
    { type: 'CheckBox', section: 'Common Controls', width: 140, height: 32, attributes: { Content: 'Check box' }, events: [{ name: 'Checked', eventArgsType: routedEvent }, { name: 'Unchecked', eventArgsType: routedEvent }], defaultEvent: 'Checked' },
    { type: 'RadioButton', section: 'Common Controls', width: 140, height: 32, attributes: { Content: 'Option' }, events: [{ name: 'Checked', eventArgsType: routedEvent }], defaultEvent: 'Checked' },
    { type: 'ToggleSwitch', section: 'Common Controls', width: 160, height: 44, attributes: { Header: 'Toggle' }, events: [{ name: 'Toggled', eventArgsType: routedEvent }], defaultEvent: 'Toggled' },
    { type: 'ComboBox', section: 'Common Controls', width: 180, height: 36, attributes: { PlaceholderText: 'Choose an item' }, events: [{ name: 'SelectionChanged', eventArgsType: 'Microsoft.UI.Xaml.Controls.SelectionChangedEventArgs' }], defaultEvent: 'SelectionChanged' },
    { type: 'ListView', section: 'Collections', width: 240, height: 160, events: [{ name: 'SelectionChanged', eventArgsType: 'Microsoft.UI.Xaml.Controls.SelectionChangedEventArgs' }], defaultEvent: 'SelectionChanged' },
    { type: 'Slider', section: 'Common Controls', width: 180, height: 32, attributes: { Value: '50' }, events: [{ name: 'ValueChanged', eventArgsType: valueChangedEvent }], defaultEvent: 'ValueChanged' },
    { type: 'ProgressBar', section: 'Common Controls', width: 180, height: 12, attributes: { Value: '50' } },
    { type: 'Image', section: 'Media & Shapes', width: 160, height: 100 },
    { type: 'Rectangle', section: 'Media & Shapes', width: 120, height: 80, attributes: { Fill: '#5B9BD5' } },
    { type: 'Ellipse', section: 'Media & Shapes', width: 100, height: 100, attributes: { Fill: '#5B9BD5' } },
    { type: 'NavigationView', section: 'Navigation', width: 420, height: 300, container: true },
    { type: 'Frame', section: 'Navigation', width: 320, height: 240, container: true },
    { type: 'CalendarDatePicker', section: 'Date & Time', width: 220, height: 36 },
    { type: 'PersonPicture', section: 'Media & Shapes', width: 72, height: 72, attributes: { DisplayName: 'WinUI Developer' } }
];

export function getDesignerControlCatalog(): DesignerControlDefinition[] {
    return catalogSeeds.map(seed => ({
        ...seed,
        description: seed.type,
        properties: [
            ...resolveAllProperties(seed.type),
            ...ATTACHED_PROPERTIES.map(property => ({
                name: property.xamlName,
                type: property.type,
                defaultValue: property.defaultValue,
                category: property.category
            }))
        ],
        events: seed.events ?? []
    }));
}