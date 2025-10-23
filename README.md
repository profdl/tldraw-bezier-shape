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

## Implementation Status

**Current Status:** ✅ Feature-complete, ready for architectural review
**Build Status:** ✅ Compiles with no TypeScript errors
**Lines of Code:** ~5,900 lines across 24 files

### Architecture Highlights

**Strengths:**
- ✅ Clean service-oriented architecture (State, Math, Bounds, PathBuilder)
- ✅ Comprehensive feature set matching professional vector tools
- ✅ Uses tldraw's native style system (color, dash, size, fill)
- ✅ Solid mathematical foundation using `bezier-js` library
- ✅ Performance optimizations (WeakCache, LRUCache)

**Architectural Questions:**
- ⚠️ 3 questions need tldraw team guidance (see below)
- ⚠️ Public API documentation needs JSDoc
- ⚠️ Test coverage needed (recommended, not blocking)

---

## For tldraw Team Reviewers

### 📋 Architectural Review Request

Please review **[TLDRAW_REVIEW_REQUEST.md](TLDRAW_REVIEW_REQUEST.md)** for our 3 architectural questions:

1. **Edit mode storage** - Should UI state be in shape props or tool state?
2. **Transform controls** - How to properly refresh/initialize after shape changes?
3. **Double-click detection** - Is there a native tldraw pattern for this?

Your guidance on these patterns will help us align with tldraw conventions before finalizing the code.

**Key files to review:**
- [BezierShapeUtil.tsx](src/lib/shapes/bezier/BezierShapeUtil.tsx) - Main shape utility
- [Creating.ts](src/lib/shapes/bezier/toolStates/Creating.ts) - Creation state machine
- [bezierShape.ts](src/lib/shapes/bezier/shared/bezierShape.ts) - Type definitions

**Search for workarounds:** `grep -r "TODO: \[tldraw-handoff\]" src/`

---

## User Documentation

For complete feature documentation and keyboard shortcuts, see:
- **[BEZIER_FEATURES.md](BEZIER_FEATURES.md)** - Complete user guide

---

*Last Updated: January 2025 - Pre-integration cleanup complete*
