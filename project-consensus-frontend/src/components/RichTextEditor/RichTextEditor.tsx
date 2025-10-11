'use client';

import React from 'react';
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
import { getAPIBaseUrl, getCookie } from '@/lib/api/api-utils';

// CKEditor 5 styles (required for proper UI rendering)
// NOTE: Global CSS must be imported in a root layout. See `src/app/layout.tsx`.

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const plugins: NonNullable<EditorConfig['plugins']> = [
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
  ];

  const toolbar: string[] = [
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
      uploadUrl: `${getAPIBaseUrl()}/api/upload/image/`,
      withCredentials: true,
      headers: {
        'X-CSRFToken': getCookie('csrftoken') || '',
      },
    },
  };

  return (
    <div className={cn(className, styles.container)}>
      <CKEditor
        editor={ClassicEditor}
        config={config}
        data={value}
        onChange={(_, editor) => onChange(editor.getData())}
      />
    </div>
  );
}
