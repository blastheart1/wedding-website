'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { CREDIT_CHANGES, CREDIT_GROUPS, CREDIT_LICENCE, CREDIT_THANKS } from '@/lib/credits'

/**
 * A small chalkboard on the coffee bar's wall. Pressed, it grows into the
 * list of people whose 3D models the site uses, as their licence asks.
 */
export function CreditsBoard() {
  const [open, setOpen] = useState(false)
  const board = useRef<HTMLDivElement>(null)
  const sign = useRef<HTMLButtonElement>(null)
  const id = useId()

  // Escape puts the board away first, before it would fold the whole corner back.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      sign.current?.focus()
    }
    const onDown = (event: PointerEvent) => { if (!board.current?.contains(event.target as Node) && event.target !== sign.current) setOpen(false) }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  return (
    <>
      <button ref={sign} type="button" className="peel-credits-sign" aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)}>
        Credits
      </button>
      {open && (
        <div ref={board} id={id} className="peel-credits-board" role="region" aria-label="Credits">
          <button type="button" className="peel-credits-close" onClick={() => { setOpen(false); sign.current?.focus() }} aria-label="Put the credits away">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <p className="peel-credits-title">With thanks to</p>
          {CREDIT_GROUPS.map(group => (
            <section key={group.heading}>
              <h3>{group.heading}</h3>
              <ul>
                {group.models.map(model => (
                  <li key={model.url}>
                    <a href={model.url} target="_blank" rel="noopener noreferrer">{model.title}</a> by {model.author}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="peel-credits-note">
            3D models from Sketchfab, used under <a href={CREDIT_LICENCE.url} target="_blank" rel="noopener noreferrer license">{CREDIT_LICENCE.name}</a>. {CREDIT_CHANGES}
          </p>
          <p className="peel-credits-note">{CREDIT_THANKS}</p>
        </div>
      )}
    </>
  )
}
