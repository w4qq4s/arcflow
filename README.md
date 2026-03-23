# ArcFlow

ArcFlow is a browser-based diagramming tool for building clean node-and-edge flow diagrams for workflows, system maps, architecture views, and analysis boards. It runs entirely in the browser with no backend, no dependencies, and no build step.

## Highlights

- Drag nodes from the sidebar onto the canvas
- Connect nodes by hovering to reveal port handles
- Bend edges and snap them into clean orthogonal paths
- Align, distribute, and group nodes inside section containers
- Customize node, edge, and section colors, including section fill opacity
- Pan, zoom, and navigate large diagrams with a minimap
- Save and load diagrams as JSON
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
      app.js             Application logic
```

## Features

- Drag-and-drop canvas editing
- Inline edge labeling
- Orthogonal edge routing with bend editing
- Node alignment, distribution, and width matching
- Section containers for grouped layouts
- Project title support in the toolbar
- Custom colors for nodes, edges, and sections
- Fill-opacity control for section containers
- Dark and light mode
- Touch pinch zoom
- Minimap navigation
- Auto-layout for flow-style diagrams
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

Diagrams are saved as `.json` files downloaded to your machine. The default filename uses the current project title when available, or `arcflow-diagram.json` otherwise.

Saved files include:

- Project title
- Nodes
- Edges
- The current id counter

Imported files are validated and sanitised before being applied, so malformed fields, duplicate ids, and dangling edges are rejected or corrected instead of being trusted directly.

## Exporting

ArcFlow exports the current diagram as:

- **SVG**: vector output with a transparent background
- **PNG**: raster export at 2x resolution with a transparent background
- **JPG**: raster export at 2x resolution with an opaque background matching the current theme

Export bounds are calculated from node and edge geometry, including waypoints and edge labels. Text annotation nodes are excluded unless they are the only nodes present.

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

## License

Released under the MIT License. See [LICENSE](LICENSE).
