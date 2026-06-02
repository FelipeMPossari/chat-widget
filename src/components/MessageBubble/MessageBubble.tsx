import { type ChangeEvent, type ReactNode, useRef, useState } from 'react';
import { Check, CheckCheck, Clock3, Paperclip, Pause, Play, TriangleAlert, X } from 'lucide-react';
import type { ChatAttachment, ChatMessage } from '../../types';
import { formatTime } from '../../utils/formatters';
import { useChat } from '../../hooks/useChat';

interface MessageBubbleProps {
    message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const { retryMessage, sending } = useChat();
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const hasAttachments = !!message.attachments?.length;
    const shouldRenderText =
        !message.interactiveList &&
        !!message.text &&
        !(hasAttachments && isAttachmentPlaceholderText(message.text, message.attachments ?? []));
    const status = normalizeStatus(message.status);
    const statusLabel = getStatusLabel(status);
    const statusIcon = getStatusIcon(status);
    const showStatusButton = status === 'failed' && !!statusIcon;
    const showStatus = !!status && !!statusIcon && !showStatusButton;
    const isRetryDisabled = sending;
    const failureDetails = getFailureDetails(message);

    async function handleRetry() {
        const retried = await retryMessage(message);

        if (retried) {
            setIsStatusModalOpen(false);
        }
    }

    return (
        <article className="xwc-message" data-author={message.authorType} data-status={status || undefined}>
            <div className="xwc-bubble">
                {showStatusButton ? (
                    <button
                        type="button"
                        className="xwc-message-status-button"
                        data-status={status}
                        title={statusLabel}
                        aria-label={statusLabel}
                        onClick={() => setIsStatusModalOpen(true)}
                    >
                        {statusIcon}
                    </button>
                ) : showStatus ? (
                    <span
                        className="xwc-message-status"
                        data-status={status}
                        title={statusLabel}
                        aria-label={statusLabel}
                    >
                        {statusIcon}
                    </span>
                ) : null}
                {shouldRenderText ? (
                    <div className="xwc-message-text">{message.text}</div>
                ) : null}
                {message.interactiveList ? (
                    <InteractiveListMessage message={message} />
                ) : null}
                {message.attachments?.map((attachment) => (
                    isImageAttachment(attachment) ? (
                        <a
                            className="xwc-attachment xwc-attachment-image-link"
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            key={attachment.id}
                            aria-label={attachment.fileName}
                        >
                            <img
                                className="xwc-attachment-image"
                                src={attachment.url}
                                alt={attachment.fileName}
                                loading="lazy"
                            />
                        </a>
                    ) : isAudioAttachment(attachment) ? (
                        <AudioAttachment attachment={attachment} key={attachment.id} />
                    ) : (
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
                    )
                ))}
            </div>
            <div className="xwc-meta">
                {message.authorName ? `${message.authorName} - ` : ''}
                {formatTime(message.createdAt)}
            </div>

            {isStatusModalOpen ? (
                <div
                    className="xwc-message-modal-backdrop"
                    role="presentation"
                    onClick={() => setIsStatusModalOpen(false)}
                >
                    <div
                        className="xwc-message-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`xwc-message-modal-title-${message.id}`}
                        aria-describedby={`xwc-message-modal-description-${message.id}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="xwc-message-modal-header">
                            <strong id={`xwc-message-modal-title-${message.id}`}>Falha ao enviar</strong>
                            <button
                                className="xwc-message-modal-close"
                                type="button"
                                aria-label="Fechar"
                                onClick={() => setIsStatusModalOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <p
                            className="xwc-message-modal-description"
                            id={`xwc-message-modal-description-${message.id}`}
                        >
                            {failureDetails.message}
                        </p>
                        {failureDetails.code ? (
                            <div className="xwc-message-modal-code">
                                <strong>Código:</strong> <span>{failureDetails.code}</span>
                            </div>
                        ) : null}
                        <div className="xwc-message-modal-actions">
                            <button
                                className="xwc-secondary-button"
                                type="button"
                                onClick={() => setIsStatusModalOpen(false)}
                            >
                                Fechar
                            </button>
                            <button
                                className="xwc-primary-button"
                                type="button"
                                onClick={() => void handleRetry()}
                                disabled={isRetryDisabled}
                            >
                                Reenviar mensagem
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </article>
    );
}

function InteractiveListMessage({ message }: { message: ChatMessage }) {
    const interactiveList = message.interactiveList;

    if (!interactiveList) {
        return null;
    }

    return (
        <div className="xwc-interactive-list-message">
            {interactiveList.headerText ? (
                <div className="xwc-interactive-list-header">{interactiveList.headerText}</div>
            ) : null}
            <div className="xwc-interactive-list-body">{interactiveList.bodyText}</div>
            <div className="xwc-interactive-list-card">
                <div className="xwc-interactive-list-button">{interactiveList.buttonText || 'Ver opções'}</div>
                {interactiveList.sections.map((section, sectionIndex) => (
                    <div className="xwc-interactive-list-section" key={`${section.title ?? 'section'}-${sectionIndex}`}>
                        {section.title ? (
                            <div className="xwc-interactive-list-section-title">{section.title}</div>
                        ) : null}
                        {section.rows.map((row, rowIndex) => (
                            <div className="xwc-interactive-list-row" key={row.id ?? `${sectionIndex}-${rowIndex}`}>
                                <div className="xwc-interactive-list-row-title">{row.title}</div>
                                {row.description ? (
                                    <div className="xwc-interactive-list-row-description">{row.description}</div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AudioAttachment({ attachment }: { attachment: ChatAttachment }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState('');

    function togglePlayback() {
        const audio = audioRef.current;

        if (!audio || !attachment.url) {
            return;
        }

        if (!audio.paused) {
            audio.pause();
            return;
        }

        setError('');
        audio.play().catch(() => {
            setError('Nao foi possivel reproduzir este audio.');
            setIsPlaying(false);
        });
    }

    function seekAudio(event: ChangeEvent<HTMLInputElement>) {
        const audio = audioRef.current;
        const time = Number(event.target.value);

        if (!audio || !Number.isFinite(time)) {
            return;
        }

        audio.currentTime = time;
        setCurrentTime(time);
    }

    return (
        <div className="xwc-audio-attachment">
            <audio
                ref={audioRef}
                preload="metadata"
                src={attachment.url}
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
                onTimeUpdate={(event) => {
                    setCurrentTime(event.currentTarget.currentTime || 0);
                    setDuration(event.currentTarget.duration || duration || 0);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={(event) => {
                    event.currentTarget.currentTime = 0;
                    setCurrentTime(0);
                    setIsPlaying(false);
                }}
                onError={() => {
                    setError('Formato de audio nao suportado pelo navegador.');
                    setIsPlaying(false);
                }}
            />
            <div className="xwc-audio-player">
                <button
                    className="xwc-audio-play-button"
                    type="button"
                    title={isPlaying ? 'Pausar audio' : 'Reproduzir audio'}
                    aria-label={isPlaying ? 'Pausar audio' : 'Reproduzir audio'}
                    disabled={!attachment.url}
                    onClick={togglePlayback}
                >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div className="xwc-audio-content">
                    <input
                        className="xwc-audio-progress"
                        type="range"
                        min="0"
                        step="0.1"
                        max={duration || 0}
                        value={currentTime}
                        disabled={!duration}
                        style={{ background: getAudioProgressBackground(currentTime, duration) }}
                        onChange={seekAudio}
                    />
                    <div className="xwc-audio-times">
                        <span>{formatAudioTime(currentTime)}</span>
                        <span>{formatAudioTime(duration)}</span>
                    </div>
                </div>
            </div>
            {error ? <div className="xwc-audio-error">{error}</div> : null}
        </div>
    );
}

function isImageAttachment(attachment: ChatAttachment): boolean {
    const contentType = attachment.contentType.toLowerCase();
    const fileName = attachment.fileName.toLowerCase();
    const url = attachment.url.toLowerCase();

    return (
        contentType.startsWith('image/') ||
        fileName.endsWith('.webp') ||
        fileName.endsWith('.png') ||
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.gif') ||
        url.endsWith('.webp') ||
        url.endsWith('.png') ||
        url.endsWith('.jpg') ||
        url.endsWith('.jpeg') ||
        url.endsWith('.gif')
    );
}

function isAudioAttachment(attachment: ChatAttachment): boolean {
    const contentType = attachment.contentType.toLowerCase();
    const fileName = attachment.fileName.toLowerCase();
    const url = attachment.url.toLowerCase();

    return (
        contentType.startsWith('audio/') ||
        fileName.endsWith('.ogg') ||
        fileName.endsWith('.oga') ||
        fileName.endsWith('.webm') ||
        fileName.endsWith('.m4a') ||
        fileName.endsWith('.mp3') ||
        url.includes('audio') ||
        url.endsWith('.ogg') ||
        url.endsWith('.oga') ||
        url.endsWith('.webm') ||
        url.endsWith('.m4a') ||
        url.endsWith('.mp3')
    );
}

function isAttachmentPlaceholderText(
    value: string,
    attachments: ChatAttachment[]
): boolean {
    const normalized = normalizeText(value);

    if (
        ['audio', 'imagem', 'image', 'video', 'sticker'].includes(normalized) ||
        normalized.includes('anexo') ||
        normalized.includes('arquivo') ||
        normalized.includes('📎')
    ) {
        return true;
    }

    return attachments.some((attachment) => {
        const fileName = normalizeText(attachment.fileName);

        return fileName.length > 0 && normalized.includes(fileName);
    });
}

function normalizeText(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function normalizeStatus(value?: string): string {
    return value?.trim().toLowerCase() ?? '';
}

function getStatusIcon(status: string): ReactNode {
    switch (status) {
        case 'failed':
            return <TriangleAlert size={12} />;
        case 'pending':
            return <Clock3 size={12} />;
        case 'delivered':
            return <CheckCheck size={12} />;
        case 'read':
            return <CheckCheck size={12} />;
        case 'sent':
            return <Check size={12} />;
        default:
            return null;
    }
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'failed':
            return 'Falha ao enviar';
        case 'pending':
            return 'Enviando';
        case 'delivered':
            return 'Recebida';
        case 'read':
            return 'Lida';
        case 'sent':
            return 'Enviada';
        default:
            return 'Mensagem';
    }
}

function getFailureDetails(message: ChatMessage): { message: string; code?: string } {
    const error = getMessageError(message);
    const messageText = readErrorText(error, 'Message') || readErrorText(error, 'message');
    const code = readErrorText(error, 'Code') || readErrorText(error, 'code');

    return {
        message: messageText || 'Nao foi possivel enviar esta mensagem.',
        code: code || undefined,
    };
}

function getAudioProgressBackground(currentTime: number, duration: number): string {
    const progress =
        duration > 0
            ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
            : 0;

    return `linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) ${progress}%, rgba(255,255,255,0.24) ${progress}%, rgba(255,255,255,0.24) 100%)`;
}

function formatAudioTime(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
        return '0:00';
    }

    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60).toString().padStart(2, '0');

    return `${minutes}:${seconds}`;
}

function getMessageError(message: ChatMessage): unknown {
    const raw = message.raw as Record<string, unknown> | undefined;

    return raw?.Error ?? raw?.error;
}

function readErrorText(error: unknown, key: string): string {
    if (!error || typeof error !== 'object') {
        return '';
    }

    const record = error as Record<string, unknown>;
    const value = record[key] ?? record[key.charAt(0).toLowerCase() + key.slice(1)];

    return typeof value === 'string' ? value.trim() : '';
}
