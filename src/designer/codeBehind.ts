import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const typeReferencePattern = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*(<[A-Za-z0-9_.,<> \[\]]+>)?(\[\])?$/;

const csharpKeywords = new Set([
    'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked',
    'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else',
    'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for',
    'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is',
    'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override',
    'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte',
    'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch',
    'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe',
    'ushort', 'using', 'virtual', 'void', 'volatile', 'while'
]);

export function isCSharpIdentifier(value: string): boolean {
    return identifierPattern.test(value) && !csharpKeywords.has(value);
}

export function codeBehindPathOf(xamlPath: string): string {
    return `${xamlPath}.cs`;
}

export function getXamlClassName(xaml: string): string | undefined {
    const qualifiedName = /\bx:Class\s*=\s*["']([^"']+)["']/.exec(xaml)?.[1];
    if (!qualifiedName || !qualifiedName.split('.').every(isCSharpIdentifier)) {
        return undefined;
    }
    const className = qualifiedName.split('.').pop();
    return className && isCSharpIdentifier(className) ? className : undefined;
}

export function findClassInsertionOffset(source: string, className: string): number {
    const classPattern = new RegExp(`\\b(?:partial\\s+)?class\\s+${escapeRegExp(className)}\\b`);
    const declaration = classPattern.exec(source);
    if (!declaration) {
        return -1;
    }
    const openingBrace = source.indexOf('{', declaration.index + declaration[0].length);
    if (openingBrace < 0) {
        return -1;
    }
    return findMatchingBrace(source, openingBrace);
}

export function hasVoidMethod(source: string, handlerName: string): boolean {
    const methodPattern = new RegExp(`\\bvoid\\s+${escapeRegExp(handlerName)}\\s*\\(`);
    return methodPattern.test(source);
}

/** Ensures a WinUI event handler exists in the XAML file's C# code-behind. */
export async function ensureWinUIEventHandler(
    xamlDocument: vscode.TextDocument,
    handlerName: string,
    eventArgsType: string
): Promise<void> {
    if (!isCSharpIdentifier(handlerName) || !typeReferencePattern.test(eventArgsType)) {
        void vscode.window.showWarningMessage('WinDev XAML Designer: invalid event handler name or event argument type.');
        return;
    }
    const codeBehindPath = codeBehindPathOf(xamlDocument.uri.fsPath);
    if (!fs.existsSync(codeBehindPath)) {
        void vscode.window.showWarningMessage(
            `WinDev XAML Designer: no C# code-behind file was found (${path.basename(codeBehindPath)}).`
        );
        return;
    }
    const className = getXamlClassName(xamlDocument.getText());
    if (!className) {
        void vscode.window.showWarningMessage('WinDev XAML Designer: the XAML file does not declare x:Class.');
        return;
    }

    const uri = vscode.Uri.file(codeBehindPath);
    const document = await vscode.workspace.openTextDocument(uri);
    let revealOffset = document.getText().search(new RegExp(`\\b${escapeRegExp(handlerName)}\\s*\\(`));
    if (!hasVoidMethod(document.getText(), handlerName)) {
        const source = document.getText();
        const insertionOffset = findClassInsertionOffset(source, className);
        if (insertionOffset < 0) {
            void vscode.window.showWarningMessage(
                `WinDev XAML Designer: could not find the ${className} class in ${path.basename(codeBehindPath)}.`
            );
            return;
        }
        const classIndent = lineIndentAt(source, insertionOffset);
        const memberIndent = `${classIndent}    `;
        const stub = `\n${memberIndent}private void ${handlerName}(object sender, ${eventArgsType} e)\n${memberIndent}{\n${memberIndent}}\n${classIndent}`;
        const edit = new vscode.WorkspaceEdit();
        edit.insert(uri, document.positionAt(insertionOffset), stub);
        if (!await vscode.workspace.applyEdit(edit)) {
            void vscode.window.showWarningMessage('WinDev XAML Designer: the code-behind edit could not be applied.');
            return;
        }
        revealOffset = insertionOffset + stub.indexOf(handlerName);
    }

    const editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false
    });
    const position = document.positionAt(Math.max(0, revealOffset));
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
}

function findMatchingBrace(source: string, openingBrace: number): number {
    let depth = 0;
    let state: 'code' | 'lineComment' | 'blockComment' | 'string' | 'character' = 'code';
    for (let index = openingBrace; index < source.length; index++) {
        const current = source[index];
        const next = source[index + 1];
        if (state === 'lineComment') {
            if (current === '\n') { state = 'code'; }
            continue;
        }
        if (state === 'blockComment') {
            if (current === '*' && next === '/') { state = 'code'; index++; }
            continue;
        }
        if (state === 'string' || state === 'character') {
            if (current === '\\') { index++; continue; }
            if ((state === 'string' && current === '"') || (state === 'character' && current === "'")) { state = 'code'; }
            continue;
        }
        if (current === '/' && next === '/') { state = 'lineComment'; index++; continue; }
        if (current === '/' && next === '*') { state = 'blockComment'; index++; continue; }
        if (current === '"') { state = 'string'; continue; }
        if (current === "'") { state = 'character'; continue; }
        if (current === '{') { depth++; }
        if (current === '}' && --depth === 0) { return index; }
    }
    return -1;
}

function lineIndentAt(source: string, offset: number): string {
    const lineStart = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
    return /^[ \t]*/.exec(source.slice(lineStart, offset))?.[0] ?? '';
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}