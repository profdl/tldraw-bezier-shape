import { StateNode, type TLStateNodeConstructor } from '@tldraw/editor'
import { Idle } from './toolStates/Idle'
import { Creating } from './toolStates/Creating'
import { Editing } from './toolStates/Editing'

/**
 * Tool for creating and editing bezier path shapes.
 *
 * @public
 * @remarks
 * The bezier tool implements a pen-tool style interface for creating vector paths.
 * It manages a state machine with three states:
 * - `Idle`: Waiting for user input
 * - `Creating`: Drawing a new bezier path
 * - `Editing`: Modifying an existing path's points
 *
 * User interactions:
 * - Click-drag: Create smooth bezier point with control handles
 * - Click: Create corner point (no control handles)
 * - Click near start: Close the path
 * - Double-click: Complete the path
 * - Escape/Enter: Exit creation mode
 * - Press 'C': Close current path
 *
 * The tool can be activated via:
 * - Toolbar button
 * - Keyboard shortcut ('b' by default)
 * - Programmatically: `editor.setCurrentTool('bezier')`
 *
 * @example
 * ```ts
 * // Register with tldraw
 * const customTools = [BezierShapeTool]
 *
 * <Tldraw tools={customTools} />
 * ```
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
