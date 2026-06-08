import { ArrowLeft, MessageCircle, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import type { ChatContactType, ConversationSummary } from '../../types';
import { formatTime } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { LoadingState } from '../shared/LoadingState';

const CONTACT_TYPES: { value: ChatContactType; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'usuarios', label: 'Usuários' },
  { value: 'pessoas', label: 'Pessoas' },
  { value: 'whatsapp', label: 'Whatsapp' },
  { value: 'instagram', label: 'Instagram' },
];

export function ConversationList() {
  const {
    closeNewConversationPicker,
    contactPickerOpen,
    contacts,
    contactsLoading,
    conversations,
    conversationsLoading,
    loadContacts,
    openNewConversationPicker,
    sections,
    selectedSection,
    selectedTab,
    selectConversation,
    selectSection,
    selectTab,
    sending,
  } = useChat();
  const [contactType, setContactType] = useState<ChatContactType>('todos');
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const tabs = selectedSection?.tabs ?? [];

  useEffect(() => {
    if (!contactPickerOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadContacts({
        contactType,
        searchTerm: contactSearchTerm,
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [contactPickerOpen, contactSearchTerm, contactType, loadContacts]);

  if (contactPickerOpen) {
    return (
      <div className="xwc-list xwc-contact-picker-list">
        <div className="xwc-contact-picker-header">
          <button
            className="xwc-icon-button xwc-contact-back"
            type="button"
            title="Voltar"
            aria-label="Voltar para conversas"
            onClick={closeNewConversationPicker}
          >
            <ArrowLeft size={18} />
          </button>
          <strong>Novo chat</strong>
        </div>

        <div className="xwc-contact-filters">
          <label className="xwc-search-field">
            <Search size={16} />
            <input
              type="search"
              value={contactSearchTerm}
              placeholder="Buscar contatos"
              onChange={(event) => setContactSearchTerm(event.target.value)}
            />
          </label>

          <div className="xwc-section-tabs" role="tablist" aria-label="Tipos de contato">
            {CONTACT_TYPES.map((type) => (
              <button
                className="xwc-filter-button"
                data-active={contactType === type.value}
                type="button"
                key={type.value}
                disabled={contactsLoading}
                onClick={() => setContactType(type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="xwc-conversations-shell" aria-busy={contactsLoading}>
          <div className="xwc-conversations">
            {contacts.length === 0 && !contactsLoading ? (
              <EmptyState message="Nenhum contato encontrado." />
            ) : (
              contacts.map((contact) => (
                <button
                  className="xwc-conversation"
                  type="button"
                  key={contact.chatGuid}
                  disabled={sending || contactsLoading}
                  onClick={() => void selectContact(contact)}
                >
                  <span className="xwc-contact-avatar" aria-hidden="true">
                    <MessageCircle size={18} />
                  </span>
                  <span className="xwc-conversation-main">
                    <span className="xwc-conversation-title">{contact.title}</span>
                    <span className="xwc-conversation-message">
                      {getContactDescription(contact, contactType)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {contactsLoading ? (
            <LoadingState variant="overlay" message="Carregando contatos..." />
          ) : null}
        </div>
      </div>
    );
  }

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

          {tabs.length > 1 && (
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

      <div className="xwc-conversations-shell" aria-busy={conversationsLoading}>
        <div className="xwc-conversations">
          {conversations.length === 0 && !conversationsLoading ? (
            <EmptyState message="Nenhuma conversa aberta." />
          ) : (
            conversations.map((conversation) => (
              <button
                className="xwc-conversation"
                type="button"
                key={conversation.chatGuid}
                disabled={sending || conversationsLoading}
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

        {conversationsLoading ? (
          <LoadingState variant="overlay" message="Carregando conversas..." />
        ) : null}
      </div>
    </div>
  );

  async function selectContact(contact: ConversationSummary) {
    await selectConversation(contact);
    closeNewConversationPicker();
  }
}

function getContactDescription(
  contact: ConversationSummary,
  contactType: ChatContactType
): string {
  const member = contact.members[0];

  if (contactType === 'todos') {
    return getContactDescriptionForAll(contact);
  }

  if (contactType === 'whatsapp') {
    return member?.number || contact.lastMessage || 'Whatsapp';
  }

  if (contactType === 'instagram') {
    return member?.externalId || contact.lastMessage || 'Instagram';
  }

  if (contactType === 'usuarios') {
    return 'Usuário do sistema';
  }

  return 'Pessoa';
}

function getContactDescriptionForAll(contact: ConversationSummary): string {
  const member = contact.members[0];
  const memberType = `${member?.type ?? ''}`.toLowerCase();
  const channel = `${contact.channel ?? ''}`.toLowerCase();

  if (channel === 'whatsapp' || member?.number) {
    return member?.number || 'Whatsapp';
  }

  if (channel === 'instagram' || member?.externalId) {
    return member?.externalId || 'Instagram';
  }

  if (memberType.includes('usuario')) {
    return 'Usuário do sistema';
  }

  return contact.lastMessage || 'Contato';
}
