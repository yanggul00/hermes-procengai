// apps/desktop/src/app/chat/sidebar/profile-switcher.test.tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import type { ProfileInfo } from '@/types/hermes'

import { ProfileList } from './profile-switcher'

const named: ProfileInfo[] = [
  { name: 'engineering', is_default: false } as ProfileInfo,
  { name: 'analytics', is_default: false } as ProfileInfo
]

function renderList(overrides: Partial<Parameters<typeof ProfileList>[0]> = {}) {
  const onSelect = vi.fn()

  render(
    <I18nProvider configClient={null} initialLocale="en">
      <ProfileList
        activeKey="engineering"
        colors={{}}
        isAll={false}
        named={named}
        onDelete={vi.fn()}
        onRecolor={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onSelect={onSelect}
        {...overrides}
      />
    </I18nProvider>
  )

  return { onSelect }
}

describe('ProfileList', () => {
  afterEach(() => {
    cleanup()
  })

  it('lists every named profile by its full name', () => {
    renderList()

    expect(screen.getByText('engineering')).toBeTruthy()
    expect(screen.getByText('analytics')).toBeTruthy()
  })

  it('selects a profile when its row is clicked', () => {
    const { onSelect } = renderList()

    fireEvent.click(screen.getByRole('button', { name: 'analytics' }))

    expect(onSelect).toHaveBeenCalledWith('analytics')
  })
})
