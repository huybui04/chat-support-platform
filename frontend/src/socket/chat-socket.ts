import { io, type Socket } from "socket.io-client";

export type CreateChatSocketInput = {
  baseUrl: string;
  token: string;
};

export function createChatSocket({
  baseUrl,
  token,
}: CreateChatSocketInput): Socket {
  const authToken = token.trim();

  return io(`${baseUrl}/chat`, {
    transports: ["websocket"],
    autoConnect: true,
    auth: authToken ? { token: authToken } : {},
    extraHeaders: authToken
      ? { Authorization: `Bearer ${authToken}` }
      : undefined,
  });
}
