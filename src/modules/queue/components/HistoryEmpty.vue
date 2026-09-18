<template>
  <Empty class="h-full bg-card">
    <EmptyHeader>
      <EmptyMedia>
        <IconHistory class="size-11 text-muted-foreground" />
      </EmptyMedia>
      <EmptyTitle>
        {{ t("queue.historyEmpty") }}
      </EmptyTitle>
      <EmptyDescription>
        {{ t("queue.historyEmptySub") }}
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button
        variant="outline"
        @click="goToAllMusic"
      >
        {{ t("player.browseMusic") }}
      </Button>
    </EmptyContent>
  </Empty>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import IconHistory from "~icons/tabler/history";
import { routeLocation } from "@/app/router/route-locations";
import { getLogger } from "@/lib/logger";

const { t } = useI18n();
const router = useRouter();

const goToAllMusic = (): void => {
  router.push(routeLocation.allMusic())
    .catch(error => getLogger().error(`[Queue] Navigation to all music failed: ${String(error)}`));
};
</script>
