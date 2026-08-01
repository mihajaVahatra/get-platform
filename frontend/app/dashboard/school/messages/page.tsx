'use client';

import { Suspense } from 'react';
import { MessagesScreen } from '@/components/messages/messages-screen';

export default function SchoolMessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesScreen />
    </Suspense>
  );
}
