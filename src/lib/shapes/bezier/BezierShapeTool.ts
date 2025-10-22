import { StateNode, type TLStateNodeConstructor } from '@tldraw/editor'
import { Idle } from './toolStates/Idle'
import { Creating } from './toolStates/Creating'
import { Editing } from './toolStates/Editing'

/**
 * Tool for creating and editing bezier path shapes.
 *
 * @public
 */
export class BezierShapeTool extends StateNode {
  static override id = 'bezier'
  static override initial = 'idle'
  static override isLockable = false
  static override children(): TLStateNodeConstructor[] {
    return [Idle, Creating, Editing]
  }

  override shapeType = 'bezier'

  override onEnter(info?: { extendingShapeId?: string; extendFromStart?: boolean }) {
    // Forward the info to the initial 'idle' child state
    // This allows us to pass extending shape info when switching tools
    this.transition('idle', info)
  }
}
