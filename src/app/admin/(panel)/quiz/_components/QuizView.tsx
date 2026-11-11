'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { QuizQuestion } from '@/lib/schema'
import { adminFetch, errorMessage } from '@/app/admin/_lib/api'
import { IconButton, PageHeader } from '@/app/admin/_ui/PageHeader'
import { Button, ConfirmButton, Group, Row, Segmented, Sheet, inputClass, labelClass } from '@/app/admin/_ui/primitives'
import { LoadState, ToggleRow } from '@/app/admin/_ui/forms'

const API = '/api/admin/quiz'
const OPTIONS = ['A', 'B', 'C', 'D'] as const
type Option = (typeof OPTIONS)[number]
type Editing = { kind: 'new' } | { kind: 'edit'; question: QuizQuestion } | null

const OPTION_CHOICES = OPTIONS.map(option => ({ value: option, label: option }))
const optionText = (question: QuizQuestion, option: Option): string =>
  ({ A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD })[option]
const asOption = (value: string): Option => (OPTIONS.includes(value as Option) ? (value as Option) : 'A')

export function QuizView() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [correct, setCorrect] = useState<Option>('A')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setQuestions((await adminFetch<{ data?: QuizQuestion[] }>(API)).data ?? [])
      setError('')
    } catch (problem) {
      setError(errorMessage(problem))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

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

  const open = (next: Editing) => {
    setCorrect(next?.kind === 'edit' ? asOption(next.question.correctOption) : 'A')
    setEditing(next)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '').trim()
    const body = { question: text('question'), optionA: text('optionA'), optionB: text('optionB'), optionC: text('optionC'), optionD: text('optionD'), correctOption: correct }
    if (Object.values(body).some(value => !value)) return void toast.error('Please fill in the question and all four answers.')
    const saved = editing.kind === 'new'
      ? await run(() => adminFetch(API, { method: 'POST', body }), 'Question added')
      : await run(() => adminFetch(API, { method: 'PATCH', body: { id: editing.question.id, ...body } }), 'Saved')
    if (saved) setEditing(null)
  }

  const current = editing?.kind === 'edit' ? editing.question : null

  return (
    <>
      <PageHeader title="Quiz" subtitle={loading ? undefined : `${questions.filter(question => question.visible).length} shown of ${questions.length}`}>
        <IconButton icon={Plus} label="Add a question" tone="primary" onClick={() => open({ kind: 'new' })} />
      </PageHeader>
      <LoadState loading={loading} error={error} />

      {!loading && !error && (
        <Group footnote="The quiz appears on the site when the games section is switched on in Site settings.">
          {questions.length === 0 && <Row><p className="py-6 text-center text-[15px] text-black/45">No questions yet. Use the plus button to add the first one.</p></Row>}
          {questions.map(question => (
            <button key={question.id} type="button" onClick={() => open({ kind: 'edit', question })}
              className="flex w-full items-center gap-3 border-t border-black/[0.07] px-4 py-3 text-left first:border-t-0 active:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] text-black/90">{question.question}</span>
                <span className="block truncate text-[13px] text-black/45">Answer: {optionText(question, asOption(question.correctOption))}</span>
              </span>
              {!question.visible && <span className="shrink-0 text-[15px] text-black/50">Hidden</span>}
              <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 text-black/25" aria-hidden="true" />
            </button>
          ))}
        </Group>
      )}

      {editing && (
        <Sheet title={editing.kind === 'new' ? 'New question' : 'Edit question'} onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <Group>
              <Row><label className={labelClass} htmlFor="quiz-question">Question</label><input id="quiz-question" name="question" className={inputClass} maxLength={500} defaultValue={current?.question ?? ''} required autoFocus /></Row>
              {OPTIONS.map(option => (
                <Row key={option}>
                  <label className={labelClass} htmlFor={`quiz-option-${option}`}>Answer {option}</label>
                  <input id={`quiz-option-${option}`} name={`option${option}`} className={inputClass} maxLength={255} defaultValue={current ? optionText(current, option) : ''} required />
                </Row>
              ))}
              <Row>
                <p className={labelClass}>Correct answer</p>
                <Segmented label="Correct answer" value={correct} options={OPTION_CHOICES} onChange={setCorrect} />
              </Row>
              {current && (
                <ToggleRow label="Include in the quiz" checked={current.visible}
                  onChange={visible => { setEditing({ kind: 'edit', question: { ...current, visible } }); run(() => adminFetch(API, { method: 'PATCH', body: { id: current.id, visible } }), visible ? 'Question included' : 'Question hidden') }} />
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
