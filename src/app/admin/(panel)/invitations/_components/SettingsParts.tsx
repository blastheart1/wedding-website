'use client'

import { X } from 'lucide-react'
import { Button, Group, Row, inputClass } from '@/app/admin/_ui/primitives'

const MAX_ITEMS = 20

/** Filled-in wording, shown exactly as the guest would read it. */
export function LinePreview({ text }: { text: string }) {
  return <Row><p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-black/85">{text}</p></Row>
}

interface ListEditorProps {
  label: string
  addLabel: string
  items: string[]
  onChange: (items: string[]) => void
}

/** A list of short lines that can each be edited, removed, or added to. */
export function ListEditor({ label, addLabel, items, onChange }: ListEditorProps) {
  return (
    <Group label={label}>
      {items.map((item, index) => (
        <Row key={index} className="flex items-center gap-2">
          <input aria-label={`${label}, line ${index + 1}`} className={inputClass} value={item} maxLength={240}
            onChange={event => onChange(items.map((current, position) => (position === index ? event.target.value : current)))} />
          <button type="button" aria-label={`Remove line ${index + 1}`} onClick={() => onChange(items.filter((_current, position) => position !== index))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50">
            <X size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </Row>
      ))}
      {items.length < MAX_ITEMS && <Row><Button onClick={() => onChange([...items, ''])}>{addLabel}</Button></Row>}
    </Group>
  )
}
