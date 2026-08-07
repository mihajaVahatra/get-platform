'use client';

import { ChangeEvent, useRef } from 'react';
import { Paperclip, FileText, Film, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  formatFileSize,
  validateAttachment,
} from './attachment-utils';

export function AttachmentPickerButton({
  files,
  onChange,
  className,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;

    if (files.length + picked.length > MAX_ATTACHMENTS) {
      toast.error(`Vous ne pouvez joindre que ${MAX_ATTACHMENTS} fichiers maximum`);
      return;
    }
    const accepted: File[] = [];
    for (const file of picked) {
      const error = validateAttachment(file);
      if (error) {
        toast.error(error);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) onChange([...files, ...accepted]);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        onChange={onPick}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Joindre un fichier"
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-indigo-600 dark:text-indigo-300 ${className || ''}`}
      >
        <Paperclip className="size-5" />
      </button>
    </>
  );
}

export function PendingAttachmentChips({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (!files.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {files.map((file, index) => (
        <span
          key={`${file.name}-${index}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300"
        >
          {file.type.startsWith('video/') ? (
            <Film className="size-3.5" />
          ) : (
            <FileText className="size-3.5" />
          )}
          <span className="max-w-[140px] truncate">{file.name}</span>
          <span className="text-indigo-400">{formatFileSize(file.size)}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Retirer ${file.name}`}
            className="text-indigo-400 hover:text-indigo-700 dark:text-indigo-300"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
