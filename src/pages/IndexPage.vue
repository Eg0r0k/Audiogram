<template>
  <Scrollable
    direction="vertical"
    class="p-2 flex-1"
  >
    <Skeleton class="w-40 h-5" />

    <Dialog>
      <DialogTrigger as-child>
        <Button variant="ghost-primary">
          PIRMAY GHOST
        </Button>
      </DialogTrigger>
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="ghost-primary">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive-link">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Badge variant="destructive">
      +23
    </Badge>
    <Badge variant="secondary">
      +23
    </Badge>
    <Badge variant="outline">
      +23
    </Badge>
    <Badge>2</Badge>

    <!-- <TrackContextMenu
      v-for="track in mockTracks"
      :key="track.id"
      :track="track"
      context="default"
    >
      <TrackRow :track="track" />
    </TrackContextMenu> -->
  </Scrollable>
</template>

<script setup lang="ts">
import Badge from "@/components/ui/badge/Badge.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import Skeleton from "@/components/ui/skeleton/Skeleton.vue";
import TrackRow from "@/components/track/TrackRow.vue";
import TrackContextMenu from "@/components/track/context-menu/TrackContextMenu.vue";
import type { Track } from "@/types/track/track";

</script>
