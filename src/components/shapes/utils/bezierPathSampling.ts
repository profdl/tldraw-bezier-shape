/**
 * Utility for sampling points along an SVG bezier path
 * Used to convert bezier curves into point arrays for draw style rendering
 */

interface Point {
  x: number
  y: number
}

/**
 * Sample points evenly along an SVG path
 * This converts the bezier curve into discrete points that can be fed to perfect-freehand
 *
 * @param pathData - SVG path data string
 * @param strokeWidth - Stroke width to determine sampling density
 * @returns Array of {x, y} point objects
 */
export function sampleBezierPath(pathData: string, strokeWidth: number): Array<{ x: number; y: number }> {
  // Create a temporary SVG path element to sample from
  const svgNS = 'http://www.w3.org/2000/svg'
  const path = document.createElementNS(svgNS, 'path')
  path.setAttribute('d', pathData)

  const totalLength = path.getTotalLength()

  // Sample more densely for thinner strokes to maintain smooth appearance
  // Base sample distance on stroke width (more samples = smoother curve)
  const baseSampleDistance = Math.max(strokeWidth * 0.5, 1)
  const numSamples = Math.ceil(totalLength / baseSampleDistance)

  const points: Array<{ x: number; y: number }> = []

  for (let i = 0; i <= numSamples; i++) {
    const distance = (i / numSamples) * totalLength
    const point = path.getPointAtLength(distance)
    points.push({ x: point.x, y: point.y })
  }

  return points
}

/**
 * Sample points along a bezier curve segment
 * Alternative approach that samples based on curve complexity
 *
 * @param p0 - Start point
 * @param p1 - First control point
 * @param p2 - Second control point
 * @param p3 - End point
 * @param samples - Number of samples (default: 20)
 * @returns Array of points
 */
export function sampleCubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  samples: number = 20
): Point[] {
  const points: Point[] = []

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    const t2 = t * t
    const t3 = t2 * t

    const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x
    const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y

    points.push({ x, y })
  }

  return points
}

/**
 * Sample points along a quadratic bezier curve segment
 *
 * @param p0 - Start point
 * @param p1 - Control point
 * @param p2 - End point
 * @param samples - Number of samples (default: 15)
 * @returns Array of points
 */
export function sampleQuadraticBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  samples: number = 15
): Point[] {
  const points: Point[] = []

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const mt = 1 - t

    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y

    points.push({ x, y })
  }

  return points
}
