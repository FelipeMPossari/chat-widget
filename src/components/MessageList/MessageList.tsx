import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { formatDateKey, formatLongDate } from '../../utils/formatters';
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
          <div className="xwc-older-messages-loading">
            <svg className="xwc-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <EmptyState message="Nenhuma mensagem ainda." />
        ) : (
          messages.map((message, index) => (
            <Fragment key={message.id}>
              {shouldShowDateSeparator(messages, index) ? (
                <DateSeparator value={message.createdAt} />
              ) : null}
              <MessageBubble message={message} />
            </Fragment>
          ))
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

function DateSeparator({ value }: { value?: string }) {
  const label = formatLongDate(value);

  if (!label) {
    return null;
  }

  return (
    <div className="xwc-date-separator" aria-label={label}>
      <div className="xwc-date-separator-line" />
      <div className="xwc-date-separator-label">{label}</div>
      <div className="xwc-date-separator-line" />
    </div>
  );
}

function shouldShowDateSeparator(messages: ChatMessage[], index: number): boolean {
  if (index === 0) {
    return true;
  }

  return (
    formatDateKey(messages[index - 1]?.createdAt) !==
    formatDateKey(messages[index]?.createdAt)
  );
}

function getDistanceFromBottom(container: HTMLDivElement): number {
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}
