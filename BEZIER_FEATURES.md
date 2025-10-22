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

### Segment Selection (Advanced)
✨ **New functionality now enabled:**

- **Alt + Hover** over a curve segment shows a preview point
- **Alt + Click** on a segment adds a new point at that location
- **Selected segments** are highlighted with a dashed outline
- Segment selection allows for precise curve manipulation

### Point Operations
- **Drag** anchor points to move them
- **Drag** control handles to adjust curve shape
- **Alt + Drag** control handle for asymmetric adjustment
- **Double-click** an anchor point to toggle between smooth/corner
- **Delete/Backspace** removes selected points

### Keyboard Shortcuts in Edit Mode
- **Escape** or **Enter** - Exit edit mode
- **Delete/Backspace** - Remove selected points
- **Alt** - Enable segment hover/selection mode
- **Shift** - Multi-select points
- **Ctrl/Cmd** - Asymmetric handle adjustment

## Advanced Features

### Segment Dragging
- Hold **Alt** while hovering over a curve segment
- See preview point where you can add a new anchor
- Click while holding **Alt** to add the point

### Point Type Toggling
- **Double-click** an anchor point to convert:
  - **Smooth point** → **Corner point** (removes handles)
  - **Corner point** → **Smooth point** (adds handles)

### Multi-Point Selection
- **Shift + Click** multiple anchor points
- Operations (delete, move) apply to all selected points
- Selected points are highlighted in blue

### Hover Preview
When in edit mode with the select tool:
- Move mouse over curve segments to see insertion preview
- Preview shows exact position where new point would be added
- Hover state is tracked per segment for precise control

## Technical Details

### Services Initialized
✅ **BezierEditModeService** - Global event handler for advanced editing
- Manages Alt+hover for segment selection
- Handles double-click for point type toggling
- Provides multi-point selection
- Tracks segment hover states

### Visual Feedback
- **Blue dots** - Selected anchor points
- **Gray dots** - Unselected anchor points
- **Small circles** - Control handles
- **Dashed highlight** - Selected segment
- **Ghost point** - Hover preview for point insertion

## Tips & Best Practices

1. **Use Alt key** for adding points to existing curves
2. **Double-click quickly** on anchor points to toggle smooth/corner
3. **Shift-select** multiple points for batch operations
4. **Drag with Ctrl** for asymmetric handles (great for corners)
5. **Close curves** for filled shapes (click near start or press 'C')
