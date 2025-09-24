'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useI18n } from '@/hooks/useI18n';
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

type PrivacySettings = {
  showEmail: boolean;
  allowDMs: boolean;
  showOnlineStatus: boolean;
  showActivity: boolean;
};

const PRIVACY_KEY = 'privacySettings';

export default function SettingsPage() {
  const { t } = useI18n();
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

  if (!isLoggedIn || !user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-4">{t('settings.title')}</h1>
        <Alert>
          <AlertDescription>
            {t('settings.requireLogin')}
          </AlertDescription>
        </Alert>
      </main>
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

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={privacy.showEmail}
              onChange={(e) => setPrivacy({ ...privacy, showEmail: e.target.checked })}
            />
            <div>
              <div className="font-medium text-sm">{t('settings.privacy.items.showEmail.title')}</div>
              <div className="text-xs text-muted-foreground">{t('settings.privacy.items.showEmail.desc')}</div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={privacy.allowDMs}
              onChange={(e) => setPrivacy({ ...privacy, allowDMs: e.target.checked })}
            />
            <div>
              <div className="font-medium text-sm">{t('settings.privacy.items.allowDMs.title')}</div>
              <div className="text-xs text-muted-foreground">{t('settings.privacy.items.allowDMs.desc')}</div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={privacy.showOnlineStatus}
              onChange={(e) => setPrivacy({ ...privacy, showOnlineStatus: e.target.checked })}
            />
            <div>
              <div className="font-medium text-sm">{t('settings.privacy.items.showOnlineStatus.title')}</div>
              <div className="text-xs text-muted-foreground">{t('settings.privacy.items.showOnlineStatus.desc')}</div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={privacy.showActivity}
              onChange={(e) => setPrivacy({ ...privacy, showActivity: e.target.checked })}
            />
            <div>
              <div className="font-medium text-sm">{t('settings.privacy.items.showActivity.title')}</div>
              <div className="text-xs text-muted-foreground">{t('settings.privacy.items.showActivity.desc')}</div>
            </div>
          </label>

          <div className="pt-2">
            <Button onClick={handleSavePrivacy} disabled={privacySaving}>
              {privacySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.actions.savePrivacy')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
