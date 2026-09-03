'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, Bot, MessageCircle, RefreshCw, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import {
  parseAssistantAction,
  parseHousekeepingPendingRequest,
  type AssistantConfirmRequestAction,
  type HousekeepingPendingRequest,
} from '@/lib/assistant-tools/types';
import {
  buildAssistantChatRequest,
  consumeLocalAssistantInteraction,
  createAssistantSession,
  findPreparedRequestCancellationTarget,
  loadOrCreateAssistantSession,
  removePreparedRequestAction,
  resetLocalAssistantInteraction,
  resolveAssistantErrorMessage,
  saveAssistantSession,
  shouldPersistAssistantUserMessage,
  type AssistantChatMessage,
  type AssistantStoredSession,
} from '@/lib/assistant-chat-session';
import type { SupportedPublicLanguage } from '@/lib/public-language';

export type LibGuestAiChatVariant = 'grand-mercure' | 'mercure' | 'novotel' | 'default';

const MESSAGE_MAX_LENGTH = 1_500;

const HOUSEKEEPING_REQUEST_COPY = {
  pt: {
    request: 'Solicitação',
    department: 'Governança',
    item: 'Item',
    service: 'Serviço',
    towels: (quantity: number) => `${quantity} ${quantity === 1 ? 'toalha' : 'toalhas'}`,
    cleaning: 'Limpeza do quarto',
    prepared: 'Solicitação preparada localmente. Nada foi enviado ao hotel.',
    cancelled: 'A solicitação em preparação foi descartada. Nada foi enviado ao hotel.',
  },
  en: {
    request: 'Request',
    department: 'Housekeeping',
    item: 'Item',
    service: 'Service',
    towels: (quantity: number) => `${quantity} towels`,
    cleaning: 'Room cleaning',
    prepared: 'Request prepared locally. Nothing was sent to the hotel.',
    cancelled: 'The request being prepared was discarded. Nothing was sent to the hotel.',
  },
  es: {
    request: 'Solicitud',
    department: 'Gobernanza',
    item: 'Ítem',
    service: 'Servicio',
    towels: (quantity: number) => `${quantity} toallas`,
    cleaning: 'Limpieza de la habitación',
    prepared: 'Solicitud preparada localmente. No se envió nada al hotel.',
    cancelled: 'La solicitud en preparación fue descartada. No se envió nada al hotel.',
  },
} as const;

export const LIBGUEST_AI_CHAT_COPY = {
  pt: {
    launcher: 'Conversar com a Maya',
    subtitle: 'Assistente virtual',
    greeting: 'Olá! Sou a Maya, assistente virtual do hotel. Como posso ajudar?',
    placeholder: 'Digite sua pergunta…',
    send: 'Enviar',
    newConversation: 'Nova conversa',
    close: 'Fechar',
    typing: 'Maya está digitando…',
    error: 'Não consegui responder agora. Tente novamente em instantes ou fale com a recepção.',
    contactDeclinedError: 'Não consegui responder agora. Tente novamente em instantes.',
    rateLimited: 'Você enviou muitas mensagens em pouco tempo. Aguarde alguns instantes e tente novamente.',
    retry: 'Tentar novamente',
    sessionNotice: 'Esta conversa fica disponível nesta aba por até 8 horas.',
  },
  en: {
    launcher: 'Chat with Maya',
    subtitle: 'Virtual assistant',
    greeting: 'Hello! I’m Maya, the hotel’s virtual assistant. How can I help?',
    placeholder: 'Type your question…',
    send: 'Send',
    newConversation: 'New conversation',
    close: 'Close',
    typing: 'Maya is typing…',
    error: 'I couldn’t answer right now. Please try again shortly or contact the front desk.',
    contactDeclinedError: 'I couldn’t answer right now. Please try again shortly.',
    rateLimited: 'You sent too many messages in a short period. Please wait a moment and try again.',
    retry: 'Try again',
    sessionNotice: 'This conversation remains available in this tab for up to 8 hours.',
  },
  es: {
    launcher: 'Hablar con Maya',
    subtitle: 'Asistente virtual',
    greeting: '¡Hola! Soy Maya, la asistente virtual del hotel. ¿Cómo puedo ayudar?',
    placeholder: 'Escribe tu pregunta…',
    send: 'Enviar',
    newConversation: 'Nueva conversación',
    close: 'Cerrar',
    typing: 'Maya está escribiendo…',
    error: 'No pude responder ahora. Inténtalo de nuevo en unos instantes o habla con recepción.',
    contactDeclinedError: 'No pude responder ahora. Inténtalo de nuevo en unos instantes.',
    rateLimited: 'Enviaste demasiados mensajes en poco tiempo. Espera unos instantes e inténtalo de nuevo.',
    retry: 'Intentar de nuevo',
    sessionNotice: 'Esta conversación permanece disponible en esta pestaña hasta 8 horas.',
  },
} as const;

const VARIANT_CLASSES: Record<LibGuestAiChatVariant, {
  launcher: string;
  panel: string;
  header: string;
  assistantBubble: string;
  userBubble: string;
  action: string;
  brandingRule: string;
  brandingPrimary: string;
  brandingSecondary: string;
}> = {
  'grand-mercure': {
    launcher: 'border-[#f3e7d3] bg-[#a9782a] text-white shadow-[0_18px_38px_-18px_rgba(57,43,25,.72)] hover:bg-[#946722] focus-visible:ring-[#c99b50]',
    panel: 'border-[#d9c7aa] bg-[#fbf7ef] text-[#302c27] shadow-[0_28px_80px_-28px_rgba(42,35,26,.72)]',
    header: 'border-[#dfcfb6] bg-[#292826] text-[#f5ead8]',
    assistantBubble: 'border-[#e1d3bd] bg-[#fffdf9] text-[#443d35]',
    userBubble: 'bg-[#a9782a] text-white',
    action: 'bg-[#a9782a] text-white hover:bg-[#946722] focus-visible:ring-[#c99b50]',
    brandingRule: 'bg-[#a9782a]/25',
    brandingPrimary: 'text-[#8a6429]',
    brandingSecondary: 'text-[#8a6429]',
  },
  mercure: {
    launcher: 'border-white bg-[#6f2f68] text-white shadow-xl hover:bg-[#5c2757] focus-visible:ring-[#8f5087]',
    panel: 'border-[#e4ccdF] bg-[#fffafb] text-[#482043] shadow-2xl',
    header: 'border-[#ead8e7] bg-[#60265b] text-white',
    assistantBubble: 'border-[#ead8e7] bg-white text-[#482043]',
    userBubble: 'bg-[#6f2f68] text-white',
    action: 'bg-[#6f2f68] text-white hover:bg-[#5c2757] focus-visible:ring-[#8f5087]',
    brandingRule: 'bg-[#6f2f68]/20',
    brandingPrimary: 'text-[#6f2f68]',
    brandingSecondary: 'text-[#6f2f68]',
  },
  novotel: {
    launcher: 'border-white bg-[#0052b4] text-white shadow-xl hover:bg-[#003f8c] focus-visible:ring-[#3182ce]',
    panel: 'border-slate-200 bg-white text-slate-900 shadow-2xl',
    header: 'border-blue-900/20 bg-[#002f6c] text-white',
    assistantBubble: 'border-slate-200 bg-slate-50 text-slate-800',
    userBubble: 'bg-[#0052b4] text-white',
    action: 'bg-[#0052b4] text-white hover:bg-[#003f8c] focus-visible:ring-[#3182ce]',
    brandingRule: 'bg-[#0052b4]/20',
    brandingPrimary: 'text-[#0052b4]',
    brandingSecondary: 'text-[#0052b4]',
  },
  default: {
    launcher: 'border-white/70 bg-[var(--hotel-accent)] text-[color:var(--hotel-accent-foreground)] shadow-xl hover:brightness-95 focus-visible:ring-[var(--hotel-accent)]',
    panel: 'border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] text-[color:var(--hotel-text)] shadow-2xl',
    header: 'border-[color:var(--hotel-border)] bg-[var(--hotel-primary)] text-[color:var(--hotel-primary-foreground)]',
    assistantBubble: 'border-[color:var(--hotel-border)] bg-[var(--hotel-surface-muted)] text-[color:var(--hotel-text)]',
    userBubble: 'bg-[var(--hotel-accent)] text-[color:var(--hotel-accent-foreground)]',
    action: 'bg-[var(--hotel-accent)] text-[color:var(--hotel-accent-foreground)] hover:brightness-95 focus-visible:ring-[var(--hotel-accent)]',
    brandingRule: 'bg-[var(--hotel-accent)]/20',
    brandingPrimary: 'text-[color:var(--hotel-accent)]',
    brandingSecondary: 'text-[color:var(--hotel-accent)]',
  },
};

function newId() {
  return crypto.randomUUID();
}

function HousekeepingRequestCard({
  action,
  language,
  actionClassName,
  onComplete,
}: {
  action: AssistantConfirmRequestAction;
  language: SupportedPublicLanguage;
  actionClassName: string;
  onComplete: (status: 'prepared' | 'cancelled') => void;
}) {
  const requestCopy = HOUSEKEEPING_REQUEST_COPY[language];
  const request = action.request;

  return (
    <div className="mt-2 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-current/55">{requestCopy.request}</p>
      <p className="mt-0.5 font-semibold">{requestCopy.department}</p>
      <div className="mt-3 rounded-xl bg-black/[0.04] px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-current/50">
          {request.requestType === 'towels' ? requestCopy.item : requestCopy.service}
        </p>
        <p className="mt-0.5 font-medium">
          {request.requestType === 'towels'
            ? requestCopy.towels(request.quantity)
            : requestCopy.cleaning}
        </p>
      </div>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={() => onComplete('prepared')}
          className={`min-h-10 rounded-full px-3.5 py-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${actionClassName}`}
        >
          {action.label}
        </button>
        <button
          type="button"
          onClick={() => onComplete('cancelled')}
          className="min-h-10 rounded-full border border-black/15 px-3.5 py-2 font-semibold transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
        >
          {action.cancelLabel}
        </button>
      </div>
    </div>
  );
}

export function LibGuestAiChat({
  hotelSlug,
  language,
  variant = 'default',
}: {
  hotelSlug: string;
  language: SupportedPublicLanguage;
  variant?: LibGuestAiChatVariant;
}) {
  const copy = LIBGUEST_AI_CHAT_COPY[language];
  const styles = VARIANT_CLASSES[variant];
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [failureKind, setFailureKind] = useState<'unavailable' | 'rate_limited' | null>(null);
  const [pendingRequest, setPendingRequest] = useState<HousekeepingPendingRequest | null>(null);
  const sessionRef = useRef<AssistantStoredSession | null>(null);
  const messagesRef = useRef<AssistantChatMessage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const inputGenerationRef = useRef(0);
  const localInteractionGuardRef = useRef({ consumedDraftGeneration: null });

  useEffect(() => {
    inputGenerationRef.current = 0;
    resetLocalAssistantInteraction(localInteractionGuardRef.current);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const session = loadOrCreateAssistantSession({
        storage: window.sessionStorage,
        hotelSlug,
        language,
        now: new Date(),
        createId: newId,
      });
      sessionRef.current = session;
      messagesRef.current = session.messages;
      setMessages(session.messages);
      setIsReady(true);
    });
    return () => {
      active = false;
      requestControllerRef.current?.abort();
    };
  }, [hotelSlug, language]);

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [isOpen, isSending, messages]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  function replaceMessages(nextMessages: AssistantChatMessage[]) {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const updatedSession = {
      ...currentSession,
      messages: nextMessages,
      timestamp: new Date().toISOString(),
    };
    sessionRef.current = updatedSession;
    saveAssistantSession(window.sessionStorage, hotelSlug, updatedSession);
  }

  function startNewConversation() {
    if (isSending || requestControllerRef.current) return;
    const session = createAssistantSession(language, new Date(), newId);
    sessionRef.current = session;
    messagesRef.current = [];
    setMessages([]);
    setInput('');
    setFailedMessage(null);
    setFailureKind(null);
    setPendingRequest(null);
    inputGenerationRef.current = 0;
    resetLocalAssistantInteraction(localInteractionGuardRef.current);
    saveAssistantSession(window.sessionStorage, hotelSlug, session);
    textareaRef.current?.focus();
  }

  async function sendMessage(text: string, appendUserMessage: boolean) {
    const message = text.trim();
    const session = sessionRef.current;
    if (!session || !message || message.length > MESSAGE_MAX_LENGTH || isSending || requestControllerRef.current) return;

    const persistUserMessage = shouldPersistAssistantUserMessage(message);
    const preparedCancellation = findPreparedRequestCancellationTarget(
      messagesRef.current,
      message,
      language
    );
    if (
      preparedCancellation &&
      !consumeLocalAssistantInteraction(
        localInteractionGuardRef.current,
        inputGenerationRef.current
      )
    ) {
      return;
    }

    if (appendUserMessage && persistUserMessage) {
      replaceMessages([...messagesRef.current, {
        id: newId(),
        role: 'user',
        text: message,
        createdAt: new Date().toISOString(),
      }]);
    }
    if (appendUserMessage) setInput('');

    if (preparedCancellation) {
      setFailedMessage(null);
      setFailureKind(null);
      setPendingRequest(null);
      completePreparedRequest(
        preparedCancellation.messageId,
        preparedCancellation.action,
        'cancelled'
      );
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setFailedMessage(null);
    setFailureKind(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssistantChatRequest({
          hotelSlug,
          language,
          contextId: session.contextId,
          message,
          ...(pendingRequest ? { pendingRequest } : {}),
        })),
        signal: controller.signal,
      });
      const result = await response.json() as unknown;
      if (
        response.status === 429 &&
        typeof result === 'object' &&
        result !== null &&
        'error' in result &&
        result.error === 'rate_limited'
      ) {
        setFailedMessage(message);
        setFailureKind('rate_limited');
        return;
      }
      if (
        !response.ok ||
        typeof result !== 'object' ||
        result === null ||
        !('answer' in result) ||
        typeof result.answer !== 'string' ||
        !result.answer.trim()
      ) {
        throw new Error('assistant_unavailable');
      }
      const action = 'action' in result && result.action !== null
        ? parseAssistantAction(result.action)
        : null;
      if ('action' in result && result.action !== null && !action) {
        throw new Error('assistant_invalid_action');
      }
      const responseLanguage = 'responseLanguage' in result &&
        (result.responseLanguage === 'pt' || result.responseLanguage === 'en' || result.responseLanguage === 'es')
          ? result.responseLanguage
          : language;
      const nextPendingRequest = 'pendingRequest' in result && result.pendingRequest !== null
        ? parseHousekeepingPendingRequest(result.pendingRequest)
        : null;
      if (
        ('pendingRequest' in result && result.pendingRequest !== null && !nextPendingRequest) ||
        (nextPendingRequest && nextPendingRequest.language !== responseLanguage) ||
        (nextPendingRequest && action)
      ) {
        throw new Error('assistant_invalid_pending_request');
      }
      replaceMessages([...messagesRef.current, {
        id: newId(),
        role: 'assistant',
        text: result.answer.trim(),
        createdAt: new Date().toISOString(),
        ...(action ? { action } : {}),
        ...(action?.type === 'confirm_request' ? { language: responseLanguage } : {}),
      }]);
      setPendingRequest(nextPendingRequest);
    } catch {
      if (!controller.signal.aborted) {
        setFailedMessage(message);
        setFailureKind('unavailable');
      }
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setIsSending(false);
    }
  }

  function completePreparedRequest(
    messageId: string,
    action: AssistantConfirmRequestAction,
    status: 'prepared' | 'cancelled'
  ) {
    const target = messagesRef.current.find(
      (message) => message.id === messageId && message.action === action
    );
    if (!target) return;
    const responseLanguage = target.language ?? language;
    const copy = HOUSEKEEPING_REQUEST_COPY[responseLanguage];
    const messagesWithoutAction = removePreparedRequestAction(messagesRef.current, {
      messageId,
      action,
      language: responseLanguage,
    });
    if (!messagesWithoutAction) return;
    replaceMessages([...messagesWithoutAction, {
      id: newId(),
      role: 'assistant',
      text: status === 'prepared' ? copy.prepared : copy.cancelled,
      createdAt: new Date().toISOString(),
      language: responseLanguage,
    }]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input, true);
    }
  }

  const showCounter = input.length >= MESSAGE_MAX_LENGTH - 200;

  return (
    <div className="libguest-ai-chat" data-chat-variant={variant}>
      {isOpen ? (
        <section
          role="dialog"
          aria-label={`Maya — ${copy.subtitle}`}
          className={`fixed inset-x-2 top-[max(1rem,env(safe-area-inset-top))] bottom-[calc(110px+env(safe-area-inset-bottom))] z-50 flex min-h-0 flex-col overflow-hidden rounded-[26px] border min-[1025px]:inset-auto min-[1025px]:right-6 min-[1025px]:bottom-24 min-[1025px]:h-[560px] min-[1025px]:max-h-[calc(100dvh-7rem)] min-[1025px]:w-[390px] ${styles.panel}`}
        >
          <header className={`flex items-center gap-3 border-b px-4 py-3.5 ${styles.header}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-lg leading-5">Maya</h2>
              <p className="mt-0.5 text-xs opacity-75">{copy.subtitle}</p>
            </div>
            <button type="button" onClick={startNewConversation} disabled={isSending || !isReady} aria-label={copy.newConversation} title={copy.newConversation} className="inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-40">
              <RefreshCw className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setIsOpen(false)} aria-label={copy.close} title={copy.close} className="inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b78942]/15 text-[#8a6429]">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className={`max-w-[84%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-sm leading-6 ${styles.assistantBubble}`}>{copy.greeting}</p>
            </div>

            <div className="mt-3 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'items-start gap-2.5'}`}>
                  {message.role === 'assistant' ? <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b78942]/15 text-[#8a6429]"><Bot className="h-4 w-4" aria-hidden="true" /></div> : null}
                  {message.role === 'assistant' ? (
                    <div className="max-w-[84%]">
                      <p className={`whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-sm leading-6 ${styles.assistantBubble}`}>{message.text}</p>
                      {message.action?.type === 'open_url' ? (
                        <a
                          href={message.action.url}
                          target={message.action.url.startsWith('https://') ? '_blank' : undefined}
                          rel={message.action.url.startsWith('https://') ? 'noreferrer' : undefined}
                          className={`mt-2 inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${styles.action}`}
                        >
                          <span className="min-w-0 break-words">{message.action.label}</span>
                          <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </a>
                      ) : message.action?.type === 'confirm_request' ? (
                        <HousekeepingRequestCard
                          action={message.action}
                          language={message.language ?? language}
                          actionClassName={styles.action}
                          onComplete={(status) => completePreparedRequest(message.id, message.action as AssistantConfirmRequestAction, status)}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <p className={`max-w-[84%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md px-3.5 py-2.5 text-sm leading-6 ${styles.userBubble}`}>{message.text}</p>
                  )}
                </div>
              ))}
            </div>

            {isSending ? <p className="mt-3 flex items-center gap-2 pl-9 text-xs text-current/60"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />{copy.typing}</p> : null}
            {failedMessage ? (
              <div role="alert" className="mt-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900">
                <p>{failureKind === 'rate_limited'
                  ? copy.rateLimited
                  : resolveAssistantErrorMessage(
                      failedMessage,
                      copy.error,
                      copy.contactDeclinedError
                    )}</p>
                <button type="button" onClick={() => void sendMessage(failedMessage, false)} disabled={isSending} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{copy.retry}
                </button>
              </div>
            ) : null}
            <div ref={messageEndRef} />
          </div>

          <footer className="border-t border-black/10 bg-white/35 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
            <form onSubmit={(event) => { event.preventDefault(); void sendMessage(input, true); }}>
              <div className="flex items-end gap-2 rounded-[20px] border border-black/15 bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[#b78942]/45">
                <textarea ref={textareaRef} value={input} onChange={(event) => {
                  inputGenerationRef.current += 1;
                  setInput(event.target.value);
                }} onKeyDown={handleKeyDown} maxLength={MESSAGE_MAX_LENGTH} rows={1} disabled={isSending || !isReady} aria-label={copy.placeholder} placeholder={copy.placeholder} className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60" />
                <button type="submit" disabled={isSending || !isReady || !input.trim()} aria-label={copy.send} title={copy.send} className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${styles.action}`}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-1.5 flex min-h-4 items-center justify-between gap-3 px-1 text-[10px] text-current/55">
                <p>{copy.sessionNotice}</p>
                {showCounter ? <span className="shrink-0 tabular-nums">{input.length}/{MESSAGE_MAX_LENGTH}</span> : null}
              </div>
            </form>
            <span aria-hidden="true" className={`mx-auto mt-2 mb-1.5 block h-px w-8 ${styles.brandingRule}`} />
            <p className="flex flex-wrap items-baseline justify-center gap-x-1 text-center text-[10px] leading-4 tracking-[0.02em]" aria-label="Powered by LibGuest AI • Conecta AI">
              <span className="text-[9px] font-normal text-current/60">Powered by</span>
              <span className={`font-semibold ${styles.brandingPrimary}`}>LibGuest AI</span>
              <span aria-hidden="true" className="text-current/35">•</span>
              <span className={`font-medium ${styles.brandingSecondary}`}>Conecta AI</span>
            </p>
          </footer>
        </section>
      ) : null}

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={copy.launcher}
          title={copy.launcher}
          className={`fixed right-4 bottom-[calc(112px+env(safe-area-inset-bottom))] z-40 inline-flex h-14 items-center gap-2 rounded-full border-2 px-4 text-sm font-medium transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 min-[1025px]:right-6 min-[1025px]:bottom-6 ${styles.launcher}`}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          <span>Maya</span>
        </button>
      ) : null}
    </div>
  );
}
