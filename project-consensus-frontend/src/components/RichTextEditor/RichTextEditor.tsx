'use client';

import React, { useEffect, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import styles from './RichTextEditor.module.css';
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  List,
  Indent,
  IndentBlock,
  BlockQuote,
  CodeBlock,
  Table,
  TableToolbar,
  Image,
  ImageToolbar,
  ImageCaption,
  ImageStyle,
  ImageResize,
  ImageUpload,
  PictureEditing,
  SimpleUploadAdapter,
} from 'ckeditor5';
import type { EditorConfig } from 'ckeditor5';
import { cn } from '@/lib/utils';
import { getAPIBaseUrl, getCookie, ensureCSRFCookie } from '@/lib/api/api-utils';

// CKEditor 5 styles (required for proper UI rendering)
// NOTE: Global CSS must be imported in a root layout. See `src/app/layout.tsx`.

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  disableImages?: boolean;  /* Disable image insertion (for comments/replies). Shows error toast when attempting to insert images. */
  imagesDisabledMessage?: string;  /* Error message to show when image insertion is blocked. Defaults to "Images are not allowed here". */
};

export default function RichTextEditor({ value, onChange, placeholder, className, disableImages = false, imagesDisabledMessage }: RichTextEditorProps) {
  const [csrfToken, setCSRFToken] = useState<string>('');
  const [imageError, setImageError] = useState<string | null>(null);

  // Ensure CSRF token is available before mounting the editor
  useEffect(() => {
    const initCSRF = async () => {
      await ensureCSRFCookie();
      const token = getCookie('csrftoken') || '';
      setCSRFToken(token);
    };
    initCSRF();
  }, []);
  // Base plugins (always included)
  const basePlugins: NonNullable<EditorConfig['plugins']> = [
    Essentials,
    Paragraph,
    Heading,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Link,
    List,
    Indent,
    IndentBlock,
    BlockQuote,
    CodeBlock,
    Table,
    TableToolbar,
  ];

  // Image plugins (only included when images are allowed)
  const imagePlugins: NonNullable<EditorConfig['plugins']> = [
    Image,
    ImageToolbar,
    ImageCaption,
    ImageStyle,
    ImageResize,
    ImageUpload,
    PictureEditing,
    SimpleUploadAdapter,
  ];

  const plugins: NonNullable<EditorConfig['plugins']> = disableImages
    ? basePlugins
    : [...basePlugins, ...imagePlugins];

  // Toolbar items (excludes uploadImage when images are disabled)
  const toolbar: string[] = disableImages
    ? [
        'undo', 'redo', '|',
        'heading', '|',
        'bold', 'italic', 'underline', 'strikethrough', 'link', '|',
        'bulletedList', 'numberedList', 'outdent', 'indent', '|',
        'blockQuote', 'codeBlock', '|',
        'insertTable'
      ]
    : [
        'undo', 'redo', '|',
        'heading', '|',
        'bold', 'italic', 'underline', 'strikethrough', 'link', '|',
        'bulletedList', 'numberedList', 'outdent', 'indent', '|',
        'blockQuote', 'codeBlock', '|',
        'insertTable', 'uploadImage'
      ];

  const config: EditorConfig = {
    // Free usage under GPL; set a commercial key if you purchase one later
    licenseKey: process.env.NEXT_PUBLIC_CKEDITOR_LICENSE_KEY ?? 'GPL',
    plugins,
    toolbar,
    placeholder,
    image: {
      toolbar: [
        'toggleImageCaption',
        'imageTextAlternative',
        '|',
        'imageStyle:inline',
        'imageStyle:block',
        'imageStyle:side',
        '|',
        'resizeImage'
      ]
    },
    table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] },
    // SimpleUploadAdapter configuration for R2 image upload
    // CKEditor sends images with field name 'upload'
    simpleUpload: {
      uploadUrl: `${getAPIBaseUrl()}/api/upload/image/?folder=images`,
      withCredentials: true,
      headers: {
        'X-CSRFToken': csrfToken,
      },
    },
  };

  // Auto-dismiss image error after 3 seconds
  useEffect(() => {
    if (imageError) {
      const timer = setTimeout(() => setImageError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [imageError]);

  // Default error message
  const defaultImageErrorMessage = 'Images are not allowed in comments and replies';
  const errorMessage = imagesDisabledMessage || defaultImageErrorMessage;

  // Handle editor ready - add clipboard listeners to block images
  const handleEditorReady = (editor: ClassicEditor) => {
    if (!disableImages) return;

    // Get the editing view to listen for clipboard events
    const view = editor.editing.view;
    const viewDocument = view.document;

    // Listen for clipboardInput events to block image paste/drop
    viewDocument.on('clipboardInput', (evt, data) => {
      const dataTransfer = data.dataTransfer;
      if (!dataTransfer) return;

      // Check if clipboard contains image files
      const files = Array.from(dataTransfer.files || []) as File[];
      const hasImageFile = files.some(file => file.type.startsWith('image/'));
      
      // Check if clipboard contains image data in HTML
      const htmlData = dataTransfer.getData('text/html') || '';
      const hasImageInHtml = /<img\s/i.test(htmlData);

      if (hasImageFile || hasImageInHtml) {
        evt.stop();
        setImageError(errorMessage);
      }
    });
  };

  // Don't render editor until CSRF token is retrieved
  if (!csrfToken) {
    return <div className={cn(className, styles.container)}>Loading editor...</div>;
  }

  return (
    <div className={cn(className, styles.container, 'relative')}>
      {/* Image error toast */}
      {imageError && (
        <div className="absolute top-0 left-0 right-0 z-50 p-2 bg-destructive text-destructive-foreground text-sm text-center rounded-t-md animate-in fade-in slide-in-from-top-2 duration-200">
          {imageError}
        </div>
      )}
      <CKEditor
        editor={ClassicEditor}
        config={config}
        data={value}
        onChange={(_, editor) => onChange(editor.getData())}
        onReady={handleEditorReady}
      />
    </div>
  );
}
