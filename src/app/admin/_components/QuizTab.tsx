'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import type { QuizQuestion } from '@/lib/schema'
import clsx from 'clsx'

const cred: RequestCredentials = 'include'

const OPTIONS = ['A', 'B', 'C', 'D'] as const
type Option   = typeof OPTIONS[number]

const inputClass  = 'w-full px-3 py-2 border border-rule bg-cream text-[13px] text-ink outline-none focus:border-rose focus:bg-white transition-colors'
const labelClass  = 'block text-[11px] text-muted mb-1'

const emptyForm = () => ({ question: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A' as Option })

export function QuizTab() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState<number | null>(null)
  const [editForm,  setEditForm]  = useState(emptyForm())
  const [newForm,   setNewForm]   = useState(emptyForm())
  const [saving,    setSaving]    = useState(false)

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/quiz', { credentials: cred })
      const json = await res.json()
      if (json.success) setQuestions(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadQuestions() }, [loadQuestions])

  const createQuestion = async () => {
    const { question, optionA, optionB, optionC, optionD, correctOption } = newForm
    if (!question.trim() || !optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      toast.error('All fields required')
      return
    }
    setSaving(true)
    try {
      const res  = await fetch('/api/admin/quiz', {
        method:      'POST',
        credentials: cred,
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ question: question.trim(), optionA: optionA.trim(), optionB: optionB.trim(), optionC: optionC.trim(), optionD: optionD.trim(), correctOption }),
      })
      const json = await res.json()
      if (json.success) {
        setQuestions(prev => [...prev, json.data])
        setNewForm(emptyForm())
        toast.success('Question added')
      } else {
        toast.error(json.error ?? 'Failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (q: QuizQuestion) => {
    setEditId(q.id)
    setEditForm({
      question:      q.question,
      optionA:       q.optionA,
      optionB:       q.optionB,
      optionC:       q.optionC,
      optionD:       q.optionD,
      correctOption: q.correctOption as Option,
    })
  }

  const saveEdit = async (id: number) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/quiz', {
        method:      'PATCH',
        credentials: cred,
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ id, ...editForm }),
      })
      const json = await res.json()
      if (json.success) {
        setQuestions(prev => prev.map(q => q.id === id ? json.data : q))
        setEditId(null)
        toast.success('Question updated')
      } else {
        toast.error(json.error ?? 'Failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleVisible = async (q: QuizQuestion) => {
    await fetch('/api/admin/quiz', {
      method:      'PATCH',
      credentials: cred,
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ id: q.id, visible: !q.visible }),
    })
    setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, visible: !item.visible } : item))
  }

  const deleteQuestion = async (id: number) => {
    if (!confirm('Delete this question?')) return
    const res = await fetch(`/api/admin/quiz?id=${id}`, { method: 'DELETE', credentials: cred })
    if (res.ok) {
      setQuestions(prev => prev.filter(q => q.id !== id))
      toast.success('Deleted')
    } else {
      toast.error('Delete failed')
    }
  }

  const QuestionForm = ({
    form, setForm, onSubmit, submitLabel,
  }: {
    form: ReturnType<typeof emptyForm>
    setForm: (f: ReturnType<typeof emptyForm>) => void
    onSubmit: () => void
    submitLabel: string
  }) => (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Question</label>
        <input
          value={form.question}
          onChange={e => setForm({ ...form, question: e.target.value })}
          className={inputClass}
          placeholder="e.g. How did Luis and Bee first meet?"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map(opt => (
          <div key={opt}>
            <label className={clsx(labelClass, 'flex items-center gap-2')}>
              <span className={clsx(
                'w-5 h-5 flex items-center justify-center text-[10px] font-medium border rounded-full',
                form.correctOption === opt ? 'border-rose bg-rose text-white' : 'border-rule text-muted',
              )}>
                {opt}
              </span>
              Option {opt}
              {form.correctOption !== opt && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, correctOption: opt })}
                  className="text-[9px] text-muted hover:text-rose transition-colors ml-auto"
                >
                  Set correct
                </button>
              )}
              {form.correctOption === opt && (
                <span className="text-[9px] text-rose ml-auto">✓ Correct</span>
              )}
            </label>
            <input
              value={form[`option${opt}` as keyof typeof form] as string}
              onChange={e => setForm({ ...form, [`option${opt}`]: e.target.value })}
              className={inputClass}
              placeholder={`Option ${opt}…`}
            />
          </div>
        ))}
      </div>
      <button
        onClick={onSubmit}
        disabled={saving}
        className="bg-rose text-white text-[10px] tracking-[2px] uppercase px-5 py-2 hover:bg-rosedark transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving…' : submitLabel}
      </button>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* ── Add question ── */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-4">➕ Add Quiz Question</h4>
        <QuestionForm
          form={newForm}
          setForm={setNewForm}
          onSubmit={createQuestion}
          submitLabel="Add Question"
        />
      </div>

      {/* ── Questions list ── */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-4">
          📋 Questions ({questions.filter(q => q.visible).length} visible / {questions.length} total)
        </h4>

        {loading ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="text-[13px] text-muted italic">No questions yet. Add one above.</p>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {questions.map((q, i) => (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{   opacity: 0, height: 0 }}
                  className={clsx('border border-rule p-4', !q.visible && 'opacity-50')}
                >
                  {editId === q.id ? (
                    <div>
                      <QuestionForm
                        form={editForm}
                        setForm={setEditForm}
                        onSubmit={() => saveEdit(q.id)}
                        submitLabel="Save Changes"
                      />
                      <button
                        onClick={() => setEditId(null)}
                        className="mt-2 text-[11px] text-muted hover:text-rose transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <p className="text-[13px] text-ink font-medium leading-snug flex-1">
                          {i + 1}. {q.question}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(q)}
                            className="px-2 py-1 text-[9px] tracking-[1.5px] uppercase text-muted border border-rule hover:bg-petal transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleVisible(q)}
                            className={clsx(
                              'px-2 py-1 text-[9px] tracking-[1.5px] uppercase border transition-colors',
                              q.visible ? 'text-muted border-rule hover:bg-petal' : 'text-rose border-rose/30 bg-rose/5',
                            )}
                          >
                            {q.visible ? 'Hide' : 'Show'}
                          </button>
                          <button
                            onClick={() => deleteQuestion(q.id)}
                            className="px-2 py-1 text-[9px] text-rose border border-rose/30 hover:bg-petal transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {OPTIONS.map(opt => (
                          <div
                            key={opt}
                            className={clsx(
                              'flex items-center gap-2 px-2 py-1 text-[11px]',
                              q.correctOption === opt ? 'bg-rose/10 text-rose font-medium' : 'text-muted',
                            )}
                          >
                            <span className={clsx(
                              'w-4 h-4 flex items-center justify-center text-[9px] border rounded-full shrink-0',
                              q.correctOption === opt ? 'border-rose text-rose' : 'border-rule',
                            )}>
                              {opt}
                            </span>
                            {q[`option${opt}` as keyof QuizQuestion] as string}
                            {q.correctOption === opt && <span className="ml-auto">✓</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
