import React from 'react'
import { useDefaultColorTheme } from 'tldraw'
import type { TLDefaultColorStyle, TLDefaultDashStyle, TLDefaultSizeStyle, TLDefaultFillStyle } from '@tldraw/tlschema'
import { BEZIER_STYLES } from '../utils/bezierConstants'
import { getStrokeWidth, getDashArray, getFillOpacity, shouldRenderFill } from '../utils/tldrawStyleUtils'

interface BezierPathProps {
  pathData: string
  color: TLDefaultColorStyle
  dash: TLDefaultDashStyle
  size: TLDefaultSizeStyle
  fill: TLDefaultFillStyle
  isClosed: boolean
  editMode: boolean
}

/**
 * Renders the main bezier curve path using tldraw's native style system
 * Handles both fill and stroke rendering with appropriate styles
 */
export const BezierPath: React.FC<BezierPathProps> = ({
  pathData,
  color,
  dash,
  size,
  fill,
  isClosed,
  editMode
}) => {
  const theme = useDefaultColorTheme()

  // Don't render anything if no path data
  if (!pathData) return null

  // Map tldraw styles to rendering values
  const strokeWidth = getStrokeWidth(size)
  const strokeDasharray = getDashArray(dash)
  const strokeColor = theme[color].solid
  const fillColor = theme[color].solid
  const fillOpacity = getFillOpacity(fill)
  const hasFill = isClosed && shouldRenderFill(fill)

  return (
    <path
      d={pathData}
      fill={hasFill ? fillColor : 'none'}
      fillOpacity={hasFill ? fillOpacity : 0}
      fillRule="evenodd"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={strokeDasharray}
      opacity={editMode ? BEZIER_STYLES.EDIT_MODE_OPACITY : 1}
      style={{ cursor: 'inherit' }}
    />
  )
}
