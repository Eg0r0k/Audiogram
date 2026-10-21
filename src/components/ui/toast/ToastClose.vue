<script setup lang="ts">
import IconX from "~icons/tabler/x";
import { ToastClose } from "@kappa-ui/core/toast";
import type { HTMLAttributes } from "vue";
import { useI18n } from "vue-i18n";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const { t } = useI18n();
</script>

<template>
  <ToastClose as-child>
    <Button
      data-slot="toast-close"
      variant="ghost"
      color="neutral"
      size="icon-xs"
      :aria-label="t('common.close')"
      :class="cn('rounded-inset-surface-md/2.5 text-muted-foreground', props.class)"
    >
      <slot>
        <IconX />
      </slot>
    </Button>
  </ToastClose>
</template>
