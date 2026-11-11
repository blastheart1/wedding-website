'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, invitationsApi, type InviteSettings } from './api'
import { Button, Group, Row, Sheet, inputClass, labelClass } from './ui'

type TextKey = 'previewTitle' | 'previewDescription' | 'previewImageUrl' | 'emailSubject' | 'emailIntro' | 'shareMessage' | 'acknowledgement'
type ListKey = 'dos' | 'donts'

const toLines = (items: string[]) => items.join('\n')
const fromLines = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean)

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<InviteSettings | null>(null)
  const [lists, setLists] = useState<Record<ListKey, string>>({ dos: '', donts: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    invitationsApi.settings()
      .then(loaded => { setSettings(loaded); setLists({ dos: toLines(loaded.dos), donts: toLines(loaded.donts) }) })
      .catch(problem => setError(errorMessage(problem)))
  }, [])

  if (!settings) {
    return <Sheet title="Invitation settings" onClose={onClose}><p className="py-10 text-center text-[15px] text-black/50">{error || 'Loading…'}</p></Sheet>
  }

  const set = (key: TextKey, value: string) => setSettings(current => (current ? { ...current, [key]: value } : current))

  const text = (key: TextKey, label: string, rows = 1) => (
    <Row>
      <label className={labelClass} htmlFor={`setting-${key}`}>{label}</label>
      {rows > 1
        ? <textarea id={`setting-${key}`} rows={rows} className={`${inputClass} resize-none`} value={settings[key]} onChange={event => set(key, event.target.value)} />
        : <input id={`setting-${key}`} className={inputClass} value={settings[key]} onChange={event => set(key, event.target.value)} />}
    </Row>
  )

  const list = (key: ListKey, label: string) => (
    <Row>
      <label className={labelClass} htmlFor={`setting-${key}`}>{label}</label>
      <textarea id={`setting-${key}`} rows={5} className={`${inputClass} resize-none`} value={lists[key]}
        onChange={event => setLists(current => ({ ...current, [key]: event.target.value }))} />
    </Row>
  )

  const save = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await invitationsApi.saveSettings({ ...settings, dos: fromLines(lists.dos), donts: fromLines(lists.donts) })
      toast.success('Settings saved')
      onClose()
    } catch (problem) {
      setError(errorMessage(problem))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Invitation settings" onClose={onClose}>
      <Group label="Link preview" footnote="Shown by Messenger, Instagram and others when a personal link is pasted. You can use {firstName}, {partner1}, {partner2} and {date}. Leave the image empty to use the generated one with the guest's first name.">
        {text('previewTitle', 'Title')}
        {text('previewDescription', 'Description', 2)}
        {text('previewImageUrl', 'Image address (https, optional)')}
      </Group>

      <Group label="Message for Messenger and Instagram" footnote="Used by Copy message and Share. {link} is the guest's personal link.">
        {text('shareMessage', 'Message', 4)}
      </Group>

      <Group label="Email">
        {text('emailSubject', 'Subject')}
        {text('emailIntro', 'Opening paragraph', 4)}
      </Group>

      <Group label="Reminders on the guest page" footnote="One per line. Guests see these before the RSVP form.">
        {list('dos', 'Please do')}
        {list('donts', "Please don't")}
        {text('acknowledgement', 'Acknowledgement the guest must tick', 2)}
      </Group>

      <p role="alert" className="min-h-[1.25rem] px-4 pt-2 text-[13px] text-[#B3261E]">{error}</p>
      <Button tone="primary" disabled={busy} onClick={save} className="mt-2 w-full">Save settings</Button>
    </Sheet>
  )
}
