import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { initAuth } from "./auth";
import "./styles/theme.css";
import "./styles/app.css";

const queryClient = new QueryClient();

// Authenticate before the first render: every call this SPA makes needs an agent
// token, so there is no useful UI to show beforehand.
initAuth()
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    document.getElementById("root")!.innerHTML =
      `<p style="font-family:sans-serif;padding:2rem;color:#b00">` +
      `Could not sign in: ${String(err)}</p>`;
  });
