import React from 'react'
import { type BezierPoint } from '../BezierShape'
import { BEZIER_STYLES, BEZIER_THRESHOLDS } from '../utils/bezierConstants'

interface BezierControlPointsProps {
  points: BezierPoint[]
  selectedPointIndices: number[]
}

/**
 * Renders control points and connection lines for bezier curve editing
 * Shows anchor points, control point handles, and connection lines
 */
export const BezierControlPoints: React.FC<BezierControlPointsProps> = ({
  points,
  selectedPointIndices
}) => {
  return (
    <g opacity={BEZIER_STYLES.CONTROL_OPACITY}>
      {points.map((point, i) => {
        const isSelected = selectedPointIndices.includes(i)

        return (
          <g key={i}>
          {/* Control point lines - draw these first so they appear behind the circles */}
          {point.cp1 && (
            <line
              x1={point.x}
              y1={point.y}
              x2={point.cp1.x}
              y2={point.cp1.y}
              stroke={BEZIER_STYLES.CONTROL_LINE_COLOR}
              strokeWidth={BEZIER_STYLES.CONTROL_LINE_WIDTH}
              strokeDasharray={BEZIER_STYLES.CONTROL_LINE_DASH}
              opacity={0.5}
            />
          )}
          {point.cp2 && (
            <line
              x1={point.x}
              y1={point.y}
              x2={point.cp2.x}
              y2={point.cp2.y}
              stroke={BEZIER_STYLES.CONTROL_LINE_COLOR}
              strokeWidth={BEZIER_STYLES.CONTROL_LINE_WIDTH}
              strokeDasharray={BEZIER_STYLES.CONTROL_LINE_DASH}
              opacity={0.5}
            />
          )}
          
          {/* Control point handles */}
          {point.cp1 && (
            <circle
              cx={point.cp1.x}
              cy={point.cp1.y}
              r={isSelected ? BEZIER_THRESHOLDS.CONTROL_RADIUS_SELECTED : BEZIER_THRESHOLDS.CONTROL_RADIUS}
              fill={isSelected ? BEZIER_STYLES.CONTROL_POINT_FILL_SELECTED : BEZIER_STYLES.CONTROL_POINT_FILL}
              stroke={isSelected ? BEZIER_STYLES.CONTROL_POINT_STROKE_SELECTED : BEZIER_STYLES.CONTROL_POINT_STROKE}
              strokeWidth={isSelected ? BEZIER_STYLES.CONTROL_STROKE_SELECTED : BEZIER_STYLES.CONTROL_STROKE}
            />
          )}
          {point.cp2 && (
            <circle
              cx={point.cp2.x}
              cy={point.cp2.y}
              r={isSelected ? BEZIER_THRESHOLDS.CONTROL_RADIUS_SELECTED : BEZIER_THRESHOLDS.CONTROL_RADIUS}
              fill={isSelected ? BEZIER_STYLES.CONTROL_POINT_FILL_SELECTED : BEZIER_STYLES.CONTROL_POINT_FILL}
              stroke={isSelected ? BEZIER_STYLES.CONTROL_POINT_STROKE_SELECTED : BEZIER_STYLES.CONTROL_POINT_STROKE}
              strokeWidth={isSelected ? BEZIER_STYLES.CONTROL_STROKE_SELECTED : BEZIER_STYLES.CONTROL_STROKE}
            />
          )}
          
          {/* Anchor points - draw these last so they appear on top */}
          <circle
            cx={point.x}
            cy={point.y}
            r={isSelected ? BEZIER_THRESHOLDS.ANCHOR_RADIUS_SELECTED : BEZIER_THRESHOLDS.ANCHOR_RADIUS}
            fill={isSelected ? BEZIER_STYLES.ANCHOR_POINT_FILL_SELECTED : BEZIER_STYLES.ANCHOR_POINT_FILL}
            stroke={isSelected ? BEZIER_STYLES.ANCHOR_POINT_STROKE_SELECTED : BEZIER_STYLES.ANCHOR_POINT_STROKE}
            strokeWidth={isSelected ? BEZIER_STYLES.ANCHOR_STROKE_SELECTED : BEZIER_STYLES.ANCHOR_STROKE}
            style={{ cursor: 'pointer' }}
          />
          </g>
        )
      })}
    </g>
  )
}
