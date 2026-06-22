import { arrayMove } from '@dnd-kit/sortable'

// Pure reorder for the profile dropdown's drag-sort: move `activeId` to where
// `overId` sits. No-op when the ids match or either is absent (a drag that ends
// off the list). Kept separate from the component so the reorder math is
// unit-testable without a DOM — mirrors the sibling order.ts helper.
export function reorderProfileNames(names: string[], activeId: string, overId: string): string[] {
  if (activeId === overId) {
    return names
  }

  const from = names.indexOf(activeId)
  const to = names.indexOf(overId)

  if (from < 0 || to < 0) {
    return names
  }

  return arrayMove(names, from, to)
}
