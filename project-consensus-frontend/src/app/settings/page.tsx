'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import type { ErrorResponse } from '@/types';
import { extractErrorMessage } from '@/lib/api/error-utils';
import { useI18n } from '@/hooks/use-i18n';
import { SiteNavigation } from '@/components/SiteNavigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { Language, User } from '@/types';
import { updateProfile, updatePrivacySettings, changePassword } from '@/lib/api/user-profile';
import { HttpError } from '@/lib/api/api-utils';
import { PronounsSelector } from '@/components/PronounsSelector';
import { validateNickname } from '@/lib/utils';
import { AvatarUpload } from '@/components/AvatarUpload';

type PrivacySettings = {
  showForumPostsPublicly: boolean;
  showForumPostCommentsPublicly: boolean;
  showCourseReviewsPublicly: boolean;
};

export default function SettingsPage() {
  const { t, language, changeLanguage } = useI18n();
  const { user, isLoggedIn, updateUser } = useApp();

  // Profile form
  const [nickname, setNickname] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [pronouns, setPronouns] = useState<string>(user?.pronouns || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErrors, setPwdErrors] = useState<string[]>([]);

  // Privacy form
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    showForumPostsPublicly: user?.showForumPostsPublicly ?? true,
    showForumPostCommentsPublicly: user?.showForumPostCommentsPublicly ?? true,
    showCourseReviewsPublicly: user?.showCourseReviewsPublicly ?? true,
  });
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState<string | null>(null);
  const [privacyErr, setPrivacyErr] = useState<string | null>(null);

  // Checkbox ids to improve a11y linking via htmlFor/aria-describedby
  const checkboxIds = {
    showForumPostsPublicly: 'privacy-showForumPostsPublicly',
    showForumPostCommentsPublicly: 'privacy-showForumPostCommentsPublicly',
    showCourseReviewsPublicly: 'privacy-showCourseReviewsPublicly',
  } as const;

  useEffect(() => {
    // Initialize profile fields from user
    setNickname(user?.name || '');
    setAvatarUrl(user?.avatar || '');
    setPronouns(user?.pronouns || '');
    
    // Update privacy settings from user
    setPrivacy((p) => ({
      ...p,
      showForumPostsPublicly: user?.showForumPostsPublicly ?? true,
      showForumPostCommentsPublicly: user?.showForumPostCommentsPublicly ?? true,
      showCourseReviewsPublicly: user?.showCourseReviewsPublicly ?? true,
    }));
  }, [user]);


  const avatarPreview = useMemo(() => avatarUrl?.trim() || '', [avatarUrl]);

  // Language options (keep in sync with SiteNavigation)
  const languageOptions = [
    { code: 'zh-HK' as Language, name: '繁體中文' },
    { code: 'zh-CN' as Language, name: '简体中文' },
    { code: 'en-US' as Language, name: 'English' },
  ];

  const getCurrentLanguage = () =>
    languageOptions.find((l) => l.code === language) || languageOptions[0];

  if (!isLoggedIn || !user) {
    return (
      <>
        <SiteNavigation />
        <div className="min-h-screen bg-background">
          <main className="max-w-3xl mx-auto px-4 py-10">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
              <Button asChild variant="outline" size="sm">
                <a href="/profile">{t('settings.actions.viewProfile')}</a>
              </Button>
            </div>
            <Alert>
              <AlertDescription>
                {t('settings.requireLogin')}
              </AlertDescription>
            </Alert>
          </main>
        </div>
      </>
    );
  }

  const handleSaveProfile = async () => {
    setProfileErr(null);
    setProfileMsg(null);
    
    // Validate nickname if it's being updated
    // 如果要更新昵称，先进行验证
    if (nickname !== user?.name) {
      const validation = validateNickname(nickname);
      if (!validation.isValid) {
        setProfileErr(t(validation.error || 'settings.profile.saveFailed'));
        return;
      }
      // Use sanitized value
      // 使用消毒后的值
      setNickname(validation.sanitizedValue || nickname);
    }
    
    setProfileSaving(true);
    try {
      // Persist to backend (send sanitized value)
      const validation = validateNickname(nickname);
      const resp = await updateProfile({
        nickname: validation.sanitizedValue || nickname,
        avatar_url: avatarUrl,
        pronouns: pronouns,
      });

      // Update local user from backend response
      updateUser?.({ 
        name: resp.user.name, 
        avatar: resp.user.avatar, 
        pronouns: resp.user.pronouns,
        lastProfileUpdatedAt: resp.user.lastProfileUpdatedAt,
        daysUntilNextUpdate: resp.user.daysUntilNextUpdate
      });
      setProfileMsg(t('settings.profile.saved'));
    } catch (e: unknown) {
      console.error(e);
      
      // Check if this is a display name rate limit error (429) or already taken error
      // 检查是否为显示名称修改频率限制错误（429）或名称已被占用错误
      if (e instanceof Error) {
        const errorMessage = e.message.toLowerCase();
        
        // Check if display name is already taken
        // 检查显示名称是否已被占用
        if (errorMessage.includes('already taken') || errorMessage.includes('已被使用')) {
          setProfileErr(t('validation.nickname.alreadyTaken'));
        }
        // Check if this is a rate limit error
        // 检查是否为频率限制错误
        else if (errorMessage.includes('display name') && (errorMessage.includes('14 days') || errorMessage.includes('wait'))) {
          // Extract days from error message if possible
          // 尝试从错误消息中提取天数
          const match = errorMessage.match(/(\d+)\s*(?:more\s+)?day/i);
          const days = match ? match[1] : user?.daysUntilNextUpdate || '?';
          setProfileErr(t('settings.profile.updateLimitReached', { days }));
        } else {
          setProfileErr(e.message || t('settings.profile.saveFailed'));
        }
      } else {
        setProfileErr(t('settings.profile.saveFailed'));
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwdErrors([]);
    setPwdMsg(null);

    if (!newPassword || newPassword !== confirmPassword) {
      setPwdErrors([t('settings.account.passwordMismatch')]);
      return;
    }

    setPwdSaving(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      setPwdMsg(t('settings.account.changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      console.error(e);

      const messages: string[] = [];

      // Try to parse structured error response from our API helpers (HttpError or similar)
      const body = (e as any)?.body;
      if (typeof body === 'string' && body.trim().startsWith('{')) {
        try {
          const data: ErrorResponse = JSON.parse(body);

          const collectFieldErrors = (field: string) => {
            const raw = (data as any)[field];
            if (!raw) return;
            const arr = Array.isArray(raw) ? raw : [raw];
            for (const err of arr) {
              if (typeof err === 'string') {
                if (err.startsWith('validation.') || err.startsWith('auth.')) {
                  messages.push(t(err));
                } else {
                  messages.push(err);
                }
              }
            }
          };

          // Old password incorrect, etc.
          collectFieldErrors('current_password');
          // New password strength / reuse errors (may contain multiple i18n codes)
          collectFieldErrors('new_password');

          if (messages.length === 0) {
            // Extract a primary error message or i18n code as fallback
            let message = extractErrorMessage(data, 'settings.account.changeFailed');
            if (typeof message === 'string' && (message.startsWith('validation.') || message.startsWith('auth.'))) {
              message = t(message);
            }
            messages.push(message || t('settings.account.changeFailed'));
          }

          setPwdErrors(messages);
          return;
        } catch {
          // Ignore parse errors and fall through to generic handling
        }
      }

      // Fallback: generic error message
      setPwdErrors([t('settings.account.changeFailed')]);
    } finally {
      setPwdSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setPrivacyErr(null);
    setPrivacyMsg(null);
    setPrivacySaving(true);
    try {
      // Save the new privacy settings to backend
      const resp = await updatePrivacySettings({
        show_forum_posts_publicly: privacy.showForumPostsPublicly,
        show_forum_post_comments_publicly: privacy.showForumPostCommentsPublicly,
        show_course_reviews_publicly: privacy.showCourseReviewsPublicly,
      });
      
      // Update local user from backend response
      updateUser?.({ 
        showForumPostsPublicly: resp.user.showForumPostsPublicly, 
        showForumPostCommentsPublicly: resp.user.showForumPostCommentsPublicly, 
        showCourseReviewsPublicly: resp.user.showCourseReviewsPublicly 
      });
      
      setPrivacyMsg(t('settings.privacy.saved'));
    } catch (e) {
      console.error(e);
      setPrivacyErr(t('settings.privacy.saveFailed'));
    } finally {
      setPrivacySaving(false);
    }
  };

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
            <Button asChild variant="outline" size="sm">
              <a href="/profile">{t('settings.actions.viewProfile')}</a>
            </Button>
          </div>
          <p className="text-muted-foreground mb-8">{t('settings.subtitle')}</p>

      {/* Profile Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.profile.title')}</CardTitle>
          <CardDescription>{t('settings.profile.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileErr && (
            <Alert variant="destructive"><AlertDescription>{profileErr}</AlertDescription></Alert>
          )}
          {profileMsg && (
            <Alert><AlertDescription>{profileMsg}</AlertDescription></Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="nickname">{t('settings.profile.nickname')}</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Alice"
              maxLength={15}
              disabled={user?.daysUntilNextUpdate !== undefined && user.daysUntilNextUpdate !== null && user.daysUntilNextUpdate > 0}
            />
            <p className="text-sm text-muted-foreground">
              {nickname.trim().length}/15 {t('validation.nickname.characters')}
            </p>
            {/* Nickname update restriction info / 昵称修改限制提示 */}
            {user?.daysUntilNextUpdate !== undefined && user.daysUntilNextUpdate !== null && user.daysUntilNextUpdate > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('settings.profile.canUpdateIn', { days: user.daysUntilNextUpdate })}
              </p>
            )}
            {/* Last updated info / 最后更新信息 */}
            {user?.lastProfileUpdatedAt && (
              <p className="text-sm text-muted-foreground">
                {t('settings.profile.lastUpdated')}: {new Date(user.lastProfileUpdatedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>{t('settings.profile.avatarUrl')}</Label>
            <AvatarUpload
              currentAvatar={avatarUrl}
              onUploadSuccess={(url) => setAvatarUrl(url)}
            />
          </div>

          <PronounsSelector
            value={pronouns}
            onChange={setPronouns}
            label={t('settings.profile.pronouns')}
            id="pronouns-selector"
          />

          <div className="pt-2">
            <Button 
              onClick={handleSaveProfile} 
              disabled={profileSaving}
            >
              {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.actions.saveProfile')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preferred Language Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.language.title')}</CardTitle>
          <CardDescription>{t('settings.language.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 h-9 px-3">
                  <span className="text-sm">{getCurrentLanguage().name}</span>
                  <ChevronDown size={12} className="opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                {languageOptions.map((langOption) => (
                  <DropdownMenuItem
                    key={langOption.code}
                    onClick={() => changeLanguage(langOption.code)}
                    className={
                      language === langOption.code ? 'bg-accent text-accent-foreground' : ''
                    }
                  >
                    <span className="text-sm">{langOption.name}</span>
                    {language === langOption.code && (
                      <span className="ml-auto text-xs">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-xs text-muted-foreground">{t('settings.language.hint')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Account Security Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.account.title')}</CardTitle>
          <CardDescription>{t('settings.account.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pwdErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                {pwdErrors.length === 1 ? (
                  pwdErrors[0]
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    {pwdErrors.map((msg, idx) => (
                      <li key={idx}>{msg}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
          {pwdMsg && (
            <Alert><AlertDescription>{pwdMsg}</AlertDescription></Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="currentPassword">{t('settings.account.currentPassword')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="newPassword">{t('settings.account.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">{t('settings.account.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <Button onClick={handleChangePassword} disabled={pwdSaving}>
              {pwdSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.actions.changePassword')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.privacy.title')}</CardTitle>
          <CardDescription>{t('settings.privacy.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {privacyErr && (
            <Alert variant="destructive"><AlertDescription>{privacyErr}</AlertDescription></Alert>
          )}
          {privacyMsg && (
            <Alert><AlertDescription>{privacyMsg}</AlertDescription></Alert>
          )}

          <div className="flex items-start gap-3">
            <Checkbox
              id={checkboxIds.showForumPostsPublicly}
              className="mt-1"
              checked={privacy.showForumPostsPublicly}
              aria-describedby={`${checkboxIds.showForumPostsPublicly}-desc`}
              onCheckedChange={(checked) =>
                setPrivacy({ ...privacy, showForumPostsPublicly: checked === true })
              }
            />
            <div>
              <Label htmlFor={checkboxIds.showForumPostsPublicly} className="font-medium text-sm">
                {t('settings.privacy.items.showForumPostsPublicly.title')}
              </Label>
              <p id={`${checkboxIds.showForumPostsPublicly}-desc`} className="text-xs text-muted-foreground">
                {t('settings.privacy.items.showForumPostsPublicly.desc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id={checkboxIds.showForumPostCommentsPublicly}
              className="mt-1"
              checked={privacy.showForumPostCommentsPublicly}
              aria-describedby={`${checkboxIds.showForumPostCommentsPublicly}-desc`}
              onCheckedChange={(checked) =>
                setPrivacy({ ...privacy, showForumPostCommentsPublicly: checked === true })
              }
            />
            <div>
              <Label htmlFor={checkboxIds.showForumPostCommentsPublicly} className="font-medium text-sm">
                {t('settings.privacy.items.showForumPostCommentsPublicly.title')}
              </Label>
              <p id={`${checkboxIds.showForumPostCommentsPublicly}-desc`} className="text-xs text-muted-foreground">
                {t('settings.privacy.items.showForumPostCommentsPublicly.desc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id={checkboxIds.showCourseReviewsPublicly}
              className="mt-1"
              checked={privacy.showCourseReviewsPublicly}
              aria-describedby={`${checkboxIds.showCourseReviewsPublicly}-desc`}
              onCheckedChange={(checked) =>
                setPrivacy({ ...privacy, showCourseReviewsPublicly: checked === true })
              }
            />
            <div>
              <Label htmlFor={checkboxIds.showCourseReviewsPublicly} className="font-medium text-sm">
                {t('settings.privacy.items.showCourseReviewsPublicly.title')}
              </Label>
              <p id={`${checkboxIds.showCourseReviewsPublicly}-desc`} className="text-xs text-muted-foreground">
                {t('settings.privacy.items.showCourseReviewsPublicly.desc')}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSavePrivacy} disabled={privacySaving}>
              {privacySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.actions.savePrivacy')}
            </Button>
          </div>
        </CardContent>
      </Card>
        </main>
      </div>
    </>
  );
}
