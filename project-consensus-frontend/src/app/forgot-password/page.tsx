'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { validatePolyuEmail } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, isLoading: authLoading } = useApp();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Redirect if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate PolyU email
    const emailValidation = validatePolyuEmail(email);
    if (!emailValidation.isValid) {
      setError(t(emailValidation.error || 'auth.errorPolyuEmail'));
      return;
    }

    const sanitizedEmail = emailValidation.sanitizedValue!;

    try {
      setIsLoading(true);

      // Get CSRF token
      await fetch(`${getAPIBaseUrl()}/api/accounts/csrf/`, {
        method: 'GET',
        credentials: 'include',
      });
      const csrfToken = getCookie('csrftoken');

      // Request password reset
      const res = await fetch(`${getAPIBaseUrl()}/api/accounts/password-reset/request/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ email: sanitizedEmail }),
      });

      if (!res.ok) {
        const errorData: ErrorResponse = await res
          .json()
          .catch(() => ({ message: 'Request failed' } as ErrorResponse));

        if (res.status === 429) {
          setError(t('auth.errorTooManyAttempts'));
          return;
        }

        let errorMessage = extractErrorMessage(errorData, 'Request failed');
        // Translate i18n error code if applicable
        if (errorMessage.startsWith('validation.') || errorMessage.startsWith('auth.')) {
          errorMessage = t(errorMessage);
        }
        setError(errorMessage);
        return;
      }

      // Always show success (no user enumeration)
      setSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('auth.errorNetwork');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNavigation />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.passwordReset.forgotPasswordTitle')}</CardTitle>
            <CardDescription>
              {t('auth.passwordReset.forgotPasswordDescription')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Success Alert */}
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50 text-green-900">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{t('auth.passwordReset.emailSent')}</AlertDescription>
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
                {/* Email Input */}
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@connect.polyu.hk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading || success}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('auth.emailVerificationHint')}
                  </p>
                </div>

                {/* Submit Button */}
                <Button type="submit" disabled={isLoading || success} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.passwordReset.sending')}
                    </>
                  ) : (
                    t('auth.passwordReset.sendResetLink')
                  )}
                </Button>

                {/* Link Validity Info */}
                <p className="text-sm text-center text-muted-foreground">
                  {t('auth.passwordReset.linkValidFor')}
                </p>

                {/* Back to Login */}
                <div className="text-center">
                  <Link
                    href="/"
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      // Will be handled by LoginModal in homepage
                    }}
                  >
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
