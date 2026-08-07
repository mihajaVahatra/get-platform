'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DefaultAvatar } from './DefaultAvatar';
import { Camera } from 'lucide-react';
import toast from 'react-hot-toast';

interface AvatarUploadProps {
  currentUrl?: string;
  endpoint: string;
  onUpload: (url: string) => void;
  fallbackText: string;
  gender?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
}

export function AvatarUpload({
  currentUrl,
  endpoint,
  onUpload,
  fallbackText,
  gender,
  firstName,
  lastName,
  size = 96,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | undefined>();
  const preview = uploadedPreview ?? currentUrl;

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
      setUploadedPreview(url);
      onUpload(url);
      toast.success('Image mise à jour !');
    } catch {
      toast.error('Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
    }
  };

  // Si une image est uploadée, on l'affiche
  const showPreview = preview !== undefined && preview !== null && preview !== '';

  return (
    <div className="relative group">
      <input
        type="file"
        id="avatar-upload"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
        disabled={isUploading}
      />
      <label htmlFor="avatar-upload" className="cursor-pointer block">
        {showPreview ? (
          <Avatar
            className="border-4 border-white/20 transition-opacity group-hover:opacity-75"
            style={{ width: size, height: size }}
          >
            <AvatarImage src={preview} />
            <AvatarFallback className="bg-purple-500 text-white text-3xl">
              {fallbackText}
            </AvatarFallback>
          </Avatar>
        ) : (
          <DefaultAvatar
            gender={gender}
            firstName={firstName}
            lastName={lastName}
            size={size}
            className="border-4 border-white/20 transition-opacity group-hover:opacity-75"
          />
        )}

        {/* Overlay flottant en bas à droite */}
        <div className="absolute bottom-0 right-0 bg-card rounded-full p-1.5 shadow-lg border-2 border-white/20 group-hover:bg-gray-100 transition-colors">
          <Camera className="h-5 w-5 text-purple-600 dark:text-purple-300" />
        </div>

        {/* Tooltip au hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full">
          <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
            {showPreview ? 'Modifier' : 'Ajouter'}
          </span>
        </div>
      </label>
    </div>
  );
}
