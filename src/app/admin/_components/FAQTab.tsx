'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import type { FAQItem } from '@/lib/schema'
import clsx from 'clsx'

const cred: RequestCredentials = 'include'

const inputClass = 'w-full px-3 py-2 border border-rule bg-cream text-[13px] text-ink outline-none focus:border-rose focus:bg-white transition-colors'
const labelClass = 'block text-[11px] text-muted mb-1'

export function FAQTab() {
  const [items,      setItems]      = useState<FAQItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [editingId,  setEditingId]  = useState<number | null>(null)
  const [editQ,      setEditQ]      = useState('')
  const [editA,      setEditA]      = useState('')
  const [newQ,       setNewQ]       = useState('')
  const [newA,       setNewA]       = useState('')
  const [creating,   setCreating]   = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/faq', { credentials: cred })
      const json = await res.json()
      if (json.success) setItems(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const startEdit = (item: FAQItem) => {
    setEditingId(item.id)
    setEditQ(item.question)
    setEditA(item.answer)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQ('')
    setEditA('')
  }

  const saveEdit = async (id: number) => {
    if (!editQ.trim() || !editA.trim()) { toast.error('Both fields required'); return }
    const res = await fetch('/api/admin/faq', {
      method:      'PATCH',
      credentials: cred,
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ id, question: editQ.trim(), answer: editA.trim() }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, question: editQ.trim(), answer: editA.trim() } : i))
      cancelEdit()
      toast.success('FAQ item updated')
    } else {
      toast.error('Update failed')
    }
  }

  const toggleVisible = async (item: FAQItem) => {
    const res = await fetch('/api/admin/faq', {
      method:      'PATCH',
      credentials: cred,
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ id: item.id, visible: !item.visible }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, visible: !item.visible } : i))
    } else {
      toast.error('Update failed')
    }
  }

  const deleteItem = async (id: number) => {
    if (!confirm('Delete this FAQ item?')) return
    const res = await fetch(`/api/admin/faq?id=${id}`, { method: 'DELETE', credentials: cred })
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id))
      toast.success('Deleted')
    } else {
      toast.error('Delete failed')
    }
  }

  const createItem = async () => {
    if (!newQ.trim() || !newA.trim()) { toast.error('Both question and answer required'); return }
    setCreating(true)
    try {
      const res  = await fetch('/api/admin/faq', {
        method:      'POST',
        credentials: cred,
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ question: newQ.trim(), answer: newA.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setItems(prev => [...prev, json.data])
        setNewQ('')
        setNewA('')
        toast.success('FAQ item added')
      } else {
        toast.error('Create failed')
      }
    } finally {
      setCreating(false)
    }
  }

  const moveItem = async (index: number, dir: -1 | 1) => {
    const newItems = [...items]
    const target   = index + dir
    if (target < 0 || target >= newItems.length) return
    ;[newItems[index], newItems[target]] = [newItems[target], newItems[index]]
    setItems(newItems)
    await fetch('/api/admin/faq', {
      method:      'PUT',
      credentials: cred,
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ order: newItems.map(i => i.id) }),
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Add new FAQ item ── */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-4">➕ Add FAQ Item</h4>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Question</label>
            <input
              value={newQ}
              onChange={e => setNewQ(e.target.value)}
              className={inputClass}
              placeholder="e.g. Is there a dress code?"
            />
          </div>
          <div>
            <label className={labelClass}>Answer</label>
            <textarea
              value={newA}
              onChange={e => setNewA(e.target.value)}
              className={clsx(inputClass, 'resize-y min-h-[80px]')}
              placeholder="Write the answer here…"
            />
          </div>
          <button
            onClick={createItem}
            disabled={creating}
            className="bg-rose text-white text-[10px] tracking-[2px] uppercase px-5 py-2 hover:bg-rosedark transition-colors disabled:opacity-60"
          >
            {creating ? 'Adding…' : 'Add Item'}
          </button>
        </div>
      </div>

      {/* ── FAQ items list ── */}
      <div className="bg-white border border-rule p-6">
        <h4 className="text-[9px] tracking-[3px] uppercase text-rose mb-4">📋 FAQ Items ({items.length})</h4>

        {loading ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-[13px] text-muted italic">No FAQ items yet. Add one above.</p>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{   opacity: 0, height: 0 }}
                  className={clsx('border border-rule p-4', !item.visible && 'opacity-50')}
                >
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <input
                        value={editQ}
                        onChange={e => setEditQ(e.target.value)}
                        className={inputClass}
                      />
                      <textarea
                        value={editA}
                        onChange={e => setEditA(e.target.value)}
                        className={clsx(inputClass, 'resize-y min-h-[60px]')}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(item.id)}
                          className="bg-rose text-white text-[9px] tracking-[2px] uppercase px-4 py-1.5 hover:bg-rosedark transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="border border-rule text-[9px] tracking-[2px] uppercase px-4 py-1.5 text-muted hover:bg-petal transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <p className="text-[13px] text-ink font-medium leading-snug flex-1">{item.question}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => moveItem(index, -1)}
                            disabled={index === 0}
                            className="p-1 text-muted hover:text-rose disabled:opacity-30 transition-colors text-[12px]"
                            title="Move up"
                          >↑</button>
                          <button
                            onClick={() => moveItem(index, 1)}
                            disabled={index === items.length - 1}
                            className="p-1 text-muted hover:text-rose disabled:opacity-30 transition-colors text-[12px]"
                            title="Move down"
                          >↓</button>
                          <button
                            onClick={() => startEdit(item)}
                            className="px-2 py-1 text-[9px] tracking-[1.5px] uppercase text-muted border border-rule hover:bg-petal transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleVisible(item)}
                            className={clsx(
                              'px-2 py-1 text-[9px] tracking-[1.5px] uppercase border transition-colors',
                              item.visible
                                ? 'text-muted border-rule hover:bg-petal'
                                : 'bg-muted/10 text-rose border-rose/30',
                            )}
                          >
                            {item.visible ? 'Hide' : 'Show'}
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="px-2 py-1 text-[9px] text-rose border border-rose/30 hover:bg-petal transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="text-[12px] text-muted leading-relaxed">{item.answer}</p>
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
