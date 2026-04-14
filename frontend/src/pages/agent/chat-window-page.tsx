import { useEffect, useRef, useState } from "react";
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

export function AgentChatWindowPage() {
  const params = useParams();
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [wsUrl, setWsUrl] = useState(
    import.meta.env.VITE_WS_URL ?? "http://localhost:3001",
  );
  const [sessionIdInput, setSessionIdInput] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState("disconnected");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [error, setError] = useState("");
  const [lastRealtimeSyncAt, setLastRealtimeSyncAt] = useState<string | null>(
    null,
  );

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const activeSessionRef = useRef("");
  const selectedSessionId = (params.sessionId ?? sessionIdInput).trim();

  useEffect(() => {
    activeSessionRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const connectSocket = () => {
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
      setLastRealtimeSyncAt(new Date().toISOString());
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
        setLastRealtimeSyncAt(new Date().toISOString());
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
      setLastRealtimeSyncAt(new Date().toISOString());
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

        setLastRealtimeSyncAt(new Date().toISOString());
        showSuccess("Session assignment updated in realtime");
      },
    );
  };

  const joinSession = () => {
    if (!selectedSessionId) {
      setError("Session id is required");
      return;
    }

    if (!socketRef.current) {
      setError("Socket is not connected");
      return;
    }

    setError("");
    socketRef.current.emit("join_session", { sessionId: selectedSessionId });
    void loadMessages();
  };

  const leaveSession = () => {
    if (!socketRef.current || !selectedSessionId) {
      return;
    }
    socketRef.current.emit("leave_session", { sessionId: selectedSessionId });
    setIsOtherTyping(false);
  };

  const loadMessages = async () => {
    if (!selectedSessionId) {
      setError("Session id is required");
      return;
    }

    try {
      const history = await getSessionMessages(selectedSessionId);
      setMessages(history);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load message history",
      );
    }
  };

  useEffect(() => {
    if (!selectedSessionId || !socketRef.current) {
      return;
    }

    socketRef.current.emit("join_session", { sessionId: selectedSessionId });
  }, [selectedSessionId]);

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
    <section className="placeholder-page">
      <h1>Chat Window</h1>
      <p>Realtime socket + history API for an active chat session.</p>

      <div className="chat-controls">
        <input
          value={wsUrl}
          onChange={(event) => setWsUrl(event.target.value)}
          placeholder="WebSocket URL"
        />
        <input
          value={params.sessionId ?? sessionIdInput}
          onChange={(event) => setSessionIdInput(event.target.value)}
          readOnly={Boolean(params.sessionId)}
          placeholder="Session ID"
        />
        <button type="button" onClick={connectSocket}>
          Connect
        </button>
        <button type="button" onClick={joinSession}>
          Join
        </button>
        <button type="button" className="secondary" onClick={leaveSession}>
          Leave
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void loadMessages()}
        >
          Load History
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void onEndSession()}
        >
          End Session
        </button>
      </div>

      <p className="status-note with-badges">
        Socket:
        <span className={`status-badge ${connection}`}>{connection}</span>
        <span>Last realtime sync:</span>
        <span>
          {lastRealtimeSyncAt
            ? new Date(lastRealtimeSyncAt).toLocaleTimeString()
            : "-"}
        </span>
      </p>
      {isOtherTyping ? (
        <p className="status-note with-badges">
          <span className="status-badge typing">Customer is typing...</span>
        </p>
      ) : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="chat-thread">
        {messages.map((message) => (
          <article key={message.id} className="chat-bubble">
            <header>
              <strong>{message.senderType}</strong>
              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
            </header>
            <p>{message.content}</p>
          </article>
        ))}
      </div>

      <div className="chat-composer">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          rows={3}
          placeholder="Type message..."
        />
        <button type="button" onClick={sendMessage}>
          Send
        </button>
      </div>
    </section>
  );
}
