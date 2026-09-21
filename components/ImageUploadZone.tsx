'use client';

import { getAccessToken } from '@/lib/supabase/client';
import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, X, Link2 } from 'lucide-react';

interface ImageUploadZoneProps {
  label: string;
  recommendedText?: string;
  currentImageUrl?: string;
  onUploadComplete: (url: string) => void;
  folder?: string;
  aspectRatio?: '1:1' | '16:9' | 'free';
  maxSizeBytes?: number; // Default 5MB
}

// Client-side compression to prevent gigantic base64 strings from exhausting localStorage
const compressImage = async (file: File, maxDim: number): Promise<File> => {
  if (file.type === 'image/svg+xml') return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export default function ImageUploadZone({
  label,
  recommendedText = 'PNG, JPG, WebP or GIF up to 5MB',
  currentImageUrl,
  onUploadComplete,
  folder = 'uploads',
  aspectRatio = 'free',
  maxSizeBytes = 5 * 1024 * 1024, // 5MB
}: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl || '');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync internal preview if external prop changes
  React.useEffect(() => {
    if (currentImageUrl !== undefined) {
      setPreviewUrl(currentImageUrl);
      setUrlInputValue(currentImageUrl);
    }
  }, [currentImageUrl]);

  const validateFile = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return 'Invalid file type. Please upload a PNG, JPG, WebP, or GIF file.';
    }
    if (file.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      return `File exceeds maximum allowed size of ${maxMb}MB.`;
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    setErrorMsg(null);
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setUploading(true);
    setUploadProgress(20);

    try {
      // Auto-compress image before upload to avoid massive base64 payloads
      const maxDimension = aspectRatio === '16:9' ? 1200 : 500;
      const fileToUpload = await compressImage(file, maxDimension);

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('folder', folder);

      setUploadProgress(50);

      const token = await getAccessToken();
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      setUploadProgress(85);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!data.url) {
        throw new Error('Upload service did not return an asset URL');
      }

      setUploadProgress(100);
      setPreviewUrl(data.url);
      setUrlInputValue(data.url);
      onUploadComplete(data.url);
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadFile(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      uploadFile(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl('');
    setUrlInputValue('');
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = urlInputValue.trim();
    if (!cleanUrl) {
      handleRemove(e as any);
      setShowUrlInput(false);
      return;
    }
    setPreviewUrl(cleanUrl);
    onUploadComplete(cleanUrl);
    setShowUrlInput(false);
    setErrorMsg(null);
  };

  const triggerSelect = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerSelect();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="form-label" style={{ marginBottom: 0 }}>
          {label}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowUrlInput(prev => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              color: showUrlInput ? 'var(--club-primary, #10B981)' : 'var(--text-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.4rem',
              borderRadius: '4px',
            }}
          >
            <Link2 size={12} />
            <span>{showUrlInput ? 'Hide URL' : 'Link URL'}</span>
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={handleRemove}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#EF4444',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.4rem',
                borderRadius: '4px',
              }}
            >
              <X size={12} />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>

      {showUrlInput && (
        <form onSubmit={handleApplyUrl} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
          <input
            type="url"
            className="form-input"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.65rem' }}
            placeholder="https://images.unsplash.com/... or image link"
            value={urlInputValue}
            onChange={e => setUrlInputValue(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.45rem 0.85rem', flexShrink: 0 }}>
            Apply
          </button>
        </form>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/svg+xml"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-label={label}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={triggerSelect}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${
            isDragging
              ? 'var(--club-primary)'
              : previewUrl
              ? 'var(--border-medium)'
              : 'var(--border-subtle)'
          }`,
          borderRadius: 'var(--radius-md)',
          background: isDragging
            ? 'rgba(var(--club-primary-rgb), 0.08)'
            : 'rgba(0, 0, 0, 0.25)',
          padding: previewUrl ? '0.75rem' : '1.5rem',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {previewUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: aspectRatio === '16:9' ? '120px' : '64px',
                height: '64px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#000',
                border: '1px solid var(--border-subtle)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={previewUrl}
                alt={label}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: aspectRatio === '16:9' ? 'cover' : 'contain',
                }}
              />
            </div>

            <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Asset configured
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Click or drag another file to replace
              </div>
            </div>

            <div
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <RefreshCw size={12} />
              <span>Change</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: isDragging ? 'var(--club-primary)' : 'rgba(255, 255, 255, 0.05)',
                color: isDragging ? '#FFFFFF' : 'var(--club-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              {uploading ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <UploadCloud size={22} />
              )}
            </div>

            <div>
              <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.9rem' }}>
                {uploading ? 'Uploading asset...' : 'Choose a file or drag it here'}
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {recommendedText}
            </div>
          </div>
        )}

        {/* Upload progress bar */}
        {uploading && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: '3px',
              width: `${uploadProgress}%`,
              background: 'var(--club-primary)',
              transition: 'width 0.3s ease',
            }}
          />
        )}
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.75rem',
            color: '#EF4444',
            marginTop: '0.2rem',
          }}
          role="alert"
        >
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
