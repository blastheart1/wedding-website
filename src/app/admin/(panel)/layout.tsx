import { redirect } from 'next/navigation'
import { isAdminSession } from '@/lib/auth'
import { getWeddingConfig } from '@/lib/config'
import { AdminShell } from '../_ui/AdminShell'

export const dynamic = 'force-dynamic'

/** Every admin area sits behind the session check and inside the same shell. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!await isAdminSession()) redirect('/admin/login')
  const config = await getWeddingConfig()
  return <AdminShell partner1={config.partner1} partner2={config.partner2}>{children}</AdminShell>
}
