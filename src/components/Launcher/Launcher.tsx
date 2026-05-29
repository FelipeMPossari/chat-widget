import { MessageCircle, X } from 'lucide-react';
import { useChat } from '../../hooks/useChat';

export function Launcher() {
  const { isOpen, toggleOpen } = useChat();

  return (
    <button
      className="xwc-launcher"
      type="button"
      aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
      onClick={toggleOpen}
    >
      {isOpen ? <X size={28} /> : <MessageCircle size={30} />}
    </button>
  );
}

