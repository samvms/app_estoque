// src/app/(public)/reset-password/page.tsx
import { PublicAuthShell } from '@/modules/auth/ui/PublicAuthShell'
// ajuste o import abaixo para o nome real do seu form de reset
import { FormResetPassword } from '@/modules/auth/ui/FormResetPassword'

export default function ResetPasswordPage() {
  return (
    <PublicAuthShell>
      <FormResetPassword />
    </PublicAuthShell>
  )
}
