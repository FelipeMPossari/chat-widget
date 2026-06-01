import { ArrowLeft } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { MessageList } from '../MessageList/MessageList';
import { MessageComposer } from './MessageComposer';

export function ActiveChat() {
    const {
        activeConversation,
        backToConversations,
        canUseConversationList,
        error,
        messages,
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

            <MessageList messages={messages} />

            {error && <div className="xwc-error">{error}</div>}

            <MessageComposer />
        </div>
    );
}

