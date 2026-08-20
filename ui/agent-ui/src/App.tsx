import { getCurrentUser, logout } from "./auth";
import IssuePage from "./pages/IssuePage";

export default function App() {
  const user = getCurrentUser();

  return (
    <div className="app">
      <header className="app-header">
        <img src="/openg2p-logo-horizontal.svg" alt="OpenG2P" height={28} />
        <span className="app-title">Agent Portal</span>
        <span className="spacer" />
        <span className="muted">{user.name ?? user.sub}</span>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </header>

      <main>
        {user.canIssue ? (
          <IssuePage />
        ) : (
          <p className="error" role="alert">
            This account is not permitted to issue credentials. It needs the
            <code> register:issue_credential </code> permission in the agent realm.
          </p>
        )}
      </main>
    </div>
  );
}
