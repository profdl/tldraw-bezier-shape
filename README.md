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

## Pre-Handoff Status

### ✅ Assessment Complete
- [x] Comprehensive code quality review (~6,000 lines analyzed)
- [x] Identified architectural questions needing tldraw team input
- [x] Created detailed improvement recommendations
- [x] Documented 48 action items across 14 categories
- [x] Prioritized improvements (Critical → High → Medium → Low)

### 📋 Documentation

**For Developers Taking Over:**
- **[HANDOFF_CHECKLIST.md](HANDOFF_CHECKLIST.md)** - Quick reference guide (start here!)
- **[RECOMMENDED_IMPROVEMENTS.md](RECOMMENDED_IMPROVEMENTS.md)** - Comprehensive recommendations with examples

**For tldraw Team:**
- **[TLDRAW_HANDOFF.md](TLDRAW_HANDOFF.md)** - 3 critical architectural questions
- **[CODE_QUALITY_IMPROVEMENTS.md](CODE_QUALITY_IMPROVEMENTS.md)** - Phase 1 cleanup summary

### 🎯 Priority Summary

**Priority 1: Critical (4-6 days)**
- ⚠️ Resolve architectural questions with tldraw team
- 📚 Add JSDoc documentation to public APIs
- 🛡️ Add error handling and validation
- 🔒 Improve type safety (meta properties, safe array access)

**Priority 2: Important (4-7 days)**
- 📦 Decompose large files (BezierShapeUtil, Creating)
- 🔄 Consolidate duplicate code
- 🎛️ Improve configuration management
- 📝 Standardize naming and code style

**Priority 3: Nice to Have (2-3 weeks)**
- 🧪 Add comprehensive testing
- 🚀 Performance optimization review
- 🔧 Enhanced debug tooling
- 📖 Additional documentation

### Overall Assessment

**Grade: A-** (would be A+ with Priority 1 items addressed)

**Strengths:**
- ✅ Clean service-oriented architecture
- ✅ Comprehensive feature set
- ✅ Good TypeScript usage
- ✅ Solid mathematical foundation

**Needs Attention:**
- ⚠️ Architectural validation required
- ⚠️ Public API documentation incomplete
- ⚠️ Error handling could be more robust
- ⚠️ No test coverage

See [HANDOFF_CHECKLIST.md](HANDOFF_CHECKLIST.md) for quick start guide and [RECOMMENDED_IMPROVEMENTS.md](RECOMMENDED_IMPROVEMENTS.md) for detailed explanations.

---

## Quick Start for New Developers

1. **Read the handoff checklist:** [HANDOFF_CHECKLIST.md](HANDOFF_CHECKLIST.md)
2. **Enable debug mode:** Set `BEZIER_DEBUG = true` in `bezierConstants.ts`
3. **Review key files:**
   - `BezierShapeTool.ts` - Tool registration
   - `BezierShapeUtil.tsx` - Main shape utility
   - `toolStates/Creating.ts` - Creation logic
   - `shared/BezierState.ts` - State management
4. **Search for workarounds:** `grep -r "TODO: \[tldraw-handoff\]" src/`

---

## For tldraw Team Reviewers

Please review **[TLDRAW_HANDOFF.md](TLDRAW_HANDOFF.md)** for 3 critical architectural questions:
1. **Edit mode storage** - Should UI state be in shape props or tool state?
2. **Transform controls** - How to properly refresh/initialize after shape changes?
3. **Double-click detection** - Is there a native tldraw pattern for this?

Your guidance on these questions will inform the refactoring approach.

---

*Last Updated: January 2025 - Pre-integration cleanup complete*
