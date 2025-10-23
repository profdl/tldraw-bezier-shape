# Bezier Tool Features

## ✅ Complete Feature Set

The bezier tool now has **full path segment selection and editing functionality** enabled.

## Creating Bezier Curves

### Activate the Tool
- **Click** the bezier icon (first button) in the toolbar
- **Press `B`** on your keyboard

### Draw Points
1. **Click** to place anchor points
2. **Click and drag** to create curved segments with control handles
3. **Shift + Drag** - Constrains angles to 45° increments
4. **Ctrl/Cmd + Drag** - Creates asymmetric control handles (one-sided)

### Complete the Curve
- **Click near the first point** (when you have 3+ points) to close the curve
- **Press `C`** to manually close the curve
- **Press Enter** or **Double-click** to finish an open curve
- **Press Escape** to cancel

## Editing Bezier Curves

### Enter Edit Mode
- **Double-click** any bezier shape to enter edit mode
- You'll see anchor points and control handles

### Select Points
- **Click** an anchor point to select it (turns blue)
- **Shift + Click** to multi-select points
- **Click** a control handle to adjust it independently

### Segment Operations (Advanced)
✨ **Advanced curve editing:**

- **Double-click** on a curve segment to add a new point at that location
- **Drag** a segment to reshape the curve by adjusting control points
- **Selected segments** are highlighted with a dashed outline
- Segment operations allow for precise curve manipulation

### Point Operations
- **Drag** anchor points to move them
- **Drag** control handles to adjust curve shape
- **Alt + Drag** control handle for asymmetric adjustment
- **Double-click** an anchor point to toggle between smooth/corner
- **Delete/Backspace** removes selected points

### Keyboard Shortcuts in Edit Mode
- **Escape** or **Enter** - Exit edit mode
- **Delete/Backspace** - Remove selected points
- **Shift** - Multi-select points
- **Ctrl/Cmd** - Asymmetric handle adjustment during creation

## Advanced Features

### Segment Editing
- **Double-click** a curve segment to add a new anchor point
- **Drag** a segment directly to reshape the curve
- The tool automatically adjusts control points to maintain smooth curves

### Point Type Toggling
- **Double-click** an anchor point to convert:
  - **Smooth point** → **Corner point** (removes handles)
  - **Corner point** → **Smooth point** (adds handles)

### Multi-Point Selection
- **Shift + Click** multiple anchor points
- Operations (delete, move) apply to all selected points
- Selected points are highlighted in blue

### Point Addition
When in edit mode:
- **Double-click** any curve segment to add a point at that location
- The curve is automatically split at the click position
- New point inherits smooth curve characteristics from the segment

## Technical Details

### Components
✅ **BezierEditModeHandler** - DOM event handler for advanced editing
- Intercepts pointer events using DOM capture phase
- Handles double-click for point type toggling and segment point insertion
- Provides multi-point selection via shift-click
- Manages segment drag operations for curve reshaping

### Visual Feedback
- **Blue dots** - Selected anchor points
- **Gray dots** - Unselected anchor points
- **Small circles** - Control handles
- **Dashed highlight** - Selected segment (when dragging)

## Tips & Best Practices

1. **Double-click segments** to add points to existing curves
2. **Double-click anchor points** to toggle smooth/corner types
3. **Shift-select** multiple points for batch operations
4. **Drag with Ctrl** during creation for asymmetric handles (great for corners)
5. **Close curves** for filled shapes (click near start or press 'C')
6. **Drag segments** directly to reshape curves without adjusting individual handles
