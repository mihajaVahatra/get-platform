'use client';

import { Suspense } from 'react';
import { MessagesScreen } from '@/components/messages/messages-screen';

/**
 * Page « Messages » du tableau de bord établissement (route App Router `/dashboard/school/messages`).
 * Client component (`'use client'`) car `MessagesScreen` s'appuie probablement sur des hooks
 * de navigation/état côté client. Le rendu est enveloppé dans `Suspense` (fallback vide) pour
 * permettre à `MessagesScreen` de lire des paramètres d'URL sans bloquer le rendu initial.
 */
export default function SchoolMessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesScreen />
    </Suspense>
  );
}
