import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import { EmptyState } from '../shared/EmptyState';

interface MessageListProps {
  messages: ChatMessage[];
  hasMoreOlderMessages: boolean;
  olderMessagesLoading: boolean;
  onLoadOlderMessages: () => Promise<void>;
}

interface ScrollSnapshot {
  firstMessageId?: string;
  lastMessageId?: string;
  scrollHeight: number;
  scrollTop: number;
  distanceFromBottom: number;
}

const LOAD_OLDER_SCROLL_THRESHOLD = 24;
const SHOW_SCROLL_BOTTOM_THRESHOLD = 140;

export function MessageList({
  messages,
  hasMoreOlderMessages,
  olderMessagesLoading,
  onLoadOlderMessages,
}: MessageListProps) {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const previousSnapshotRef = useRef<ScrollSnapshot | null>(null);
  const beforeOlderLoadSnapshotRef = useRef<ScrollSnapshot | null>(null);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  useLayoutEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    const firstMessageId = messages[0]?.id;
    const lastMessageId = messages[messages.length - 1]?.id;
    const previousSnapshot = previousSnapshotRef.current;
    const beforeOlderLoadSnapshot = beforeOlderLoadSnapshotRef.current;
    const prependedOlderMessages =
      !!beforeOlderLoadSnapshot &&
      !!previousSnapshot?.firstMessageId &&
      firstMessageId !== previousSnapshot.firstMessageId &&
      lastMessageId === previousSnapshot.lastMessageId;
    const shouldScrollToNewLastMessage =
      !previousSnapshot?.lastMessageId ||
      (lastMessageId !== previousSnapshot.lastMessageId &&
        previousSnapshot.distanceFromBottom <= SHOW_SCROLL_BOTTOM_THRESHOLD);

    if (prependedOlderMessages) {
      container.scrollTop =
        container.scrollHeight -
        beforeOlderLoadSnapshot.scrollHeight +
        beforeOlderLoadSnapshot.scrollTop;
      beforeOlderLoadSnapshotRef.current = null;
    } else if (shouldScrollToNewLastMessage) {
      container.scrollTop = container.scrollHeight;
    }

    updateScrollBottomButtonVisibility(container);
    previousSnapshotRef.current = {
      firstMessageId,
      lastMessageId,
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      distanceFromBottom: getDistanceFromBottom(container),
    };
  }, [messages]);

  async function handleScroll() {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    updateScrollBottomButtonVisibility(container);

    if (
      !hasMoreOlderMessages ||
      olderMessagesLoading ||
      container.scrollTop > LOAD_OLDER_SCROLL_THRESHOLD
    ) {
      return;
    }

    beforeOlderLoadSnapshotRef.current = {
      firstMessageId: messages[0]?.id,
      lastMessageId: messages[messages.length - 1]?.id,
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      distanceFromBottom: getDistanceFromBottom(container),
    };

    await onLoadOlderMessages();
  }

  function handleScrollToBottom() {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
    setShowScrollBottomButton(false);
  }

  function updateScrollBottomButtonVisibility(container: HTMLDivElement) {
    setShowScrollBottomButton(
      getDistanceFromBottom(container) > SHOW_SCROLL_BOTTOM_THRESHOLD
    );
  }

  return (
    <div className="xwc-messages-shell">
      <div className="xwc-messages" ref={messagesRef} onScroll={() => void handleScroll()}>
        {olderMessagesLoading ? (
          <div className="xwc-older-messages-loading">Carregando mensagens anteriores...</div>
        ) : null}
        {messages.length === 0 ? (
          <EmptyState message="Nenhuma mensagem ainda." />
        ) : (
          messages.map((message) => <MessageBubble message={message} key={message.id} />)
        )}
      </div>

      {showScrollBottomButton ? (
        <button
          type="button"
          className="xwc-scroll-bottom-button"
          title="Ir para a ultima mensagem"
          aria-label="Ir para a ultima mensagem"
          onClick={handleScrollToBottom}
        >
          <ArrowDown size={18} />
        </button>
      ) : null}
    </div>
  );
}

function getDistanceFromBottom(container: HTMLDivElement): number {
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}
