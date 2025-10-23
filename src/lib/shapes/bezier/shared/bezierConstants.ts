/**
 * Configuration constants for the Bezier shape system
 */

// Debug mode - set to true to enable console logging
export const BEZIER_DEBUG = false

// Interaction thresholds (in pixels, will be scaled by zoom level)
export const BEZIER_THRESHOLDS = {
  // Point selection/hover detection
  ANCHOR_POINT: 10, // Increased from 5 for more reliable clicking
  ANCHOR_POINT_HOVER: 12, // Increased from 7
  CONTROL_POINT: 8, // Increased from 5

  // Segment interaction
  SEGMENT_HOVER: 8,
  SEGMENT_CLICK: 10,
  PATH_SEGMENT: 10,
  SEGMENT_ANCHOR_EXCLUSION: 15, // Increased from 12 - Don't show segment hover near anchors
  
  // Snap behavior for closing curves
  SNAP_TO_START: 12,
  SNAP_RELEASE: 15,
  CLOSE_CURVE: 10,
  
  // Drag behavior
  CORNER_POINT_DRAG: 3, // Pixels before creating control points
  
  // Visual sizes
  ANCHOR_RADIUS: 4,
  ANCHOR_RADIUS_SELECTED: 4,
  CONTROL_RADIUS: 2.2,
  CONTROL_RADIUS_SELECTED: 3.2,
  HOVER_PREVIEW_RADIUS: 2.4,
  HOVER_PREVIEW_RING: 5,
} as const

// Visual styles
export const BEZIER_STYLES = {
  // Colors
  CONTROL_LINE_COLOR: '#34a0ff',
  CONTROL_POINT_STROKE: '#34a0ff',
  CONTROL_POINT_FILL: 'white',
  CONTROL_POINT_FILL_SELECTED: '#34a0ff',
  CONTROL_POINT_STROKE_SELECTED: '#ffffff',
  ANCHOR_POINT_FILL: 'white',
  ANCHOR_POINT_STROKE: '#34a0ff',
  ANCHOR_POINT_FILL_SELECTED: '#34a0ff',
  ANCHOR_POINT_STROKE_SELECTED: '#ffffff',
  HOVER_PREVIEW_COLOR: '#00ff88',
  
  // Stroke styles
  CONTROL_LINE_WIDTH: 1.5,
  CONTROL_LINE_DASH: '2 2',
  EDIT_MODE_DASH: '5 3',
  EDIT_MODE_OPACITY: 0.7,
  CONTROL_OPACITY: 1,
  HOVER_OPACITY: 0.9,
  HOVER_RING_OPACITY: 0.4,
  SEGMENT_HIGHLIGHT_COLOR: '#ff9800',
  SEGMENT_HIGHLIGHT_WIDTH: 3,
  SEGMENT_HIGHLIGHT_OPACITY: 0.9,
  SEGMENT_HIGHLIGHT_DASH: 'none',
  
  // Stroke widths
  ANCHOR_STROKE: 1.4,
  ANCHOR_STROKE_SELECTED: 0,
  CONTROL_STROKE: 0.9,
  CONTROL_STROKE_SELECTED: 0,
  HOVER_PREVIEW_STROKE: 1.2,
  HOVER_RING_STROKE: 1,
} as const

/**
 * Handle generation and control point positioning constants.
 *
 * These values control how control points are automatically generated when:
 * - Converting corner points to smooth points
 * - Adding new points to a curve
 * - Closing a path with smooth continuity
 */
export const BEZIER_HANDLES = {
  DEFAULT_CONTROL_OFFSET: 100,    // Default distance (pixels) for new control points when creating smooth points
  CONTROL_POINT_SCALE: 0.3,       // Scale factor (0-1) for auto-generated control points relative to neighbor distance
  SEGMENT_HANDLE_LENGTH: 0.15,    // Handle length as fraction (0.15 = 15%) of curve length when splitting segments
} as const

/**
 * Stroke size mapping following tldraw's native pattern.
 * Maps size style to stroke width in pixels.
 */
export const STROKE_SIZES = {
  s: 2,
  m: 3.5,
  l: 5,
  xl: 10,
} as const

/**
 * Timing constants for interaction behavior.
 *
 * These control the temporal aspects of user interactions like double-clicks
 * and UI update delays.
 */
export const BEZIER_TIMING = {
  DOUBLE_CLICK_THRESHOLD: 300,    // Maximum milliseconds between clicks to register as double-click
  DOUBLE_CLICK_DISTANCE: 5,       // Maximum pixel movement between clicks to register as double-click
  TRANSFORM_CONTROLS_DELAY: 50,   // Delay (ms) before refreshing transform controls after closing curve
  TRANSFORM_CONTROLS_INIT: 10,    // Delay (ms) for initializing transform controls after curve completion
} as const

/**
 * Bounds calculation constants.
 *
 * These control how bounding boxes are calculated during shape creation and editing.
 */
export const BEZIER_BOUNDS = {
  SINGLE_POINT_PADDING: 50,       // Padding (pixels) around single-point shapes to prevent jumping
  MULTI_POINT_PADDING: 10,        // Padding (pixels) around multi-point shapes for visual breathing room
  BOUNDS_CHANGE_THRESHOLD: 0.01,  // Minimum change (pixels) to trigger bounds recalculation
  EDIT_MODE_EXIT_PADDING: 20,     // Padding (pixels) around shape bounds to prevent accidental exit when selecting edge points
} as const

/**
 * Utility functions for debug logging.
 *
 * These provide categorized logging that can be toggled on/off via BEZIER_DEBUG.
 * Categories help filter log output when debugging specific subsystems.
 */

/**
 * Log a debug message if BEZIER_DEBUG is enabled.
 *
 * @param category - Log category (e.g., 'Selection', 'PointAdd', 'Drag')
 * @param args - Arguments to log
 *
 * @example
 * ```ts
 * bezierLog('Selection', 'Point selected:', pointIndex)
 * // Output when BEZIER_DEBUG=true: [Bezier:Selection] Point selected: 3
 * ```
 */
export function bezierLog(category: string, ...args: unknown[]): void {
  if (BEZIER_DEBUG) {
    console.log(`[Bezier:${category}]`, ...args)
  }
}

/**
 * Log a warning message if BEZIER_DEBUG is enabled.
 *
 * @param category - Warning category (e.g., 'Bounds', 'State', 'Math')
 * @param args - Arguments to log as warning
 *
 * @example
 * ```ts
 * bezierWarn('Bounds', 'Invalid bounds detected:', bounds)
 * // Output when BEZIER_DEBUG=true: [Bezier:Bounds] Invalid bounds detected: {...}
 * ```
 */
export function bezierWarn(category: string, ...args: unknown[]): void {
  if (BEZIER_DEBUG) {
    console.warn(`[Bezier:${category}]`, ...args)
  }
}
