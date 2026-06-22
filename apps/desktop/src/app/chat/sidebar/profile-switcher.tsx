import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { PROFILE_SWATCHES, profileColorSoft, resolveProfileColor } from '@/lib/profile-color'
import { cn } from '@/lib/utils'
import {
  $activeGatewayProfile,
  $profileColors,
  $profileCreateRequest,
  $profileOrder,
  $profiles,
  $profileScope,
  ALL_PROFILES,
  normalizeProfileKey,
  refreshActiveProfile,
  selectProfile,
  setProfileColor,
  setProfileOrder,
  setShowAllProfiles,
  sortByProfileOrder
} from '@/store/profile'
import type { ProfileInfo } from '@/types/hermes'

import { CreateProfileDialog } from '../../profiles/create-profile-dialog'
import { DeleteProfileDialog } from '../../profiles/delete-profile-dialog'
import { RenameProfileDialog } from '../../profiles/rename-profile-dialog'
import { PROFILES_ROUTE } from '../../routes'

import { reorderProfileNames } from './profile-reorder'

// easeOutBack — a little overshoot so squares spring into their new slot rather
// than sliding in flat. Neighbors reflow on RAIL_TRANSITION; the dragged square
// glides between snapped cells on the snappier DRAG_TRANSITION.
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const RAIL_TRANSITION = { duration: 300, easing: SPRING }
const DRAG_TRANSITION = `transform 200ms ${SPRING}`

// The dropdown list is a vertical strip, so pin drags to the y-axis (kill any
// x drift). Replaces the horizontal stepThroughCells modifier the rail used.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

// Profile rail at the sidebar foot: a default↔all toggle pinned left, a
// dropdown of the named profiles between, and Manage pinned right. The active
// profile shows in its own color on the dropdown trigger — the "where am I"
// cue. Single-profile users see the "+" (create their first profile) and the
// Manage overflow (edit the default profile's SOUL.md); the named-profile
// dropdown and the default↔all toggle only appear once a second profile exists.
export function ProfileRail() {
  const { t } = useI18n()
  const p = t.profiles
  const profiles = useStore($profiles)
  const scope = useStore($profileScope)
  const gatewayProfile = useStore($activeGatewayProfile)
  const order = useStore($profileOrder)
  const colors = useStore($profileColors)
  const navigate = useNavigate()

  const [createOpen, setCreateOpen] = useState(false)
  const [pendingRename, setPendingRename] = useState<null | ProfileInfo>(null)
  const [pendingDelete, setPendingDelete] = useState<null | ProfileInfo>(null)

  const isAll = scope === ALL_PROFILES
  const activeKey = normalizeProfileKey(gatewayProfile)
  const defaultProfile = profiles.find(profile => profile.is_default)
  const onDefault = !isAll && activeKey === 'default'

  const named = sortByProfileOrder(profiles.filter(profile => !profile.is_default), order)
  const multiProfile = profiles.length > 1

  // Re-pull the running profile + list on mount so a profile created elsewhere
  // shows up; cheap and best-effort.
  useEffect(() => {
    void refreshActiveProfile()
  }, [])

  // Open the create dialog when the `profile.create` hotkey fires (the dialog
  // state lives here, so the global keybind bumps a request atom we watch).
  const createRequest = useStore($profileCreateRequest)
  const lastCreateRef = useRef(createRequest)

  useEffect(() => {
    if (createRequest === lastCreateRef.current) {
      return
    }

    lastCreateRef.current = createRequest
    setCreateOpen(true)
  }, [createRequest])

  return (
    <div aria-label="Profiles" className="flex items-center gap-0.5" role="tablist">
      {/* One button toggles default ↔ all: home face when scoped to a profile,
          layers face when showing everything. Pinned left like Manage is right.
          Hidden until a second profile exists. */}
      {multiProfile &&
        (defaultProfile ? (
          // On default → toggle to all. Anywhere else (all view or a named
          // profile) → return to default. So leaving a profile never lands on all.
          <ProfilePill
            active={isAll || onDefault}
            glyph={isAll ? 'layers' : 'home'}
            label={onDefault ? p.showAllProfiles : p.switchToProfile(defaultProfile.name)}
            onSelect={() => (onDefault ? setShowAllProfiles(true) : selectProfile(defaultProfile.name))}
          />
        ) : (
          <ProfilePill active={isAll} glyph="layers" label={p.allProfiles} onSelect={() => setShowAllProfiles(true)} />
        ))}

      {/* Single-profile: the active default's home icon next to the create +. */}
      {!multiProfile && defaultProfile && (
        <ProfilePill
          active
          glyph="home"
          label={defaultProfile.name}
          onSelect={() => selectProfile(defaultProfile.name)}
        />
      )}

      {/* The dropdown replaces the horizontal letter-square strip. */}
      {multiProfile && (
        <ProfileDropdown
          activeKey={activeKey}
          colors={colors}
          isAll={isAll}
          named={named}
          onDelete={profile => setPendingDelete(profile)}
          onRecolor={(name, color) => setProfileColor(name, color)}
          onRename={profile => setPendingRename(profile)}
          onReorder={setProfileOrder}
          onSelect={selectProfile}
        />
      )}

      <Tip label={p.newProfile}>
        <button
          aria-label={p.newProfile}
          className="grid size-5 shrink-0 place-items-center rounded-[3px] text-(--ui-text-tertiary) opacity-55 transition hover:bg-(--ui-control-hover-background) hover:text-foreground hover:opacity-100"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <Codicon name="add" size="0.75rem" />
        </button>
      </Tip>

      {/* Always reachable, even with only the default profile: the manage
          overlay is the only place to edit a profile's SOUL.md, so a
          single-profile user must be able to edit the default's persona
          without first creating a throwaway second profile. */}
      <ProfilePill active={false} glyph="ellipsis" label={p.manageProfiles} onSelect={() => navigate(PROFILES_ROUTE)} />

      {/* Land in the new profile on a fresh chat (selectProfile triggers the
          new-session reset), not stuck on the session you were just in. */}
      <CreateProfileDialog
        onClose={() => setCreateOpen(false)}
        onCreated={async name => {
          await refreshActiveProfile()
          selectProfile(name)
        }}
        open={createOpen}
        profiles={profiles}
      />

      <RenameProfileDialog
        currentName={pendingRename?.name ?? ''}
        onClose={() => setPendingRename(null)}
        onRenamed={refreshActiveProfile}
        open={pendingRename !== null}
      />

      <DeleteProfileDialog
        onClose={() => setPendingDelete(null)}
        onDeleted={refreshActiveProfile}
        open={pendingDelete !== null}
        profile={pendingDelete}
      />
    </div>
  )
}

interface ProfilePillProps {
  active: boolean
  // home / All / Manage are glyph action buttons (navigation, not identity).
  glyph: string
  label: string
  onSelect: () => void
}

function ProfilePill({ active, glyph, label, onSelect }: ProfilePillProps) {
  return (
    <Tip label={label}>
      <Button
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'bg-transparent text-(--ui-text-tertiary) hover:bg-(--ui-control-hover-background) hover:text-foreground',
          active && 'bg-(--ui-control-active-background) text-foreground'
        )}
        onClick={onSelect}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Codicon name={glyph} size="0.875rem" />
      </Button>
    </Tip>
  )
}

// Hold this long without moving (a drag would have started first) to open the
// color picker — the "hard press" gesture, distinct from tap-to-select.
const LONG_PRESS_MS = 450

interface ProfileRowProps {
  active: boolean
  color: null | string
  label: string
  onSelect: () => void
  onRecolor: (color: null | string) => void
  onRename: () => void
  onDelete: () => void
}

// A profile as a full-width row inside the dropdown: a color dot + the full
// name + a check on the active one. Drag-sort to reorder (a tap under the drag
// threshold still selects), long-press or right-click to recolor/rename/delete
// — the same gesture set the old letter-square carried, just laid out as a row.
function ProfileRow({ active, color, label, onDelete, onRecolor, onRename, onSelect }: ProfileRowProps) {
  const { t } = useI18n()
  const p = t.profiles
  const hue = color ?? 'var(--ui-text-quaternary)'
  const [pickerOpen, setPickerOpen] = useState(false)
  const pressTimer = useRef<null | number>(null)
  const suppressClick = useRef(false)

  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: label,
    transition: RAIL_TRANSITION
  })

  const clearPress = () => {
    if (pressTimer.current != null) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  useEffect(() => {
    if (isDragging) {
      clearPress()
    }
  }, [isDragging])
  useEffect(() => clearPress, [])

  const base = CSS.Transform.toString(transform)
  const lift = isDragging ? '0 6px 16px -4px rgb(0 0 0 / 0.4)' : undefined

  const pickColor = (next: null | string) => {
    onRecolor(next)
    setPickerOpen(false)
    triggerHaptic('selection')
  }

  return (
    <Popover onOpenChange={setPickerOpen} open={pickerOpen}>
      <ContextMenu>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <PopoverAnchor asChild>
              <ContextMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'flex w-full cursor-grab touch-none select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs leading-none transition-colors hover:bg-(--ui-control-hover-background)',
                      active && 'bg-(--ui-control-active-background)',
                      isDragging && 'z-10 cursor-grabbing'
                    )}
                    ref={setNodeRef}
                    style={{
                      boxShadow: lift,
                      transform: base,
                      transition: isDragging ? DRAG_TRANSITION : transition
                    }}
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label={label}
                    aria-pressed={active}
                    onClick={() => {
                      if (suppressClick.current) {
                        suppressClick.current = false

                        return
                      }

                      onSelect()
                    }}
                    onPointerCancel={clearPress}
                    onPointerDown={event => {
                      listeners?.onPointerDown?.(event)

                      if (event.button !== 0) {
                        return
                      }

                      suppressClick.current = false
                      clearPress()
                      pressTimer.current = window.setTimeout(() => {
                        suppressClick.current = true
                        triggerHaptic('success')
                        setPickerOpen(true)
                      }, LONG_PRESS_MS)
                    }}
                    onPointerLeave={clearPress}
                    onPointerUp={clearPress}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: profileColorSoft(hue, active ? 70 : 45), boxShadow: `inset 0 0 0 1px ${hue}` }}
                    />
                    <span className="flex-1 truncate text-left" style={{ color: active ? undefined : 'var(--ui-text-secondary)' }}>
                      {label}
                    </span>
                    {active && <Codicon name="check" size="0.75rem" />}
                  </button>
                </TooltipTrigger>
              </ContextMenuTrigger>
            </PopoverAnchor>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ContextMenuContent
          aria-label={p.actionsFor(label)}
          className="w-40"
          collisionPadding={{ bottom: 44, left: 8, right: 8, top: 8 }}
          onCloseAutoFocus={event => event.preventDefault()}
        >
          <ContextMenuItem onSelect={() => setPickerOpen(true)}>
            <Codicon name="symbol-color" size="0.875rem" />
            <span>{p.color}</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={onRename}>
            <Codicon name="edit" size="0.875rem" />
            <span>{p.rename}</span>
          </ContextMenuItem>
          <ContextMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete} variant="destructive">
            <Codicon name="trash" size="0.875rem" />
            <span>{t.common.delete}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <PopoverContent aria-label={p.colorFor(label)} className="w-auto p-2" collisionPadding={{ bottom: 44, left: 8, right: 8, top: 8 }} side="right">
        <div className="grid grid-cols-6 gap-1.5">
          {PROFILE_SWATCHES.map(swatch => (
            <button
              aria-label={p.setColor(swatch)}
              className="size-5 rounded-full transition-transform hover:scale-110"
              key={swatch}
              onClick={() => pickColor(swatch)}
              style={{
                backgroundColor: swatch,
                boxShadow: swatch === color ? '0 0 0 2px var(--ui-bg-elevated), 0 0 0 3.5px currentColor' : undefined,
                color: swatch
              }}
              type="button"
            />
          ))}
        </div>
        <button
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-xs text-(--ui-text-tertiary) transition hover:bg-(--ui-control-hover-background) hover:text-foreground"
          onClick={() => pickColor(null)}
          type="button"
        >
          <Codicon name="sync" size="0.75rem" />
          {p.autoColor}
        </button>
      </PopoverContent>
    </Popover>
  )
}

type ProfileDropdownProps = ProfileListProps

// The control that replaces the letter-square strip: a Popover whose trigger
// shows the active named profile (color dot + name, or a neutral "Profiles"
// label when the active context is default/all), opening a vertical list of
// every named profile. Selecting closes the panel.
function ProfileDropdown({ activeKey, colors, isAll, named, onDelete, onRecolor, onRename, onReorder, onSelect }: ProfileDropdownProps) {
  const { t } = useI18n()
  const p = t.profiles
  const [open, setOpen] = useState(false)

  const activeNamed = isAll ? null : named.find(profile => normalizeProfileKey(profile.name) === activeKey) ?? null
  const triggerColor = activeNamed ? resolveProfileColor(activeNamed.name, colors) : null
  const triggerLabel = activeNamed ? activeNamed.name : p.title

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Tip label={p.switchToProfile(triggerLabel)}>
        <PopoverTrigger asChild>
          <button
            aria-label={p.title}
            className={cn(
              'flex h-6 min-w-0 max-w-40 flex-1 items-center gap-1.5 rounded-md px-1.5 text-xs text-(--ui-text-tertiary) transition hover:bg-(--ui-control-hover-background) hover:text-foreground',
              activeNamed && 'text-foreground'
            )}
            type="button"
          >
            {triggerColor && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: triggerColor }} />}
            <span className="flex-1 truncate text-left">{triggerLabel}</span>
            <Codicon name="chevron-down" size="0.625rem" />
          </button>
        </PopoverTrigger>
      </Tip>

      <PopoverContent align="start" className="w-56 p-1" collisionPadding={{ bottom: 44, left: 8, right: 8, top: 8 }} side="top">
        <ProfileList
          activeKey={activeKey}
          colors={colors}
          isAll={isAll}
          named={named}
          onDelete={onDelete}
          onRecolor={onRecolor}
          onRename={onRename}
          onReorder={onReorder}
          onSelect={name => {
            onSelect(name)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

interface ProfileListProps {
  named: ProfileInfo[]
  activeKey: string
  isAll: boolean
  colors: Record<string, string>
  onReorder: (names: string[]) => void
  onSelect: (name: string) => void
  onRecolor: (name: string, color: null | string) => void
  onRename: (profile: ProfileInfo) => void
  onDelete: (profile: ProfileInfo) => void
}

// The vertical sortable list rendered inside the dropdown panel. Drag a row to
// reorder (committed via reorderProfileNames → onReorder), tap to select.
export function ProfileList({ activeKey, colors, isAll, named, onDelete, onRecolor, onRename, onReorder, onSelect }: ProfileListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const lastOverRef = useRef<string | null>(null)

  const handleDragStart = ({ active }: DragStartEvent) => {
    lastOverRef.current = String(active.id)
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    const id = over ? String(over.id) : null

    if (id && id !== lastOverRef.current) {
      lastOverRef.current = id
      triggerHaptic('selection')
    }
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    lastOverRef.current = null

    if (!over || active.id === over.id) {
      return
    }

    const next = reorderProfileNames(named.map(profile => profile.name), String(active.id), String(over.id))
    onReorder(next)
    triggerHaptic('success')
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext items={named.map(profile => profile.name)} strategy={verticalListSortingStrategy}>
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto [scrollbar-width:thin]">
          {named.map(profile => (
            <ProfileRow
              active={!isAll && normalizeProfileKey(profile.name) === activeKey}
              color={resolveProfileColor(profile.name, colors)}
              key={profile.name}
              label={profile.name}
              onDelete={() => onDelete(profile)}
              onRecolor={color => onRecolor(profile.name, color)}
              onRename={() => onRename(profile)}
              onSelect={() => onSelect(profile.name)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
