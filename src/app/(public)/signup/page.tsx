import { PublicAuthShell } from '@/modules/auth/ui/PublicAuthShell'
import { FormSignup } from '@/modules/auth/ui/FormSignup'

export default function SignupPage() {
  return (
    <PublicAuthShell>
      <FormSignup />
    </PublicAuthShell>
  )
}
