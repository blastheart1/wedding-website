'use client'

import { useId, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { MAX_PLUS_ONES, checkPlusOnes, parsePastedPlusOnes, splitNames } from '@/lib/invitations/plus-ones'
import { labelClass } from '@/app/admin/_ui/primitives'

interface PlusOnesFieldProps {
  label?: string
  names: readonly string[]
  onChange: (names: string[]) => void
  /** The guest these plus ones belong to, so a plus one is never given the guest's own name. */
  guestName?: string
}

/**
 * The people the couple names as a guest's plus ones. Type a name and a comma
 * (or press Enter) and it becomes a pill; paste the couple's own list, with or
 * without its leading "2:", and each name becomes a pill.
 */
export function PlusOnesField({ label = 'Plus ones (people they may bring)', names, onChange, guestName }: PlusOnesFieldProps) {
  const [text, setText] = useState('')
  const [problem, setProblem] = useState('')
  const id = useId()

  /** Adds names to the list; returns whether they were all accepted. */
  const add = (incoming: readonly string[]): boolean => {
    if (!incoming.length) return true
    const checked = checkPlusOnes([...names, ...incoming], guestName)
    if (!checked.ok) { setProblem(checked.message); return false }
    setProblem('')
    onChange(checked.names)
    return true
  }
  const commit = () => { if (add(splitNames(text))) setText('') }
  const change = (value: string) => {
    // A pasted list keeps its count in front ("2: A, B"), which is checked rather than typed into a pill.
    if (/^\s*\d{1,2}\s*:/.test(value) && /[,;\n]/.test(value)) {
      const pasted = parsePastedPlusOnes(value)
      if (!pasted.ok) { setText(value); setProblem(pasted.message); return }
      if (add(pasted.names)) setText('')
      return
    }
    if (!/[,;\n]/.test(value)) { setText(value); setProblem(''); return }
    const pieces = value.split(/[,;\n]/)
    const rest = pieces.pop() ?? ''
    if (add(pieces.map(piece => piece.trim()).filter(Boolean))) setText(rest.trimStart())
    else setText(value)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); commit() }
    else if (event.key === 'Backspace' && !text && names.length) onChange(names.slice(0, -1))
  }

  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-black/[0.045] p-2 focus-within:ring-2 focus-within:ring-black/20">
        {names.map(name => (
          <span key={name} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#2E1F1A] py-1 pl-3 pr-1 text-[14px] text-white">
            <span className="break-words">{name}</span>
            <button type="button" onClick={() => onChange(names.filter(other => other !== name))} aria-label={`Remove ${name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current">
              <X size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={event => change(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          disabled={names.length >= MAX_PLUS_ONES}
          placeholder={names.length ? 'Add another name' : 'Type a name, then a comma'}
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="words"
          className={clsx('min-w-[150px] flex-1 bg-transparent px-1.5 py-1.5 text-[16px] text-black/85 outline-none placeholder:text-black/40')}
        />
      </div>
      <p className="mt-1.5 min-h-[18px] text-[13px] leading-snug text-black/50" role="status" aria-live="polite">
        {problem || 'Each name becomes a pill. The guest will tick the ones who are coming. Nobody else can be added.'}
      </p>
    </div>
  )
}
