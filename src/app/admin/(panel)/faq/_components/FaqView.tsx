'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { FAQItem } from '@/lib/schema'
import { adminFetch, errorMessage } from '@/app/admin/_lib/api'
import { IconButton, PageHeader } from '@/app/admin/_ui/PageHeader'
import { Button, ConfirmButton, Group, Row, Sheet, inputClass, labelClass } from '@/app/admin/_ui/primitives'
import { LoadState, ToggleRow } from '@/app/admin/_ui/forms'

const API = '/api/admin/faq'
type Editing = { kind: 'new' } | { kind: 'edit'; item: FAQItem } | null

export function FaqView() {
  const [items, setItems] = useState<FAQItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems((await adminFetch<{ data?: FAQItem[] }>(API)).data ?? [])
      setError('')
    } catch (problem) {
      setError(errorMessage(problem))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  /** Runs one change, then reloads so the list always shows what the server has. */
  const run = async (work: () => Promise<unknown>, done: string) => {
    if (busy) return false
    setBusy(true)
    try {
      await work()
      toast.success(done)
      await load()
      return true
    } catch (problem) {
      toast.error(errorMessage(problem))
      return false
    } finally {
      setBusy(false)
    }
  }

  const move = (index: number, by: -1 | 1) => {
    const target = index + by
    if (target < 0 || target >= items.length) return
    const next = items.map(item => item.id)
    ;[next[index], next[target]] = [next[target], next[index]]
    run(() => adminFetch(API, { method: 'PUT', body: { order: next } }), 'Order saved')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    const body = { question: String(form.get('question') ?? '').trim(), answer: String(form.get('answer') ?? '').trim() }
    if (!body.question || !body.answer) return void toast.error('Please fill in both the question and the answer.')
    const saved = editing.kind === 'new'
      ? await run(() => adminFetch(API, { method: 'POST', body }), 'Question added')
      : await run(() => adminFetch(API, { method: 'PATCH', body: { id: editing.item.id, ...body } }), 'Saved')
    if (saved) setEditing(null)
  }

  const current = editing?.kind === 'edit' ? editing.item : null

  return (
    <>
      <PageHeader title="FAQ" subtitle={loading ? undefined : `${items.filter(item => item.visible).length} shown of ${items.length}`}>
        <IconButton icon={Plus} label="Add a question" tone="primary" onClick={() => setEditing({ kind: 'new' })} />
      </PageHeader>
      <LoadState loading={loading} error={error} />

      {!loading && !error && (
        <Group footnote={items.length > 1 ? 'Use the arrows to change the order guests see.' : undefined}>
          {items.length === 0 && <Row><p className="py-6 text-center text-[15px] text-black/45">No questions yet. Use the plus button to add the first one.</p></Row>}
          {items.map((item, index) => (
            <div key={item.id} className="flex items-stretch border-t border-black/[0.07] first:border-t-0">
              <div className="flex flex-col justify-center gap-0.5 pl-2">
                <button type="button" aria-label="Move up" disabled={busy || index === 0} onClick={() => move(index, -1)} className="rounded p-1 text-black/45 disabled:opacity-25"><ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" /></button>
                <button type="button" aria-label="Move down" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)} className="rounded p-1 text-black/45 disabled:opacity-25"><ArrowDown size={16} strokeWidth={2.2} aria-hidden="true" /></button>
              </div>
              <button type="button" onClick={() => setEditing({ kind: 'edit', item })}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left active:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] text-black/90">{item.question}</span>
                  <span className="block truncate text-[13px] text-black/45">{item.answer}</span>
                </span>
                {!item.visible && <span className="shrink-0 text-[15px] text-black/50">Hidden</span>}
                <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 text-black/25" aria-hidden="true" />
              </button>
            </div>
          ))}
        </Group>
      )}

      {editing && (
        <Sheet title={editing.kind === 'new' ? 'New question' : 'Edit question'} onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <Group>
              <Row><label className={labelClass} htmlFor="faq-question">Question</label><input id="faq-question" name="question" className={inputClass} maxLength={500} defaultValue={current?.question ?? ''} required autoFocus /></Row>
              <Row><label className={labelClass} htmlFor="faq-answer">Answer</label><textarea id="faq-answer" name="answer" rows={6} className={`${inputClass} resize-y`} maxLength={2000} defaultValue={current?.answer ?? ''} required /></Row>
              {current && (
                <ToggleRow label="Show on the site" checked={current.visible}
                  onChange={visible => { setEditing({ kind: 'edit', item: { ...current, visible } }); run(() => adminFetch(API, { method: 'PATCH', body: { id: current.id, visible } }), visible ? 'Question shown' : 'Question hidden') }} />
              )}
            </Group>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" tone="primary" disabled={busy}>{editing.kind === 'new' ? 'Add question' : 'Save'}</Button>
              {current && <ConfirmButton confirmText="Tap again to delete" disabled={busy}
                onConfirm={async () => { if (await run(() => adminFetch(`${API}?id=${current.id}`, { method: 'DELETE' }), 'Question deleted')) setEditing(null) }}>Delete</ConfirmButton>}
            </div>
          </form>
        </Sheet>
      )}
    </>
  )
}
