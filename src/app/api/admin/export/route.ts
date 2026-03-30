import { NextRequest, NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db   = getDb()
  const rsvps = await db
    .select()
    .from(schema.rsvps)
    .orderBy(schema.rsvps.createdAt)

  const rows = rsvps.map((r, i) => ({
    '#':                     i + 1,
    'Name':                  r.name,
    'Email':                 r.email,
    'Attending':             r.attending ? 'Yes' : 'No',
    'Dietary Restrictions':  r.dietary ?? '—',
    'Legacy Meal':           r.meal        ?? '—',
    'Song Request':          r.songRequest ?? '—',
    'Message':               r.message     ?? '—',
    'Submitted':             new Date(r.createdAt).toLocaleDateString('en-GB'),
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  ws['!cols'] = [
    { wch: 4  }, { wch: 28 }, { wch: 32 }, { wch: 12 },
    { wch: 30 }, { wch: 18 }, { wch: 28 }, { wch: 40 }, { wch: 14 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'RSVPs')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Luis_Bee_RSVPs.xlsx"',
    },
  })
}
