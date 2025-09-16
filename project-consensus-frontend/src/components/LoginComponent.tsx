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
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useApp } from '@/contexts/AppContext';
import { LoginResponse } from '@/types/app-types';
import { useI18n } from '@/hooks/useI18n';

/**
 * 登录组件属性 / Login component props
 */
export interface LoginComponentProps {
    className?: string; // 自定义CSS类名（可选） / Custom CSS class name (optional)
    onLoginSuccess?: (user: import('@/types/user').User) => void; // 登录成功回调（可选） / Login success callback (optional)
}

export function LoginComponent({ className }: LoginComponentProps) {
    const { t } = useI18n();
    // Auth context
    const { login } = useApp();
    
    // State management
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Reset Form
    const resetForm = () => {
        setEmail('');
        setPassword('');
        setError('');
    };

    // Backend Login API, Incomplete!
    const handleLogin = async (email: string, password: string): Promise<LoginResponse> => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    device: 'web',
                    userAgent: navigator.userAgent
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Login failed');
            }

            return response.json();
        } catch (err) {
            console.error('Login error:', err);
            throw err;
        }
    };

    // Google Auth
    const handleGoogleAuth = async (): Promise<void> => {
        // Redirect to Oauth google auth endpoint
        window.location.href = '/api/auth/google';
    };

    // Form submit handle
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Basic Verification, needs more cases
        if (!email || !password) {
            setError(t('auth.errorRequiredFields'));
            setIsLoading(false);
            return;
        }

        if (!email.includes('@')) {
            setError(t('auth.errorInvalidEmail'));
            setIsLoading(false);
            return;
        }

        try {
            const result = await handleLogin(email, password);

            if (result.success && result.user) {
                // Save token to localStorage or cookie
                if (result.token) {
                    localStorage.setItem('authToken', result.token);
                    // Or use cookies
                    // document.cookie = `authToken=${result.token}; path=/; secure; samesite=strict`;
                }

                // Use AuthContext to save user information
                login(result.user, result.token!);

                // Close modal and reset form
                setIsOpen(false);
                resetForm();

                // No need to refresh page, AuthContext will automatically update UI

            } else {
                setError(result.message || 'Login failed');
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t('auth.errorNetwork');
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Google login handling
    const handleGoogleLogin = async () => {
        setIsGoogleLoading(true);
        setError('');

        try {
            await handleGoogleAuth();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t('auth.errorGoogleFailed');
            setError(errorMessage);
            setIsGoogleLoading(false);
        }
    };

    // Forget password handling
    const handleForgotPassword = () => {
        // Navigate to forgot password page
        window.location.href = '/forgot-password';
    };

    // Sign up handling
    const handleSignUp = () => {
        setIsOpen(false);
        window.location.href = '/register';
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="default"
                    className={`items-center gap-2 ${className}`}
                >
                    <User size={16} />
                    <span>{t('auth.login')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="p-0 max-w-sm overflow-hidden rounded-xl">
                <DialogTitle className="sr-only">{t('auth.login')}</DialogTitle>
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
                                {/* Email Input */}
                                <div className="grid gap-2">
                                    <Label htmlFor="email">{t('auth.email')}</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="@connect.polyu.hk"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
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
                            </div>
                        </form>
                    </CardContent>

                    <CardFooter className="flex-col gap-3">
                        {/* Login Button */}
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('auth.login')}
                        </Button>

                        {/* Google Login button */}
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={handleGoogleLogin}
                            disabled={isGoogleLoading || isLoading}
                        >
                            {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('auth.loginWithGoogle')}
                        </Button>

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
            </DialogContent>
        </Dialog>
    );
}