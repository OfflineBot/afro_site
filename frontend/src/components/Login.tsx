import { useRef, useState } from "react";
import { api, token } from "../lib/api";

export default function Login({ admin, onChange }: { admin: boolean; onChange: (admin: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (admin) {
    return (
      <button
        className="btn"
        onClick={() => {
          token.clear();
          onChange(false);
        }}
      >
        Log out
      </button>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const res = await api.login(password);
      token.set(res.token);
      setPassword("");
      setError(null);
      dialog.current?.close();
      onChange(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <button className="btn" onClick={() => dialog.current?.showModal()}>
        Log in
      </button>
      <dialog ref={dialog} onClose={() => setError(null)}>
        <form onSubmit={submit}>
          <div className="card-head">
            <h2>Password</h2>
          </div>
          <div className="row">
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <button className="btn btn-primary" type="submit">
              Log in
            </button>
            <button className="btn" type="button" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </dialog>
    </>
  );
}
