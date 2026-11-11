'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { renderTemplate } from '@/lib/invitations/settings'
import { FIELD_TOKENS, templateProblem, type TemplateField } from '@/lib/invitations/tokens'
import { Button, Group, Row, Segmented, Sheet, inputClass, labelClass } from '@/app/admin/_ui/primitives'
import { TokenField } from '@/app/admin/_ui/TokenField'
import { errorMessage, invitationsApi, type InviteSettings, type SettingsSample } from './api'
import { LinePreview, ListEditor } from './SettingsParts'

type Tab = 'preview' | 'message' | 'email' | 'guest'

const TABS = [
  { value: 'preview', label: 'Link preview' },
  { value: 'message', label: 'Message' },
  { value: 'email', label: 'Email' },
  { value: 'guest', label: 'Guest page' },
] as const

const TEMPLATE_FIELDS = Object.keys(FIELD_TOKENS) as TemplateField[]

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<InviteSettings | null>(null)
  const [sample, setSample] = useState<SettingsSample | null>(null)
  const [tab, setTab] = useState<Tab>('preview')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    invitationsApi.settings()
      .then(loaded => { setSettings(loaded.settings); setSample(loaded.sample) })
      .catch(problem => setError(errorMessage(problem)))
  }, [])

  if (!settings || !sample) {
    return <Sheet wide title="Invitation settings" onClose={onClose}><p className="py-10 text-center text-[15px] text-black/50">{error || 'Loading…'}</p></Sheet>
  }

  const update = <K extends keyof InviteSettings>(key: K, value: InviteSettings[K]) =>
    setSettings(current => (current ? { ...current, [key]: value } : current))
  const filled = (field: TemplateField) => renderTemplate(settings[field], { ...sample })
  const problems = TEMPLATE_FIELDS.map(field => templateProblem(field, settings[field])).filter((problem): problem is string => problem !== null)

  const template = (field: TemplateField, label: string, multiline = false) => (
    <Row>
      <TokenField id={`setting-${field}`} label={label} value={settings[field]} allowed={FIELD_TOKENS[field]} multiline={multiline} onChange={value => update(field, value)} />
    </Row>
  )

  const save = async () => {
    if (busy) return
    if (problems.length) return setError(problems[0])
    setBusy(true)
    setError('')
    try {
      const cleaned = { ...settings, dos: settings.dos.map(item => item.trim()).filter(Boolean), donts: settings.donts.map(item => item.trim()).filter(Boolean) }
      await invitationsApi.saveSettings(cleaned)
      toast.success('Settings saved')
      onClose()
    } catch (problem) {
      setError(errorMessage(problem))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet wide title="Invitation settings" onClose={onClose}>
      <div className="pt-4"><Segmented label="Settings section" value={tab} options={TABS} onChange={setTab} /></div>

      {tab === 'preview' && (
        <>
          <Group label="What Messenger and Instagram show" footnote="Leave the image empty to use the generated one with the guest's first name.">
            {template('previewTitle', 'Title')}
            {template('previewDescription', 'Description', true)}
            <Row>
              <label className={labelClass} htmlFor="setting-previewImageUrl">Image address (https, optional)</label>
              <input id="setting-previewImageUrl" type="url" className={inputClass} value={settings.previewImageUrl} onChange={event => update('previewImageUrl', event.target.value)} />
            </Row>
          </Group>
          <Group label={`Preview for ${sample.firstName}`}>
            <Row>
              <p className="text-[15px] font-medium text-black/85">{filled('previewTitle')}</p>
              <p className="text-[13px] leading-snug text-black/50">{filled('previewDescription')}</p>
            </Row>
          </Group>
        </>
      )}

      {tab === 'message' && (
        <>
          <Group label="Message for Messenger, Instagram and text" footnote="Used by Copy message and Share. It must include the Link.">
            {template('shareMessage', 'Message', true)}
          </Group>
          <Group label={`Preview for ${sample.firstName}`}><LinePreview text={filled('shareMessage')} /></Group>
        </>
      )}

      {tab === 'email' && (
        <>
          <Group label="Email">
            {template('emailSubject', 'Subject')}
            {template('emailIntro', 'Opening paragraph', true)}
          </Group>
          <Group label={`Preview for ${sample.firstName}`} footnote="The button, QR code and link are added to the email automatically. Open a guest and choose Preview email to see all of it.">
            <Row>
              <p className="text-[13px] text-black/45">Subject</p>
              <p className="text-[15px] font-medium text-black/85">{filled('emailSubject')}</p>
            </Row>
            <LinePreview text={filled('emailIntro')} />
          </Group>
        </>
      )}

      {tab === 'guest' && (
        <>
          <ListEditor label="Please do" addLabel="Add a reminder" items={settings.dos} onChange={items => update('dos', items)} />
          <ListEditor label="Please don't" addLabel="Add a reminder" items={settings.donts} onChange={items => update('donts', items)} />
          <Group label="Acknowledgement" footnote="Guests must tick this before they can send their RSVP.">
            <Row>
              <label className={labelClass} htmlFor="setting-acknowledgement">Wording</label>
              <textarea id="setting-acknowledgement" rows={2} className={`${inputClass} resize-none`} value={settings.acknowledgement} onChange={event => update('acknowledgement', event.target.value)} />
            </Row>
          </Group>
        </>
      )}

      <p role="alert" className="min-h-[1.25rem] px-4 pt-3 text-[13px] text-[#B3261E]">{error || (problems.length ? 'Fix the highlighted placeholder before saving.' : '')}</p>
      <Button tone="primary" disabled={busy || problems.length > 0} onClick={save} className="mt-2 w-full">Save settings</Button>
    </Sheet>
  )
}
