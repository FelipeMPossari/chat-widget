import { KeyboardEvent, useRef, useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { useChat } from '../../hooks/useChat';

export function MessageComposer() {
  const { settings, sending, sendMessage, uploadAttachment } = useChat();
  const [draft, setDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSend() {
    const sent = await sendMessage(draft);

    if (sent) {
      setDraft('');
    }
  }

  async function handleFile(file?: File) {
    await uploadAttachment(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="xwc-message-input">
      <input
        className="xwc-hidden-file"
        type="file"
        ref={fileInputRef}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        className="xwc-icon-button"
        type="button"
        title="Anexar arquivo"
        aria-label="Anexar arquivo"
        disabled={!settings.allowAttachments || sending}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip size={18} />
      </button>
      <textarea
        aria-label="Mensagem"
        placeholder="Digite uma mensagem"
        value={draft}
        rows={1}
        disabled={sending}
        onKeyDown={handleDraftKeyDown}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        className="xwc-icon-button"
        type="button"
        title="Enviar"
        aria-label="Enviar mensagem"
        disabled={sending || !draft.trim()}
        onClick={() => void handleSend()}
      >
        <Send size={18} />
      </button>
    </div>
  );
}

