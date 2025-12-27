import { FormLogin } from '@/modules/auth/ui/FormLogin'

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Login</h1>
      <FormLogin />
    </div>
  )
}
