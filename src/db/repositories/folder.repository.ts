import { db } from "@/db";
import type { SidebarFolderEntity, SidebarFolderEntryEntity } from "@/db/entities";
import { tableOf, type TableSource } from "@/db/tables";
import type { SidebarFolderId } from "@/types/ids";
import { BaseRepository, guarded } from "./base.repository";

function folderItemKey(item: SidebarFolderEntryEntity) {
  return `${item.type}:${item.id}`;
}

function normalizeFolderItems(items: SidebarFolderEntryEntity[]) {
  const seen = new Set<string>();
  const normalizedItems: SidebarFolderEntryEntity[] = [];

  for (const item of items) {
    const plainItem: SidebarFolderEntryEntity = {
      type: item.type,
      id: item.id,
    };
    const key = folderItemKey(plainItem);
    if (seen.has(key)) continue;

    seen.add(key);
    normalizedItems.push(plainItem);
  }

  return { normalizedItems, seen };
}

export class FolderRepository extends BaseRepository<SidebarFolderEntity, SidebarFolderId> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "folders"));
  }

  async setItems(folderId: SidebarFolderId, items: SidebarFolderEntryEntity[]): Promise<void> {
    return guarded(async () => {
      const { normalizedItems, seen } = normalizeFolderItems(items);
      const notMoved = (item: SidebarFolderEntryEntity) => !seen.has(folderItemKey(item));

      await db.transaction("rw", "folders", async () => {
        await this.table.update(folderId, {
          items: normalizedItems,
          updatedAt: Date.now(),
        });

        const folders = await this.table.toArray();
        await Promise.all(folders.map(async (folder) => {
          if (folder.id === folderId) return;

          const filteredItems = folder.items.filter(notMoved);
          if (filteredItems.length === folder.items.length) return;

          await this.table.update(folder.id, {
            items: filteredItems,
            updatedAt: Date.now(),
          });
        }));
      });
    });
  }

  async removeItem(type: SidebarFolderEntryEntity["type"], id: string): Promise<void> {
    const notRemoved = (item: SidebarFolderEntryEntity) => !(item.type === type && item.id === id);
    return guarded(async () => {
      await db.transaction("rw", "folders", async () => {
        const folders = await this.table.toArray();
        await Promise.all(folders.map(async (folder) => {
          const filteredItems = folder.items.filter(notRemoved);
          if (filteredItems.length === folder.items.length) return;

          await this.table.update(folder.id, {
            items: filteredItems,
            updatedAt: Date.now(),
          });
        }));
      });
    });
  }
}

export const folderRepository = new FolderRepository();
