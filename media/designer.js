(function () {
    'use strict';

    const vscode = acquireVsCodeApi();
    const bootstrap = window.designerBootstrap;
    const catalog = new Map(bootstrap.catalog.map(control => [control.type, control]));
    const containers = new Set(bootstrap.catalog.filter(control => control.container).map(control => control.type));
    const enumValues = {
        HorizontalAlignment: ['Left', 'Center', 'Right', 'Stretch'],
        VerticalAlignment: ['Top', 'Center', 'Bottom', 'Stretch'],
        Orientation: ['Vertical', 'Horizontal'],
        Visibility: ['Visible', 'Collapsed'],
        TextWrapping: ['NoWrap', 'Wrap', 'WrapWholeWords'],
        Stretch: ['None', 'Fill', 'Uniform', 'UniformToFill'],
        ElementTheme: ['Default', 'Light', 'Dark'],
        bool: ['True', 'False']
    };
    const state = {
        sourceText: '',
        document: null,
        selectedPath: null,
        selectedElement: null,
        visualByPath: new Map(),
        zoom: 1,
        snap: bootstrap.snap,
        gridSize: bootstrap.gridSize,
        mode: 'edit',
        parseError: null,
        dragTarget: null
    };

    document.body.innerHTML = `
        <div class="designer-app">
            <div class="designer-toolbar">
                <button class="tool-button mode-button active" id="editMode" title="Edit design">Edit</button>
                <button class="tool-button mode-button" id="previewMode" title="Render native WinUI preview" ${bootstrap.nativePreviewAvailable ? '' : 'disabled'}>Preview</button>
                <span class="toolbar-spacer"></span>
                <button class="tool-button" id="zoomOut" title="Zoom out" aria-label="Zoom out">-</button>
                <span class="zoom-label" id="zoomLabel">100%</span>
                <button class="tool-button" id="zoomIn" title="Zoom in" aria-label="Zoom in">+</button>
                <label class="snap-control" title="Snap movement and sizing to the design grid"><input type="checkbox" id="snapToggle" ${state.snap ? 'checked' : ''}> Snap</label>
                <button class="tool-button" id="openText" title="Open XAML as text" aria-label="Open XAML as text">&lt;/&gt;</button>
            </div>
            <div class="designer-workspace">
                <aside class="designer-sidebar toolbox">
                    <div class="pane-title">Toolbox</div>
                    <input class="pane-search" id="toolSearch" type="search" placeholder="Filter controls" aria-label="Filter controls">
                    <div class="toolbox-list" id="toolboxList"></div>
                </aside>
                <section class="stage-viewport" id="stageViewport">
                    <div class="stage-center" id="stageCenter">
                        <div class="design-surface" id="designSurface"><div class="design-root" id="designRoot"></div></div>
                    </div>
                    <div class="preview-pane" id="previewPane"><div class="preview-progress">Select Preview to render native WinUI.</div></div>
                </section>
                <aside class="designer-sidebar properties">
                    <div class="pane-title">Properties</div>
                    <div class="selection-summary" id="selectionSummary"><div class="selection-name">No selection</div><div class="selection-type">Select an element on the canvas.</div></div>
                    <div class="property-content" id="propertyContent"></div>
                </aside>
            </div>
            <div class="designer-status"><span id="statusText">Loading XAML...</span><span class="status-spacer"></span><span id="platformText">${bootstrap.platform}</span></div>
        </div>`;

    const designRoot = document.getElementById('designRoot');
    const designSurface = document.getElementById('designSurface');
    const previewPane = document.getElementById('previewPane');
    const stageCenter = document.getElementById('stageCenter');
    const statusText = document.getElementById('statusText');
    const propertyContent = document.getElementById('propertyContent');
    const selectionSummary = document.getElementById('selectionSummary');

    function localName(element) {
        return element.localName || element.nodeName.split(':').pop();
    }

    function isPropertyElement(element) {
        return localName(element).includes('.');
    }

    function elementChildren(element) {
        return Array.from(element.children).filter(child => !isPropertyElement(child));
    }

    function pathOf(element) {
        const parts = [];
        let current = element;
        while (current && current !== state.document.documentElement) {
            const parent = current.parentElement;
            if (!parent) { break; }
            parts.unshift(Array.from(parent.children).indexOf(current));
            current = parent;
        }
        return parts.join('/');
    }

    function elementAtPath(path) {
        if (!state.document) { return null; }
        let element = state.document.documentElement;
        if (!path) { return element; }
        for (const part of path.split('/')) {
            element = element.children[Number(part)];
            if (!element) { return null; }
        }
        return element;
    }

    function parseThickness(value) {
        const parts = String(value || '0').split(',').map(part => Number(part.trim()) || 0);
        if (parts.length === 1) { return [parts[0], parts[0], parts[0], parts[0]]; }
        if (parts.length === 2) { return [parts[0], parts[1], parts[0], parts[1]]; }
        return [parts[0], parts[1], parts[2], parts[3]];
    }

    function cssColor(value, fallback) {
        if (!value || value.startsWith('{')) { return fallback; }
        if (/^#[0-9a-f]{8}$/i.test(value)) { return `#${value.slice(3)}${value.slice(1, 3)}`; }
        return value;
    }

    function numberAttribute(element, name, fallback) {
        const parsed = Number(element.getAttribute(name));
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    function applyLayout(visual, element, type) {
        const definition = catalog.get(type);
        const width = numberAttribute(element, 'Width', definition?.width);
        const height = numberAttribute(element, 'Height', definition?.height);
        if (width) { visual.style.width = `${width}px`; }
        if (height) { visual.style.height = `${height}px`; }
        const margin = parseThickness(element.getAttribute('Margin'));
        visual.style.margin = margin.map(value => `${value}px`).join(' ');
        visual.style.opacity = element.getAttribute('Opacity') || '1';
        if (element.getAttribute('Visibility') === 'Collapsed') { visual.style.display = 'none'; }
        visual.style.background = cssColor(element.getAttribute('Background') || element.getAttribute('Fill'), visual.style.background);
        visual.style.color = cssColor(element.getAttribute('Foreground'), visual.style.color);
        visual.style.borderColor = cssColor(element.getAttribute('BorderBrush') || element.getAttribute('Stroke'), visual.style.borderColor);
        const border = parseThickness(element.getAttribute('BorderThickness'))[0];
        if (border) { visual.style.borderWidth = `${border}px`; }
        const radius = parseThickness(element.getAttribute('CornerRadius'))[0];
        if (radius) { visual.style.borderRadius = `${radius}px`; }
        if (element.getAttribute('FontSize')) { visual.style.fontSize = `${element.getAttribute('FontSize')}px`; }
        if (element.getAttribute('FontWeight')) { visual.style.fontWeight = element.getAttribute('FontWeight'); }
        if (element.parentElement && localName(element.parentElement) === 'Canvas') {
            visual.style.left = `${Number(element.getAttribute('Canvas.Left')) || 0}px`;
            visual.style.top = `${Number(element.getAttribute('Canvas.Top')) || 0}px`;
        }
        const row = Number(element.getAttribute('Grid.Row'));
        const column = Number(element.getAttribute('Grid.Column'));
        const rowSpan = Number(element.getAttribute('Grid.RowSpan'));
        const columnSpan = Number(element.getAttribute('Grid.ColumnSpan'));
        if (Number.isInteger(row) && row >= 0) { visual.style.gridRow = String(row + 1); }
        if (Number.isInteger(column) && column >= 0) { visual.style.gridColumn = String(column + 1); }
        if (Number.isInteger(rowSpan) && rowSpan > 0) { visual.style.gridRowEnd = `span ${rowSpan}`; }
        if (Number.isInteger(columnSpan) && columnSpan > 0) { visual.style.gridColumnEnd = `span ${columnSpan}`; }
    }

    function getContent(element, type) {
        return element.getAttribute('Content') || element.getAttribute('Text') || element.getAttribute('Header') || element.getAttribute('PlaceholderText') || element.getAttribute('DisplayName') || type;
    }

    function renderElement(element) {
        const type = localName(element);
        const path = pathOf(element);
        const visual = document.createElement('div');
        visual.className = `xaml-element xaml-${type.toLowerCase()} ${containers.has(type) ? 'xaml-container' : 'xaml-control'}`;
        if (!catalog.has(type) && !['Window', 'Page', 'UserControl'].includes(type)) { visual.classList.add('unknown-control'); }
        visual.dataset.path = path;
        visual.title = element.getAttribute('x:Name') || element.getAttribute('Name') || type;
        state.visualByPath.set(path, visual);
        applyLayout(visual, element, type);

        if (type === 'Grid') {
            visual.classList.add('xaml-grid');
            const rows = Array.from(element.getElementsByTagName('RowDefinition')).filter(row => row.closest('Grid') === element);
            const columns = Array.from(element.getElementsByTagName('ColumnDefinition')).filter(column => column.closest('Grid') === element);
            if (rows.length) { visual.style.gridTemplateRows = rows.map(row => xamlLength(row.getAttribute('Height'))).join(' '); }
            if (columns.length) { visual.style.gridTemplateColumns = columns.map(column => xamlLength(column.getAttribute('Width'))).join(' '); }
        } else if (type === 'StackPanel') {
            visual.classList.add('xaml-stackpanel');
            visual.style.flexDirection = element.getAttribute('Orientation') === 'Horizontal' ? 'row' : 'column';
            visual.style.gap = `${Number(element.getAttribute('Spacing')) || 0}px`;
        } else if (type === 'Canvas') {
            visual.classList.add('xaml-canvas');
        } else if (type === 'RelativePanel') {
            visual.classList.add('xaml-relativepanel');
        } else if (type === 'Border') {
            visual.classList.add('xaml-border');
        }

        const children = elementChildren(element);
        if (children.length) {
            children.forEach(child => visual.appendChild(renderElement(child)));
        } else if (!containers.has(type) || type === 'NavigationView') {
            visual.textContent = getContent(element, type);
        }

        visual.addEventListener('mousedown', event => {
            event.stopPropagation();
            selectElement(element);
            if (event.button === 0 && element.parentElement && localName(element.parentElement) === 'Canvas') {
                startMove(event, element, visual);
            }
        });
        visual.addEventListener('dblclick', event => {
            event.stopPropagation();
            const definition = catalog.get(type);
            if (definition?.defaultEvent) { wireEvent(element, definition.defaultEvent); }
        });
        return visual;
    }

    function xamlLength(value) {
        if (!value || value === '*') { return '1fr'; }
        if (value === 'Auto') { return 'auto'; }
        if (value.endsWith('*')) { return `${Number(value.slice(0, -1)) || 1}fr`; }
        return `${Number(value) || 1}px`;
    }

    function render() {
        designRoot.replaceChildren();
        state.visualByPath.clear();
        if (state.parseError) {
            designRoot.innerHTML = `<div class="error-state">${escapeHtml(state.parseError)}</div>`;
            propertyContent.replaceChildren();
            return;
        }
        if (!state.document) { return; }
        const root = state.document.documentElement;
        const rootWidth = numberAttribute(root, 'Width', bootstrap.previewWidth);
        const rootHeight = numberAttribute(root, 'Height', bootstrap.previewHeight);
        designSurface.style.width = `${rootWidth}px`;
        designSurface.style.minHeight = `${rootHeight}px`;
        designRoot.style.minHeight = `${rootHeight}px`;
        const content = ['Window', 'Page', 'UserControl'].includes(localName(root)) && elementChildren(root).length === 1
            ? elementChildren(root)[0]
            : root;
        designRoot.appendChild(renderElement(content));
        designSurface.style.transform = `scale(${state.zoom})`;
        restoreSelection();
        statusText.textContent = `${localName(root)} - ${state.visualByPath.size} elements`;
    }

    function parseDocument(text) {
        const parsed = new DOMParser().parseFromString(text, 'application/xml');
        const error = parsed.querySelector('parsererror');
        if (error) {
            state.parseError = error.textContent.trim();
            state.document = null;
        } else {
            state.parseError = null;
            state.document = parsed;
        }
        render();
    }

    function selectElement(element) {
        state.selectedElement = element;
        state.selectedPath = pathOf(element);
        drawSelection();
        renderProperties();
    }

    function restoreSelection() {
        const selected = state.selectedPath === null ? null : elementAtPath(state.selectedPath);
        state.selectedElement = selected;
        if (selected) { drawSelection(); renderProperties(); }
        else { clearSelection(); }
    }

    function clearSelection() {
        state.selectedElement = null;
        state.selectedPath = null;
        document.querySelector('.selection-box')?.remove();
        selectionSummary.innerHTML = '<div class="selection-name">No selection</div><div class="selection-type">Select an element on the canvas.</div>';
        propertyContent.innerHTML = '<div class="empty-state">Properties appear here when an element is selected.</div>';
    }

    function drawSelection() {
        document.querySelector('.selection-box')?.remove();
        if (!state.selectedPath) { return; }
        const visual = state.visualByPath.get(state.selectedPath);
        if (!visual) { return; }
        const surfaceRect = designSurface.getBoundingClientRect();
        const rect = visual.getBoundingClientRect();
        const box = document.createElement('div');
        box.className = 'selection-box';
        box.style.left = `${(rect.left - surfaceRect.left) / state.zoom}px`;
        box.style.top = `${(rect.top - surfaceRect.top) / state.zoom}px`;
        box.style.width = `${rect.width / state.zoom}px`;
        box.style.height = `${rect.height / state.zoom}px`;
        const tag = document.createElement('span');
        tag.className = 'selection-tag';
        tag.textContent = state.selectedElement.getAttribute('x:Name') || state.selectedElement.getAttribute('Name') || localName(state.selectedElement);
        box.appendChild(tag);
        for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
            const handle = document.createElement('span');
            handle.className = `resize-handle handle-${direction}`;
            handle.addEventListener('mousedown', event => startResize(event, direction));
            box.appendChild(handle);
        }
        designSurface.appendChild(box);
    }

    function startMove(event, element, visual) {
        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const left = Number(element.getAttribute('Canvas.Left')) || 0;
        const top = Number(element.getAttribute('Canvas.Top')) || 0;
        const move = current => {
            const nextLeft = snap(left + (current.clientX - startX) / state.zoom);
            const nextTop = snap(top + (current.clientY - startY) / state.zoom);
            visual.style.left = `${Math.max(0, nextLeft)}px`;
            visual.style.top = `${Math.max(0, nextTop)}px`;
            element.setAttribute('Canvas.Left', String(Math.max(0, nextLeft)));
            element.setAttribute('Canvas.Top', String(Math.max(0, nextTop)));
            drawSelection();
        };
        const end = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', end);
            commit();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
    }

    function startResize(event, direction) {
        event.preventDefault();
        event.stopPropagation();
        const element = state.selectedElement;
        const visual = state.visualByPath.get(state.selectedPath);
        if (!element || !visual) { return; }
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = visual.getBoundingClientRect().width / state.zoom;
        const startHeight = visual.getBoundingClientRect().height / state.zoom;
        const move = current => {
            let width = startWidth;
            let height = startHeight;
            if (direction.includes('e')) { width += (current.clientX - startX) / state.zoom; }
            if (direction.includes('w')) { width -= (current.clientX - startX) / state.zoom; }
            if (direction.includes('s')) { height += (current.clientY - startY) / state.zoom; }
            if (direction.includes('n')) { height -= (current.clientY - startY) / state.zoom; }
            width = Math.max(16, snap(width));
            height = Math.max(16, snap(height));
            element.setAttribute('Width', String(width));
            element.setAttribute('Height', String(height));
            visual.style.width = `${width}px`;
            visual.style.height = `${height}px`;
            drawSelection();
        };
        const end = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', end);
            commit();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
    }

    function snap(value) {
        return state.snap ? Math.round(value / state.gridSize) * state.gridSize : Math.round(value);
    }

    function renderToolbox(filter = '') {
        const list = document.getElementById('toolboxList');
        list.replaceChildren();
        const query = filter.trim().toLowerCase();
        const sections = new Map();
        for (const definition of bootstrap.catalog) {
            if (query && !definition.type.toLowerCase().includes(query)) { continue; }
            if (!sections.has(definition.section)) { sections.set(definition.section, []); }
            sections.get(definition.section).push(definition);
        }
        for (const [section, definitions] of sections) {
            const title = document.createElement('div');
            title.className = 'tool-section-title';
            title.textContent = section;
            list.appendChild(title);
            for (const definition of definitions) {
                const item = document.createElement('div');
                item.className = 'tool-item';
                item.draggable = true;
                item.innerHTML = `<span class="tool-glyph">${definition.container ? '[ ]' : '+'}</span><span>${definition.type}</span>`;
                item.addEventListener('dragstart', event => {
                    event.dataTransfer.setData('text/windev-xaml-control', definition.type);
                    event.dataTransfer.effectAllowed = 'copy';
                });
                item.addEventListener('dblclick', () => addControl(definition.type, null, null));
                list.appendChild(item);
            }
        }
    }

    function findDropElement(target) {
        let node = target;
        while (node && node !== designSurface) {
            if (node.dataset?.path !== undefined) {
                const element = elementAtPath(node.dataset.path);
                if (element && containers.has(localName(element))) { return element; }
            }
            node = node.parentElement;
        }
        if (state.document) {
            const root = state.document.documentElement;
            const first = elementChildren(root)[0];
            if (containers.has(localName(root))) { return root; }
            if (first && containers.has(localName(first))) { return first; }
        }
        return null;
    }

    function addControl(type, clientX, clientY) {
        const parent = state.selectedElement && containers.has(localName(state.selectedElement))
            ? state.selectedElement
            : findDropElement(state.dragTarget || designRoot);
        const definition = catalog.get(type);
        if (!parent || !definition) {
            statusText.textContent = 'Select a layout container before adding a control.';
            return;
        }
        const element = state.document.createElementNS(state.document.documentElement.namespaceURI, type);
        const xNamespace = state.document.documentElement.lookupNamespaceURI('x');
        if (xNamespace) { element.setAttributeNS(xNamespace, 'x:Name', uniqueName(type)); }
        element.setAttribute('Width', String(definition.width));
        element.setAttribute('Height', String(definition.height));
        for (const [name, value] of Object.entries(definition.attributes || {})) { element.setAttribute(name, value); }
        if (localName(parent) === 'Canvas') {
            const parentVisual = state.visualByPath.get(pathOf(parent));
            const rect = parentVisual?.getBoundingClientRect();
            const left = clientX === null || !rect ? 16 : snap((clientX - rect.left) / state.zoom);
            const top = clientY === null || !rect ? 16 : snap((clientY - rect.top) / state.zoom);
            element.setAttribute('Canvas.Left', String(Math.max(0, left)));
            element.setAttribute('Canvas.Top', String(Math.max(0, top)));
        } else if (localName(parent) === 'Grid') {
            element.setAttribute('HorizontalAlignment', 'Left');
            element.setAttribute('VerticalAlignment', 'Top');
            element.setAttribute('Margin', '16');
        }
        parent.appendChild(element);
        state.selectedPath = pathOf(element);
        commit();
        render();
    }

    function uniqueName(type) {
        const base = type.charAt(0).toLowerCase() + type.slice(1);
        const names = new Set(Array.from(state.document.querySelectorAll('*')).map(element => element.getAttribute('x:Name') || element.getAttribute('Name')).filter(Boolean));
        let index = 1;
        while (names.has(`${base}${index}`)) { index++; }
        return `${base}${index}`;
    }

    function renderProperties() {
        const element = state.selectedElement;
        if (!element) { clearSelection(); return; }
        const type = localName(element);
        const definition = catalog.get(type);
        const name = element.getAttribute('x:Name') || element.getAttribute('Name') || '(unnamed)';
        selectionSummary.innerHTML = `<div class="selection-name">${escapeHtml(name)}</div><div class="selection-type">${escapeHtml(type)}</div>`;
        propertyContent.replaceChildren();
        const metadata = new Map((definition?.properties || []).map(property => [property.name, property]));
        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name;
            if (!metadata.has(name) && !name.startsWith('xmlns')) {
                metadata.set(name, { name, type: 'string', defaultValue: '', category: 'Miscellaneous' });
            }
        }
        if (!metadata.has('x:Name')) { metadata.set('x:Name', { name: 'x:Name', type: 'string', defaultValue: '', category: 'Common' }); }
        const grouped = new Map();
        for (const property of metadata.values()) {
            if (!grouped.has(property.category)) { grouped.set(property.category, []); }
            grouped.get(property.category).push(property);
        }
        for (const category of ['Common', 'Layout', 'Appearance', 'Text', 'Interaction', 'Accessibility', 'Miscellaneous']) {
            const properties = grouped.get(category);
            if (!properties?.length) { continue; }
            const heading = document.createElement('div');
            heading.className = 'property-category';
            heading.textContent = category;
            propertyContent.appendChild(heading);
            properties.sort((left, right) => left.name.localeCompare(right.name));
            for (const property of properties) { propertyContent.appendChild(createPropertyRow(element, property)); }
        }
    }

    function createPropertyRow(element, property) {
        const row = document.createElement('label');
        row.className = 'property-row';
        row.title = `${property.name} (${property.type})`;
        const name = document.createElement('span');
        name.className = 'property-name';
        name.textContent = property.name;
        row.appendChild(name);
        const value = getPropertyValue(element, property.name);
        const choices = enumValues[property.type];
        const editor = choices ? document.createElement('select') : document.createElement('input');
        editor.className = 'property-editor';
        if (choices) {
            const unset = document.createElement('option');
            unset.value = '';
            unset.textContent = `(default: ${property.defaultValue})`;
            editor.appendChild(unset);
            for (const choice of choices) {
                const option = document.createElement('option');
                option.value = choice;
                option.textContent = choice;
                editor.appendChild(option);
            }
        }
        editor.value = value;
        if (value.startsWith('{Binding') || value.startsWith('{x:Bind')) {
            editor.classList.add('binding');
            editor.readOnly = true;
            editor.title = 'Binding expressions are preserved and read-only in the visual designer.';
        } else {
            editor.placeholder = property.defaultValue ? `Default: ${property.defaultValue}` : '';
            editor.addEventListener('change', () => {
                setPropertyValue(element, property.name, editor.value.trim());
                state.selectedPath = pathOf(element);
                commit();
                render();
            });
        }
        row.appendChild(editor);
        return row;
    }

    function getPropertyValue(element, name) {
        if (name === 'x:Name') { return element.getAttribute('x:Name') || element.getAttribute('Name') || ''; }
        return element.getAttribute(name) || '';
    }

    function setPropertyValue(element, name, value) {
        if (!value) {
            element.removeAttribute(name);
            if (name === 'x:Name') { element.removeAttribute('Name'); }
            return;
        }
        if (name === 'x:Name') {
            const xNamespace = state.document.documentElement.lookupNamespaceURI('x');
            if (xNamespace) { element.setAttributeNS(xNamespace, 'x:Name', value); }
            else { element.setAttribute('Name', value); }
            return;
        }
        element.setAttribute(name, value);
    }

    function wireEvent(element, eventName) {
        let controlName = element.getAttribute('x:Name') || element.getAttribute('Name');
        if (!controlName) {
            controlName = uniqueName(localName(element));
            setPropertyValue(element, 'x:Name', controlName);
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(controlName)) {
            statusText.textContent = 'Set a valid C# identifier in x:Name before wiring an event.';
            return;
        }
        const handlerName = `${controlName}_${eventName}`;
        element.setAttribute(eventName, handlerName);
        const definition = catalog.get(localName(element));
        const eventDefinition = definition?.events.find(candidate => candidate.name === eventName);
        commit();
        vscode.postMessage({ type: 'wireEvent', eventName, handlerName, eventArgsType: eventDefinition?.eventArgsType || 'Microsoft.UI.Xaml.RoutedEventArgs' });
        render();
    }

    function serializeDocument() {
        const declaration = state.sourceText.match(/^\s*<\?xml[^?]*\?>/)?.[0];
        const serialized = new XMLSerializer().serializeToString(state.document.documentElement);
        return `${declaration ? `${declaration}\n` : ''}${formatXml(serialized)}\n`;
    }

    function formatXml(xml) {
        const compact = xml.replace(/>\s+</g, '><');
        const tokens = compact.replace(/></g, '>\n<').split('\n');
        let depth = 0;
        return tokens.map(token => {
            const trimmed = token.trim();
            if (/^<\//.test(trimmed)) { depth = Math.max(0, depth - 1); }
            const line = `${'    '.repeat(depth)}${trimmed}`;
            if (/^<[^!?/][^>]*[^/]?>$/.test(trimmed) && !/<\/[^>]+>$/.test(trimmed)) { depth++; }
            return line;
        }).join('\n');
    }

    function commit() {
        if (!state.document || state.parseError) { return; }
        const baseText = state.sourceText;
        const text = serializeDocument();
        state.sourceText = text;
        vscode.postMessage({ type: 'edit', text, baseText });
    }

    function requestPreview() {
        previewPane.classList.add('active');
        stageCenter.style.display = 'none';
        previewPane.innerHTML = '<div class="preview-progress">Rendering native WinUI preview...</div>';
        vscode.postMessage({ type: 'renderNativePreview', text: state.sourceText });
    }

    function setMode(mode) {
        state.mode = mode;
        document.getElementById('editMode').classList.toggle('active', mode === 'edit');
        document.getElementById('previewMode').classList.toggle('active', mode === 'preview');
        if (mode === 'preview') { requestPreview(); }
        else { previewPane.classList.remove('active'); stageCenter.style.display = 'grid'; }
    }

    function changeZoom(delta) {
        state.zoom = Math.min(2, Math.max(.25, state.zoom + delta));
        document.getElementById('zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
        designSurface.style.transform = `scale(${state.zoom})`;
        drawSelection();
    }

    function escapeHtml(value) {
        const node = document.createElement('span');
        node.textContent = String(value);
        return node.innerHTML;
    }

    document.getElementById('toolSearch').addEventListener('input', event => renderToolbox(event.target.value));
    document.getElementById('editMode').addEventListener('click', () => setMode('edit'));
    document.getElementById('previewMode').addEventListener('click', () => setMode('preview'));
    document.getElementById('zoomOut').addEventListener('click', () => changeZoom(-.1));
    document.getElementById('zoomIn').addEventListener('click', () => changeZoom(.1));
    document.getElementById('snapToggle').addEventListener('change', event => { state.snap = event.target.checked; });
    document.getElementById('openText').addEventListener('click', () => vscode.postMessage({ type: 'openText' }));
    designRoot.addEventListener('mousedown', event => { if (event.target === designRoot) { clearSelection(); } });
    designRoot.addEventListener('dragover', event => {
        if (!event.dataTransfer.types.includes('text/windev-xaml-control')) { return; }
        event.preventDefault();
        state.dragTarget = event.target;
        document.querySelector('.drop-target')?.classList.remove('drop-target');
        const parent = findDropElement(event.target);
        const visual = parent ? state.visualByPath.get(pathOf(parent)) : null;
        visual?.classList.add('drop-target');
    });
    designRoot.addEventListener('dragleave', () => document.querySelector('.drop-target')?.classList.remove('drop-target'));
    designRoot.addEventListener('drop', event => {
        event.preventDefault();
        document.querySelector('.drop-target')?.classList.remove('drop-target');
        const type = event.dataTransfer.getData('text/windev-xaml-control');
        if (type) { addControl(type, event.clientX, event.clientY); }
    });
    window.addEventListener('resize', drawSelection);
    window.addEventListener('keydown', event => {
        if (!state.selectedElement || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) { return; }
        if (event.key === 'Delete' && state.selectedElement !== state.document.documentElement) {
            event.preventDefault();
            state.selectedElement.remove();
            clearSelection();
            commit();
            render();
        }
    });
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'documentChanged') {
            state.sourceText = message.text;
            parseDocument(message.text);
        } else if (message.type === 'editResult' && !message.ok && typeof message.text === 'string') {
            state.sourceText = message.text;
            parseDocument(message.text);
            statusText.textContent = message.conflict ? 'Source changed outside the designer; reloaded latest XAML.' : 'Designer edit was not applied.';
        } else if (message.type === 'nativePreviewResult') {
            const validImage = typeof message.image === 'string'
                && message.image.length <= 64 * 1024 * 1024
                && /^[A-Za-z0-9+/]*={0,2}$/.test(message.image);
            if (message.success && validImage) {
                const image = document.createElement('img');
                image.className = 'preview-image';
                image.src = `data:image/png;base64,${message.image}`;
                image.alt = 'Native WinUI preview';
                previewPane.replaceChildren(image);
                const renderTime = typeof message.renderTimeMs === 'number' && Number.isFinite(message.renderTimeMs)
                    ? `${Math.round(message.renderTimeMs)} ms`
                    : 'an unknown duration';
                statusText.textContent = `Native preview rendered in ${renderTime}`;
            } else {
                previewPane.innerHTML = `<div class="error-state">${escapeHtml(message.message || 'Native preview failed.')}</div>`;
            }
        }
    });

    renderToolbox();
    clearSelection();
    vscode.postMessage({ type: 'ready' });
}());