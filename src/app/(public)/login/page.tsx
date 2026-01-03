// src/app/(public)/login/page.tsx
import { PublicAuthShell } from '@/modules/auth/ui/PublicAuthShell'
import { FormLogin } from '@/modules/auth/ui/FormLogin'

export default function LoginPage() {
  return (
    <PublicAuthShell>
      <FormLogin />
    </PublicAuthShell>
  )
}
