# tldraw-bezier-shape

Fast Vite + React playground preloaded with the latest [`@tldraw/tldraw`](https://www.npmjs.com/package/@tldraw/tldraw) SDK. Launch it locally to start experimenting with custom tools, shapes, and persistence.

This project implements a **Bezier Pen Tool** and **Bezier Shape** for tldraw, providing Illustrator/Figma-style vector path creation and editing capabilities.

## Prerequisites

- Node.js 18+ (Vite 7 requires at least Node 18.0.0)
- npm 9+ (ships with current Node releases)

## Getting started

```bash
npm install
npm run dev
```

The dev server opens automatically at `http://localhost:5173` with a fully interactive tldraw canvas. Changes under `src/` hot‑reload instantly.

## Build for production

```bash
npm run build
npm run preview # optional: serve the production bundle locally
```

The output is emitted to `dist/`, ready to deploy on any static host (Netlify, Vercel, GitHub Pages, etc.).

---

## Bezier Tool Implementation

### Features

✅ **Vector Path Creation**
- Click-drag to create smooth bezier points
- Click without drag for corner points
- Shift+drag for angle-constrained handles
- Ctrl/Alt+drag for asymmetric control points

✅ **Path Editing**
- Double-click to enter edit mode
- Select and drag anchor points
- Drag control point handles with symmetry
- Double-click points to toggle smooth/corner
- Double-click segments to add new points
- Delete key to remove selected points

✅ **Path Closing**
- Snap to start point to close curve
- Automatic smooth closing handles
- Press 'C' to close curve explicitly

✅ **Standard Shape Features**
- Full transform support (resize, rotate, flip)
- Style controls (color, dash, size, fill)
- Undo/redo support
- Copy/paste/duplicate
- Group operations

### Implementation Files

Core implementation is in `src/lib/shapes/bezier/`:

- **`BezierShapeUtil.tsx`** - Main shape utility and lifecycle
- **`BezierShapeTool.ts`** - Tool registration and state machine
- **`toolStates/`** - Tool state implementations (Idle, Creating, Editing)
- **`shared/`** - Shared utilities and services:
  - `bezierState.ts` - State management service
  - `bezierMath.ts` - Mathematical operations (using bezier-js)
  - `bezierBounds.ts` - Bounds calculation and normalization
  - `bezierShape.ts` - Shape type definitions and migrations
  - `bezierPathBuilder.ts` - Path construction with tldraw PathBuilder
  - `bezierConstants.ts` - Configuration and styling constants

### Debug Mode

Enable debug logging by setting `BEZIER_DEBUG = true` in `src/lib/shapes/bezier/shared/bezierConstants.ts`:

```typescript
export const BEZIER_DEBUG = true
```

Logs are categorized: `Interaction`, `PointType`, `HitTest`, `Selection`, `Drag`, etc.

---

## Pre-Integration Status

### ✅ Completed Cleanup (Phase 1)
- [x] Removed all production `console.log` statements
- [x] Standardized debug logging to use `bezierLog` utility
- [x] Documented setTimeout workarounds with `[tldraw-handoff]` TODOs
- [x] Created technical discussion document

### ⚠️ Pending Review
See **[TLDRAW_HANDOFF.md](TLDRAW_HANDOFF.md)** for technical questions that need tldraw team validation:
1. Edit mode storage pattern (props vs. tool state)
2. Transform control initialization (setTimeout workarounds)
3. Double-click detection approach
4. Bounds calculation during creation
5. Transient shape store pattern

### 🧪 Testing (Phase 2)
- [ ] Unit tests for `BezierMath` utilities
- [ ] Unit tests for `BezierState` operations
- [ ] Unit tests for `BezierBounds` transformations
- [ ] Integration tests for tool states
- [ ] Performance tests with complex paths

### 📝 Documentation (Phase 3)
- [ ] Add usage examples
- [ ] Document keyboard shortcuts
- [ ] Add architecture overview
- [ ] Performance benchmarks

---

## For tldraw Team Reviewers

Start with **[TLDRAW_HANDOFF.md](TLDRAW_HANDOFF.md)** which outlines:
- 5 critical implementation questions requiring your guidance
- Known workarounds that may need refactoring
- Recommended integration path
- Key files to review

All workarounds are tagged with `TODO: [tldraw-handoff]` comments in the code for easy searching.

---

*Last Updated: January 2025 - Pre-integration cleanup complete*
