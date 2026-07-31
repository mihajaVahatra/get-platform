'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { MailOpen, MessageCircle, PenLine, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

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
    subject: string;
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
};
type ThreadMessage = {
  id: string;
  conversationId: string;
  subject: string;
  body: string;
  createdAt: string;
  senderId: string;
  recipientId: string;
  sender: UserPreview;
  recipient: UserPreview;
};

const nameOf = (user: UserPreview | null) =>
  user?.student
    ? `${user.student.firstName} ${user.student.lastName}`.trim()
    : user?.email || 'Utilisateur';
const dateOf = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [userId, setUserId] = useState('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/messages/conversations?limit=30');
      const items = response.data.data ?? [];
      setConversations(items);
      setSelected(
        (current) =>
          items.find(
            (conversation: Conversation) => conversation.id === current?.id,
          ) ??
          items[0] ??
          null,
      );
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      toast.error(
        'Impossible de charger les conversations. Vérifiez la migration Prisma.',
      );
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
      toast.error('Impossible de charger cette discussion');
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

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    try {
      const response = await apiClient.post('/messages', {
        recipientEmail: form.get('recipientEmail'),
        subject: form.get('subject'),
        body: form.get('body'),
      });
      const sent = response.data.data as ThreadMessage;
      toast.success('Message envoyé');
      setShowCompose(false);
      await loadConversations();
      const conversation = (response.data.data as ThreadMessage).conversationId;
      setSelected({
        id: conversation,
        lastMessageAt: sent.createdAt,
        participant: sent.recipient,
        unreadCount: 0,
        lastMessage: sent,
      });
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Impossible d’envoyer le message'
          : 'Impossible d’envoyer le message',
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
      await apiClient.post('/messages', {
        recipientEmail: selected.participant.email,
        subject: selected.lastMessage?.subject || 'Discussion',
        body: replyText.trim(),
      });
      setReplyText('');
      await Promise.all([loadConversations(), loadThread(selected.id)]);
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Impossible d’envoyer la réponse'
          : 'Impossible d’envoyer la réponse',
      );
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] text-[#111a4b]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Messages</h1>
          <p className="mt-1 text-xs text-slate-500">
            Vos discussions privées avec les étudiants et les services GET.
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
        >
          <PenLine className="size-4" />
          Nouveau message
        </button>
      </header>
      <div className="grid overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_18px_rgba(68,50,140,0.05)] md:grid-cols-[310px_1fr]">
        <aside className="border-b border-slate-100 md:border-b-0 md:border-r">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-extrabold">Discussions</p>
            <p className="mt-1 text-[10px] text-slate-500">
              Les messages sont regroupés par contact.
            </p>
          </div>
          <div className="max-h-[590px] overflow-y-auto">
            {loading ? (
              <p className="p-5 text-xs text-slate-500">Chargement…</p>
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
        <section className="flex min-h-[500px] flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600">
                  {nameOf(selected.participant)[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">
                    {nameOf(selected.participant)}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {selected.participant?.email}
                  </p>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#fcfcff] p-4">
                {threadLoading ? (
                  <p className="text-center text-xs text-slate-400">
                    Chargement de la discussion…
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
                className="border-t border-slate-100 bg-white p-3"
              >
                <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-400">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={2}
                    maxLength={20000}
                    placeholder={`Répondre à ${nameOf(selected.participant)}…`}
                    className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
                  />
                  <button
                    disabled={
                      replying ||
                      !replyText.trim() ||
                      !selected.participant?.email
                    }
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Envoyer la réponse"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[10px] text-slate-400">
                  Entrée crée une nouvelle ligne · cliquez sur l’avion pour
                  envoyer
                </p>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <MailOpen className="size-10 text-violet-200" />
              <p className="mt-3 text-sm font-bold text-slate-700">
                Aucune discussion sélectionnée
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Choisissez un contact ou démarrez un nouveau message.
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
  return (
    <button
      onClick={onClick}
      className={`w-full border-b border-slate-50 px-4 py-3 text-left transition hover:bg-violet-50/60 ${active ? 'bg-violet-50' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
          {nameOf(conversation.participant)[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-xs font-extrabold">
              {nameOf(conversation.participant)}
            </span>
            <span className="ml-auto text-[10px] text-slate-400">
              {dateOf(conversation.lastMessageAt)}
            </span>
          </span>
          <span className="mt-1 flex gap-2">
            <span className="truncate text-[10px] text-slate-500">
              {conversation.lastMessage?.body || 'Nouvelle discussion'}
            </span>
            {conversation.unreadCount > 0 && (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white">
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
        className={`max-w-[82%] rounded-2xl px-4 py-3 ${mine ? 'rounded-br-sm bg-violet-600 text-white' : 'rounded-bl-sm bg-white text-slate-700 shadow-sm ring-1 ring-slate-100'}`}
      >
        <p
          className={`mb-1 text-[10px] font-bold ${mine ? 'text-violet-200' : 'text-violet-500'}`}
        >
          {message.subject}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-5">{message.body}</p>
        <p
          className={`mt-2 text-right text-[10px] ${mine ? 'text-violet-200' : 'text-slate-400'}`}
        >
          {dateOf(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
function EmptyConversation({ onCompose }: { onCompose: () => void }) {
  return (
    <div className="p-6 text-center">
      <MessageCircle className="mx-auto size-7 text-violet-200" />
      <p className="mt-2 text-xs font-bold text-slate-700">Aucune discussion</p>
      <button
        onClick={onCompose}
        className="mt-3 text-xs font-bold text-violet-600"
      >
        Écrire un message
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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  sending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <form
        onSubmit={onSubmit}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold">Nouvelle discussion</h2>
            <p className="mt-1 text-xs text-slate-500">
              Une discussion existante sera automatiquement réutilisée.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          <Field
            name="recipientEmail"
            type="email"
            label="Destinataire"
            placeholder="enrolled@test.com"
          />
          <Field
            name="subject"
            label="Objet"
            placeholder="Ex. Question sur le cours"
          />
          <label className="block text-xs font-bold text-slate-700">
            Message
            <textarea
              name="body"
              required
              minLength={1}
              maxLength={20000}
              className="mt-1.5 min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-400"
              placeholder="Écrivez votre message…"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            <Send className="size-4" />
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </form>
    </div>
  );
}
function Field({
  label,
  name,
  type = 'text',
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
}) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
      />
    </label>
  );
}
