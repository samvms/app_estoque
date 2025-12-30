import { FormLogin } from '@/modules/auth/ui/FormLogin'

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] grid place-items-center px-4">
      <div className="w-full max-w-md">
        <FormLogin />
      </div>
    </div>
  )
}
