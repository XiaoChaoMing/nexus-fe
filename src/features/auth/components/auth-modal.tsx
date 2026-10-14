import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoginForm } from '@/features/auth/components/login-form'
import { RegisterForm } from '@/features/auth/components/register-form'
import { useAuthModal, type AuthTab } from '@/features/auth/stores/auth-modal-store'

/**
 * One dialog, two tabs (NXL-D §9). Opened by gated actions; it never navigates, so a playing video keeps
 * playing underneath. Radix Dialog gives the focus trap and Esc; below 768px it is a bottom sheet.
 */
export function AuthModal() {
  const { t } = useTranslation('auth')
  const open = useAuthModal((s) => s.open)
  const tab = useAuthModal((s) => s.tab)
  const setTab = useAuthModal((s) => s.setTab)
  const close = useAuthModal((s) => s.close)
  const context = useAuthModal((s) => s.context)
  const signedIn = () => close({ signedIn: true })
  // Links inside the forms (forgot password) leave the page; the remembered action no longer applies.
  const leave = () => close()

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        data-testid="auth-modal"
        aria-describedby="auth-modal-desc"
        className="max-h-[92dvh] overflow-y-auto sm:max-w-md max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=open]:zoom-in-100 max-md:data-[state=closed]:zoom-out-100"
      >
        <DialogHeader>
          <DialogTitle>{tab === 'login' ? t('modal.loginTitle') : t('modal.registerTitle')}</DialogTitle>
          <DialogDescription id="auth-modal-desc">{context ? t(`modal.context.${context}`) : t('modal.subtitle')}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as AuthTab)}>
          <TabsList aria-label={t('modal.tabs')}>
            <TabsTrigger value="login">{t('login.title')}</TabsTrigger>
            <TabsTrigger value="register">{t('register.submit')}</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-4">
            <LoginForm onSuccess={signedIn} onNavigate={leave} />
          </TabsContent>
          <TabsContent value="register" className="pt-4">
            <RegisterForm onSuccess={signedIn} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
