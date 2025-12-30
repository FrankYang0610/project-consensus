'use client';

import { useState, FormEvent } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useApp } from '@/contexts/AppContext';
import { LoginResponse, LoginApiResponse, ErrorResponse, LoginSuccessResponse } from '@/types';
import { getCookie, getAPIBaseUrl } from '@/lib/api/api-utils';
import { extractErrorMessage } from '@/lib/api/error-utils';
import { useI18n } from '@/hooks/use-i18n';
import { cn } from '@/lib/utils';

/**
 * 登录模态框属性 / Login modal props
 */
export interface LoginModalProps {
  className?: string; // 自定义CSS类名（可选） / Custom CSS class name (optional)
  onLoginSuccess?: (user: import('@/types/user').User) => void; // 登录成功回调（可选） / Login success callback (optional)
}

export function LoginModal({ className, onLoginSuccess }: LoginModalProps) {
  const { t } = useI18n();
  // Auth context
  const { login, closeLoginModal, openLoginModal, loginModalOpen } = useApp();

  // State management
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset Form
  const resetForm = () => {
    setUsernameOrEmail('');
    setPassword('');
    setError('');
  };

  // Backend Login API
  const handleLogin = async (usernameOrEmail: string, password: string): Promise<LoginResponse> => {
    try {
      // Ensure CSRF cookie exists (safe GET)
      await fetch(`${getAPIBaseUrl()}/api/accounts/csrf/`, { method: 'GET', credentials: 'include' });
      const csrfToken = getCookie('csrftoken');
      const response = await fetch(`${getAPIBaseUrl()}/api/accounts/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          username_or_email: usernameOrEmail.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response
          .json()
          .catch(() => ({ message: 'Login failed' } as ErrorResponse));
        if (response.status === 429) {
          return { success: false, message: t('auth.errorTooManyAttempts') } as LoginResponse;
        }
        let errorMessage = extractErrorMessage(errorData, 'Login failed');
        // Translate i18n error code if applicable
        if (errorMessage.startsWith('validation.') || errorMessage.startsWith('auth.')) {
          errorMessage = t(errorMessage);
        }
        return { success: false, message: errorMessage } as LoginResponse;
      }

      const data: LoginApiResponse = await response
        .json()
        .catch(() => ({ message: 'Login failed' } as ErrorResponse));
      if ('success' in data && data.success) {
        const success = data as LoginSuccessResponse;
        return { success: true, user: success.user };
      }
      const err = data as ErrorResponse;
      return { success: false, message: err.message || err.detail || 'Login failed' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('auth.errorNetwork');
      return { success: false, message: msg } as LoginResponse;
    }
  };

  // Form submit handle
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Basic Verification
    if (!usernameOrEmail || !password) {
      setError(t('auth.errorRequiredFields'));
      setIsLoading(false);
      return;
    }

    try {
      const result = await handleLogin(usernameOrEmail, password);

      if (result.success && result.user) {
        // Use AuthContext to save user information
        login(result.user);

        // Close modal and reset form
        closeLoginModal();
        resetForm();

        // External callback
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(result.user);
        }

        // No need to refresh page, AuthContext will automatically update UI

      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err: unknown) {
      // Check if this is an account disabled error
      // 检查是否为账户被禁用错误
      const errorMessage = err instanceof Error ? err.message : t('auth.errorNetwork');
      
      // If the error message contains "disabled" keyword, show localized disabled message
      // 如果错误消息包含"disabled"关键字，显示本地化的禁用消息
      if (errorMessage.toLowerCase().includes('disabled')) {
        setError(t('auth.errorAccountDisabled'));
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Forget password handling
  const handleForgotPassword = () => {
    // Navigate to forgot password page
    window.location.href = '/forgot-password';
  };

  // Sign up handling
  const handleSignUp = () => {
    closeLoginModal();
    window.location.href = '/register';
  };

  const LoginBody = (
    <Card className="border-0 shadow-none rounded-none">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.welcomeBack')}</CardTitle>
            <CardDescription>
              {t('auth.loginDescription')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                {/* Username or Email Input */}
                <div className="grid gap-2">
                  <Label htmlFor="usernameOrEmail">{t('auth.usernameOrEmail')}</Label>
                  <Input
                    id="usernameOrEmail"
                    type="text"
                    placeholder={t('auth.usernameOrEmailPlaceholder')}
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                {/* Password Input */}
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('auth.password')}</Label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                {/* Login Button inside the form to trigger submit */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('auth.login')}
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-3">
            {/* Register Link */}
            <div className="text-center text-sm text-muted-foreground">
              {t('auth.dontHaveAccount')}{' '}
              <button
                type="button"
                onClick={handleSignUp}
                className="underline underline-offset-4 hover:text-primary"
              >
                {t('auth.signUp')}
              </button>
            </div>
          </CardFooter>
        </Card>
  );

  return (
    <Dialog open={loginModalOpen} onOpenChange={(open) => !open && closeLoginModal()}>
      <DialogContent className={cn("p-0 max-w-sm overflow-hidden rounded-xl", className)}>
        <DialogTitle className="sr-only">{t('auth.login')}</DialogTitle>
        {LoginBody}
      </DialogContent>
    </Dialog>
  );
}
