import { describe, expect, it } from 'vitest'

import { reorderProfileNames } from './profile-reorder'

describe('reorderProfileNames', () => {
  it('moves the dragged name into the over slot', () => {
    expect(reorderProfileNames(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
  })

  it('returns the same order when active and over are the same', () => {
    expect(reorderProfileNames(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
  })

  it('leaves the order unchanged when an id is not in the list', () => {
    expect(reorderProfileNames(['a', 'b'], 'a', 'missing')).toEqual(['a', 'b'])
  })
})
