import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { saveSessionPdf } from '@/lib/session-pdf'
import { printSessionPdf } from '@/lib/session-print'
import { $selectedStoredSessionId, $sessions } from '@/store/session'

// Wire the native right-click "Print"/"Save" items (main.cjs context menu) to
// the active session. Silent no-op when there is no active session (the menu is
// shown app-wide; right-clicking outside a chat should do nothing, not error).
export function useContextActions(): void {
  const storedId = useStore($selectedStoredSessionId)
  const sessions = useStore($sessions)

  useEffect(() => {
    if (!window.hermesDesktop?.onContextAction) {
      return
    }

    return window.hermesDesktop.onContextAction(({ action }) => {
      if (!storedId) {
        return
      }

      const active = sessions.find(session => session.id === storedId)
      const opts = { profile: active?.profile, title: active?.title }

      if (action === 'save') {
        void saveSessionPdf(storedId, opts)
      } else {
        void printSessionPdf(storedId, opts)
      }
    })
  }, [storedId, sessions])
}
