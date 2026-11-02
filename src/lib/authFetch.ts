import { supabase } from "./supabase";

export class SignInRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignInRequiredError";
  }
}

// Drop-in replacement for fetch() for our own /api routes. Adds the signed-in
// user's token. Only an HTTP 401 means "your login is not valid" - a bad photo,
// a daily-limit hit or a model error never produces a 401, so those never
// affect the session. On a 401 we first try once with a freshly refreshed
// token, and only sign the user out if that also fails.
export async function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const send = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", "Bearer " + token);
    return fetch(input, { ...init, headers });
  };

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new SignInRequiredError("Please sign in.");
  }

  let res = await send(token);

  if (res.status === 401) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    const newToken = refreshed?.session?.access_token;
    if (!error && newToken && newToken !== token) {
      res = await send(newToken);
    }
    if (res.status === 401) {
      await supabase.auth.signOut();
      throw new SignInRequiredError("Session expired — please sign in again.");
    }
  }
  return res;
}
