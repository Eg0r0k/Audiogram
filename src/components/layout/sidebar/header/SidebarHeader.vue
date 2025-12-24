<script setup lang="ts">
import { Button } from "@/components/ui/button";
import IconMenu2 from "~icons/tabler/menu-2";
import IconSearch from "~icons/tabler/search";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
</script>

<template>
  <div class="flex items-center gap-3 shrink-0 px-4 pb-4">
    <div>
      <Button
        variant="ghost"
        size="icon-lg"
        class="rounded-full"
      >
        <IconMenu2 class="size-6" />
      </Button>
    </div>
    <InputGroup class="bg-background! border-none! rounded-full h-10">
      <InputGroupInput
        class="pl-4! "
        :placeholder="$t('common.search')"
        @keydown.stop
      />
      <InputGroupAddon>
        <IconSearch class="ml-1 size-6" />
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>
