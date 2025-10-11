'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, X } from 'lucide-react';
import { apiUpload } from '@/lib/api/api-utils';

interface AvatarUploadProps {
  currentAvatar?: string;
  onUploadSuccess: (url: string) => void;
  className?: string;
}

export function AvatarUpload({ currentAvatar, onUploadSuccess, className }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatar || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'avatars');

      const data = await apiUpload<{ url: string }>('/api/upload/image/', formData);
      onUploadSuccess(data.url);
      setPreview(data.url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setPreview(currentAvatar || null);
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUploadSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      <div className="flex items-start gap-4">
        {/* Avatar Preview */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center">
            {preview ? (
              <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl text-muted-foreground">?</span>
            )}
          </div>
          {preview && !uploading && (
            <button
              onClick={handleRemove}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Avatar
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Max 5MB. Formats: JPEG, PNG, GIF, WebP
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
