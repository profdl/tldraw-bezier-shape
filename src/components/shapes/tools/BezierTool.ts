import { StateNode, type TLStateNodeConstructor } from '@tldraw/editor'
import { BezierIdle } from './states/BezierIdle'
import { BezierCreating } from './states/BezierCreating'
import { BezierEditing } from './states/BezierEditing'

/**
 * Tool for creating and editing bezier path shapes.
 *
 * @public
 */
export class BezierTool extends StateNode {
  static override id = 'bezier'
  static override initial = 'idle'
  static override isLockable = false
  static override children(): TLStateNodeConstructor[] {
    return [BezierIdle, BezierCreating, BezierEditing]
  }

  override shapeType = 'bezier'

  override onEnter(info?: { extendingShapeId?: string; extendFromStart?: boolean }) {
    // Forward the info to the initial 'idle' child state
    // This allows us to pass extending shape info when switching tools
    this.transition('idle', info)
  }
}