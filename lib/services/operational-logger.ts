export function logOperationalError({
  module,
  action,
  operation,
  hotelId,
  targetId,
  error,
}: {
  module: string;
  action: string;
  operation: string;
  hotelId?: string;
  targetId?: string;
  error: unknown;
}) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';

  console.error(`[${module}] ${action} failed`, {
    operation,
    hotelId,
    targetId,
    message,
  });
}
