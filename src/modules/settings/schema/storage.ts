import { z } from "zod";

export const StorageInfoSchema = z.object({
  tracksSize: z.number().default(0),
  coversSize: z.number().default(0),
  dbSize: z.number().default(0),
  quotaTotal: z.number().default(0),
  quotaUsed: z.number().default(0),
  tracksCount: z.number().default(0),
  albumsCount: z.number().default(0),
  artistsCount: z.number().default(0),
  storagePath: z.string().default(""),
});

export type StorageInfo = z.infer<typeof StorageInfoSchema>;
