# XAML Designer

WinDev Helper 4.0 provides an editable visual designer for WinUI 3 `.xaml` files. The designer is the default XAML editor and works on Windows, macOS, and Linux. Its HTML/CSS canvas approximates WinUI controls; Windows users can switch to native Preview mode for rendering through the actual WinUI engine.

## Opening XAML

- Open a `.xaml` file normally to use the designer.
- Run **WinDev: Open XAML Designer** (`Ctrl+Shift+V`) to switch a text editor to the designer.
- Run **WinDev: Open XAML as Text** or select the `</>` toolbar button to edit source directly.

## Editing a Layout

The Toolbox contains a curated set of WinUI layout, common, collection, navigation, date/time, media, and shape controls. Search by control name, then drag a control onto a layout container or double-click it to add it to the selected container.

Select a control on the canvas to show its properties and resize handles. Canvas children can be dragged to update `Canvas.Left` and `Canvas.Top`. All selected controls can be resized with the eight edge and corner handles. The Snap toggle uses `windevHelper.designer.gridSize`; zoom controls range from 25% to 200%. Press `Delete` to remove the selected element.

Grid additions use left/top alignment and margin defaults. Row and column assignments can be edited through `Grid.Row`, `Grid.Column`, `Grid.RowSpan`, and `Grid.ColumnSpan` in the property grid.

## Properties and Bindings

The embedded property grid combines attributes already present in the element with inherited WinUI metadata and attached properties. Changes update the XAML document and participate in VS Code undo/redo.

Values beginning with `{Binding` or `{x:Bind` are shown as read-only. This prevents the visual designer from corrupting binding expressions; use the text editor to change them.

## Events and Code-Behind

Double-click a supported control to wire its default event. The designer:

1. Assigns an `x:Name` when needed.
2. Adds an event attribute such as `Click="button1_Click"` to XAML.
3. Finds the partial class declared by `x:Class` in the adjacent `.xaml.cs` file.
4. Adds a handler with a fully qualified WinUI event argument type when one does not already exist.
5. Opens the handler beside the designer.

This workflow does not require C# Dev Kit. The open-source C# extension remains the extension's only required VS Code dependency.

## Native Preview

On Windows, select **Preview** in the designer toolbar to render the current source with `XamlPreviewHost.exe`. The extension communicates with the host over a per-process named pipe and displays its PNG output in the editor. Project `App.xaml` resources and merged resource dictionaries are supplied to the renderer where possible.

Preview is disabled when the current platform or architecture has no matching native host binary. Visual editing remains available in that case.

## Settings

| Setting | Default | Description |
|---|---:|---|
| `windevHelper.designer.gridSize` | `8` | Snap grid size in pixels, from 1 to 64 |
| `windevHelper.designer.snapToGrid` | `true` | Initial state of designer snapping |
| `windevHelper.preview.width` | `800` | Native render width in device-independent pixels |
| `windevHelper.preview.height` | `600` | Native render height in device-independent pixels |
| `windevHelper.preview.theme` | `auto` | Native render theme: `auto`, `light`, or `dark` |

## Source Synchronization

The text document is authoritative. Each visual change includes the exact source revision from which it was produced. If the source changed before the edit is applied, the extension rejects the stale edit and reloads the latest XAML instead of overwriting it. Messages are processed in order so rapid drag and resize operations cannot apply out of sequence.

The interaction and synchronization approach was informed by the MIT-licensed [WinForm-GUI-Maker](https://github.com/coolshrimp/WinForm-GUI-Maker) project. Full attribution is included in [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).