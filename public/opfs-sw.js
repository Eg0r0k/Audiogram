self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!url.pathname.startsWith("/opfs/")) return;

  const opfsPath = decodeURIComponent(url.pathname.replace("/opfs/", ""));

  event.respondWith(
    navigator.storage.getDirectory().then(async (root) => {
      const parts = opfsPath.split("/").filter(Boolean);
      const filename = parts.pop();

      let dir = root;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part);
      }

      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();

      return new Response(file, {
        status: 200,
        headers: {
          "Content-Type": file.type || "audio/mpeg",
          "Content-Length": file.size,
          "Accept-Ranges": "bytes",
        },
      });
    }).catch(() => new Response("Not found", { status: 404 })),
  );
});
