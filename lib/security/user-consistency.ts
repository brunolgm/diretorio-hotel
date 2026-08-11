type OperationResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

export type UserProvisioningResult =
  | { ok: true; userId: string }
  | { ok: false; stage: 'auth'; error: unknown }
  | {
      ok: false;
      stage: 'profile';
      userId: string;
      error: unknown;
      compensated: boolean;
      compensationError?: unknown;
    };

export async function provisionAuthUserWithProfile({
  createAuthUser,
  createProfile,
  deleteAuthUser,
}: {
  createAuthUser: () => Promise<OperationResult<{ userId: string }>>;
  createProfile: (userId: string) => Promise<OperationResult>;
  deleteAuthUser: (userId: string) => Promise<OperationResult>;
}): Promise<UserProvisioningResult> {
  const authResult = await createAuthUser();
  if (!authResult.ok) return { ok: false, stage: 'auth', error: authResult.error };

  const { userId } = authResult.value;
  const profileResult = await createProfile(userId);
  if (profileResult.ok) return { ok: true, userId };

  const compensation = await deleteAuthUser(userId);
  return {
    ok: false,
    stage: 'profile',
    userId,
    error: profileResult.error,
    compensated: compensation.ok,
    ...(compensation.ok ? {} : { compensationError: compensation.error }),
  };
}

export type CoordinatedUserUpdateResult =
  | { ok: true }
  | { ok: false; stage: 'profile'; error: unknown }
  | {
      ok: false;
      stage: 'auth';
      error: unknown;
      compensated: boolean;
      compensationError?: unknown;
    };

export async function updateProfileThenAuth({
  updateProfile,
  updateAuth,
  restoreProfile,
}: {
  updateProfile: () => Promise<OperationResult>;
  updateAuth: () => Promise<OperationResult>;
  restoreProfile: () => Promise<OperationResult>;
}): Promise<CoordinatedUserUpdateResult> {
  const profileResult = await updateProfile();
  if (!profileResult.ok) return { ok: false, stage: 'profile', error: profileResult.error };

  const authResult = await updateAuth();
  if (authResult.ok) return { ok: true };

  const compensation = await restoreProfile();
  return {
    ok: false,
    stage: 'auth',
    error: authResult.error,
    compensated: compensation.ok,
    ...(compensation.ok ? {} : { compensationError: compensation.error }),
  };
}
