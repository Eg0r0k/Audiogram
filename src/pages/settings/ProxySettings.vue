<template>
  <SettingsScreen :title="$t('settings.index.proxy')">
    <SettingsGroup>
      <Item @click="setEnabled(!enabled)">
        <ItemContent>
          <ItemTitle>{{ $t("settings.proxy.enable") }}</ItemTitle>
          <ItemDescription>
            {{ $t("settings.proxy.description") }}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            :model-value="enabled"
            @click.stop
            @update:model-value="setEnabled"
          />
        </ItemActions>
      </Item>
    </SettingsGroup>

    <SettingsGroup
      class="mt-2"
      :class="{ 'opacity-40 pointer-events-none': !enabled }"
    >
      <Item>
        <ItemContent>
          <ItemTitle>{{ $t("settings.proxy.protocol") }}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- renderless reka root, the trigger below carries the label -->
          <Select
            :model-value="protocol"
            @update:model-value="(val) => setProtocol(val as ProxyProtocol)"
          >
            <SelectTrigger
              variant="ghost"
              class="w-[120px] h-8 font-medium pointer-events-auto"
              :aria-label="$t('settings.proxy.protocol')"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in protocolOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </ItemActions>
      </Item>

      <div class="px-4 py-3 space-y-4">
        <div class="grid grid-cols-[1fr_7rem] gap-x-3 gap-y-1.5">
          <Label
            for="proxy-port"
            class="col-start-2"
          >
            {{ $t('settings.proxy.port') }}
          </Label>
          <div class="row-start-2 min-w-0 space-y-1.5">
            <InputFloating
              id="proxy-host"
              variant="soft"
              :model-value="host"
              :label="$t('settings.proxy.host')"
              placeholder="127.0.0.1"
              autocomplete="off"
              spellcheck="false"
              :aria-invalid="!!hostError || undefined"
              :aria-describedby="hostError ? 'proxy-host-error' : undefined"
              :class="{ 'border-destructive focus-visible:ring-destructive': hostError }"
              @update:model-value="(val) => setHost(String(val))"
            />
            <p
              v-if="hostError"
              id="proxy-host-error"
              class="text-xs text-destructive"
              role="alert"
            >
              {{ hostError }}
            </p>
          </div>
          <InputNumber
            id="proxy-port"
            variant="soft"
            size="xl"
            orientation="vertical"
            class="row-start-2 col-start-2"
            :model-value="port"
            :min="1"
            :max="65535"
            :format-options="PORT_FORMAT"
            @update:model-value="setPortValue"
          >
            <InputNumberInput />
            <InputNumberIncrement />
            <InputNumberDecrement />
          </InputNumber>
        </div>

        <InputFloating
          id="proxy-username"
          variant="soft"
          :model-value="username"
          :label="$t('settings.proxy.username')"
          autocomplete="off"
          spellcheck="false"
          @update:model-value="(val) => setUsername(String(val))"
        />

        <InputFloating
          id="proxy-password"
          variant="soft"
          :model-value="password"
          :label="$t('settings.proxy.password')"
          type="password"
          autocomplete="off"
          @update:model-value="(val) => setPassword(String(val))"
        />
      </div>
      <Button
        class="w-full h-14 justify-start"
        size="xl"
        variant="ghost"
        :disabled="!canTest || isTesting"
        @click="handleTest"
      >
        <Spinner
          v-if="isTesting"
          class="size-6"
        />
        <IconPlugConnected
          v-else
          class="size-6"
        />
        {{ $t("settings.proxy.test") }}
      </Button>
    </SettingsGroup>

    <div
      v-if="testState !== 'idle'"
      class="px-4 mt-2"
    >
      <p
        v-if="testState === 'ok'"
        class="text-sm text-muted-foreground font-medium"
      >
        {{ testMessage }}
      </p>
      <p
        v-else
        class="text-sm text-destructive wrap-break-word"
      >
        {{ testMessage }}
      </p>
    </div>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getLogger } from "@/lib/logger";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { InputFloating } from "@/components/ui/input-floating";
import { InputNumber, InputNumberDecrement, InputNumberIncrement, InputNumberInput } from "@/components/ui/input-number";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import IconPlugConnected from "~icons/tabler/plug-connected";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import { isValidProxyHost } from "@/modules/settings/schema/proxy";
import { useProxySettings } from "@/modules/settings/store/proxy";
import { checkProxyConnection } from "@/modules/settings/service/proxy";
import type { ProxyProtocol } from "@/modules/settings/schema";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";

const { t } = useI18n();

const {
  enabled,
  protocol,
  host,
  port,
  username,
  password,
  proxyUrl,
  protocolOptions,
  setEnabled,
  setProtocol,
  setHost,
  setPort,
  setUsername,
  setPassword,
} = useProxySettings();

// A port is never grouped: "10 808" would not read as one.
const PORT_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 0, useGrouping: false };

// The field clamps to 1..65535 itself; an emptied field keeps the last port.
const setPortValue = (value: number | undefined) => {
  if (value !== undefined && Number.isFinite(value)) setPort(Math.trunc(value));
};

const isTesting = ref(false);
const testState = ref<"idle" | "ok" | "error">("idle");
const testMessage = ref("");

// Live, not on submit: the page writes to the store on every keystroke, so
// the field is the only place a bad host can be pointed out. A rejected host
// also makes `proxyUrl` null — the backend never sees it.
const hostError = computed(() =>
  host.value.trim() !== "" && !isValidProxyHost(host.value) ? t("settings.proxy.hostInvalid") : null,
);

const canTest = computed(() => proxyUrl.value !== null);

const handleTest = async () => {
  const url = proxyUrl.value;
  if (!url) return;

  isTesting.value = true;
  testState.value = "idle";
  testMessage.value = "";

  const result = await checkProxyConnection(url);
  result.match(
    (latency) => {
      testState.value = "ok";
      testMessage.value = t("settings.proxy.testOk", { ms: latency });
    },
    (error) => {
      getLogger().warn(`[ProxySettings] Proxy check failed: ${error.message}`);
      testState.value = "error";
      testMessage.value = t("settings.proxy.testFailed");
    },
  );

  isTesting.value = false;
};
</script>
