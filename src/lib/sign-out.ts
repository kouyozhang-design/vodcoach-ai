type SessionReader = {
  auth: {
    getUser: () => PromiseLike<{ data: { user: unknown } }>;
  };
};

type SessionEnder = {
  auth: {
    signOut: () => PromiseLike<unknown>;
  };
};

export async function sessionIsPresent(supabase: SessionReader | null): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

/** Clears the Supabase server session only. Saved coaching stays in the browser. */
export async function endServerSession(supabase: SessionEnder | null): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
