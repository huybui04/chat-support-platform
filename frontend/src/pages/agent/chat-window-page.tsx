import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { Socket } from "socket.io-client";
import { useParams } from "react-router-dom";

import {
  endSession,
  getSessionById,
  getSessionMessages,
  type ChatMessage,
  type ChatSession,
} from "../../services/agent-api";
import { createChatSocket } from "../../socket/chat-socket";
import { useAuth } from "../../store/auth-context";
import { useToast } from "../../store/toast-context";
import type { SocketIncomingMessage } from "../../types/socket";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

function formatSenderLabel(senderType: ChatMessage["senderType"]): string {
  if (senderType === "agent") {
    return "You";
  }

  if (senderType === "customer") {
    return "Customer";
  }

  return "System";
}

function formatChannelLabel(channel?: ChatSession["channel"]) {
  if (channel === "whatsapp") {
    return "WhatsApp";
  }

  if (channel === "instagram") {
    return "Instagram";
  }

  if (channel === "messenger") {
    return "Messenger";
  }

  if (channel === "gmail") {
    return "Gmail";
  }

  return "Web";
}

function isGmailSession(channel?: ChatSession["channel"]) {
  return channel === "gmail";
}

function formatEmailAddress(value?: string | null, fallback = "-") {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function AgentChatWindowPage() {
  const params = useParams();
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const wsUrl = import.meta.env.VITE_WS_URL ?? "http://localhost:3001";
  const initialMessageLimit = 6;
  const olderMessageLimit = 20;
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [olderMessageCursor, setOlderMessageCursor] = useState<string>();
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const activeSessionRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const preserveScrollOnPrependRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const selectedSessionId = (params.sessionId ?? "").trim();
  const gmailMode = isGmailSession(session?.channel);

  const agentMessageCount = messages.filter(
    (message) => message.senderType === "agent",
  ).length;
  const customerMessageCount = messages.filter(
    (message) => message.senderType === "customer",
  ).length;

  useEffect(() => {
    activeSessionRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSession(null);
      return;
    }

    let active = true;

    void getSessionById(selectedSessionId)
      .then((result) => {
        if (active) {
          setSession(result);
        }
      })
      .catch(() => {
        if (active) {
          setSession(null);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedSessionId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      if (shouldAutoScrollRef.current) {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
      return;
    }

    if (preserveScrollOnPrependRef.current) {
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = container.scrollTop + heightDiff;
      preserveScrollOnPrependRef.current = false;
      return;
    }

    if (shouldAutoScrollRef.current) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const loadMessages = useCallback(
    async (sessionId: string) => {
      if (!sessionId) {
        return;
      }

      try {
        setIsLoadingMessages(true);
        const result = await getSessionMessages(sessionId, {
          limit: initialMessageLimit,
        });

        setMessages(result.items);
        setHasMoreMessages(Boolean(result.meta?.hasMore));
        setOlderMessageCursor(result.meta?.beforeMessageId);
      } catch (caughtError) {
        showError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load message history",
        );
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [initialMessageLimit, showError],
  );

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return true;
    }

    return (
      container.scrollHeight - container.scrollTop - container.clientHeight < 80
    );
  }, []);

  const joinAndLoadSession = useCallback(
    (sessionId: string, socket?: Socket | null) => {
      const targetSocket = socket ?? socketRef.current;
      if (!sessionId || !targetSocket || !targetSocket.connected) {
        return;
      }

      targetSocket.emit("join_session", { sessionId });
      shouldAutoScrollRef.current = true;
      void loadMessages(sessionId);
    },
    [loadMessages],
  );

  const connectSocket = useCallback(
    (sessionId: string) => {
      if (!token) {
        showError("Missing access token. Please login again.");
        return;
      }

      socketRef.current?.disconnect();
      const socket = createChatSocket({ baseUrl: wsUrl, token });
      socketRef.current = socket;
      setConnection("connecting");

      socket.on("connect", () => {
        setConnection("connected");
        joinAndLoadSession(sessionId, socket);
      });

      socket.on("disconnect", () => {
        setConnection("disconnected");
      });

      socket.on("error", (payload: { message?: string }) => {
        showError(payload.message ?? "Socket error");
        setConnection("error");
      });

      socket.on("new_message", (payload: SocketIncomingMessage) => {
        if (payload.message.sessionId !== activeSessionRef.current) {
          return;
        }

        shouldAutoScrollRef.current =
          isNearBottom() || payload.message.senderType === "agent";
        setMessages((current) => [...current, payload.message]);
      });

      socket.on("session_ended", (payload: { sessionId?: string }) => {
        if (
          !payload.sessionId ||
          payload.sessionId !== activeSessionRef.current
        ) {
          return;
        }

        showError("Session was ended");
        showSuccess("Session ended in realtime");
      });

      socket.on(
        "session_assigned",
        (payload: { session?: { id?: string; agentId?: string | null } }) => {
          if (
            !payload.session?.id ||
            payload.session.id !== activeSessionRef.current
          ) {
            return;
          }

          showSuccess("Session assignment updated in realtime");
        },
      );

      socket.on(
        "message_error",
        (payload: { sessionId?: string; message?: string }) => {
          if (
            payload.sessionId &&
            payload.sessionId !== activeSessionRef.current
          ) {
            return;
          }

          const message = payload.message ?? "Failed to send message";
          showError(message);
        },
      );
      if (socket.connected) {
        setConnection("connected");
        joinAndLoadSession(sessionId, socket);
      }
    },
    [isNearBottom, joinAndLoadSession, showError, showSuccess, token, wsUrl],
  );

  const leaveSession = () => {
    if (!socketRef.current || !selectedSessionId) {
      return;
    }
    socketRef.current.emit("leave_session", { sessionId: selectedSessionId });
  };

  useEffect(() => {
    if (!selectedSessionId || !token) {
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      const timeoutId = window.setTimeout(() => {
        connectSocket(selectedSessionId);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    if (socket.connected) {
      const timeoutId = window.setTimeout(() => {
        setConnection("connected");
        joinAndLoadSession(selectedSessionId, socket);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    window.setTimeout(() => {
      setConnection("connecting");
    }, 0);
    const handleConnect = () => {
      setConnection("connected");
      joinAndLoadSession(selectedSessionId, socket);
    };

    socket.once("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [connectSocket, joinAndLoadSession, selectedSessionId, token]);

  const sendMessage = () => {
    if (!socketRef.current || !selectedSessionId || !draft.trim()) {
      return;
    }

    socketRef.current.emit("send_message", {
      sessionId: selectedSessionId,
      content: draft.trim(),
      messageType: "text",
    });
    socketRef.current.emit("typing_stop", { sessionId: selectedSessionId });
    setDraft("");
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    sendMessage();
  };

  const onDraftChange = (value: string) => {
    setDraft(value);

    if (!socketRef.current || !selectedSessionId) {
      return;
    }

    socketRef.current.emit("typing_start", { sessionId: selectedSessionId });
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      socketRef.current?.emit("typing_stop", { sessionId: selectedSessionId });
      typingTimeoutRef.current = null;
    }, 800);
  };

  const loadOlderMessages = useCallback(async () => {
    if (!selectedSessionId || isLoadingOlderMessages || isLoadingMessages) {
      return;
    }

    if (!hasMoreMessages || !olderMessageCursor) {
      return;
    }

    const container = messagesContainerRef.current;

    prevScrollHeightRef.current = container?.scrollHeight ?? 0;
    preserveScrollOnPrependRef.current = true;
    shouldAutoScrollRef.current = false;

    try {
      setIsLoadingOlderMessages(true);

      const result = await getSessionMessages(selectedSessionId, {
        beforeMessageId: olderMessageCursor,
        limit: olderMessageLimit,
      });

      setMessages((current) => [...result.items, ...current]);
      setHasMoreMessages(Boolean(result.meta?.hasMore));
      setOlderMessageCursor(result.meta?.beforeMessageId);
    } catch (caughtError) {
      preserveScrollOnPrependRef.current = false;
      showError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load older messages",
      );
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [
    hasMoreMessages,
    isLoadingMessages,
    isLoadingOlderMessages,
    olderMessageCursor,
    olderMessageLimit,
    selectedSessionId,
    showError,
  ]);

  const onThreadScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingOlderMessages || isLoadingMessages) {
      return;
    }

    if (container.scrollTop <= 6) {
      void loadOlderMessages();
    }
  }, [isLoadingMessages, isLoadingOlderMessages, loadOlderMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingMessages || isLoadingOlderMessages) {
      return;
    }

    // If initial batch does not overflow, fetch older chunks automatically.
    if (
      hasMoreMessages &&
      container.scrollHeight <= container.clientHeight + 2
    ) {
      shouldAutoScrollRef.current = false;
      void loadOlderMessages();
    }
  }, [
    hasMoreMessages,
    isLoadingMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
    messages.length,
  ]);

  const onEndSession = async () => {
    if (!selectedSessionId) {
      showError("Session id is required");
      return;
    }

    try {
      await endSession(selectedSessionId);
      showSuccess("Session ended");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to end session";
      showError(message);
    }
  };

  return (
    <section
      className={`placeholder-page agent-chat-page ${gmailMode ? "agent-email-page" : ""}`}
    >
      <header
        className={`agent-chat-hero ${gmailMode ? "agent-email-hero" : ""}`}
      >
        <div>
          <h1>{gmailMode ? "Gmail Conversation" : "Live Chat Workspace"}</h1>
          <p>
            {gmailMode
              ? "Review the email thread with Gmail-style headers and message cards."
              : "Handle realtime conversations, monitor typing/activity, and close sessions from one focused panel."}
          </p>
        </div>
        <div className="agent-chat-hero-meta">
          <span className="agent-chat-session-tag">
            Channel: {formatChannelLabel(session?.channel)}
          </span>
          <span className="agent-chat-session-tag">
            Session:{" "}
            {selectedSessionId
              ? `#${selectedSessionId.slice(0, 10)}`
              : "Not selected"}
          </span>
          <span className={`status-badge ${connection}`}>{connection}</span>
        </div>
      </header>

      <section
        className={`agent-chat-shell ${gmailMode ? "agent-email-shell" : ""}`}
      >
        <article
          className={`agent-chat-thread-card ${gmailMode ? "agent-email-thread-card" : ""}`}
        >
          <header className="agent-chat-thread-head">
            <div>
              <h2>
                {gmailMode
                  ? (session?.campaignName ?? "Email thread")
                  : "Conversation"}
              </h2>
              <p>{messages.length} messages</p>
            </div>
            <div className="agent-chat-thread-head-right">
              <div className="agent-chat-thread-kpis">
                <span>Agent: {agentMessageCount}</span>
                <span>Customer: {customerMessageCount}</span>
              </div>
              <div className="agent-chat-control-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={leaveSession}
                >
                  Leave
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void onEndSession()}
                >
                  End Session
                </button>
              </div>
            </div>
          </header>

          <div
            className={`agent-chat-thread ${gmailMode ? "agent-email-thread" : ""}`}
            role="log"
            aria-live="polite"
            ref={messagesContainerRef}
            onScroll={onThreadScroll}
          >
            {isLoadingMessages ? (
              <p className="status-note">Loading messages...</p>
            ) : null}

            {!isLoadingMessages && isLoadingOlderMessages ? (
              <p className="status-note">Loading older messages...</p>
            ) : null}

            {!isLoadingMessages && !hasMoreMessages && messages.length > 0 ? (
              <p className="status-note">Beginning of conversation</p>
            ) : null}

            {messages.length === 0 ? (
              <p className="status-note">
                No messages yet. Session history loads automatically when a
                session is selected.
              </p>
            ) : null}

            {messages.map((message, index) => {
              const isEmail = gmailMode;
              const previousMessage = messages[index - 1];
              const emailSubject =
                session?.campaignName?.trim() ||
                (index === 0
                  ? `Re: ${message.content.slice(0, 24)}`
                  : `Re: ${session?.contactName ?? "message"}`);
              const fromAddress =
                message.senderType === "agent"
                  ? formatEmailAddress(session?.agentName, "You")
                  : formatEmailAddress(
                      session?.contactName,
                      "customer@unknown.com",
                    );
              const toAddress =
                message.senderType === "agent"
                  ? formatEmailAddress(
                      session?.contactName,
                      "customer@unknown.com",
                    )
                  : formatEmailAddress(
                      session?.agentName,
                      "support@company.com",
                    );

              return (
                <article
                  key={message.id}
                  className={`agent-chat-bubble ${message.senderType} ${isEmail ? "agent-email-card" : ""}`}
                >
                  {isEmail ? (
                    <>
                      <header className="agent-email-card-head">
                        <div>
                          <strong>
                            {message.senderType === "agent"
                              ? "Re: "
                              : "Subject: "}
                            {emailSubject}
                          </strong>
                          <div className="agent-email-meta-row">
                            <span>
                              <b>From:</b> {fromAddress}
                            </span>
                            <span>
                              <b>To:</b> {toAddress}
                            </span>
                            <span>
                              <b>Sent:</b>{" "}
                              {new Date(message.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <span className="agent-email-card-chip">
                          {message.senderType === "agent"
                            ? "Outgoing"
                            : "Incoming"}
                        </span>
                      </header>

                      <div className="agent-email-card-body">
                        <p>{message.content}</p>

                        {previousMessage ? (
                          <blockquote className="agent-email-quote">
                            <span>Quoted previous message</span>
                            <p>{previousMessage.content}</p>
                          </blockquote>
                        ) : null}

                        {message.attachmentUrl ? (
                          <a
                            className="agent-email-attachment"
                            href={message.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open attachment
                          </a>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <header>
                        <strong>{formatSenderLabel(message.senderType)}</strong>
                        <span>
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </header>
                      <p>{message.content}</p>
                    </>
                  )}
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div
            className={`agent-chat-composer ${gmailMode ? "agent-email-composer" : ""}`}
          >
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onDraftKeyDown}
              rows={gmailMode ? 5 : 3}
              placeholder={
                gmailMode ? "Reply to this email..." : "Type message..."
              }
            />
            <div className="agent-chat-composer-actions">
              <small>
                {gmailMode
                  ? "Enter to send, Shift + Enter for new line"
                  : "Enter to send, Shift + Enter for new line"}
              </small>
              <button
                type="button"
                onClick={sendMessage}
                disabled={!draft.trim()}
              >
                {gmailMode ? "Send Email" : "Send Message"}
              </button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
