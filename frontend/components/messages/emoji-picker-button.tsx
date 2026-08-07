'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smile } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

const PICKER_WIDTH = 300;
const PICKER_HEIGHT = 360;

export function EmojiPickerButton({
  onSelect,
  className,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !pickerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.min(
        Math.max(rect.right - PICKER_WIDTH, 8),
        window.innerWidth - PICKER_WIDTH - 8,
      );
      const top = Math.max(rect.top - PICKER_HEIGHT - 8, 8);
      setPosition({ top, left });
    }
    setOpen((value) => !value);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="Ajouter un emoji"
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-indigo-600 dark:text-indigo-300 ${className || ''}`}
      >
        <Smile className="size-5" />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={pickerRef}
            className="fixed z-[60]"
            style={{ top: position.top, left: position.left }}
          >
            <EmojiPicker
              theme={Theme.LIGHT}
              width={PICKER_WIDTH}
              height={PICKER_HEIGHT}
              searchDisabled={false}
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
              onEmojiClick={(data: EmojiClickData) => {
                onSelect(data.emoji);
                setOpen(false);
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
