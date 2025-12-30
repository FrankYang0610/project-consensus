'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { SiteNavigation } from '@/components/SiteNavigation';
import Link from 'next/link';
import { ErrorResponse, RegisterSuccessResponse, SendVerificationCodeResponse } from '@/types';
import { getCookie, getAPIBaseUrl } from '@/lib/api/api-utils';
import { extractErrorMessage } from '@/lib/api/error-utils';
import { useApp } from '@/contexts/AppContext';
import { validateNickname, validateEmail, validateUsername } from '@/lib/utils';

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { login, user, isLoading: authLoading, openLoginModal } = useApp();

  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSendingCode, setIsSendingCode] = useState(false);
  const [canInputVerificationCode, setCanInputVerificationCode] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check if email is provided (trimmed)
  const hasEmail = email.trim().length > 0;

  // Redirect if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  // Countdown effect for resend button
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Reset verification code state when email changes
  useEffect(() => {
    setCanInputVerificationCode(false);
    setSentToEmail('');
    setVerificationCode('');
  }, [email]);

  const handleSendCode = async () => {
    setError('');
    setSuccess('');

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setError(t(emailValidation.error || 'auth.errorInvalidEmail'));
      return;
    }

    const sanitizedEmail = emailValidation.sanitizedValue!;

    try {
      setIsSendingCode(true);
      await fetch(`${getAPIBaseUrl()}/api/accounts/csrf/`, { method: 'GET', credentials: 'include' });
      const csrfToken = getCookie('csrftoken');
      const res = await fetch(`${getAPIBaseUrl()}/api/accounts/send_verification_code/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}) },
        credentials: 'include',
        body: JSON.stringify({ email: sanitizedEmail }),
      });
      if (!res.ok) {
        const errorData: ErrorResponse = await res.json().catch(() => ({} as ErrorResponse));
        // Handle specific error cases
        if (res.status === 429) {
          const msg = (errorData.message || '').toString();
          const localized = msg.startsWith('auth.') || msg.startsWith('validation.') ? t(msg) : t('auth.errorTooManyAttempts');
          throw new Error(localized);
        }
        const generic = errorData.message || errorData.detail || 'Failed to send code';
        const localized = generic.startsWith?.('auth.') || generic.startsWith?.('validation.') ? t(generic) : generic;
        throw new Error(localized);
      }
      const data: SendVerificationCodeResponse = await res.json();
      setCanInputVerificationCode(true);
      setSentToEmail(data.email);
      const countdown = typeof data.resend_after_seconds === 'number' && data.resend_after_seconds > 0 ? data.resend_after_seconds : 90;
      setResendCountdown(countdown);
      setSuccess(t('auth.verificationCodeSent', { email: data.email }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('auth.errorNetwork');
      setError(message);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !nickname || !password || !confirmPassword) {
      setError(t('auth.errorRequiredFields'));
      return;
    }

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      setError(t(usernameValidation.error || 'validation.username.invalid'));
      return;
    }

    // Validate nickname
    const nicknameValidation = validateNickname(nickname);
    if (!nicknameValidation.isValid) {
      setError(t(nicknameValidation.error || 'validation.nickname.invalid'));
      return;
    }

    // Validate email and verification code (if email provided)
    let sanitizedEmail = '';
    if (hasEmail) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        setError(t(emailValidation.error || 'auth.errorInvalidEmail'));
        return;
      }
      sanitizedEmail = emailValidation.sanitizedValue || '';

      // If email is provided, verification code is required
      if (!verificationCode || verificationCode.length !== 6) {
        setError(t('validation.verificationCode.required'));
        return;
      }
    }

    if (password !== confirmPassword) {
      setError(t('auth.errorPasswordMismatch'));
      return;
    }

    try {
      setIsRegistering(true);
      await fetch(`${getAPIBaseUrl()}/api/accounts/csrf/`, { method: 'GET', credentials: 'include' });
      const csrfToken = getCookie('csrftoken');
      const res = await fetch(`${getAPIBaseUrl()}/api/accounts/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          username: usernameValidation.sanitizedValue,
          nickname: nicknameValidation.sanitizedValue,
          email: sanitizedEmail,
          verification_code: hasEmail ? verificationCode : '',
          password,
          password_confirm: confirmPassword,
        }),
      });
      if (!res.ok) {
        const data: ErrorResponse = await res.json().catch(() => ({ message: 'Register failed' } as ErrorResponse));

        // Handle specific error cases
        if (res.status === 429) {
          const msg = (data.message || '').toString();
          const localized429 = msg.startsWith('auth.') || msg.startsWith('validation.') ? t(msg) : t('auth.errorTooManyAttempts');
          throw new Error(localized429);
        }

        // Extract error message
        let errorMessage = extractErrorMessage(data, 'Register failed');

        // If backend returned field-level password errors, collect and translate all of them
        if (data.password) {
          const raw = Array.isArray(data.password) ? data.password : [data.password];
          const passwordErrors = raw
            .filter((err): err is string => typeof err === 'string')
            .map((err) =>
              err.startsWith('validation.') || err.startsWith('auth.') ? t(err) : err
            );
          if (passwordErrors.length > 0) {
            errorMessage = passwordErrors.join(', ');
          }
        }

        if (errorMessage.startsWith('validation.') || errorMessage.startsWith('auth.')) {
          errorMessage = t(errorMessage);
        }

        throw new Error(errorMessage);
      }

      const data: RegisterSuccessResponse = await res.json();

      // Verify registration success
      if (!data.success || !data.user) {
        throw new Error('Register failed');
      }

      // Session cookie is set by backend; update UI state
      login(data.user);

      // Use window.location for navigation to ensure clean page load
      // This helps prevent any state issues with the router
      window.location.href = '/welcome';
    } catch (e: unknown) {
      // Check if display name is already taken
      if (e instanceof Error) {
        const errorMessage = e.message.toLowerCase();
        if (
          errorMessage.includes('already taken') ||
          errorMessage.includes('已被使用') ||
          errorMessage.includes('display name')
        ) {
          setError(t('validation.nickname.alreadyTaken'));
        } else {
          setError(e.message);
        }
      } else {
        setError(t('auth.errorNetwork'));
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div>
      <SiteNavigation showBackButton onBackClick={() => window.history.back()} />
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t('auth.register')}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">{t('auth.username')}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('auth.usernamePlaceholder')}
                  disabled={isRegistering}
                  minLength={5}
                  maxLength={30}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {t('auth.usernameHint')}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nickname">{t('auth.nickname')}</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isRegistering}
                  maxLength={15}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {nickname.trim().length}/15 {t('validation.nickname.characters')}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">{t('auth.emailOptional')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isRegistering}
                />
                <p className="text-sm text-muted-foreground">
                  {t('auth.emailOptionalHint')}
                </p>
              </div>

              {/* Verification code section - only shown when email is provided */}
              {hasEmail && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="code">{t('auth.verificationCode')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSendCode}
                      disabled={isSendingCode || isRegistering || resendCountdown > 0}
                    >
                      {isSendingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {resendCountdown > 0 ? `${t('auth.resendCode')} (${resendCountdown}s)` : t('auth.sendCode')}
                    </Button>
                  </div>
                  <Input
                    id="code"
                    placeholder={canInputVerificationCode ? '' : t('auth.verificationCodeInputDisabledHint')}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    disabled={!canInputVerificationCode || isRegistering}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required={hasEmail}
                  />
                  {sentToEmail && (
                    <p className="text-sm text-muted-foreground">
                      {t('auth.verificationCodeSent', { email: sentToEmail })}
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isRegistering}
                  required
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">{t('auth.passwordRequirements')}</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>{t('auth.passwordRequirement1')}</li>
                    <li>{t('auth.passwordRequirement2')}</li>
                    <li>{t('auth.passwordRequirement3')}</li>
                  </ul>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isRegistering}
                  required
                />
                <Alert variant="warning" className="mt-2">
                  <AlertDescription>{t('auth.passwordPolyUWarning')}</AlertDescription>
                </Alert>
              </div>

              <Button type="submit" className="w-full" disabled={isRegistering}>
                {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('auth.register')}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                {t('auth.registerConsent')}{' '}
                <Link
                  href="/tos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {t('auth.termsOfService')}
                </Link>
              </p>
            </form>
          </CardContent>

          <CardFooter className="justify-center text-sm text-muted-foreground">
            <span className="mr-1">{t('auth.alreadyHaveAccount')}</span>
            <button
              type="button"
              onClick={openLoginModal}
              className="underline underline-offset-4 hover:text-primary transition-colors"
            >
              {t('auth.login')}
            </button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
