import { MediaActions } from "@/components/media-hero/menu/types";

export const useMediaContext = (): MediaActions => {
  const addPlaylistInQueue = () => {};
  const changePlaylist = () => {};
  const deletePlaylist = () => {};
  const share = () => {};
  return {
    addPlaylistInQueue,
    changePlaylist,
    deletePlaylist,
    share,

  };
};
