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
    <InputGroup class="dark:bg-background! bg-muted! border-none! rounded-full h-10">
      <InputGroupAddon
        tabindex="-1"
      >
        <IconSearch class="ml-1 size-5" />
      </InputGroupAddon>
      <InputGroupInput
        v-model="searchQuery"
        class="pl-4!"
        :placeholder="$t('common.search')"
        @keydown.stop
      />

      <InputGroupAddon
        v-if="searchQuery.trim()"
        tabindex="-1"
        align="inline-end"
      >
        <Button
          class="rounded-full"
          variant="ghost-primary"
          size="icon-sm"
          @click="clear"
        >
          <IconX class="size-5" />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import IconMenu2 from "~icons/tabler/menu-2";
import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { ref } from "vue";

const searchQuery = ref("");

const clear = () => {
  searchQuery.value = "";
};
</script>
