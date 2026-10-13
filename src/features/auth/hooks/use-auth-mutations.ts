import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, type LoginBody, type RegisterBody } from '@/features/auth/api/auth-api'
import { completeSignIn } from '@/features/auth/lib/session'
import { useAuthStore } from '@/features/auth/stores/auth-store'

export function useLogin() {
  return useMutation({
    mutationFn: async (body: LoginBody) => completeSignIn(await authApi.login(body)),
    meta: { localErrors: true },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: async (body: RegisterBody) => completeSignIn(await authApi.register(body)),
    meta: { localErrors: true },
  })
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => authApi.logout(),
    // Sign out locally even if the server call fails; the cookie expires on its own.
    onSettled: () => {
      clear()
      queryClient.removeQueries({ queryKey: ['me'] })
      queryClient.removeQueries({ queryKey: ['studio'] })
      queryClient.removeQueries({ queryKey: ['creator'] })
    },
    meta: { localErrors: true },
  })
}
