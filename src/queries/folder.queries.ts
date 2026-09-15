import type { SidebarFolderEntity, SidebarFolderEntryEntity } from "@/db/entities";
import { folderRepository } from "@/db/repositories";
import { assertValidFolderName } from "@/modules/library/lib/folderName";
import { queryKeys } from "@/queries/query-keys";
import { SidebarFolderId } from "@/types/ids";
import type { QueryClient } from "@tanstack/vue-query";
import { settleLibraryReads } from "./cache";
import { unwrapResult } from "./shared";

// Folders are only read as part of the library summary.
const invalidateFolders = async (queryClient: QueryClient) => {
  await settleLibraryReads(queryClient);
  queryClient.invalidateQueries({ queryKey: queryKeys.library.summary() }).catch(() => {});
};

export async function createFolderAndSync(queryClient: QueryClient, name: string) {
  const now = Date.now();
  const folder: SidebarFolderEntity = {
    id: SidebarFolderId(crypto.randomUUID()),
    name: assertValidFolderName(name),
    items: [],
    addedAt: now,
    updatedAt: now,
  };

  await unwrapResult(folderRepository.create(folder));
  await invalidateFolders(queryClient);

  return folder;
}

export async function renameFolderAndSync(queryClient: QueryClient, folderId: SidebarFolderId, name: string) {
  await unwrapResult(folderRepository.update(folderId, {
    name: assertValidFolderName(name),
    updatedAt: Date.now(),
  }));
  await invalidateFolders(queryClient);
}

export async function deleteFolderAndSync(queryClient: QueryClient, folderId: SidebarFolderId) {
  await unwrapResult(folderRepository.delete(folderId));
  await invalidateFolders(queryClient);
}

export async function setFolderItemsAndSync(
  queryClient: QueryClient,
  folderId: SidebarFolderId,
  items: SidebarFolderEntryEntity[],
) {
  await unwrapResult(folderRepository.setItems(folderId, items));
  await invalidateFolders(queryClient);
}

export async function removeFolderItemAndSync(
  queryClient: QueryClient,
  type: SidebarFolderEntryEntity["type"],
  id: string,
) {
  await unwrapResult(folderRepository.removeItem(type, id));
  await invalidateFolders(queryClient);
}
