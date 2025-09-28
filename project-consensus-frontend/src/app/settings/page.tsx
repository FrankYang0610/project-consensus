'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useI18n } from '@/hooks/useI18n';
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
import { Language } from '@/types';

type PrivacySettings = {
  showEmail: boolean;
  allowDMs: boolean;
  showOnlineStatus: boolean;
  showActivity: boolean;
};

const PRIVACY_KEY = 'privacySettings';

export default function SettingsPage() {
  const { t, language, changeLanguage } = useI18n();
  const { user, isLoggedIn, updateUser } = useApp();

  // Profile form
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  // Privacy form
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    showEmail: false,
    allowDMs: true,
    showOnlineStatus: true,
    showActivity: true,
  });
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState<string | null>(null);
  const [privacyErr, setPrivacyErr] = useState<string | null>(null);

  // Checkbox ids to improve a11y linking via htmlFor/aria-describedby
  const checkboxIds = {
    showEmail: 'privacy-showEmail',
    allowDMs: 'privacy-allowDMs',
    showOnlineStatus: 'privacy-showOnlineStatus',
    showActivity: 'privacy-showActivity',
  } as const;

  useEffect(() => {
    // Initialize profile fields from user
    setDisplayName(user?.name || '');
    setAvatarUrl(user?.avatar || '');
  }, [user]);

  useEffect(() => {
    // Load privacy from localStorage
    try {
      const raw = localStorage.getItem(PRIVACY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PrivacySettings;
        setPrivacy((p) => ({ ...p, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  const avatarPreview = useMemo(() => avatarUrl?.trim() || '', [avatarUrl]);

  // Language options (keep in sync with SiteNavigation)
  const languageOptions = [
    { code: 'zh-HK' as Language, name: '繁體中文', flag: '🇭🇰' },
    { code: 'zh-CN' as Language, name: '简体中文', flag: '🇨🇳' },
    { code: 'en-US' as Language, name: 'English', flag: '🇺🇸' },
  ];

  const getCurrentLanguage = () =>
    languageOptions.find((l) => l.code === language) || languageOptions[0];

  if (!isLoggedIn || !user) {
    return (
      <>
        <SiteNavigation />
        <div className="min-h-screen bg-background">
          <main className="max-w-3xl mx-auto px-4 py-10">
            <h1 className="text-2xl font-semibold mb-4">{t('settings.title')}</h1>
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
    setProfileSaving(true);
    try {
      // Placeholder: directly update frontend state/localStorage via AppContext
      updateUser?.({ name: displayName, avatar: avatarUrl });
      setProfileMsg(t('settings.profile.saved'));
    } catch (e) {
      console.error(e);
      setProfileErr(t('settings.profile.saveFailed'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwdErr(null);
    setPwdMsg(null);

    if (!newPassword || newPassword !== confirmPassword) {
      setPwdErr(t('settings.account.passwordMismatch'));
      return;
    }

    setPwdSaving(true);
    try {
      // TODO: integrate backend endpoint
      // Example:
      // const resp = await fetch('/api/auth/change_password/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      // if (!resp.ok) throw new Error('Failed');

      // For now, simulate success
      await new Promise((r) => setTimeout(r, 600));
      setPwdMsg(t('settings.account.changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      console.error(e);
      setPwdErr(t('settings.account.changeFailed'));
    } finally {
      setPwdSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setPrivacyErr(null);
    setPrivacyMsg(null);
    setPrivacySaving(true);
    try {
      localStorage.setItem(PRIVACY_KEY, JSON.stringify(privacy));
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
          <h1 className="text-2xl font-semibold mb-2">{t('settings.title')}</h1>
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
            <Label htmlFor="displayName">{t('settings.profile.displayName')}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alice"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="avatarUrl">{t('settings.profile.avatarUrl')}</Label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
            TODO: validate URL to prevent XSS?
            {avatarPreview && (
              <div className="flex items-center gap-3 mt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreview}
                  alt="avatar preview"
                  className="w-12 h-12 rounded-full border object-cover"
                />
                <span className="text-xs text-muted-foreground">{t('settings.profile.preview')}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button onClick={handleSaveProfile} disabled={profileSaving}>
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
                  <span className="text-sm">{getCurrentLanguage().flag}</span>
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
                    <span className="mr-2">{langOption.flag}</span>
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
          {pwdErr && (
            <Alert variant="destructive"><AlertDescription>{pwdErr}</AlertDescription></Alert>
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
              id={checkboxIds.showEmail}
              className="mt-1"
              checked={privacy.showEmail}
              aria-describedby={`${checkboxIds.showEmail}-desc`}
              onCheckedChange={(checked) =>
                setPrivacy({ ...privacy, showEmail: checked === true })
              }
            />
            <div>
              <Label htmlFor={checkboxIds.showEmail} className="font-medium text-sm">
                {t('settings.privacy.items.showEmail.title')}
              </Label>
              <p id={`${checkboxIds.showEmail}-desc`} className="text-xs text-muted-foreground">
                {t('settings.privacy.items.showEmail.desc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id={checkboxIds.allowDMs}
              className="mt-1"
              checked={privacy.allowDMs}
              aria-describedby={`${checkboxIds.allowDMs}-desc`}
              onCheckedChange={(checked) =>
                setPrivacy({ ...privacy, allowDMs: checked === true })
              }
            />
            <div>
              <Label htmlFor={checkboxIds.allowDMs} className="font-medium text-sm">
                {t('settings.privacy.items.allowDMs.title')}
              </Label>
              <p id={`${checkboxIds.allowDMs}-desc`} className="text-xs text-muted-foreground">
                {t('settings.privacy.items.allowDMs.desc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id={checkboxIds.showOnlineStatus}
              className="mt-1"
              checked={privacy.showOnlineStatus}
              aria-describedby={`${checkboxIds.showOnlineStatus}-desc`}
              onCheckedChange={(checked) =>
                setPrivacy({ ...privacy, showOnlineStatus: checked === true })
              }
            />
            <div>
              <Label htmlFor={checkboxIds.showOnlineStatus} className="font-medium text-sm">
                {t('settings.privacy.items.showOnlineStatus.title')}
              </Label>
              <p id={`${checkboxIds.showOnlineStatus}-desc`} className="text-xs text-muted-foreground">
                {t('settings.privacy.items.showOnlineStatus.desc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id={checkboxIds.showActivity}
              className="mt-1"
              checked={privacy.showActivity}
              aria-describedby={`${checkboxIds.showActivity}-desc`}
              onCheckedChange={(checked) =>
                setPrivacy({ ...privacy, showActivity: checked === true })
              }
            />
            <div>
              <Label htmlFor={checkboxIds.showActivity} className="font-medium text-sm">
                {t('settings.privacy.items.showActivity.title')}
              </Label>
              <p id={`${checkboxIds.showActivity}-desc`} className="text-xs text-muted-foreground">
                {t('settings.privacy.items.showActivity.desc')}
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
