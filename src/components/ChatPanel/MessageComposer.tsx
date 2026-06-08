import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import { List, Mic, Paperclip, Plus, Send, StopCircle, Trash2, X } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import type { ChatInteractiveList, ConversationSummary } from '../../types';

interface InteractiveListRowDraft {
    id: string;
    title: string;
    description: string;
}

export function MessageComposer() {
    const {
        activeConversation,
        selectedSection,
        settings,
        sending,
        sendInteractiveList,
        sendMessage,
        uploadAttachment,
    } = useChat();
    const [draft, setDraft] = useState('');
    const [isInteractiveListOpen, setIsInteractiveListOpen] = useState(false);
    const [isAudioRecording, setIsAudioRecording] = useState(false);
    const [recordingError, setRecordingError] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRecorderRef = useRef<MediaRecorder | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const canSendInteractiveList = isWhatsAppConversation(
        activeConversation,
        selectedSection?.name
    );

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

    async function handleInteractiveListSubmit(interactiveList: ChatInteractiveList) {
        const sent = await sendInteractiveList(interactiveList);

        if (sent) {
            setIsInteractiveListOpen(false);
        }
    }

    async function toggleAudioRecording() {
        if (isAudioRecording) {
            stopAudioRecording();
            return;
        }

        await startAudioRecording();
    }

    async function startAudioRecording() {
        setRecordingError('');

        if (
            !settings.allowAttachments ||
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === 'undefined'
        ) {
            setRecordingError('Gravacao de audio indisponivel neste navegador.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const options = getAudioRecorderOptions();
            const recorder = new MediaRecorder(stream, options);

            audioStreamRef.current = stream;
            audioChunksRef.current = [];
            audioRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data?.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                void sendRecordedAudio();
            };

            recorder.start();
            setIsAudioRecording(true);
        } catch {
            releaseAudioStream();
            setRecordingError('Nao foi possivel iniciar a gravacao.');
        }
    }

    function stopAudioRecording() {
        const recorder = audioRecorderRef.current;

        if (!recorder) {
            releaseAudioStream();
            setIsAudioRecording(false);
            return;
        }

        if (recorder.state !== 'inactive') {
            recorder.stop();
        }

        setIsAudioRecording(false);
    }

    async function sendRecordedAudio() {
        const mimeType = audioRecorderRef.current?.mimeType || 'audio/webm;codecs=opus';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        audioChunksRef.current = [];
        audioRecorderRef.current = null;
        releaseAudioStream();

        if (!audioBlob.size) {
            return;
        }

        const extension = getAudioFileExtension(mimeType);
        const uploadMimeType = getAudioUploadMimeType(mimeType);
        const file = new File(
            [audioBlob],
            `audio-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
            { type: uploadMimeType }
        );

        await uploadAttachment(file);
    }

    function releaseAudioStream() {
        audioStreamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
    }

    return (
        <>
            <div className="xwc-message-input">
                <input
                    className="xwc-hidden-file"
                    type="file"
                    ref={fileInputRef}
                    onChange={(event) => void handleFile(event.target.files?.[0])}
                />
                <div className="xwc-message-actions">
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
                    {canSendInteractiveList ? (
                        <button
                            className="xwc-icon-button"
                            type="button"
                            title="Enviar lista"
                            aria-label="Enviar lista"
                            disabled={sending || isAudioRecording}
                            onClick={() => setIsInteractiveListOpen(true)}
                        >
                            <List size={18} />
                        </button>
                    ) : null}
                    <button
                        className="xwc-icon-button"
                        type="button"
                        data-recording={isAudioRecording}
                        title={isAudioRecording ? 'Parar gravacao' : 'Gravar audio'}
                        aria-label={isAudioRecording ? 'Parar gravacao' : 'Gravar audio'}
                        disabled={!settings.allowAttachments || sending}
                        onClick={() => void toggleAudioRecording()}
                    >
                        {isAudioRecording ? <StopCircle size={19} /> : <Mic size={18} />}
                    </button>
                </div>
                <textarea
                    aria-label="Mensagem"
                    placeholder={isAudioRecording ? 'Gravando audio...' : 'Digite uma mensagem'}
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
                    disabled={sending || isAudioRecording || !draft.trim()}
                    onClick={() => void handleSend()}
                >
                    <Send size={18} />
                </button>
            </div>

            {recordingError ? <div className="xwc-composer-error">{recordingError}</div> : null}

            {isInteractiveListOpen ? (
                <InteractiveListDialog
                    sending={sending}
                    onClose={() => setIsInteractiveListOpen(false)}
                    onSubmit={(interactiveList) => void handleInteractiveListSubmit(interactiveList)}
                />
            ) : null}
        </>
    );
}

function InteractiveListDialog({
    sending,
    onClose,
    onSubmit,
}: {
    sending: boolean;
    onClose: () => void;
    onSubmit: (interactiveList: ChatInteractiveList) => void;
}) {
    const [headerText, setHeaderText] = useState('');
    const [bodyText, setBodyText] = useState('');
    const [buttonText, setButtonText] = useState('Ver opções');
    const [sectionTitle, setSectionTitle] = useState('Opções');
    const [rows, setRows] = useState<InteractiveListRowDraft[]>([createRow()]);
    const canSend =
        !!bodyText.trim() &&
        !!buttonText.trim() &&
        rows.some((row) => !!row.title.trim());

    function addRow() {
        if (rows.length >= 10) {
            return;
        }

        setRows((current) => [...current, createRow()]);
    }

    function removeRow(id: string) {
        if (rows.length <= 1) {
            return;
        }

        setRows((current) => current.filter((row) => row.id !== id));
    }

    function updateRow(id: string, field: 'title' | 'description', value: string) {
        setRows((current) =>
            current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
        );
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();

        if (!canSend) {
            return;
        }

        onSubmit({
            headerText: headerText.trim() || undefined,
            bodyText: bodyText.trim(),
            buttonText: buttonText.trim(),
            sections: [
                {
                    title: sectionTitle.trim() || 'Opções',
                    rows: rows
                        .filter((row) => !!row.title.trim())
                        .map((row) => ({
                            id: row.id,
                            title: row.title.trim(),
                            description: row.description.trim() || undefined,
                        })),
                },
            ],
        });
    }

    return (
        <div className="xwc-dialog-backdrop" role="presentation" onClick={onClose}>
            <form
                className="xwc-interactive-list-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="xwc-interactive-list-title"
                onSubmit={handleSubmit}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="xwc-dialog-header">
                    <div>
                        <strong id="xwc-interactive-list-title">Enviar lista</strong>
                        <p>Monte as opções que serão enviadas ao WhatsApp.</p>
                    </div>
                    <button className="xwc-message-modal-close" type="button" aria-label="Fechar" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <label className="xwc-field">
                    <span>Mensagem</span>
                    <textarea
                        rows={3}
                        maxLength={1024}
                        value={bodyText}
                        onChange={(event) => setBodyText(event.target.value)}
                    />
                </label>

                <div className="xwc-dialog-grid">
                    <label className="xwc-field">
                        <span>Texto do botão</span>
                        <input
                            maxLength={20}
                            value={buttonText}
                            onChange={(event) => setButtonText(event.target.value)}
                        />
                    </label>
                    <label className="xwc-field">
                        <span>Titulo da seção</span>
                        <input
                            maxLength={24}
                            value={sectionTitle}
                            onChange={(event) => setSectionTitle(event.target.value)}
                        />
                    </label>
                </div>

                <label className="xwc-field">
                    <span>Cabeçalho opcional</span>
                    <input
                        maxLength={60}
                        value={headerText}
                        onChange={(event) => setHeaderText(event.target.value)}
                    />
                </label>

                <div className="xwc-options-editor">
                    <div className="xwc-options-editor-header">
                        <strong>Opções</strong>
                        <button type="button" className="xwc-icon-button" aria-label="Adicionar opção" onClick={addRow}>
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="xwc-options-editor-list">
                        {rows.map((row, index) => (
                            <div className="xwc-option-row" key={row.id}>
                                <div className="xwc-option-title-row">
                                    <label className="xwc-field">
                                        <span>Opção {index + 1}</span>
                                        <input
                                            maxLength={24}
                                            value={row.title}
                                            onChange={(event) => updateRow(row.id, 'title', event.target.value)}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className="xwc-icon-button"
                                        aria-label="Remover opção"
                                        disabled={rows.length <= 1}
                                        onClick={() => removeRow(row.id)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <label className="xwc-field">
                                    <span>Descrição opcional</span>
                                    <input
                                        maxLength={72}
                                        value={row.description}
                                        onChange={(event) => updateRow(row.id, 'description', event.target.value)}
                                    />
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="xwc-dialog-actions">
                    <button className="xwc-secondary-button" type="button" onClick={onClose}>
                        Cancelar
                    </button>
                    <button className="xwc-primary-button" type="submit" disabled={!canSend || sending}>
                        Enviar
                    </button>
                </div>
            </form>
        </div>
    );
}

function isWhatsAppConversation(
    conversation?: ConversationSummary | null,
    selectedSectionName?: string
): boolean {
    const channel = normalizeLabel(conversation?.channel);

    if (channel === 'whatsapp') {
        return true;
    }

    return normalizeLabel(selectedSectionName) === 'whatsapp';
}

function normalizeLabel(value?: string): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function createRow(): InteractiveListRowDraft {
    return {
        id: `opt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: '',
        description: '',
    };
}

function getAudioRecorderOptions(): MediaRecorderOptions {
    const mimeType = [
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/webm',
    ].find((type) => MediaRecorder.isTypeSupported(type));

    return mimeType ? { mimeType } : {};
}

function getAudioFileExtension(mimeType: string): string {
    if (mimeType.includes('ogg')) {
        return 'ogg';
    }

    if (mimeType.includes('mp4') || mimeType.includes('mp4a')) {
        return 'm4a';
    }

    return 'webm';
}

function getAudioUploadMimeType(mimeType: string): string {
    if (mimeType.includes('ogg')) {
        return 'audio/ogg';
    }

    if (mimeType.includes('mp4') || mimeType.includes('mp4a')) {
        return 'application/octet-stream';
    }

    if (mimeType.includes('webm')) {
        return 'audio/webm';
    }

    return mimeType.split(';')[0] || 'application/octet-stream';
}
