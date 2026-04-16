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
  getSessionMessages,
  type ChatMessage,
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

export function AgentChatWindowPage() {
  const params = useParams();
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const wsUrl = import.meta.env.VITE_WS_URL ?? "http://localhost:3001";
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const activeSessionRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedSessionId = (params.sessionId ?? "").trim();

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
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
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

  const loadMessages = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      return;
    }

    try {
      const history = await getSessionMessages(sessionId);
      setMessages(history);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load message history",
      );
    }
  }, []);

  const joinAndLoadSession = useCallback(
    (sessionId: string, socket?: Socket | null) => {
      const targetSocket = socket ?? socketRef.current;
      if (!sessionId || !targetSocket || !targetSocket.connected) {
        return;
      }

      targetSocket.emit("join_session", { sessionId });
      void loadMessages(sessionId);
    },
    [loadMessages],
  );

  const connectSocket = useCallback(
    (sessionId: string) => {
      if (!token) {
        setError("Missing access token. Please login again.");
        return;
      }

      socketRef.current?.disconnect();
      const socket = createChatSocket({ baseUrl: wsUrl, token });
      socketRef.current = socket;
      setConnection("connecting");
      setError("");

      socket.on("connect", () => {
        setConnection("connected");
        joinAndLoadSession(sessionId, socket);
      });

      socket.on("disconnect", () => {
        setConnection("disconnected");
      });

      socket.on("error", (payload: { message?: string }) => {
        setError(payload.message ?? "Socket error");
        setConnection("error");
      });

      socket.on("new_message", (payload: SocketIncomingMessage) => {
        if (payload.message.sessionId !== activeSessionRef.current) {
          return;
        }
        setMessages((current) => [...current, payload.message]);
      });

      socket.on(
        "user_typing",
        (payload: {
          sessionId: string;
          senderType: string;
          isTyping: boolean;
        }) => {
          if (
            payload.sessionId !== activeSessionRef.current ||
            payload.senderType === "agent"
          ) {
            return;
          }
          setIsOtherTyping(payload.isTyping);
        },
      );

      socket.on("session_ended", (payload: { sessionId?: string }) => {
        if (
          !payload.sessionId ||
          payload.sessionId !== activeSessionRef.current
        ) {
          return;
        }

        setIsOtherTyping(false);

        setError("Session was ended");
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
      if (socket.connected) {
        setConnection("connected");
        joinAndLoadSession(sessionId, socket);
      }
    },
    [joinAndLoadSession, showSuccess, token, wsUrl],
  );

  const leaveSession = () => {
    if (!socketRef.current || !selectedSessionId) {
      return;
    }
    socketRef.current.emit("leave_session", { sessionId: selectedSessionId });
    setIsOtherTyping(false);
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

  const onEndSession = async () => {
    if (!selectedSessionId) {
      setError("Session id is required");
      return;
    }

    try {
      await endSession(selectedSessionId);
      setError("");
      showSuccess("Session ended");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to end session";
      setError(message);
      showError(message);
    }
  };

  return (
    <section className="placeholder-page agent-chat-page">
      <header className="agent-chat-hero">
        <div>
          <h1>Live Chat Workspace</h1>
          <p>
            Handle realtime conversations, monitor typing/activity, and close
            sessions from one focused panel.
          </p>
        </div>
        <div className="agent-chat-hero-meta">
          <span className="agent-chat-session-tag">
            Session:{" "}
            {selectedSessionId
              ? `#${selectedSessionId.slice(0, 10)}`
              : "Not selected"}
          </span>
          <span className={`status-badge ${connection}`}>{connection}</span>
        </div>
      </header>

      <section className="agent-chat-shell">
        <article className="agent-chat-thread-card">
          <header className="agent-chat-thread-head">
            <div>
              <h2>Conversation</h2>
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

          <div className="agent-chat-info-row">
            {isOtherTyping ? (
              <span className="status-badge typing">Customer is typing...</span>
            ) : null}
            {error ? <span className="status-badge error">{error}</span> : null}
          </div>

          <div className="agent-chat-thread" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <p className="status-note">
                No messages yet. Session history loads automatically when a
                session is selected.
              </p>
            ) : null}

            {messages.map((message) => (
              <article
                key={message.id}
                className={`agent-chat-bubble ${message.senderType}`}
              >
                <header>
                  <strong>{formatSenderLabel(message.senderType)}</strong>
                  <span>
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </span>
                </header>
                <p>{message.content}</p>
              </article>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="agent-chat-composer">
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onDraftKeyDown}
              rows={3}
              placeholder="Type message..."
            />
            <div className="agent-chat-composer-actions">
              <small>Enter to send, Shift + Enter for new line</small>
              <button
                type="button"
                onClick={sendMessage}
                disabled={!draft.trim()}
              >
                Send Message
              </button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
