import { BaseBoxShapeUtil, type TLBaseBoxShape } from 'tldraw'

/**
 * Base class for shapes that support flipping
 * Extends tldraw's BaseBoxShapeUtil with flip tracking
 */
export abstract class FlippableShapeUtil<
  Shape extends TLBaseBoxShape
> extends BaseBoxShapeUtil<Shape> {

  /**
   * Get common default props including color, fill, and stroke
   */
  protected getCommonDefaultProps() {
    return {
      color: 'black',
      fillColor: 'none',
      strokeWidth: 2,
      fill: false,
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
