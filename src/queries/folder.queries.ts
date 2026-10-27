import type { SidebarFolderEntity, SidebarFolderEntryEntity } from "@/db/entities";
import { folderRepository } from "@/db/repositories";
import { assertValidFolderName } from "@/modules/library/lib/folderName";
import { SidebarFolderId } from "@/types/ids";

export async function createFolderAndSync(name: string) {
  const now = Date.now();
  const folder: SidebarFolderEntity = {
    id: SidebarFolderId(crypto.randomUUID()),
    name: assertValidFolderName(name),
    items: [],
    addedAt: now,
    updatedAt: now,
  };

  await folderRepository.create(folder);

  return folder;
}

export async function renameFolderAndSync(folderId: SidebarFolderId, name: string) {
  await folderRepository.update(folderId, {
    name: assertValidFolderName(name),
    updatedAt: Date.now(),
  });
}

export async function deleteFolderAndSync(folderId: SidebarFolderId) {
  await folderRepository.delete(folderId);
}

export async function setFolderItemsAndSync(
  folderId: SidebarFolderId,
  items: SidebarFolderEntryEntity[],
) {
  await folderRepository.setItems(folderId, items);
}

export async function removeFolderItemAndSync(
  type: SidebarFolderEntryEntity["type"],
  id: string,
) {
  await folderRepository.removeItem(type, id);
}
