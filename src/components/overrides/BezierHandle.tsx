import { DefaultHandle, useEditor, type TLHandleProps } from 'tldraw'

/**
 * Custom handle renderer that hides tldraw's default handle visuals
 * for bezier shapes in edit mode. This allows our bespoke anchors /
 * control points to remain visible while retaining the hit area and
 * interaction behaviour provided by the default handles.
 */
export function BezierHandle(props: TLHandleProps) {
  const editor = useEditor()
  const shape = editor.getShape(props.shapeId)

  const isBezierInEditMode =
    shape?.type === 'bezier' && 'editMode' in shape.props && shape.props.editMode

  if (!isBezierInEditMode) {
    return <DefaultHandle {...props} />
  }

  const radius =
    (props.isCoarse ? editor.options.coarseHandleRadius : editor.options.handleRadius) /
    Math.max(props.zoom, 0.25)

  return (
    <g className={`tl-handle tl-handle__${props.handle.type}`}>
      <circle
        className="tl-handle__bg"
        r={radius}
        fill="transparent"
        stroke="transparent"
        style={{ pointerEvents: 'all' }}
      />
    </g>
  )
}
