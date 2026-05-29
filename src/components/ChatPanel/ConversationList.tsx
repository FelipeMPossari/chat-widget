import { Plus } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { formatTime } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';

export function ConversationList() {
  const { conversations, createBlankConversation, selectConversation, sending } = useChat();

  return (
    <div className="xwc-list">
      <div className="xwc-list-toolbar">
        <button
          className="xwc-secondary-button"
          type="button"
          disabled={sending}
          onClick={() => void createBlankConversation()}
        >
          <Plus size={17} />
          Nova conversa
        </button>
      </div>

      <div className="xwc-conversations">
        {conversations.length === 0 ? (
          <EmptyState message="Nenhuma conversa aberta." />
        ) : (
          conversations.map((conversation) => (
            <button
              className="xwc-conversation"
              type="button"
              key={conversation.chatGuid}
              onClick={() => selectConversation(conversation)}
            >
              <span>
                <span className="xwc-conversation-title">{conversation.title}</span>
                <span className="xwc-conversation-message">
                  {conversation.lastMessage || conversation.status}
                </span>
              </span>
              <span className="xwc-conversation-time">
                {formatTime(conversation.lastMessageAt)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

