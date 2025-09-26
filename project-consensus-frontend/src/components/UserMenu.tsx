'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

export interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps) {
  const { user, logout } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const handleProfile = () => {
    // Navigate to profile page
    window.location.href = '/profile';
    setIsOpen(false);
  };

  const handleSettings = () => {
    // Navigate to settings page
    window.location.href = '/settings';
    setIsOpen(false);
  };

  // Get user display name
  const displayName = user.name || user.email.split('@')[0];

  // Get avatar - if no avatar, display first letter
  const avatarText = user.name
    ? user.name.charAt(0).toUpperCase()
    : user.email.charAt(0).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("items-center gap-2", className)}
        >
          {/* User avatar */}
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={displayName}
              width={16}
              height={16}
              className="w-4 h-4 rounded-full"
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
              {avatarText}
            </div>
          )}

          {/* User name - on larger screens */}
          <span className="hidden sm:inline text-sm">
            {displayName}
          </span>

          {/* Dropdown arrow */}
          <ChevronDown size={12} />
        </Button>
      </DialogTrigger>

      <DialogContent className="p-0 max-w-sm">
        <DialogTitle className="sr-only">User Menu</DialogTitle>
        <div className="p-4">
          {/* User information header */}
          <div className="flex items-center gap-3 pb-4 border-b">
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt={displayName}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium">
                {avatarText}
              </div>
            )}
            <div>
              <div className="font-medium">{displayName}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>

          {/* Menu options */}
          <div className="py-4 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={handleProfile}
            >
              <User size={16} />
              Profile
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={handleSettings}
            >
              <Settings size={16} />
              Settings
            </Button>

            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
