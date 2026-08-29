'use client';

import { useEffect, useState } from 'react';

import { TimedMessage } from '@/components/ui/timed-message';

export function DeckSuccessMessage() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const storedMessage = sessionStorage.getItem('deck-success-message');

    if (!storedMessage) {
      return;
    }

    setMessage(storedMessage);

    sessionStorage.removeItem('deck-success-message');
  }, []);

  if (!message) {
    return null;
  }

  return <TimedMessage message={message} onClose={() => setMessage('')} />;
}
