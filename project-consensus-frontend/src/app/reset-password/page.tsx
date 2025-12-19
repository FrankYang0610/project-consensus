'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { SiteNavigation } from '@/components/SiteNavigation';
import Link from 'next/link';
import { ErrorResponse } from '@/types';
import { getCookie, getAPIBaseUrl } from '@/lib/api/api-utils';
import { extractErrorMessage } from '@/lib/api/error-utils';
import { useApp } from '@/contexts/AppContext';

function ResetPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useApp();

  const [uid, setUid] = useState('');
  const [token, setToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  // Redirect if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  // Extract uid, token and session id from URL on mount
  useEffect(() => {
    const uidParam = searchParams.get('uid');
    const tokenParam = searchParams.get('token');
    const sidParam = searchParams.get('sid');

    if (!uidParam || !tokenParam || !sidParam) {
      setInvalidLink(true);
      setError(t('auth.passwordReset.errorInvalidLink'));
    } else {
      setUid(uidParam);
      setToken(tokenParam);
      setSessionId(sidParam);
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordReset.errorPasswordMismatch'));
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setError(t('validation.password.tooShort'));
      return;
    }

    try {
      setIsLoading(true);

      // Get CSRF token
      await fetch(`${getAPIBaseUrl()}/api/accounts/csrf/`, {
        method: 'GET',
        credentials: 'include',
      });
      const csrfToken = getCookie('csrftoken');

      // Confirm password reset
      const res = await fetch(`${getAPIBaseUrl()}/api/accounts/password-reset/confirm/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          uid,
          token,
          session_id: sessionId,
          new_password: newPassword,
          new_password_confirm: confirmPassword,
        }),
      });

      if (!res.ok) {
        const errorData: ErrorResponse = await res
          .json()
          .catch(() => ({ message: 'Reset failed' } as ErrorResponse));

        if (res.status === 429) {
          setError(t('auth.errorTooManyAttempts'));
          return;
        }

        let errorMessage = extractErrorMessage(errorData, 'Reset failed');
        
        // Translate i18n error code if applicable
        if (errorMessage.startsWith('validation.') || errorMessage.startsWith('auth.')) {
          errorMessage = t(errorMessage);
        }
        
        // Handle password validation errors (can be array)
        if (errorData.new_password) {
          const passwordErrors = Array.isArray(errorData.new_password)
            ? errorData.new_password
            : [errorData.new_password];
          const translatedErrors = passwordErrors.map((err) =>
            typeof err === 'string' && (err.startsWith('validation.') || err.startsWith('auth.'))
              ? t(err)
              : err
          );
          errorMessage = translatedErrors.join(', ');
        }
        
        setError(errorMessage);
        return;
      }

      // Success
      setSuccess(true);
      
      // Redirect to home after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('auth.errorNetwork');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show invalid link message if no uid/token
  if (invalidLink) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteNavigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>{t('auth.passwordReset.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="mt-4 text-center">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  {t('auth.passwordReset.forgotPasswordTitle')}
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNavigation />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.passwordReset.title')}</CardTitle>
            <CardDescription>
              {t('auth.passwordReset.resetPasswordDescription')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Success Alert */}
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50 text-green-900">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{t('auth.passwordReset.success')}</AlertDescription>
              </Alert>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                {/* New Password Input */}
                <div className="grid gap-2">
                  <Label htmlFor="new-password">{t('auth.passwordReset.newPassword')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading || success}
                    required
                    minLength={8}
                  />
                </div>

                {/* Confirm Password Input */}
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">
                    {t('auth.passwordReset.confirmNewPassword')}
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading || success}
                    required
                    minLength={8}
                  />
                </div>

                {/* Password Requirements */}
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">{t('auth.passwordRequirements')}</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('auth.passwordRequirement1')}</li>
                    <li>{t('auth.passwordRequirement2')}</li>
                    <li>{t('auth.passwordRequirement3')}</li>
                  </ul>
                </div>

                <Alert variant="warning" className="text-sm">
                  <AlertDescription>{t('auth.passwordPolyUWarning')}</AlertDescription>
                </Alert>

                {/* Submit Button */}
                <Button type="submit" disabled={isLoading || success} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.passwordReset.resetting')}
                    </>
                  ) : (
                    t('auth.passwordReset.resetPassword')
                  )}
                </Button>

                {/* Back to Login */}
                <div className="text-center">
                  <Link href="/" className="text-sm text-primary hover:underline">
                    {t('auth.passwordReset.backToLogin')}
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
