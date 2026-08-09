'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import {
  ArrowLeft,
  MailOpen,
  MessageCircle,
  Paperclip,
  PenLine,
  Send,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { EmojiPickerButton } from '@/components/messages/emoji-picker-button';
import {
  AttachmentPickerButton,
  PendingAttachmentChips,
} from '@/components/messages/attachment-picker';
import {
  AttachmentGrid,
  type SentAttachment,
} from '@/components/messages/attachment-view';

type UserPreview = {
  id: string;
  email: string;
  student?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  } | null;
};
type Conversation = {
  id: string;
  lastMessageAt: string;
  participant: UserPreview | null;
  unreadCount: number;
  lastMessage: {
    id: string;
    subject: string | null;
    body: string;
    createdAt: string;
    senderId: string;
    hasAttachments?: boolean;
  } | null;
};
type ThreadMessage = {
  id: string;
  conversationId: string;
  subject: string | null;
  body: string;
  createdAt: string;
  senderId: string;
  recipientId: string;
  sender: UserPreview;
  recipient: UserPreview;
  attachments?: SentAttachment[];
};

function buildMessageFormData(payload: {
  recipientEmail: string;
  subject?: string;
  body: string;
  files: File[];
}) {
  const formData = new FormData();
  formData.append('recipientEmail', payload.recipientEmail);
  if (payload.subject?.trim()) formData.append('subject', payload.subject.trim());
  formData.append('body', payload.body);
  payload.files.forEach((file) => formData.append('attachments', file));
  return formData;
}

const nameOf = (user: UserPreview | null, fallback: string) =>
  user?.student
    ? `${user.student.firstName} ${user.student.lastName}`.trim()
    : user?.email || fallback;
const dateOf = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageContent />
    </Suspense>
  );
}

function MessagesPageContent() {
  const t = useTranslations('StudentMessages');
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(
    searchParams.get('compose') === '1',
  );
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replying, setReplying] = useState(false);
  const [userId, setUserId] = useState('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/messages/conversations?limit=30');
      const items = response.data.data ?? [];
      setConversations(items);
      setSelected((current) =>
        current
          ? (items.find(
              (conversation: Conversation) => conversation.id === current.id,
            ) ?? null)
          : null,
      );
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      toast.error(t('loadConversationsError'));
      setConversations([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (conversationId: string) => {
    setThreadLoading(true);
    try {
      const response = await apiClient.get(
        `/messages/conversations/${conversationId}?limit=50`,
      );
      setMessages(response.data.data ?? []);
      await apiClient.patch(`/messages/conversations/${conversationId}/read`);
      setConversations((items) =>
        items.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
      window.dispatchEvent(new Event('messages:updated'));
    } catch (error) {
      console.error('Erreur chargement discussion:', error);
      toast.error(t('loadThreadError'));
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadConversations);
  }, [loadConversations]);
  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((response) => setUserId(response.data.data.user?.id || ''))
      .catch(() => setUserId(''));
  }, []);
  useEffect(() => {
    if (selected) void Promise.resolve().then(() => loadThread(selected.id));
    else void Promise.resolve().then(() => setMessages([]));
  }, [selected, loadThread]);

  const openConversation = (conversation: Conversation) =>
    setSelected(conversation);

  const sendMessage = async (payload: {
    recipientEmail: string;
    subject: string;
    body: string;
    files: File[];
  }) => {
    setSending(true);
    try {
      const response = await apiClient.post(
        '/messages',
        buildMessageFormData(payload),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const sent = response.data.data as ThreadMessage;
      toast.success(t('messageSent'));
      setShowCompose(false);
      await loadConversations();
      setSelected({
        id: sent.conversationId,
        lastMessageAt: sent.createdAt,
        participant: sent.recipient,
        unreadCount: 0,
        lastMessage: {
          ...sent,
          hasAttachments: (sent.attachments?.length ?? 0) > 0,
        },
      });
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || t('sendMessageError')
          : t('sendMessageError'),
      );
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected?.participant?.email || !replyText.trim()) return;
    setReplying(true);
    try {
      await apiClient.post(
        '/messages',
        buildMessageFormData({
          recipientEmail: selected.participant.email,
          body: replyText.trim(),
          files: replyFiles,
        }),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setReplyText('');
      setReplyFiles([]);
      await Promise.all([loadConversations(), loadThread(selected.id)]);
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || t('sendReplyError')
          : t('sendReplyError'),
      );
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] text-[#111a4b]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">{t('title')}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
        >
          <PenLine className="size-4" />
          {t('newMessage')}
        </button>
      </header>
      <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-[0_4px_18px_rgba(68,50,140,0.05)] md:grid-cols-[310px_1fr]">
        <aside
          className={`${selected ? 'hidden md:block' : ''} border-b border-border md:border-b-0 md:border-r`}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-extrabold">{t('discussionsTitle')}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t('discussionsSubtitle')}
            </p>
          </div>
          <div className="max-h-[590px] overflow-y-auto">
            {loading ? (
              <p className="p-5 text-xs text-muted-foreground">{t('loading')}</p>
            ) : conversations.length === 0 ? (
              <EmptyConversation onCompose={() => setShowCompose(true)} />
            ) : (
              conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={selected?.id === conversation.id}
                  onClick={() => openConversation(conversation)}
                />
              ))
            )}
          </div>
        </aside>
        <section
          className={`${selected ? 'flex' : 'hidden md:flex'} min-h-[280px] flex-col md:min-h-[500px]`}
        >
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b border-border p-4">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={t('backToDiscussions')}
                  className="-ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted md:hidden"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <span className="flex size-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-sm font-bold text-indigo-600 dark:text-indigo-300">
                  {nameOf(selected.participant, t('defaultUser'))[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">
                    {nameOf(selected.participant, t('defaultUser'))}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {selected.participant?.email}
                  </p>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#fcfcff] p-4">
                {threadLoading ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {t('loadingThread')}
                  </p>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      mine={message.senderId === userId}
                    />
                  ))
                )}
              </div>
              <form
                onSubmit={sendReply}
                className="border-t border-border bg-card p-3"
              >
                <PendingAttachmentChips
                  files={replyFiles}
                  onRemove={(index) =>
                    setReplyFiles((files) => files.filter((_, i) => i !== index))
                  }
                />
                <div className="flex items-end gap-1 rounded-xl border border-border bg-muted p-2 focus-within:border-indigo-400">
                  <AttachmentPickerButton
                    files={replyFiles}
                    onChange={setReplyFiles}
                  />
                  <EmojiPickerButton
                    onSelect={(emoji) =>
                      setReplyText((text) => `${text}${emoji}`)
                    }
                  />
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={2}
                    maxLength={20000}
                    placeholder={t('replyPlaceholder', { name: nameOf(selected.participant, t('defaultUser')) })}
                    className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
                  />
                  <button
                    disabled={
                      replying ||
                      !replyText.trim() ||
                      !selected.participant?.email
                    }
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title={t('sendReplyTitle')}
                  >
                    <Send className="size-4" />
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
                  {t('replyHint')}
                </p>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <MailOpen className="size-10 text-indigo-200" />
              <p className="mt-3 text-sm font-bold text-foreground">
                {t('noDiscussionSelected')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('chooseContact')}
              </p>
            </div>
          )}
        </section>
      </div>
      {showCompose && (
        <ComposeDialog
          onClose={() => setShowCompose(false)}
          onSubmit={sendMessage}
          sending={sending}
        />
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const t = useTranslations('StudentMessages');
  return (
    <button
      onClick={onClick}
      className={`w-full border-b border-slate-50 px-4 py-3 text-left transition hover:bg-indigo-50/60 ${active ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-xs font-bold text-indigo-600 dark:text-indigo-300">
          {nameOf(conversation.participant, t('defaultUser'))[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-xs font-extrabold">
              {nameOf(conversation.participant, t('defaultUser'))}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {dateOf(conversation.lastMessageAt)}
            </span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            {conversation.lastMessage?.hasAttachments && (
              <Paperclip className="size-3 shrink-0 text-indigo-400" />
            )}
            <span className="truncate text-[10px] text-muted-foreground">
              {conversation.lastMessage?.body || t('newConversationFallback')}
            </span>
            {conversation.unreadCount > 0 && (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                {conversation.unreadCount}
              </span>
            )}
          </span>
        </span>
      </div>
    </button>
  );
}
function MessageBubble({
  message,
  mine,
}: {
  message: ThreadMessage;
  mine: boolean;
}) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 ${mine ? 'rounded-br-sm bg-indigo-600 text-white' : 'rounded-bl-sm bg-card text-foreground shadow-sm ring-1 ring-slate-100'}`}
      >
        {message.subject && (
          <p
            className={`mb-1 text-[10px] font-bold ${mine ? 'text-indigo-200' : 'text-indigo-500 dark:text-indigo-300'}`}
          >
            {message.subject}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-5">{message.body}</p>
        <AttachmentGrid attachments={message.attachments || []} mine={mine} />
        <p
          className={`mt-2 text-right text-[10px] ${mine ? 'text-indigo-200' : 'text-muted-foreground'}`}
        >
          {dateOf(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
function EmptyConversation({ onCompose }: { onCompose: () => void }) {
  const t = useTranslations('StudentMessages');
  return (
    <div className="p-6 text-center">
      <MessageCircle className="mx-auto size-7 text-indigo-200" />
      <p className="mt-2 text-xs font-bold text-foreground">{t('noDiscussion')}</p>
      <button
        onClick={onCompose}
        className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-300"
      >
        {t('writeMessage')}
      </button>
    </div>
  );
}
function ComposeDialog({
  onClose,
  onSubmit,
  sending,
}: {
  onClose: () => void;
  onSubmit: (payload: {
    recipientEmail: string;
    subject: string;
    body: string;
    files: File[];
  }) => void;
  sending: boolean;
}) {
  const t = useTranslations('StudentMessages');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipientEmail.trim() || !body.trim()) return;
    onSubmit({ recipientEmail: recipientEmail.trim(), subject, body, files });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold">{t('newDiscussion')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('reuseExisting')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-bold text-foreground">
            {t('recipient')}
            <input
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              placeholder="enrolled@test.com"
              required
              maxLength={254}
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
          </label>
          <label className="block text-xs font-bold text-foreground">
            {t('subject')} <span className="font-normal text-muted-foreground">{t('optional')}</span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ex. Question sur le cours"
              maxLength={200}
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
          </label>
          <label className="block text-xs font-bold text-foreground">
            {t('message')}
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
              minLength={1}
              maxLength={20000}
              className="mt-1.5 min-h-32 w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-indigo-400"
              placeholder={t('messagePlaceholder')}
            />
          </label>
          <PendingAttachmentChips
            files={files}
            onRemove={(index) =>
              setFiles((current) => current.filter((_, i) => i !== index))
            }
          />
          <div className="flex items-center gap-1">
            <AttachmentPickerButton files={files} onChange={setFiles} />
            <EmojiPickerButton
              onSelect={(emoji) => setBody((current) => `${current}${emoji}`)}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
          >
            {t('cancel')}
          </button>
          <button
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            <Send className="size-4" />
            {sending ? t('sendingEllipsis') : t('send')}
          </button>
        </div>
      </form>
    </div>
  );
}
