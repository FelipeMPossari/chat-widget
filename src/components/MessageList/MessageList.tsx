import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import { EmptyState } from '../shared/EmptyState';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  return (
    <div className="xwc-messages" ref={messagesRef}>
      {messages.length === 0 ? (
        <EmptyState message="Nenhuma mensagem ainda." />
      ) : (
        messages.map((message) => <MessageBubble message={message} key={message.id} />)
      )}
    </div>
  );
}

