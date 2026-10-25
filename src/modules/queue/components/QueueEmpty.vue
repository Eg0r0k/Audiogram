<template>
  <Empty class="h-full bg-card">
    <EmptyHeader>
      <EmptyMedia>
        <IconLogo class="size-32 text-muted-foreground" />
      </EmptyMedia>
      <EmptyTitle>
        {{ t("queue.queueEmpty") }}
      </EmptyTitle>
      <EmptyDescription>
        {{ t("queue.queueEmptySub") }}
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button
        variant="solid"
        color="surface"
        @click="openAllMusic"
      >
        {{ t("queue.openAllMusic") }}
      </Button>
    </EmptyContent>
  </Empty>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import IconLogo from "~icons/audiogram/logo";
import { routeLocation } from "@/app/router/route-locations";
import { getLogger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

const { t } = useI18n();
const router = useRouter();

const openAllMusic = (): void => {
  router.push(routeLocation.allMusic())
    .catch(error => getLogger().error(`[Queue] Opening all music failed: ${formatError(error)}`));
};
</script>
