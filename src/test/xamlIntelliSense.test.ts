import * as assert from 'assert';
import * as vscode from 'vscode';
import { XamlIntelliSenseProvider } from '../xamlIntelliSense';

suite('Experimental XAML IntelliSense', () => {
    const provider = new XamlIntelliSenseProvider(() => true);

    async function completion(source: string): Promise<vscode.CompletionItem[]> {
        const cursor = source.indexOf('|');
        assert.ok(cursor >= 0, 'Test source must include a cursor marker');
        const text = source.slice(0, cursor) + source.slice(cursor + 1);
        const document = await vscode.workspace.openTextDocument({ language: 'xaml', content: text });
        return provider.provideCompletionItems(document, document.positionAt(cursor)) ?? [];
    }

    async function hover(source: string): Promise<vscode.Hover | undefined> {
        const cursor = source.indexOf('|');
        assert.ok(cursor >= 0, 'Test source must include a cursor marker');
        const text = source.slice(0, cursor) + source.slice(cursor + 1);
        const document = await vscode.workspace.openTextDocument({ language: 'xaml', content: text });
        return provider.provideHover(document, document.positionAt(cursor));
    }

    test('completes built-in controls and preserves namespace prefixes', async () => {
        const items = await completion('<StackPanel><controls:But|');
        const button = items.find(item => item.label === 'controls:Button');
        assert.ok(button);
        assert.strictEqual(button.insertText, 'Button');
    });

    test('completes inherited properties, directives, events, and attached properties', async () => {
        const properties = await completion('<Button Cont|');
        assert.ok(properties.some(item => item.label === 'Content'));
        const directives = await completion('<Button x:Na|');
        const name = directives.find(item => item.label === 'x:Name');
        assert.ok(name);
        assert.ok(name.insertText instanceof vscode.SnippetString);
        assert.strictEqual(name.insertText.value, 'x:Name="$1"');
        const events = await completion('<Button Cli|');
        assert.ok(events.some(item => item.label === 'Click'));
        const attached = await completion('<TextBlock Grid.|');
        assert.ok(attached.some(item => item.label === 'Grid.Row'));
    });

    test('does not suggest an attribute that is already present in the tag', async () => {
        const items = await completion('<Button Content="Ready" Cont|');
        assert.ok(!items.some(item => item.label === 'Content'));
    });

    test('completes curated enum, boolean, and markup-extension values', async () => {
        const enums = await completion('<Button HorizontalContentAlignment="Cen|');
        assert.ok(enums.some(item => item.label === 'Center'));
        const booleans = await completion('<Button IsEnabled="T|');
        assert.ok(booleans.some(item => item.label === 'True'));
        const markup = await completion('<TextBlock Text="{|');
        assert.ok(markup.some(item => item.label === '{Binding }'));
    });

    test('supports multiline tags and ignores comments and text content', async () => {
        const multiline = await completion('<Button\n  Content="Ready"\n  Wid|');
        assert.ok(multiline.some(item => item.label === 'Width'));
        assert.deepStrictEqual(await completion('<!-- <But| -->'), []);
        assert.deepStrictEqual(await completion('<Grid>Text|</Grid>'), []);
    });

    test('provides control and property type hovers', async () => {
        const control = await hover('<But|ton />');
        assert.ok(control?.contents.some(content => content instanceof vscode.MarkdownString && content.value.includes('Button')));
        const property = await hover('<Button Cont|ent="OK" />');
        assert.ok(property?.contents.some(content => content instanceof vscode.MarkdownString && content.value.includes('Content')));
    });

    test('can be disabled without affecting other XAML editing providers', async () => {
        const disabled = new XamlIntelliSenseProvider(() => false);
        const document = await vscode.workspace.openTextDocument({ language: 'xaml', content: '<But' });
        assert.strictEqual(disabled.provideCompletionItems(document, new vscode.Position(0, 4)), undefined);
        assert.strictEqual(disabled.provideHover(document, new vscode.Position(0, 3)), undefined);
    });
});
