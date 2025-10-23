# Bezier Shape Architecture

This document provides a high-level overview of the bezier path creation and editing system. It's intended for developers who want to understand how the system works, modify it, or add new features.

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Architecture Diagram](#architecture-diagram)
4. [Key Components](#key-components)
5. [State Machine](#state-machine)
6. [Coordinate Systems](#coordinate-systems)
7. [Event Flow](#event-flow)
8. [Common Operations](#common-operations)
9. [Adding New Features](#adding-new-features)

## Overview

The bezier system provides a pen tool (similar to Adobe Illustrator or Figma) for creating and editing curved paths in the TLDraw canvas. It supports:

- Creating bezier curves point-by-point with draggable handles
- Editing existing curves (moving points, adjusting control points)
- Converting between smooth and corner points
- Adding/removing points on existing curves
- Closing paths to create filled shapes
- Snapping to the start point when closing curves

## Core Concepts

### BezierPoint

The fundamental data structure representing a point on a bezier curve:

```typescript
interface BezierPoint {
  x: number;          // Anchor point X position (in local coordinates)
  y: number;          // Anchor point Y position (in local coordinates)
  cp1?: { x: number; y: number };  // Incoming control point (optional)
  cp2?: { x: number; y: number };  // Outgoing control point (optional)
}
```

- **Anchor point**: The point the curve passes through
- **Control points (cp1, cp2)**: Bezier handles that control curve shape
  - `cp1`: Incoming handle (affects curve entering the point)
  - `cp2`: Outgoing handle (affects curve leaving the point)
- **Corner vs Smooth**: Points without control points are "corner" points, points with control points are "smooth"

### Coordinate Systems

The bezier system uses two coordinate systems:

1. **Page Coordinates**: Absolute positions on the infinite canvas
2. **Local Coordinates**: Positions relative to the shape's bounding box (shape.x, shape.y)

**Why two systems?**
- TLDraw shapes store points in local coordinates for efficient transforms (move, scale, rotate)
- User interactions (mouse clicks, drags) happen in page coordinates
- We constantly convert between the two systems

```typescript
// Convert page to local
const localPoint = {
  x: pagePoint.x - shape.x,
  y: pagePoint.y - shape.y
}

// Convert local to page
const pagePoint = {
  x: localPoint.x + shape.x,
  y: localPoint.y + shape.y
}
```

### Edit Mode vs Normal Mode

Bezier shapes have two interaction modes:

| Mode | Purpose | User Can |
|------|---------|----------|
| **Normal Mode** | Transform the whole shape | Move, scale, rotate the entire path |
| **Edit Mode** | Modify individual points | Add/remove/move points, adjust handles |

Toggle between modes:
- **Enter edit mode**: Double-click a shape
- **Exit edit mode**: Press Escape, Enter, or click outside the shape

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         TLDraw Editor                        │
│                                                              │
│  ┌────────────────┐         ┌──────────────────────┐       │
│  │  BezierTool    │────────▶│  State Machine       │       │
│  │  (Tool Entry)  │         │                      │       │
│  └────────────────┘         │  ┌────────────────┐ │       │
│                             │  │ BezierIdle     │ │       │
│                             │  └────────┬───────┘ │       │
│                             │           │         │       │
│                             │           ▼         │       │
│                             │  ┌────────────────┐ │       │
│                             │  │BezierCreating  │ │       │
│                             │  │ (draw mode)    │ │       │
│                             │  └────────┬───────┘ │       │
│                             │           │         │       │
│                             │           ▼         │       │
│                             │  ┌────────────────┐ │       │
│                             │  │BezierEditing   │ │       │
│                             │  │ (edit mode)    │ │       │
│                             │  └────────────────┘ │       │
│                             └──────────────────────┘       │
│                                                              │
└──────────────────────┬────────────────────────────────────┘
                       │
                       │ delegates to
                       ▼
        ┌──────────────────────────────────┐
        │       Service Layer              │
        ├──────────────────────────────────┤
        │                                   │
        │  ┌─────────────────────────────┐ │
        │  │  BezierState                │ │
        │  │  (state transformations)    │ │
        │  └─────────────────────────────┘ │
        │                                   │
        │  ┌─────────────────────────────┐ │
        │  │  BezierMath                 │ │
        │  │  (curve mathematics)        │ │
        │  └─────────────────────────────┘ │
        │                                   │
        │  ┌─────────────────────────────┐ │
        │  │  BezierBounds               │ │
        │  │  (bounds calculation)       │ │
        │  └─────────────────────────────┘ │
        │                                   │
        │  ┌─────────────────────────────┐ │
        │  │  Tool state logic          │ │
        │  │  (BezierEditing, etc.)     │ │
        │  └─────────────────────────────┘ │
        │                                   │
        └───────────────────────────────────┘
```

## Key Components

### Services (`src/lib/shapes/bezier/shared/`)

#### BezierState
**Purpose**: Pure functional state transformations

**Responsibilities**:
- Enter/exit/toggle edit mode
- Handle point selection (single, multi-select with Shift)
- Add/delete/modify points
- Convert smooth ↔ corner points
- Hit testing (find point/segment at position)

**Key Methods**:
```typescript
BezierState.enterEditMode(shape) → new shape with editMode=true
BezierState.deleteSelectedPoints(shape) → shape with points removed
BezierState.addPointToSegment(shape, segmentIndex, t) → shape with new point
```

#### BezierMath
**Purpose**: Bezier curve mathematics using bezier-js library

**Responsibilities**:
- Convert between our format and bezier-js format
- Calculate points on curves at parameter t
- Split segments when adding points
- Find closest point on curve (for click detection)
- Calculate accurate bounds for curved paths
- Sample curves into straight line segments

**Key Methods**:
```typescript
BezierMath.segmentToBezier(p1, p2) → Bezier object
BezierMath.splitSegmentAtT(p1, p2, 0.5) → { leftSegment, rightSegment, splitPoint }
BezierMath.getAccurateBounds(points, isClosed) → { minX, minY, maxX, maxY }
```

#### BezierBounds
**Purpose**: Bounding box calculations and coordinate normalization

**Responsibilities**:
- Calculate accurate bounds (not just anchor points, includes control points)
- Normalize points to local coordinates
- Recalculate shape bounds after point changes
- Provide different bounds for edit vs normal mode

**Key Methods**:
```typescript
BezierBounds.recalculateShapeBounds(shape, newPoints) → updated shape
BezierBounds.getAccurateBounds(points, isClosed) → bounds
```

#### BezierEditModeHandler
**Purpose**: React component that handles edit-mode interactions using DOM event capture.

**Responsibilities**:
- Intercepts pointer events before tldraw's handle system (using capture: true)
- Manages double-click detection for toggling point types
- Handles segment click and drag operations
- Detects clicks outside shape to exit edit mode
- Manages keyboard shortcuts (Delete/Backspace) in edit mode

**Why DOM event capture?**
TLDraw's handle system intercepts pointer events on anchor points (rendered as handles), preventing the shape's event handlers from receiving them. By using DOM listeners with `capture: true`, we intercept events BEFORE tldraw processes them.

**Implementation**:
- Lives in `src/lib/shapes/bezier/components/BezierEditModeHandler.tsx`
- Uses React hooks with DOM event listeners
- Renders nothing (returns null) - purely functional component

### Tool States (`src/lib/shapes/bezier/toolStates/`)

#### Idle (`src/lib/shapes/bezier/toolStates/Idle.ts`)
**Entry point** for the bezier tool. Waits for pointer down to start creating.

**Responsibilities**:
- Sets crosshair cursor when entering the tool
- Transitions to Creating state on canvas click
- Transitions to Editing state when clicking on a bezier shape already in edit mode
- Handles extending existing shapes (receives extendingShapeId in onEnter)

#### Creating (`src/lib/shapes/bezier/toolStates/Creating.ts`)
**Active drawing mode**. Handles:
- Click to add points
- Drag to create control handles
- Hover preview of next segment
- Snap-to-start for closing curves
- Keyboard: Enter/Escape to finish, 'c' to close

**Complex features**:
- Stable origin positioning (prevents shape from jumping during creation)
- Corner point threshold (small drags create corner points, larger drags create smooth points)
- Hysteresis for snap-to-start (different thresholds for entering/exiting snap)

#### Editing (`src/lib/shapes/bezier/toolStates/Editing.ts`)
**Edit mode for existing shapes** within the tool's state machine. Handles:
- Setting editMode=true on the shape when entering
- Basic pointer event routing
- Alt+drag for segment manipulation
- Transitioning back to select tool on escape/enter

**Note**: Most edit-mode interactions are handled by `BezierEditModeHandler` component, which uses DOM event capture to intercept events before tldraw's handle system processes them.

## State Machine

The bezier tool uses TLDraw's StateNode system for state management:

```
┌──────────────┐
│ BezierTool   │  (parent)
└──────┬───────┘
       │
       ├─▶ BezierIdle ────click────▶ BezierCreating ────complete────▶ (exit to select)
       │                                    │
       │                                    │
       └─────double-click existing──────────┴──────▶ BezierEditing ────escape────▶ (exit to select)
```

### Transitions

| From | To | Trigger |
|------|-----|---------|
| BezierIdle | BezierCreating | Click on canvas |
| BezierCreating | (select tool) | Enter, Escape, or double-click |
| BezierIdle | BezierEditing | Click on shape in edit mode |
| BezierEditing | (select tool) | Escape, Enter, or click outside |

## Coordinate Systems

### Local vs Page Coordinates

All points in `shape.props.points` are stored in **local coordinates** relative to `(shape.x, shape.y)`.

**Why?**
- Efficient transforms: moving a shape just updates `shape.x/y`, not every point
- TLDraw's transform system expects local coordinates

**When to convert**:
```typescript
// User clicks at page coordinates (100, 200)
// Shape is at page position (50, 50)
const localPoint = {
  x: pagePoint.x - shape.x,  // 100 - 50 = 50
  y: pagePoint.y - shape.y   // 200 - 50 = 150
}
```

### Bounds Normalization

After modifying points, bounds must be recalculated:

1. Calculate accurate bounds in page coordinates
2. Normalize points to new bounds origin
3. Update shape position and size

```typescript
// Before: points at [100,100], [200,200] with shape at (0,0)
const updatedShape = BezierBounds.recalculateShapeBounds(shape, points)
// After: points at [0,0], [100,100] with shape at (100,100)
// Visual result: unchanged! Just different coordinate representation
```

## Event Flow

### Creating a Curve

1. User clicks canvas → `BezierCreating.onPointerDown()`
2. First point added at click position
3. User drags → `BezierCreating.onPointerMove()`
4. Drag distance > threshold → control points created
5. User releases → `BezierCreating.onPointerUp()` → ready for next point
6. Repeat 1-5 for each point
7. User presses Enter or double-clicks → `BezierCreating.complete()` → switch to select tool

### Editing an Existing Curve

1. User double-clicks shape (in select tool) → `BezierShapeUtil.onDoubleClick()`
2. Shape enters edit mode → `BezierStateActions.enterEditMode()`
3. `BezierEditModeHandler` component listens for DOM events with capture phase
4. User clicks anchor → handler calls `BezierStateActions.handlePointSelection()`
5. User double-clicks anchor → handler calls `BezierStateActions.togglePointType()`
6. User drags anchor → TLDraw's handle system calls `BezierShapeUtil.onHandleDrag()`
7. User drags segment → handler manages segment drag state and updates control points
8. User presses Delete → handler calls `BezierStateActions.deleteSelectedPoints()`
9. User presses Escape or clicks outside → `BezierStateActions.exitEditMode()` → back to normal mode

### Adding a Point

1. User double-clicks on curve segment (in edit mode)
2. `BezierEditModeHandler` detects double-click on segment
3. Convert page coords to local coords
4. `BezierState.getSegmentAtPosition()` finds which segment (returns t value)
5. `BezierState.addPointToSegment()` uses `BezierMath.splitSegmentAtT()`
6. `BezierBounds.recalculateShapeBounds()` updates shape dimensions
7. New point is selected automatically

## Common Operations

### How to Add a Point

```typescript
// 1. Find segment near click position
const segmentInfo = BezierState.getSegmentAtPosition(
  shape.props.points,
  localPoint,
  zoomLevel,
  shape.props.isClosed
);

if (segmentInfo) {
  // 2. Split segment at that position
  const updatedShape = BezierState.addPointToSegment(
    shape,
    segmentInfo.segmentIndex,
    segmentInfo.t  // Parameter value 0-1 along the segment
  );

  // 3. Recalculate bounds
  const finalShape = BezierBounds.recalculateShapeBounds(
    updatedShape,
    updatedShape.props.points
  );

  // 4. Update in editor
  editor.updateShape(finalShape);
}
```

### How to Delete Selected Points

```typescript
// Use BezierStateActions service (handles bounds recalculation internally)
BezierStateActions.deleteSelectedPoints(editor, shape);
```

### How to Toggle Point Type (Smooth ↔ Corner)

```typescript
// On double-click of anchor point
BezierStateActions.togglePointType(editor, shape, pointIndex);
// Note: BezierStateActions methods handle editor.updateShape() internally
```

## Adding New Features

### Adding a New Keyboard Shortcut

Edit `BezierEditModeHandler` component's keyboard event listener:

```typescript
const handleKeyDown = (event: KeyboardEvent) => {
  // ... existing code ...

  if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
    // Cmd/Ctrl+S to simplify path
    const editingShape = getEditingShape()
    if (editingShape) {
      simplifyPath(editor, editingShape)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}
```

### Adding a New Point Operation

1. Add function to `BezierState` (for pure transformations):
```typescript
// In bezierState.ts
static mirrorPoint(shape: BezierShape, pointIndex: number): BezierShape {
  const newPoints = [...shape.props.points];
  const point = { ...newPoints[pointIndex] };

  if (point.cp1 && point.cp2) {
    // Mirror cp1 based on cp2
    const dx = point.cp2.x - point.x;
    const dy = point.cp2.y - point.y;
    point.cp1 = {
      x: point.x - dx,
      y: point.y - dy
    };
  }

  newPoints[pointIndex] = point;
  return { ...shape, props: { ...shape.props, points: newPoints } };
}
```

2. Add action to `BezierStateActions` (if it needs editor interaction):
```typescript
// In bezierState.ts BezierStateActions namespace
static mirrorPoint(editor: Editor, shape: BezierShape, pointIndex: number): void {
  const updatedShape = BezierState.mirrorPoint(shape, pointIndex);
  const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points);
  editor.updateShape(finalShape);
}
```

3. Call from the appropriate event handler in `BezierEditModeHandler`

### Adding a New Math Operation

Add to `BezierMath` service:

```typescript
static getLength(points: BezierPoint[], isClosed: boolean): number {
  const segments = this.getAllSegments(points, isClosed);
  return segments.reduce((total, seg) => total + seg.length(), 0);
}
```

## Configuration

All constants are centralized in `bezierConstants.ts`:

- `BEZIER_THRESHOLDS`: Hit detection distances
- `BEZIER_STYLES`: Colors, stroke widths, visual styling
- `BEZIER_HANDLES`: Control point generation parameters
- `BEZIER_TIMING`: Double-click timing, setTimeout delays
- `BEZIER_BOUNDS`: Padding, bounds calculation thresholds

**To change a threshold**: Edit the constant in `bezierConstants.ts`. All code references the constant, so the change applies everywhere.

## Testing

Current test coverage:
- ✅ `BezierState.test.ts` - Basic state transformations

Needed test coverage:
- ⬜ `BezierMath.test.ts` - Mathematical operations
- ⬜ `BezierBounds.test.ts` - Bounds calculations
- ⬜ Integration tests for full create/edit workflows
- ⬜ `BezierEditing.test.ts` - Event handling logic

## Performance Considerations

### Bounds Calculation

- Uses bezier-js `bbox()` for accurate curve bounds (not just anchor points)
- Only recalculates when points actually change
- `haveBoundsChanged()` checks prevent unnecessary updates

### Handle Generation

- Uses LRU cache in `BezierShapeUtil.getHandles()`
- Cache key based on points structure and edit mode
- Avoids regenerating handles on every render

### Event Handling

- Edit mode uses DOM event listeners with capture phase (`BezierEditModeHandler`)
- Tool states use TLDraw's StateNode hooks for tool-level events
- Logic only runs while a bezier shape is in edit mode
- Delegates heavy lifting to pure functions in the shared service layer (BezierState, BezierMath, BezierBounds)

## Common Pitfalls

### ❌ Don't: Mutate shape.props directly
```typescript
// BAD
shape.props.points.push(newPoint);
editor.updateShape(shape);
```

### ✅ Do: Create new objects
```typescript
// GOOD
const updatedShape = {
  ...shape,
  props: {
    ...shape.props,
    points: [...shape.props.points, newPoint]
  }
};
editor.updateShape(updatedShape);
```

### ❌ Don't: Forget to recalculate bounds
```typescript
// BAD - shape will have incorrect size
const newPoints = modifyPoints(shape.props.points);
editor.updateShape({...shape, props: {...shape.props, points: newPoints}});
```

### ✅ Do: Always recalculate after modifying points
```typescript
// GOOD
const newPoints = modifyPoints(shape.props.points);
const updatedShape = BezierBounds.recalculateShapeBounds(shape, newPoints);
editor.updateShape(updatedShape);
```

### ❌ Don't: Mix page and local coordinates
```typescript
// BAD - adding page coords to local coords
const newPoint = {
  x: pagePoint.x,  // Wrong! This is page coordinates
  y: pagePoint.y
};
shape.props.points.push(newPoint);
```

### ✅ Do: Convert to local coordinates first
```typescript
// GOOD
const localPoint = {
  x: pagePoint.x - shape.x,
  y: pagePoint.y - shape.y
};
const newPoints = [...shape.props.points, localPoint];
```

## Resources

- [Bezier-js Documentation](https://pomax.github.io/bezierjs/)
- [TLDraw StateNode Guide](https://tldraw.dev/docs/editor#state-nodes)
- [Cubic Bezier Curves (Primer)](https://pomax.github.io/bezierinfo/)

## Questions?

If you're working on the bezier system and have questions:

1. Check this document first
2. Look at JSDoc comments in the service classes
3. Enable `BEZIER_DEBUG = true` in `bezierConstants.ts` for detailed logging
4. Search for similar operations in the existing code
