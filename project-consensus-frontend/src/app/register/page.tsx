'use client';

import { useState, FormEvent, useEffect } from 'react';
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
import { useI18n } from '@/hooks/useI18n';
import { SiteNavigation } from '@/components/SiteNavigation';
import Link from 'next/link';
import { ErrorResponse, RegisterSuccessResponse, SendVerificationCodeResponse } from '@/types';

const POLYU_EMAIL_REGEX = /@connect\.polyu\.hk$/i;

export default function RegisterPage() {
  const { t } = useI18n();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSendingCode, setIsSendingCode] = useState(false);
  const [canInputCode, setCanInputCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // countdown effect
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleSendCode = async () => {
    setError('');
    setSuccess('');

    if (!email || !POLYU_EMAIL_REGEX.test(email)) {
      setError(t('auth.errorPolyuEmail'));
      return;
    }
    try {
      setIsSendingCode(true);
      // TODO: Actual server address (backend)
      // TODO：实际服务器地址（后端）
      const res = await fetch('http://127.0.0.1:8000/api/accounts/send_verification_code/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const errorData: ErrorResponse = await res.json().catch(() => ({} as ErrorResponse));
        throw new Error(errorData.message || errorData.detail || 'Failed to send code');
      }
      setCanInputCode(true);
      setResendCountdown(60);
      setSuccess(t('common.note'));
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

    if (!nickname || !email || !password || !confirmPassword || !verificationCode) {
      setError(t('auth.errorRequiredFields'));
      return;
    }
    if (!POLYU_EMAIL_REGEX.test(email)) {
      setError(t('auth.errorPolyuEmail'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errorPasswordMismatch'));
      return;
    }

    try {
      setIsRegistering(true);
      // TODO: Actual server address (backend)
      // TODO：实际服务器地址（后端）
      const res = await fetch('http://127.0.0.1:8000/api/accounts/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          email,
          verification_code: verificationCode,
          password,
        }),
      });
      const data: RegisterSuccessResponse | ErrorResponse = await res
        .json()
        .catch(() => ({ message: 'Register failed' } as ErrorResponse));
      if (!res.ok || !(data as RegisterSuccessResponse).success) {
        const err = data as ErrorResponse;
        throw new Error(err.message || err.detail || 'Register failed');
      }

      // Persist auth and go back
      const successData = data as RegisterSuccessResponse;
      if (successData.token && successData.user) {
        localStorage.setItem('authToken', successData.token);
        localStorage.setItem('user', JSON.stringify(successData.user));
      }
      window.history.back();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('auth.errorNetwork');
      setError(message);
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
            <CardDescription>{t('auth.emailVerificationHint')}</CardDescription>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('auth.emailPrivacyNotice')}
            </p>
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
                <Label htmlFor="nickname">{t('auth.nickname')}</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isRegistering}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">{t('auth.polyuEmail')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="@connect.polyu.hk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isRegistering}
                  required
                />
              </div>

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
                  placeholder={t('auth.codeInputDisabledHint')}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  disabled={!canInputCode || isRegistering}
                  required
                />
              </div>

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
            <Link className="underline underline-offset-4" href="/">
              {t('auth.login')}
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}


