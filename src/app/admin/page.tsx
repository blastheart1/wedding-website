import { redirect } from 'next/navigation'

/** The admin opens on Invitations; the shared layout handles the session check. */
export default function AdminPage() {
  redirect('/admin/invitations')
}
