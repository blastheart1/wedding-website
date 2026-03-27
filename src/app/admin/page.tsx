import { redirect } from 'next/navigation'
import { isAdminSession } from '@/lib/auth'
import { AdminPanel } from './_components/AdminPanel'

export default async function AdminPage() {
  const authed = await isAdminSession()
  if (!authed) redirect('/admin/login')
  return <AdminPanel />
}
