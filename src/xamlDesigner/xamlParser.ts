// WinDev Helper - XAML Parser
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

/**
 * Represents a parsed XAML element
 */
export interface XamlElement {
    /** The element tag name (e.g., 'Button', 'StackPanel') */
    tagName: string;
    /** The namespace prefix if any (e.g., 'x', 'local') */
    prefix?: string;
    /** The full qualified name including prefix */
    fullName: string;
    /** Element attributes */
    attributes: Map<string, string>;
    /** Child elements */
    children: XamlElement[];
    /** Parent element reference */
    parent?: XamlElement;
    /** Source location in the XAML file */
    sourceLocation: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    /** Text content if any */
    textContent?: string;
    /** Whether this is a self-closing element */
    selfClosing: boolean;
}

/**
 * Result of parsing a XAML document
 */
export interface XamlParseResult {
    /** The root element */
    root?: XamlElement;
    /** Any parsing errors encountered */
    errors: XamlParseError[];
    /** Namespace declarations from the root element */
    namespaces: Map<string, string>;
}

/**
 * A XAML parsing error
 */
export interface XamlParseError {
    message: string;
    line: number;
    column: number;
}

/**
 * Simple XAML parser that converts XAML text to a tree structure
 * Note: This is a simplified parser for POC purposes
 */
export class XamlParser {
    private text: string = '';
    private pos: number = 0;
    private line: number = 1;
    private column: number = 1;
    private errors: XamlParseError[] = [];

    /**
     * Parse XAML text into a structured tree
     */
    public parse(xamlText: string): XamlParseResult {
        this.text = xamlText;
        this.pos = 0;
        this.line = 1;
        this.column = 1;
        this.errors = [];

        const namespaces = new Map<string, string>();
        let root: XamlElement | undefined;

        try {
            // Skip XML declaration and comments at the start
            this.skipWhitespaceAndComments();

            // Skip XML declaration if present
            if (this.text.substring(this.pos, this.pos + 5) === '<?xml') {
                this.skipUntil('?>');
                this.pos += 2;
                this.skipWhitespaceAndComments();
            }

            // Parse the root element
            if (this.peek() === '<') {
                root = this.parseElement();
                
                // Extract namespace declarations from root
                if (root) {
                    for (const [key, value] of root.attributes) {
                        if (key === 'xmlns' || key.startsWith('xmlns:')) {
                            const prefix = key === 'xmlns' ? '' : key.substring(6);
                            namespaces.set(prefix, value);
                        }
                    }
                }
            }
        } catch (error) {
            this.errors.push({
                message: error instanceof Error ? error.message : 'Unknown parsing error',
                line: this.line,
                column: this.column
            });
        }

        const result: XamlParseResult = {
            errors: this.errors,
            namespaces
        };
        if (root) {
            result.root = root;
        }
        return result;
    }

    /**
     * Find the element at a given line and column position
     */
    public findElementAtPosition(root: XamlElement, line: number, column: number): XamlElement | undefined {
        if (!this.isPositionInElement(root, line, column)) {
            return undefined;
        }

        // Check children first (depth-first) to find the most specific match
        for (const child of root.children) {
            const found = this.findElementAtPosition(child, line, column);
            if (found) {
                return found;
            }
        }

        // If no child contains the position, return this element
        return root;
    }

    private isPositionInElement(element: XamlElement, line: number, column: number): boolean {
        const loc = element.sourceLocation;
        
        if (line < loc.startLine || line > loc.endLine) {
            return false;
        }
        
        if (line === loc.startLine && column < loc.startColumn) {
            return false;
        }
        
        if (line === loc.endLine && column > loc.endColumn) {
            return false;
        }
        
        return true;
    }

    private parseElement(): XamlElement | undefined {
        const startLine = this.line;
        const startColumn = this.column;

        // Consume '<'
        if (this.peek() !== '<') {
            return undefined;
        }
        this.advance();

        // Parse tag name
        const fullName = this.parseTagName();
        if (!fullName) {
            this.errors.push({
                message: 'Expected element name',
                line: this.line,
                column: this.column
            });
            return undefined;
        }

        const [prefix, tagName] = this.splitTagName(fullName);

        // Parse attributes
        const attributes = this.parseAttributes();

        this.skipWhitespace();

        // Check for self-closing or content
        let selfClosing = false;
        const children: XamlElement[] = [];
        let textContent: string | undefined;

        if (this.text.substring(this.pos, this.pos + 2) === '/>') {
            selfClosing = true;
            this.advance();
            this.advance();
        } else if (this.peek() === '>') {
            this.advance();

            // Parse content (children and text)
            const content = this.parseContent(fullName);
            children.push(...content.children);
            textContent = content.textContent;
        }

        const element: XamlElement = {
            tagName,
            ...(prefix && { prefix }),
            fullName,
            attributes,
            children,
            sourceLocation: {
                startLine,
                startColumn,
                endLine: this.line,
                endColumn: this.column
            },
            ...(textContent && { textContent }),
            selfClosing
        };

        // Set parent reference for children
        for (const child of children) {
            child.parent = element;
        }

        return element;
    }

    private parseTagName(): string {
        let name = '';
        while (this.pos < this.text.length) {
            const ch = this.peek();
            if (/[\w:.\-]/.test(ch)) {
                name += ch;
                this.advance();
            } else {
                break;
            }
        }
        return name;
    }

    private splitTagName(fullName: string): [string | undefined, string] {
        const colonIndex = fullName.indexOf(':');
        if (colonIndex > 0) {
            return [fullName.substring(0, colonIndex), fullName.substring(colonIndex + 1)];
        }
        return [undefined, fullName];
    }

    private parseAttributes(): Map<string, string> {
        const attributes = new Map<string, string>();

        while (this.pos < this.text.length) {
            this.skipWhitespace();

            const ch = this.peek();
            if (ch === '>' || ch === '/' || ch === '') {
                break;
            }

            // Parse attribute name
            const attrName = this.parseAttributeName();
            if (!attrName) {
                break;
            }

            this.skipWhitespace();

            // Expect '='
            if (this.peek() !== '=') {
                // Attribute without value (boolean-style)
                attributes.set(attrName, 'true');
                continue;
            }
            this.advance();

            this.skipWhitespace();

            // Parse attribute value
            const value = this.parseAttributeValue();
            attributes.set(attrName, value);
        }

        return attributes;
    }

    private parseAttributeName(): string {
        let name = '';
        while (this.pos < this.text.length) {
            const ch = this.peek();
            if (/[\w:.\-]/.test(ch)) {
                name += ch;
                this.advance();
            } else {
                break;
            }
        }
        return name;
    }

    private parseAttributeValue(): string {
        const quote = this.peek();
        if (quote !== '"' && quote !== "'") {
            // Unquoted value - read until whitespace
            let value = '';
            while (this.pos < this.text.length) {
                const ch = this.peek();
                if (/\s|>|\//.test(ch)) {
                    break;
                }
                value += ch;
                this.advance();
            }
            return value;
        }

        this.advance(); // consume opening quote
        let value = '';
        while (this.pos < this.text.length) {
            const ch = this.peek();
            if (ch === quote) {
                this.advance();
                break;
            }
            value += ch;
            this.advance();
        }
        return value;
    }

    private parseContent(parentTag: string): { children: XamlElement[], textContent?: string } {
        const children: XamlElement[] = [];
        let textContent = '';

        while (this.pos < this.text.length) {
            this.skipWhitespaceAndComments();

            // Check for closing tag
            if (this.text.substring(this.pos, this.pos + 2) === '</') {
                // Verify it's the right closing tag
                this.pos += 2;
                const closingTag = this.parseTagName();
                this.skipWhitespace();
                if (this.peek() === '>') {
                    this.advance();
                }
                
                if (closingTag === parentTag) {
                    break;
                } else {
                    this.errors.push({
                        message: `Mismatched closing tag: expected </${parentTag}>, got </${closingTag}>`,
                        line: this.line,
                        column: this.column
                    });
                    // Break on mismatch - no recovery attempted
                    break;
                }
            }

            // Check for child element
            if (this.peek() === '<') {
                // Check if it's a comment
                if (this.text.substring(this.pos, this.pos + 4) === '<!--') {
                    this.skipComment();
                    continue;
                }

                const child = this.parseElement();
                if (child) {
                    children.push(child);
                }
            } else {
                // Text content
                while (this.pos < this.text.length && this.peek() !== '<') {
                    textContent += this.peek();
                    this.advance();
                }
            }
        }

        const trimmedText = textContent.trim();
        if (trimmedText) {
            return { children, textContent: trimmedText };
        }
        return { children };
    }

    private skipWhitespace(): void {
        while (this.pos < this.text.length && /\s/.test(this.peek())) {
            this.advance();
        }
    }

    private skipWhitespaceAndComments(): void {
        while (this.pos < this.text.length) {
            this.skipWhitespace();
            if (this.text.substring(this.pos, this.pos + 4) === '<!--') {
                this.skipComment();
            } else {
                break;
            }
        }
    }

    private skipComment(): void {
        this.pos += 4; // skip '<!--'
        while (this.pos < this.text.length) {
            if (this.text.substring(this.pos, this.pos + 3) === '-->') {
                this.pos += 3;
                break;
            }
            this.advance();
        }
    }

    private skipUntil(marker: string): void {
        while (this.pos < this.text.length) {
            if (this.text.substring(this.pos, this.pos + marker.length) === marker) {
                return;
            }
            this.advance();
        }
    }

    private peek(): string {
        return this.text[this.pos] || '';
    }

    private advance(): void {
        if (this.text[this.pos] === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.pos++;
    }
}
