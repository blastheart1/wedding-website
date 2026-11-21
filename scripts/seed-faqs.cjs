#!/usr/bin/env node
// Guarded, additive loader for the starter FAQ list.
// Default is an offline plan: no network, no writes. Applying requires both
// --apply and --target-host=<exact database hostname>. It only INSERTS rows whose
// question text is not already present; it never updates or deletes anything.
// Afterwards everything is editable at /admin/faq.
const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')
const root = path.resolve(__dirname, '..')

const FAQS = [
  {
    question: 'Is there a parking area?',
    answer: [
      'Church: Kindly note that private vehicles are not permitted to enter or park within the church premises. Only the bridal car will be allowed inside. Street parking is available outside the church, so we encourage guests to arrive early to secure a convenient parking space.',
      "Reception: A dedicated parking area is available directly in front of the reception venue. To preserve the venue's styling and setup, parking inside the venue premises itself is not permitted. We kindly ask guests to use the designated parking area.",
    ].join('\n\n'),
  },
  {
    question: 'Can I bring my children?',
    answer: 'As we are celebrating an intimate wedding, we have reserved invitations only for children who have been given specific roles in the ceremony. We sincerely appreciate your understanding and cooperation.',
  },
  {
    question: 'Can I bring a plus-one?',
    answer: 'Plus-ones are accommodated based on the number of guests indicated in your RSVP invitation. If your invitation does not include a plus-one, it means we have reached our guest capacity. However, should you wish to bring someone along, you may reach out to the couple directly to check if additional slots have become available. As we are keeping our celebration intimate, we appreciate your understanding regarding our limited guest capacity.',
  },
  {
    question: 'What time should I arrive?',
    answer: 'We kindly encourage all guests to arrive by 1:30 PM, as the bridal procession will begin promptly at 2:00 PM. We appreciate everyone being on time so that we can begin the ceremony as scheduled.',
  },
  {
    question: 'What happens if I arrive late or miss the ceremony?',
    answer: [
      'As the wedding ceremony is the most important part of our celebration, we sincerely hope that all our invited guests can join us at the church and witness this special moment.',
      'Please understand that attendance at the church ceremony is required to be welcomed at the reception. Guests who are unable to attend the ceremony will unfortunately not be accommodated at the reception. We hope for your understanding, as having you present during our exchange of vows means so much to us.',
    ].join('\n\n'),
  },
  {
    question: 'What should I expect at the garden reception?',
    answer: [
      'Our cocktail hour, featuring light snacks and refreshments, will be held in the garden, which is an open-air area. Dinner and the wedding program, however, will take place inside the air-conditioned pavilion.',
      'We encourage everyone to wear comfortable clothing and footwear that complement our wedding color palette while remaining appropriate for the church ceremony. Please also keep in mind that the garden area is outdoors when choosing your shoes and attire.',
    ].join('\n\n'),
  },
  {
    question: 'Can I take photos and videos during the ceremony?',
    answer: [
      'Guests are welcome to take photos and videos throughout the ceremony. However, we kindly request that everyone refrain from taking photos or videos during the bridal procession (bridal walk) so our official photographers can capture this special moment without obstruction.',
      'Once the bridal procession is over, you are welcome to take photos and videos for the rest of the ceremony. Thank you for helping us preserve these precious moments!',
    ].join('\n\n'),
  },
]

const MAX_QUESTION = 500
const MAX_ANSWER = 2000

function validate() {
  for (const item of FAQS) {
    if (!item.question.trim() || item.question.length > MAX_QUESTION) throw new Error('Invalid FAQ question length.')
    if (!item.answer.trim() || item.answer.length > MAX_ANSWER) throw new Error('Invalid FAQ answer length.')
  }
  if (new Set(FAQS.map(item => item.question)).size !== FAQS.length) throw new Error('Duplicate FAQ question in the list.')
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const targetHost = args.find(arg => arg.startsWith('--target-host='))?.slice('--target-host='.length)
  if (args.some(arg => arg !== '--apply' && !arg.startsWith('--target-host='))) {
    throw new Error('Use no flags for the offline plan, or --apply --target-host=<exact database hostname>.')
  }
  if (apply && !targetHost) throw new Error('Applying requires --apply --target-host=<exact database hostname>. Nothing was written.')
  validate()

  if (!apply) {
    console.log(JSON.stringify({ mode: 'offline plan', applied: false, wouldInsertAtMost: FAQS.length, questions: FAQS.map(item => item.question) }, null, 2))
    return
  }

  const envPath = path.join(root, '.env.local')
  const env = { ...(fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {}), ...process.env }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Nothing was written.')
  if (new URL(env.DATABASE_URL).hostname !== targetHost) throw new Error('The expected target host does not match DATABASE_URL. Nothing was written.')

  const { neon } = require('@neondatabase/serverless')
  const sql = neon(env.DATABASE_URL)
  const existing = await sql('SELECT id, question, sort_order FROM faq_items ORDER BY sort_order, id', [])
  const have = new Set(existing.map(row => row.question.trim().toLowerCase()))
  const missing = FAQS.filter(item => !have.has(item.question.trim().toLowerCase()))
  const base = existing.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1

  if (!missing.length) {
    console.log(JSON.stringify({ mode: 'already current', applied: false, countBefore: existing.length }, null, 2))
    return
  }
  // One transaction: all missing rows or none. Rows are appended after existing ones.
  const results = await sql.transaction(
    missing.map((item, index) => sql('INSERT INTO faq_items (question, answer, sort_order, visible) VALUES ($1, $2, $3, true) RETURNING id', [item.question, item.answer, base + index])),
    { readOnly: false, fetchOptions: { signal: AbortSignal.timeout(30000) } },
  )
  const ids = results.map(rows => rows[0].id)
  const [{ count }] = await sql('SELECT count(*)::int AS count FROM faq_items', [])
  console.log(JSON.stringify({
    mode: 'applied', applied: true, countBefore: existing.length, countAfter: count, insertedIds: ids,
    rollback: `DELETE FROM faq_items WHERE id IN (${ids.join(', ')});`,
  }, null, 2))
}

main().catch(error => {
  const safe = /^(Use no flags|Applying requires|Invalid FAQ|Duplicate FAQ|DATABASE_URL is missing|The expected target)/.test(error?.message || '')
  console.error(safe ? error.message : 'FAQ load did not complete. Nothing is guaranteed written; check /admin/faq. No credentials were logged.')
  process.exitCode = 1
})
