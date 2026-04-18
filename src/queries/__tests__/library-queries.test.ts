import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/vue-query";
import {
  clearLibraryData,
  invalidateLibraryData,
} from "../library.queries";

const createMockQueryClient = (): QueryClient => {
  const mocks = {
    removeQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
  };
  return mocks as unknown as QueryClient;
};

describe("library.queries", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createMockQueryClient();
    vi.clearAllMocks();
  });

  describe("clearLibraryData", () => {
    it("should remove all library queries", async () => {
      await clearLibraryData(queryClient);

      expect(queryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: ["library"],
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: ["artists"],
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: ["albums"],
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: ["playlists"],
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: ["tracks"],
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: ["covers"],
      });
    });

    it("should invalidate queries after removing", async () => {
      await clearLibraryData(queryClient);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["library"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["artists"],
      });
    });
  });

  describe("invalidateLibraryData", () => {
    it("should invalidate all library queries", async () => {
      await invalidateLibraryData(queryClient);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["library"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["artists"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["albums"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["playlists"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["tracks"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["covers"],
      });
    });
  });
});
