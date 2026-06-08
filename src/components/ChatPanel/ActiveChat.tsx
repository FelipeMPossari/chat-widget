import { ArrowLeft } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { MessageList } from '../MessageList/MessageList';
import { LoadingState } from '../shared/LoadingState';
import { MessageComposer } from './MessageComposer';

export function ActiveChat() {
    const {
        activeConversation,
        backToConversations,
        canUseConversationList,
        error,
        hasMoreOlderMessages,
        loadOlderMessages,
        messages,
        messagesLoading,
        olderMessagesLoading,
    } = useChat();

    return (
        <div className="xwc-chat">
            <div className="xwc-chat-toolbar">
                {canUseConversationList ? (
                    <button
                        className="xwc-icon-button"
                        type="button"
                        title="Voltar"
                        aria-label="Voltar para conversas"
                        onClick={backToConversations}
                    >
                        <ArrowLeft size={18} />
                    </button>
                ) : (
                    <span />
                )}
                <span className="xwc-chat-name">{activeConversation?.title}</span>
            </div>

            <div className="xwc-chat-messages-frame" aria-busy={messagesLoading}>
                <MessageList
                    messages={messages}
                    hasMoreOlderMessages={hasMoreOlderMessages}
                    olderMessagesLoading={olderMessagesLoading}
                    onLoadOlderMessages={loadOlderMessages}
                />

                {messagesLoading ? (
                    <LoadingState variant="overlay" message="Carregando mensagens..." />
                ) : null}
            </div>

            {error && <div className="xwc-error">{error}</div>}

            <MessageComposer />
        </div>
    );
}
