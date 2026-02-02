<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader title="Audio & Playback" />
      <SettingsGroup>
        <div class="px-4">
          <div class=" text-primary font-medium mb-1">
            Streaming quality
          </div>
          <div class="text-sm text-muted-foreground mb-3">
            Higher quality uses more data
          </div>
        </div>

        <RadioGroup
          v-model="streamingQuality"
          class="gap-0"
        >
          <Item
            v-for="quality in streamingQualities"
            :key="quality.value"
            v-ripple
            size="sm"
            class="cursor-pointer"
            @click="streamingQuality = quality.value"
          >
            <ItemMedia>
              <RadioGroupItem :value="quality.value" />
            </ItemMedia>
            <ItemContent class="ml-4">
              <ItemTitle>{{ quality.label }}</ItemTitle>
              <ItemSubtitle>{{ quality.description }}</ItemSubtitle>
            </ItemContent>
          </Item>
        </RadioGroup>
      </SettingsGroup>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Scrollable } from "@/components/ui/scrollable";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Item, ItemContent, ItemSubtitle, ItemTitle } from "@/components/ui/item";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";

const streamingQuality = ref("high");

const streamingQualities = [
  { value: "low", label: "Low", description: "24 kbps" },
  { value: "normal", label: "Normal", description: "96 kbps" },
  { value: "high", label: "High", description: "160 kbps" },
  { value: "very-high", label: "Very high", description: "320 kbps" },
];
</script>
