import { createShapeId, type TLShapeId } from 'tldraw'

/**
 * Store for tracking transient shapes during creation
 * Transient shapes are temporary shapes that can be cancelled
 */

interface TransientSession {
  shapeId: TLShapeId
  toolId: string
  shapeType: string
}

interface TransientShapeStore {
  session: TransientSession | null
  startSession: (toolId: string, shapeType: string) => TLShapeId
  bindShape: (shapeId: TLShapeId) => void
  finalizeSession: () => void
  cancelSession: () => void
}

export const useTransientShapeStore: {
  getState: () => TransientShapeStore
} = {
  getState: () => ({
    session: null,
    startSession: (_toolId: string, _shapeType: string) => {
      return createShapeId()
    },
    bindShape: (_shapeId: TLShapeId) => {
      // No-op for now
    },
    finalizeSession: () => {
      // No-op for now
    },
    cancelSession: () => {
      // No-op for now
    },
  }),
}
