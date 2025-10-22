import { BaseBoxShapeUtil, type TLBaseBoxShape } from 'tldraw'

/**
 * Base class for shapes that support flipping
 * Extends tldraw's BaseBoxShapeUtil with flip tracking
 */
export abstract class FlippableShapeUtil<
  Shape extends TLBaseBoxShape
> extends BaseBoxShapeUtil<Shape> {

  /**
   * Get common default props using tldraw's native style system
   */
  protected getCommonDefaultProps() {
    return {
      color: 'black' as const,
      dash: 'solid' as const,
      size: 'm' as const,
      fill: 'none' as const,
    }
  }

  /**
   * Custom flip handler - override in subclasses
   */
  protected onFlipCustom?(
    shape: Shape,
    direction: 'horizontal' | 'vertical',
    isFlippedX: boolean,
    isFlippedY: boolean
  ): Shape
}
