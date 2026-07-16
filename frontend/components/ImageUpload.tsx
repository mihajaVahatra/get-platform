'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import toast from 'react-hot-toast';

interface ImageUploadProps {
  currentUrl?: string;
  endpoint: string;
  onUpload: (url: string) => void;
  fallbackText: string;
  size?: 'small' | 'medium' | 'large';
}

export function ImageUpload({
  currentUrl,
  endpoint,
  onUpload,
  fallbackText,
  size = 'medium',
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl);

  const sizeClasses = {
    small: 'w-16 h-16 text-lg',
    medium: 'w-28 h-28 text-3xl',
    large: 'w-40 h-40 text-4xl',
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont autorisées');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const url = response.data.data?.avatarUrl || response.data.data?.logoUrl || response.data.data?.url;
      setPreview(url);
      onUpload(url);
      toast.success('Image mise à jour !');
    } catch (error) {
      toast.error('Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar className={`${sizeClasses[size]} border-4 border-gray-200`}>
        <AvatarImage src={preview || '/avatar-placeholder.png'} />
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          {fallbackText}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-center gap-1">
        <input
          type="file"
          id="image-upload"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          disabled={isUploading}
        />
        <label htmlFor="image-upload" className="cursor-pointer">
          <button
            type="button"
            disabled={isUploading}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isUploading ? '⏳ Upload...' : '📸 Changer la photo'}
          </button>
        </label>
        <p className="text-xs text-gray-400">JPG, PNG, GIF • max 5MB</p>
      </div>
    </div>
  );
}
