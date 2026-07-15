"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 1000 * 30,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastContainer
        position="bottom-right"
        autoClose={1600}
        hideProgressBar
        closeButton={false}
        icon={false}
        draggable={false}
        newestOnTop
        limit={2}
        pauseOnFocusLoss={false}
        theme="light"
        style={{
          width: "auto",
          maxWidth: "min(92vw, 360px)",
          right: 12,
          left: "auto",
          bottom: 12,
          padding: 0,
        }}
        toastStyle={{
          background: "var(--app-surface, #ffffff)",
          color: "var(--app-text, #111827)",
          border: "1px solid var(--app-border, #e5e7eb)",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
          borderRadius: 10,
          padding: "8px 10px",
          fontSize: 13,
          minHeight: "auto",
          width: "auto",
          maxWidth: "min(92vw, 360px)",
        }}
      />
    </QueryClientProvider>
  );
}
