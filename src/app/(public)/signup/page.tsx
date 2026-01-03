// src/app/(public)/signup/page.tsx
import { PublicAuthShell } from '@/modules/auth/ui/PublicAuthShell'
// ajuste o import abaixo para o nome real do seu form de signup
import { FormSignup } from '@/modules/auth/ui/FormSignup'

export default function SignupPage() {
  return (
    <PublicAuthShell>
      <FormSignup />
    </PublicAuthShell>
  )
}
