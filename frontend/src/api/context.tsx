import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { WyvernClient } from "./client";

const WyvernClientContext = createContext<WyvernClient | null>(null);

export function WyvernClientProvider({
  client,
  children,
}: {
  client: WyvernClient;
  children: ReactNode;
}) {
  return (
    <WyvernClientContext.Provider value={client}>
      {children}
    </WyvernClientContext.Provider>
  );
}

export function useWyvernClient(): WyvernClient {
  const client = useContext(WyvernClientContext);
  if (client === null) {
    throw new Error("useWyvernClient must be used inside WyvernClientProvider");
  }
  return client;
}
