'use client';

import { FileText, Download } from 'lucide-react';
import { formatFileSize } from './attachment-utils';

export type SentAttachment = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: string;
};

export function AttachmentGrid({
  attachments,
  mine,
}: {
  attachments: SentAttachment[];
  mine: boolean;
}) {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((attachment) => (
        <AttachmentItem key={attachment.id} attachment={attachment} mine={mine} />
      ))}
    </div>
  );
}

function AttachmentItem({
  attachment,
  mine,
}: {
  attachment: SentAttachment;
  mine: boolean;
}) {
  if (attachment.kind === 'IMAGE') {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="max-h-52 w-full max-w-[240px] rounded-lg object-cover"
        />
      </a>
    );
  }
  if (attachment.kind === 'VIDEO') {
    return (
      <video
        src={attachment.url}
        controls
        className="max-h-56 w-full max-w-[280px] rounded-lg"
      />
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
        mine
          ? 'bg-indigo-700/60 text-white hover:bg-indigo-700'
          : 'bg-muted text-foreground hover:bg-muted'
      }`}
    >
      <FileText className="size-4 shrink-0" />
      <span className="max-w-[160px] truncate">{attachment.fileName}</span>
      <span className={mine ? 'text-indigo-200' : 'text-muted-foreground'}>
        {formatFileSize(attachment.size)}
      </span>
      <Download className="size-3.5 shrink-0" />
    </a>
  );
}
