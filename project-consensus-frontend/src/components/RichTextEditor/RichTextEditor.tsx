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
  SimpleUploadAdapter
} from 'ckeditor5';
import type { EditorConfig } from 'ckeditor5';

// CKEditor 5 styles (required for proper UI rendering)
// NOTE: Global CSS must be imported in a root layout. See `src/app/layout.tsx`.

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  // 图片上传配置 / Image upload configuration
  uploadUrl?: string; // 图片上传接口地址 / Image upload endpoint URL
  uploadHeaders?: Record<string, string>; // 上传请求头（如认证token） / Upload request headers (e.g., auth token)
  onUploadError?: (error: Error) => void; // 上传错误回调 / Upload error callback
};

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder, 
  className,
  uploadUrl,
  uploadHeaders,
  onUploadError
}: RichTextEditorProps) {
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
    // 使用服务器端上传适配器 / Using server-side upload adapter
    SimpleUploadAdapter
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
    // 图片上传配置 / Image upload configuration
    simpleUpload: uploadUrl ? {
      // TODO: 后端需要实现图片上传接口 / Backend needs to implement image upload endpoint
      // 接口规范 / API specification:
      // - 接收 multipart/form-data 格式的图片文件 / Accept multipart/form-data image files
      // - 返回格式: { url: "https://example.com/image.jpg" } / Return format: { url: "https://example.com/image.jpg" }
      // - 支持文件类型验证、大小限制、安全扫描 / Support file type validation, size limits, security scanning
      uploadUrl,
      headers: uploadHeaders,
      withCredentials: true, // 发送认证信息 / Send authentication credentials
    } : undefined
  };

  return (
    <div className={`${className} ${styles.container}`}>
      <CKEditor
        editor={ClassicEditor}
        config={config}
        data={value}
        onChange={(_, editor) => onChange(editor.getData())}
        onError={(error, { willEditorRestart }) => {
          // 处理编辑器错误 / Handle editor errors
          console.error('CKEditor error:', error);
          if (onUploadError && error.name === 'UploadError') {
            onUploadError(error);
          }
          if (willEditorRestart) {
            // 编辑器将重启，可以在这里添加加载指示器 / Editor will restart, can add loading indicator here
            console.log('Editor will restart due to error');
          }
        }}
      />
    </div>
  );
}
