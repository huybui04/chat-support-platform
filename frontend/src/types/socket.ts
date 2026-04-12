export type SocketIncomingMessage = {
  message: {
    id: string;
    sessionId: string;
    senderType: "agent" | "customer" | "system";
    senderId: string | null;
    content: string;
    messageType: "text" | "image" | "file" | "system";
    createdAt: string;
  };
};
