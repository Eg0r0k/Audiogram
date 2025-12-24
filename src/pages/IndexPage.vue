<template>
  <Scrollable
    direction="vertical"
    class=" flex-1 bg-card "
  >
    <div>
      <Button
        as-child
        variant="ghost-primary"
      >
        <Link :to="'/settings'">
          Settings
        </Link>
      </Button>

      <Button
        as-child
        variant="ghost-primary"
      >
        <Link :to="'/album/album-1'">
          Exemple Album
        </Link>
      </Button>
      <Button
        as-child
        variant="ghost-primary"
      >
        <Link :to="'/profile'">
          Profile
        </Link>
      </Button>
      <Button
        as-child
        variant="ghost-primary"
      >
        <Link :to="'/artist/artist-1'">
          Exemple artist
        </Link>
      </Button>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import Link from "@/components/ui/link/Link.vue";
import { Button } from "@/components/ui/button";

</script>
