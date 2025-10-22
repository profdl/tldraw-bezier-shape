# tldraw Bezier Refactor Plan

This document maps the current bezier implementation to the target structure and responsibilities that mirror tldraw's native codebase. It will serve as a checklist while restructuring the modules.

## Target Directory Layout

```
src/
  lib/
    shapes/
      bezier/
        BezierShapeUtil.tsx
        bezier-shape.ts            # type + props + migrations
        components/
          BezierShapeSvg.tsx
          BezierControlPoints.tsx
          BezierHoverPreview.tsx
        shared/
          bezierConstants.ts
          bezierGeometry.ts
          bezierHandles.ts
          bezierPath.ts
          bezierState.ts           # pure helpers
        toolStates/
          Idle.ts
          Creating.ts
          Editing.ts
        __tests__/
          BezierShapeUtil.test.tsx # smoke + serialization coverage
```

### File Migration Map

| Current Path | Target Path / Notes |
| ------------ | ------------------- |
| `src/components/shapes/BezierShape.tsx` | `src/lib/shapes/bezier/BezierShapeUtil.tsx` (rewrite to extend `ShapeUtil`) |
| `src/components/shapes/services/BezierState.ts` | `src/lib/shapes/bezier/shared/bezierState.ts` (pure helpers, no editor dependency) |
| `src/components/shapes/services/BezierBounds.ts` | Merge into `shared/bezierGeometry.ts` alongside path/bounds helpers |
| `src/components/shapes/services/BezierMath.ts` | `shared/bezierGeometry.ts` |
| `src/components/shapes/services/BezierEditModeService.ts` | Remove in favor of tool state logic driven by `StateNode` subclasses |
| `src/components/shapes/services/BezierInteractionDetector.ts` | Fold required helpers into `shared/bezierHandles.ts` |
| `src/components/shapes/tools/BezierTool.ts` | `toolStates/index` (rename to `BezierShapeTool.ts`) |
| `src/components/shapes/tools/states/*` | `toolStates/Idle.ts`, `Creating.ts`, `Editing.ts` (align signatures with `Draw` tool states) |
| `src/components/shapes/utils/bezierConstants.ts` | `shared/bezierConstants.ts` (re-export defaults to match tldraw style constants) |
| `src/components/shapes/utils/bezierPathBuilder.ts` & `bezierPathHelpers.ts` | Consolidate into `shared/bezierPath.ts` |
| `src/components/shapes/utils/bezierHandleUtils.ts` | `shared/bezierHandles.ts` |
| `src/components/shapes/utils/fillDefs.ts` & `defaultStyleDefs.tsx` | Prefer imports from `@tldraw/editor` shared defs; delete redundant files |
| `src/components/shapes/components/*` | Move into `components/` without service dependencies |
| `src/components/overrides/BezierHandle.tsx` | Evaluate necessity; prefer `ShapeUtil` handle overrides if possible |
| `src/store/transientShapeStore.ts` | Remove if redundant after tool state refactor |

## Key Refactor Goals

1. **API Parity**
   - Import primitives, types, props, and migrations from `@tldraw/editor` rather than the umbrella `tldraw`.
   - Expose `BezierShapeUtil` with `static props`, `static migrations`, and implement `getGeometry`, `component`, `indicator`, `toSvg`, `onResize`, mirroring `DrawShapeUtil`.

2. **State Management**
   - Replace `BezierEditModeService`'s DOM listeners with tool state logic (`StateNode` subclasses using editor's event hooks).
   - Keep pure geometry/state helpers editor-agnostic for easier migration to the upstream repo.

3. **Styling & Rendering**
   - Leverage built-in helpers like `ShapeFill`, `getFillDefForCanvas`, `getFillDefForExport`, and shared stroke constants.
   - Normalize hover / selection visuals to match how native shapes display control handles.

4. **Documentation & Tests**
   - Rewrite long-form docs into concise guides aligned with tldraw tone (e.g., `GeoShapeUtil` docs).
   - Add smoke tests for serialization, editing transitions, and tool behavior to ease upstream review.

## Execution Notes

- Start by creating the new directory scaffold and migrating modules with alias exports to avoid massive breakages.
- Update `App.tsx` to consume the new exports and remove transient service wiring after tool state parity is achieved.
- Once the new shape util mirrors native patterns, remove deprecated files and ensure TypeScript clean build.
- Finish by syncing documentation and preparing a handoff summary for the upstream team.

