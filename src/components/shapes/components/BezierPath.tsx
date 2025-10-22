import React from 'react'
import { BEZIER_STYLES } from '../utils/bezierConstants'

interface BezierPathProps {
  pathData: string
  color: string
  fillColor: string
  strokeWidth: number
  fill: boolean
  isClosed: boolean
  editMode: boolean
}

/**
 * Renders the main bezier curve path
 * Handles both fill and stroke rendering with appropriate styles
 */
export const BezierPath: React.FC<BezierPathProps> = ({
  pathData,
  color,
  fillColor,
  strokeWidth,
  fill,
  isClosed,
  editMode
}) => {
  // Don't render anything if no path data
  if (!pathData) return null

  return (
    <path
      d={pathData}
      fill={isClosed && fill ? fillColor : 'none'}
      fillRule="evenodd"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={undefined}
      opacity={editMode ? BEZIER_STYLES.EDIT_MODE_OPACITY : 1}
      style={{ cursor: 'inherit' }}
    />
  )
}
