import { Plus } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { formatTime } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';

export function ConversationList() {
  const {
    conversations,
    conversationsLoading,
    openNewConversationPicker,
    sections,
    selectedSection,
    selectedTab,
    selectConversation,
    selectSection,
    selectTab,
    sending,
  } = useChat();
  const tabs = selectedSection?.tabs ?? [];

  return (
    <div className="xwc-list">
      {sections.length > 0 && (
        <div className="xwc-filters">
          <div className="xwc-filter-header">
            <div className="xwc-section-tabs" role="tablist" aria-label="Secoes do chat">
              {sections.map((section) => (
                <button
                  className="xwc-filter-button"
                  data-active={selectedSection?.sectionGuid === section.sectionGuid}
                  type="button"
                  key={section.sectionGuid || section.name}
                  disabled={conversationsLoading}
                  onClick={() => void selectSection(section)}
                >
                  {section.name}
                  {section.totalUnread > 0 && (
                    <span className="xwc-filter-count">{section.totalUnread}</span>
                  )}
                </button>
              ))}
            </div>

            <button
              className="xwc-new-chat-button"
              type="button"
              title="Nova conversa"
              aria-label="Nova conversa"
              disabled={sending || conversationsLoading}
              onClick={() => void openNewConversationPicker()}
            >
              <Plus size={18} />
            </button>
          </div>

          {tabs.length > 0 && (
            <div className="xwc-tab-tabs" role="tablist" aria-label="Filtros da secao">
              {tabs.map((tab) => (
                <button
                  className="xwc-filter-button xwc-filter-button-subtle"
                  data-active={selectedTab?.tabGuid === tab.tabGuid}
                  type="button"
                  key={tab.tabGuid || tab.name}
                  disabled={conversationsLoading}
                  onClick={() => void selectTab(tab)}
                >
                  {tab.name}
                  {tab.totalUnread > 0 && (
                    <span className="xwc-filter-count">{tab.totalUnread}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="xwc-conversations" aria-busy={conversationsLoading}>
        {conversations.length === 0 ? (
          <EmptyState
            message={conversationsLoading ? 'Carregando conversas...' : 'Nenhuma conversa aberta.'}
          />
        ) : (
          conversations.map((conversation) => (
            <button
              className="xwc-conversation"
              type="button"
              key={conversation.chatGuid}
              disabled={sending}
              onClick={() => void selectConversation(conversation)}
            >
              <span className="xwc-conversation-main">
                <span className="xwc-conversation-row">
                  <span className="xwc-conversation-title">{conversation.title}</span>
                  <span className="xwc-conversation-time">
                    {formatTime(conversation.lastMessageAt)}
                  </span>
                </span>
                <span className="xwc-conversation-message">
                  {conversation.lastMessage || 'Sem mensagens recentes'}
                </span>
              </span>
              {conversation.unreadCount > 0 && (
                <span className="xwc-unread-badge">{conversation.unreadCount}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
