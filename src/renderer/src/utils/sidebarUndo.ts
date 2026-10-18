export type UndoOp =
  | { kind: 'rename'; oldPath: string; newPath: string }
  | { kind: 'move'; oldPath: string; newPath: string }
  | { kind: 'delete'; trashId: string }

const MAX_UNDO = 20
const stack: UndoOp[] = []

export function pushUndo(op: UndoOp): void {
  stack.push(op)
  if (stack.length > MAX_UNDO) stack.shift()
}

export function popUndo(): UndoOp | undefined {
  return stack.pop()
}
