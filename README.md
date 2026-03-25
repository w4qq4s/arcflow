# ArcFlow

ArcFlow is a browser-based diagramming tool for building clean node-and-edge flow diagrams for workflows, system maps, architecture views, and analysis boards. It runs entirely in the browser with no backend, no dependencies, and no build step.

## Highlights

- Drag nodes from the sidebar onto the canvas
- Connect nodes by dragging from a source handle to a target port, or click a target node as fallback
- Box-select nodes and edges together on the canvas
- Bend edges and snap them into clean orthogonal paths
- Align, distribute, and group nodes inside section containers
- Customize node, edge, and section colors, including section fill opacity
- Pan, zoom, and navigate large diagrams with a minimap
- Keep multiple browser projects with recent autosaved drafts
- Switch into read-only mode for inspection and demos
- Share diagrams with compressed URL links in supported modern browsers
- Save diagrams as JSON and import them back into browser projects
- Export as SVG, PNG, or JPG
- Open in-app help with `Ctrl / Cmd + /`

## Quick start

Clone or download the repository, then open `index.html` in a modern browser.

```bash
git clone https://github.com/w4qq4s/arcflow
cd arcflow
```

No install step is required.

ArcFlow can be opened directly from disk, but some clipboard features work best in a secure context such as `https://` or `http://localhost`.

## Project structure

```text
arcflow/
  .gitignore             Common editor and OS ignores
  LICENSE                MIT license
  README.md              Project documentation
  index.html             Main HTML shell and modal markup
  assets/
    css/
      styles.css         All visual styles, tokens, and theme variables
    js/
      example-project.js Built-in example diagram data
      app.js             Application logic
```

## Features

- Drag-and-drop canvas editing
- Box selection for nodes and edges
- Drag-to-connect node linking with click fallback
- Inline edge labeling
- Orthogonal edge routing with bend editing
- Node alignment, distribution, and width matching
- Browser-saved recent projects with autosave
- Read-only mode with toolbar toggle and `?readonly=1`
- Compressed URL sharing with viewport preservation
- Section containers for grouped layouts
- Project title support in the toolbar
- Custom colors for nodes, edges, and sections
- Fill-opacity control for section containers
- Lock and unlock nodes or sections to block edits
- Draggable edge labels with route and label reset actions
- Dark and light mode
- Touch pinch zoom
- Minimap navigation
- Auto-layout for flow-style diagrams
- Advanced export controls for scale, padding, background mode, and JPG quality
- Transparent SVG and PNG export
- JSON save and load with schema sanitisation

## Keyboard shortcuts

| Action                | Shortcut                                 |
| --------------------- | ---------------------------------------- |
| Show help             | `Ctrl / Cmd + /`                         |
| Select all            | `Ctrl / Cmd + A`                         |
| Duplicate selection   | `Ctrl / Cmd + D`                         |
| Copy                  | `Ctrl / Cmd + C`                         |
| Paste                 | `Ctrl / Cmd + V`                         |
| Undo                  | `Ctrl / Cmd + Z`                         |
| Redo                  | `Ctrl / Cmd + Y` or `Ctrl / Cmd + Shift + Z` |
| Delete selected       | `Delete` or `Backspace`                  |
| Nudge selected        | Arrow keys                               |
| Pan canvas            | `Ctrl + drag` or middle-mouse drag       |
| Zoom                  | `Ctrl + scroll` or pinch on touch        |
| Cancel connection     | `Escape`                                 |
| Fit diagram to screen | Toolbar button                           |

## Saving and loading

ArcFlow now supports two persistence flows:

- **Browser projects**: recent diagrams are autosaved in `localStorage` and can be reopened from the `Load` dialog
- **JSON files**: diagrams can still be downloaded as `.json` files and imported back in later, either by choosing a file or pasting full ArcFlow JSON into the `Load` dialog

The default JSON filename uses the current project title when available, or `arcflow-diagram.json` otherwise.

Saved files include:

- Project title
- Nodes
- Edges
- The current id counter
- Lock state and edge label offsets

Imported files are validated and sanitised before being applied, so malformed fields, duplicate ids, and dangling edges are rejected or corrected instead of being trusted directly.

## Exporting

ArcFlow exports the current diagram as:

- **SVG**: vector output with a transparent background
- **PNG**: raster export with configurable scale and optional transparent, theme, or white background
- **JPG**: raster export with configurable scale, padding, and quality using an opaque background

Export bounds are calculated from node and edge geometry, including waypoints and draggable edge labels. Text annotation nodes are excluded unless they are the only nodes present.

## Node types

| Type        | Description                         |
| ----------- | ----------------------------------- |
| Single line | One line of text                    |
| Two line    | Title and subtitle                  |
| Section     | Dashed container for grouping nodes |
| Annotation  | Free-floating text                  |

Built-in node ramps include purple, teal, coral, red, amber, blue, green, gray, and pink. Each visual element can also use a custom color.

## Technical notes

- **Rendering**: the canvas is an SVG with separate layers for containers, edges, nodes, and overlays
- **History**: undo and redo use snapshot history with bounded stack depth
- **Security**: imported JSON is sanitised before entering state, and user text is escaped before being written into SVG markup
- **Touch**: pinch zoom is handled through Pointer Events with native browser gestures suppressed on the canvas

## Browser support

ArcFlow targets current versions of Chrome, Firefox, Safari, and Edge with support for Pointer Events, `requestAnimationFrame`, `navigator.clipboard`, and modern ES syntax.

If the system clipboard API is unavailable or denied, ArcFlow falls back to its in-memory clipboard buffer when possible.

URL sharing also depends on `CompressionStream` and `DecompressionStream`. If those are unavailable, JSON export remains the fallback for lossless sharing.

## License

Released under the MIT License. See [LICENSE](LICENSE).
