'use client'

import { useCallback, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { toSegments, tokenLabel, unknownTokens, type TokenKey } from '@/lib/invitations/tokens'

/** Keeps the caret placeable after a pill at the end of the field. Never saved. */
const SPACER = '​'
const PILL_CLASS = 'mx-0.5 inline-flex select-none items-center gap-1 rounded-full bg-[#2E1F1A] py-0.5 pl-2.5 pr-1 align-baseline text-[14px] leading-tight text-white'

interface TokenFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  allowed: readonly TokenKey[]
  /** Allow line breaks. */
  multiline?: boolean
}

function pillElement(key: TokenKey): HTMLElement {
  const pill = document.createElement('span')
  pill.dataset.token = key
  pill.contentEditable = 'false'
  pill.className = PILL_CLASS
  pill.append(tokenLabel(key))
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.tabIndex = -1
  remove.dataset.remove = 'true'
  remove.setAttribute('aria-label', `Remove ${tokenLabel(key)}`)
  remove.className = 'flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[12px] leading-none'
  remove.textContent = '×'
  pill.append(remove)
  return pill
}

/** Reads the editor back into stored text: pills become {key}, everything else is plain text. */
function serialise(root: Node, multiline: boolean): string {
  let text = ''
  root.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
    } else if (node instanceof HTMLElement) {
      if (node.dataset.token) text += `{${node.dataset.token}}`
      // A trailing <br> is the browser's own filler for an empty last line, not something the couple typed.
      else if (node.tagName === 'BR') text += node === root.lastChild ? '' : '\n'
      else text += (node.tagName === 'DIV' && text && !text.endsWith('\n') ? '\n' : '') + serialise(node, multiline)
    }
  })
  const plain = text.split(SPACER).join('')
  return multiline ? plain : plain.replace(/\n/g, '')
}

/** True for a text node holding nothing the couple typed: empty, or only the caret spacer. */
function isFiller(node: Node | null): boolean {
  return node !== null && node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').split(SPACER).join('') === ''
}

function render(root: HTMLElement, value: string, allowed: readonly TokenKey[]) {
  root.replaceChildren()
  for (const segment of toSegments(value, allowed)) {
    root.append(segment.type === 'text' ? document.createTextNode(segment.value) : pillElement(segment.key))
  }
  if (root.lastChild instanceof HTMLElement) root.append(document.createTextNode(SPACER))
}

/** The pill directly before (or after) a collapsed caret, if there is one. */
function adjacentPill(root: HTMLElement, direction: 'before' | 'after'): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection || !selection.isCollapsed || !selection.anchorNode || !root.contains(selection.anchorNode)) return null
  const { anchorNode: node, anchorOffset: offset } = selection
  let neighbour: Node | null = null
  if (node === root) {
    neighbour = root.childNodes[direction === 'before' ? offset - 1 : offset] ?? null
  } else if (node.nodeType === Node.TEXT_NODE) {
    const content = node.textContent ?? ''
    const atStart = content.slice(0, offset).split(SPACER).join('') === ''
    const atEnd = content.slice(offset).split(SPACER).join('') === ''
    if (direction === 'before' && atStart) neighbour = node.previousSibling
    if (direction === 'after' && atEnd) neighbour = node.nextSibling
  }
  // Splitting text around a pill can leave empty text nodes between it and the caret; look past them.
  while (isFiller(neighbour)) neighbour = direction === 'before' ? neighbour!.previousSibling : neighbour!.nextSibling
  return neighbour instanceof HTMLElement && neighbour.dataset.token ? neighbour : null
}

/**
 * A text box where placeholders are pills. Pills are inserted with the buttons
 * above the box and removed as one piece; the stored value keeps the plain
 * {firstName} form, so nothing else in the system has to change.
 */
export function TokenField({ id, label, value, onChange, allowed, multiline = false }: TokenFieldProps) {
  const editor = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<string | null>(null)
  const savedRange = useRef<Range | null>(null)

  // Rebuild the contents only when the value changed from outside, never while typing.
  useEffect(() => {
    const root = editor.current
    if (!root || lastEmitted.current === value) return
    render(root, value, allowed)
    lastEmitted.current = value
  }, [value, allowed])

  const emit = useCallback(() => {
    const root = editor.current
    if (!root) return
    const next = serialise(root, multiline)
    lastEmitted.current = next
    onChange(next)
  }, [onChange, multiline])

  const rememberCaret = () => {
    const selection = window.getSelection()
    const root = editor.current
    if (root && selection && selection.rangeCount && root.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange()
  }

  const insertPill = (key: TokenKey) => {
    const root = editor.current
    if (!root) return
    const selection = window.getSelection()
    let range = savedRange.current
    if (!range || !root.contains(range.startContainer)) {
      range = document.createRange()
      range.selectNodeContents(root)
      range.collapse(false)
    }
    range.deleteContents()
    const pill = pillElement(key)
    const after = document.createTextNode(SPACER)
    range.insertNode(after)
    range.insertNode(pill)
    // Merge the fragments the insertion left behind, then put the caret just after the pill.
    root.normalize()
    const following = pill.nextSibling
    if (following && following.nodeType === Node.TEXT_NODE) {
      const text = following.textContent ?? ''
      range.setStart(following, text.startsWith(SPACER) ? 1 : 0)
    } else {
      range.setStartAfter(pill)
    }
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRange.current = range.cloneRange()
    root.focus()
    emit()
  }

  const insertText = (text: string) => {
    // execCommand keeps the browser's own undo history working inside the editor.
    document.execCommand('insertText', false, text)
  }

  const unknown = unknownTokens(value, allowed)
  const fix = (raw: string, key: TokenKey) => onChange(value.split(raw).join(`{${key}}`))

  return (
    <div>
      <p id={`${id}-label`} className="mb-1 block text-[13px] text-black/50">{label}</p>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] text-black/45">Insert</span>
        {allowed.map(key => (
          <button key={key} type="button" onMouseDown={event => event.preventDefault()} onClick={() => insertPill(key)}
            className="rounded-full bg-black/[0.06] px-3 py-1 text-[14px] text-black/80 active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/50">
            {tokenLabel(key)}
          </button>
        ))}
      </div>
      <div
        ref={editor}
        id={id}
        role="textbox"
        aria-labelledby={`${id}-label`}
        aria-multiline={multiline}
        aria-invalid={unknown.length > 0}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={emit}
        onBlur={() => {
          rememberCaret()
          // A placeholder typed by hand correctly turns into a pill once the field is left.
          // Rebuild only when there is such text: rebuilding replaces every pill element.
          const root = editor.current
          const typedByHand = root !== null && Array.from(root.childNodes).some(node =>
            node.nodeType === Node.TEXT_NODE && toSegments(node.textContent ?? '', allowed).some(segment => segment.type === 'token'))
          if (root && typedByHand) render(root, serialise(root, multiline), allowed)
        }}
        onKeyUp={rememberCaret}
        onMouseUp={rememberCaret}
        onMouseDown={event => {
          // Handled on mouse-down, and without letting focus move, so the pill is still in place when it is removed.
          const target = event.target as HTMLElement
          const pill = target.closest<HTMLElement>('[data-remove]')?.closest<HTMLElement>('[data-token]')
          if (!pill) return
          event.preventDefault()
          if (pill.isConnected) { pill.remove(); emit() }
        }}
        onKeyDown={event => {
          const root = editor.current
          if (!root) return
          if (event.key === 'Enter') {
            event.preventDefault()
            if (multiline) insertText('\n')
            return
          }
          if (event.key === 'Backspace' || event.key === 'Delete') {
            const pill = adjacentPill(root, event.key === 'Backspace' ? 'before' : 'after')
            if (pill) { event.preventDefault(); pill.remove(); emit() }
          }
        }}
        onPaste={event => {
          event.preventDefault()
          const text = event.clipboardData.getData('text/plain')
          insertText(multiline ? text : text.replace(/\s*\n\s*/g, ' '))
        }}
        className={clsx(
          'w-full whitespace-pre-wrap break-words rounded-lg bg-black/[0.045] px-3 py-2.5 text-[16px] leading-relaxed text-black/85 outline-none focus:ring-2 focus:ring-black/20',
          multiline ? 'min-h-[96px]' : 'min-h-[44px]',
          unknown.length > 0 && 'ring-2 ring-[#B3261E]/50',
        )}
      />
      {unknown.map(item => (
        <p key={item.raw} role="alert" className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-[#B3261E]">
          <span>{item.raw} is not a placeholder.</span>
          {item.suggestion
            ? <button type="button" onClick={() => fix(item.raw, item.suggestion as TokenKey)} className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-black/80">Use {tokenLabel(item.suggestion)}</button>
            : <span>Remove it, or use an Insert button.</span>}
        </p>
      ))}
    </div>
  )
}
