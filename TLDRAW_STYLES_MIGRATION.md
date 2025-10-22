# Migrating to tldraw's Native Style System

## Overview

I've started integrating tldraw's native style system into the bezier shape. This replaces custom style properties with tldraw's standard `color`, `dash`, `size`, and `fill` styles.

## ✅ Completed Changes

### 1. Core Type Definitions Updated
- **BezierShape.tsx** - Shape type now uses `TLDefaultColorStyle`, `TLDefaultDashStyle`, `TLDefaultSizeStyle`, `TLDefaultFillStyle`
- **FlippableShapeUtil.ts** - Default props updated to use tldraw styles
- **defaultShapeProps.ts** - Constants updated to match tldraw's style system

### 2. Old vs New Properties

| Old Property | New Property | Type | Values |
|--------------|--------------|------|--------|
| `color: string` | `color: TLDefaultColorStyle` | Union | `'black' \| 'blue' \| 'green' \| 'grey' \| 'light-blue' \| 'light-green' \| 'light-red' \| 'light-violet' \| 'orange' \| 'red' \| 'violet' \| 'yellow'` |
| `fillColor: string` | *(removed)* | - | Color is determined by `color` + `fill` style |
| `strokeWidth: number` | `size: TLDefaultSizeStyle` | Union | `'s' \| 'm' \| 'l' \| 'xl'` |
| `fill: boolean` | `fill: TLDefaultFillStyle` | Union | `'none' \| 'semi' \| 'solid' \| 'pattern'` |
| *(new)* | `dash: TLDefaultDashStyle` | Union | `'draw' \| 'solid' \| 'dashed' \| 'dotted'` |

## 🚧 Remaining Work

### Files That Need Updates

#### 1. BezierPath.tsx Component
**Location:** `src/components/shapes/components/BezierPath.tsx`

**Current signature:**
```typescript
interface BezierPathProps {
  pathData: string
  color: string
  fillColor: string
  strokeWidth: number
  fill: boolean
  isClosed: boolean
  editMode: boolean
}
```

**Needs to become:**
```typescript
interface BezierPathProps {
  pathData: string
  color: TLDefaultColorStyle
  dash: TLDefaultDashStyle
  size: TLDefaultSizeStyle
  fill: TLDefaultFillStyle
  isClosed: boolean
  editMode: boolean
}
```

**Rendering changes needed:**
- Import `useDefaultColorTheme` from tldraw
- Import `getDefaultColorThemeForDefaultColorThemeColor` or similar helper
- Map `size` ('s', 'm', 'l', 'xl') to stroke width numbers
- Map `dash` to `stroke-dasharray` values
- Use tldraw's color theme to get actual color hex values
- Apply `fill` style properly ('none', 'semi', 'solid', 'pattern')

#### 2. BezierShape.tsx Component Method
**Location:** Line ~132 in `BezierShape.tsx`

**Update rendering:**
```typescript
override component(shape: BezierShape) {
  const { points, color, dash, size, fill, isClosed, editMode, ... } = shape.props

  // Need to map tldraw styles to rendering values
  const pathData = points.length >= 2 ? bezierPointsToPath(points, isClosed) : ''

  return (
    <HTMLContainer style={{ cursor: 'default' }}>
      <svg ...>
        <BezierPath
          pathData={pathData}
          color={color}
          dash={dash}
          size={size}
          fill={fill}
          isClosed={isClosed}
          editMode={!!editMode}
        />
        ...
      </svg>
    </HTMLContainer>
  )
}
```

#### 3. convertShapeToBezier.ts
**Location:** `src/components/shapes/utils/convertShapeToBezier.ts`

Lines that reference old properties need updates:
- Line 52: `const { w, h, color, fillColor, strokeWidth, fill, points, isClosed } = bezierData.props`
- Lines 68-76: Shape creation with old props
- Lines 164-167: Extracting shape props
- Lines 185-191: Creating bezier with old props

#### 4. GeometryConverter.ts (Stub)
**Location:** `src/store/modifiers/utils/GeometryConverter.ts`

Update return type to use new style properties.

### Style Value Mappings

#### Size to Stroke Width
```typescript
const STROKE_WIDTHS = {
  's': 2,
  'm': 3.5,
  'l': 5,
  'xl': 10,
}
```

#### Dash to SVG dash-array
```typescript
const DASH_PATTERNS = {
  'draw': 'none', // Hand-drawn style - needs special handling
  'solid': 'none',
  'dashed': '8 8',
  'dotted': '2 6',
}
```

#### Fill Styles
```typescript
const FILL_OPACITY = {
  'none': 0,
  'semi': 0.5,
  'solid': 1,
  'pattern': 1, // With pattern overlay
}
```

## Implementation Strategy

### Option 1: Complete Migration (Recommended)
1. Update BezierPath component to accept and render tldraw styles
2. Create style utility functions:
   - `getStrokeWidth(size: TLDefaultSizeStyle): number`
   - `getDashArray(dash: TLDefaultDashStyle): string`
   - `getFillOpacity(fill: TLDefaultFillStyle): number`
3. Update all shape creation/conversion code
4. Test thoroughly with tldraw's style panel

### Option 2: Backwards Compatibility Layer
Keep both old and new properties temporarily:
```typescript
color: TLDefaultColorStyle | string
size?: TLDefaultSizeStyle
strokeWidth?: number
// etc.
```

Then gradually migrate consumers.

## Benefits of Native Styles

✅ **Style Panel Integration** - Bezier shapes will work with tldraw's built-in style panel
✅ **Consistent UI** - Same styling as other tldraw shapes
✅ **Theme Support** - Automatic light/dark theme support
✅ **Export/Import** - Better compatibility with tldraw file format
✅ **Draw Style** - Access to tldraw's hand-drawn "draw" style
✅ **Pattern Fills** - Access to tldraw's pattern fill styles

## Testing Checklist

After completing migration:
- [ ] Bezier shapes render correctly with all color options
- [ ] All dash styles work (solid, dashed, dotted, draw)
- [ ] All size options render at correct stroke width
- [ ] Fill styles work (none, semi, solid, pattern)
- [ ] Style panel controls appear and function
- [ ] Existing shapes load correctly
- [ ] Shape creation uses default styles
- [ ] Edit mode still functions properly
- [ ] Export/import preserves styles

## Example: Complete BezierPath Component

```typescript
import { useDefaultColorTheme } from 'tldraw'
import type { TLDefaultColorStyle, TLDefaultDashStyle, TLDefaultSizeStyle, TLDefaultFillStyle } from '@tldraw/tlschema'

const STROKE_WIDTHS = { 's': 2, 'm': 3.5, 'l': 5, 'xl': 10 }
const DASH_ARRAYS = { 'solid': 'none', 'dashed': '8 8', 'dotted': '2 6', 'draw': 'none' }

export function BezierPath({
  pathData, color, dash, size, fill, isClosed, editMode
}: {
  pathData: string
  color: TLDefaultColorStyle
  dash: TLDefaultDashStyle
  size: TLDefaultSizeStyle
  fill: TLDefaultFillStyle
  isClosed: boolean
  editMode: boolean
}) {
  const theme = useDefaultColorTheme()

  const strokeWidth = STROKE_WIDTHS[size]
  const strokeDasharray = DASH_ARRAYS[dash]
  const strokeColor = theme[color].solid
  const fillColor = fill === 'none' ? 'none' : theme[color].fill
  const fillOpacity = fill === 'none' ? 0 : fill === 'semi' ? 0.5 : 1

  return (
    <path
      d={pathData}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      fill={fillColor}
      fillOpacity={fillOpacity}
      fillRule={isClosed ? 'evenodd' : 'nonzero'}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}
```

## Next Steps

1. Review this migration guide
2. Decide on implementation strategy
3. Update BezierPath component
4. Update all references to old properties
5. Test thoroughly
6. Update documentation

The core types are done - now we need to update the rendering layer!
