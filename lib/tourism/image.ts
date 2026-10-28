import { isOwnedTourismImagePath } from '../security/image-upload.ts';

export type ImageAssociation = { item_id: string; updated_at: string; previous_image_path: string | null; main_image_path: string | null };
export type ImageFeedback = { success?: string; warning?: string; error?: string };
export type ImageFailure = { code?: string; message?: string };
export interface TourismImageIO {
  associate(path: string | null, revision: string): Promise<{ data: ImageAssociation | null; error: ImageFailure | null }>;
  read(): Promise<string | null>;
  remove(path: string): Promise<{ error: unknown }>;
  log(operation: string, path: string | null): void;
}

/** Storage is not transactional. Only owner-validated objects are removed, at most twice. */
export async function cleanupTourismImage(io: Pick<TourismImageIO, 'remove' | 'log'>, hotelId: string, itemId: string, path: string | null, currentPath: string | null): Promise<boolean> {
  if (!path || path === currentPath) return true;
  if (!isOwnedTourismImagePath(path, hotelId, itemId)) { io.log('cleanup_refused_invalid_ownership', path); return false; }
  for (let attempt = 0; attempt < 2; attempt++) {
    try { if (!(await io.remove(path)).error) return true; } catch { /* bounded retry */ }
  }
  io.log('cleanup_failed_after_two_attempts', path);
  return false;
}

export async function associateTourismImage({ io, hotelId, itemId, oldPath, newPath, revision, errorMessage }: {
  io: TourismImageIO; hotelId: string; itemId: string; oldPath: string | null; newPath: string | null; revision: string;
  errorMessage: (error: ImageFailure) => string;
}): Promise<ImageFeedback> {
  if (newPath !== null && !isOwnedTourismImagePath(newPath, hotelId, itemId)) return { error: 'Caminho de imagem inválido.' };
  let result: { data: ImageAssociation | null; error: ImageFailure | null };
  try { result = await io.associate(newPath, revision); } catch { result = { data: null, error: null }; }
  const cleanup = (path: string | null, current: string | null) => cleanupTourismImage(io, hotelId, itemId, path, current);
  if (result.error?.code && /^[A-Z0-9]{5}$/.test(result.error.code) && !result.error.code.startsWith('08') && !['57014', '57P01', '57P02', '57P03'].includes(result.error.code)) {
    const cleaned = await cleanup(newPath, oldPath);
    return { error: errorMessage(result.error), ...(!cleaned ? { warning: 'A associação foi rejeitada; o upload novo precisa de limpeza posterior.' } : {}) };
  }
  let previous: string | null;
  if (!result.error && result.data?.item_id === itemId && result.data.main_image_path === newPath) {
    previous = result.data.previous_image_path;
  } else {
    // A read of the old value is not a rollback barrier: the original RPC may
    // still commit later. Only observing the new value confirms association.
    let current: string | null;
    try { current = await io.read(); } catch {
      io.log('association_ambiguous_read_failed', newPath);
      return { warning: 'Não foi possível confirmar a associação da imagem. Nenhum arquivo foi removido. Recarregue os dados.' };
    }
    if (current === newPath) previous = oldPath;
    else if (current === oldPath) {
      io.log('association_ambiguous_old_path_observed', newPath);
      return { warning: 'A associação da imagem ainda não pôde ser confirmada. Nenhum arquivo foi removido; a operação pode concluir depois. Recarregue os dados para reconciliar o estado.' };
    } else {
      io.log('association_ambiguous_concurrent_change', newPath);
      return { warning: 'A imagem foi alterada por outra operação. Nenhum arquivo foi removido. Recarregue os dados.' };
    }
  }
  const cleaned = await cleanup(previous, newPath);
  return { success: newPath ? 'Imagem principal atualizada.' : 'Imagem principal removida.', ...(!cleaned ? { warning: 'A alteração foi salva, mas o arquivo anterior precisa de limpeza posterior.' } : {}) };
}
