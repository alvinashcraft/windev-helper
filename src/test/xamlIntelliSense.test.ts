import * as assert from 'assert';
import * as vscode from 'vscode';
import { XamlIntelliSenseProvider } from '../xamlIntelliSense';

suite('Experimental XAML IntelliSense', () => {
    const provider = new XamlIntelliSenseProvider(() => true);

    async function completion(source: string, language = 'xaml'): Promise<vscode.CompletionItem[]> {
        const cursor = source.indexOf('|');
        assert.ok(cursor >= 0, 'Test source must include a cursor marker');
        const text = source.slice(0, cursor) + source.slice(cursor + 1);
        const document = await vscode.workspace.openTextDocument({ language, content: text });
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
        assert.ok(!(await completion('<Button x:Bi|')).some(item => item.label === 'x:Bind'));
        assert.ok(!(await completion('<x:Nu|')).some(item => item.label === 'x:Null'));
        assert.ok(!(await completion('<x:Arr|')).some(item => item.label === 'x:Array'));
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

    test('uses the values for each selection-mode enum type', async () => {
        const listBox = await completion('<ListBox SelectionMode="N|');
        assert.ok(!listBox.some(item => item.label === 'None'));
        const listView = await completion('<ListView SelectionMode="N|');
        assert.ok(listView.some(item => item.label === 'None'));
    });

    test('replaces whole tokens and does not duplicate attribute assignments', async () => {
        const element = await completion('<But|ton />');
        const button = element.find(item => item.label === 'Button');
        assert.ok(button?.range instanceof vscode.Range);
        assert.strictEqual(button.range.start.character, 1);
        assert.strictEqual(button.range.end.character, 7);

        const value = await completion('<Button IsEnabled="T|rue" />');
        const truth = value.find(item => item.label === 'True');
        assert.ok(truth?.range instanceof vscode.Range);
        assert.strictEqual(truth.range.start.character, 19);
        assert.strictEqual(truth.range.end.character, 23);

        const attribute = await completion('<Button Content|="OK" />');
        const content = attribute.find(item => item.label === 'Content');
        assert.strictEqual(content?.insertText, 'Content');
        assert.ok(content?.range instanceof vscode.Range);
        assert.strictEqual(content.range.start.character, 8);
        assert.strictEqual(content.range.end.character, 15);
    });

    test('does not suggest attributes already present later in the opening tag', async () => {
        const items = await completion('<Button | Content="Ready" />');
        assert.ok(!items.some(item => item.label === 'Content'));
    });

    test('supports multiline tags and ignores comments and text content', async () => {
        const multiline = await completion('<Button\n  Content="Ready"\n  Wid|');
        assert.ok(multiline.some(item => item.label === 'Width'));
        assert.deepStrictEqual(await completion('<!-- <But| -->'), []);
        assert.deepStrictEqual(await completion('<Grid>Text|</Grid>'), []);
    });

    test('supports XAML files opened with the XML language mode', async () => {
        const items = await completion('<Button Wid|', 'xml');
        assert.ok(items.some(item => item.label === 'Width'));
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
