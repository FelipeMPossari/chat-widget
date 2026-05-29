import { Paperclip } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { formatTime } from '../../utils/formatters';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <article className="xwc-message" data-author={message.authorType}>
      <div className="xwc-bubble">
        {message.text}
        {message.attachments?.map((attachment) => (
          <a
            className="xwc-attachment"
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            key={attachment.id}
          >
            <Paperclip size={15} />
            {attachment.fileName}
          </a>
        ))}
      </div>
      <div className="xwc-meta">
        {message.authorName ? `${message.authorName} - ` : ''}
        {formatTime(message.createdAt)}
      </div>
    </article>
  );
}

