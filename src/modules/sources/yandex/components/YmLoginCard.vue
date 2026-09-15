<template>
  <div class="space-y-3">
    <div
      v-if="step.kind === 'expired'"
      class="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ $t("settings.sources.ym.sessionExpired") }}
    </div>

    <template v-if="loggedIn">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">
            {{ $t("settings.sources.ym.signedInAs", { name: displayName || uidLabel }) }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ hasPlus ? $t("settings.sources.ym.plus") : $t("settings.sources.ym.noPlus") }}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="signOut"
        >
          {{ $t("settings.sources.ym.signOut") }}
        </Button>
      </div>
    </template>

    <template v-else-if="step.kind === 'pending'">
      <div class="flex items-start gap-4">
        <div class="min-w-0 flex-1 space-y-2">
          <p class="text-xs text-muted-foreground">
            {{ $t("settings.sources.ym.codeHint", { url: step.verificationUrl }) }}
          </p>
          <p
            class="font-mono text-3xl font-semibold tracking-[0.3em] select-all"
            data-testid="ym-user-code"
          >
            {{ step.userCode }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ remainingLabel }}
          </p>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              @click="openYandex"
            >
              <IconExternalLink class="size-4" />
              {{ $t("settings.sources.ym.openYandex") }}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              @click="cancelSignIn"
            >
              {{ $t("settings.sources.ym.cancel") }}
            </Button>
          </div>
        </div>
        <YmQrCode
          v-if="showQr"
          :value="step.verificationUrl"
          class="size-32 shrink-0 rounded-lg bg-white p-1.5 text-black"
        />
      </div>
    </template>

    <template v-else>
      <p
        v-if="step.kind === 'codeExpired'"
        class="text-sm text-muted-foreground"
      >
        {{ $t("settings.sources.ym.codeExpired") }}
      </p>
      <p
        v-else-if="step.kind === 'error'"
        class="text-sm text-destructive wrap-break-word"
      >
        {{ $t("settings.sources.ym.failed", { message: step.message }) }}
      </p>
      <Button
        class="w-full"
        :disabled="busy"
        @click="signIn"
      >
        <IconLogin class="size-4" />
        {{ step.kind === "codeExpired" ? $t("settings.sources.ym.newCode") : $t("settings.sources.ym.signIn") }}
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import IconExternalLink from "~icons/tabler/external-link";
import IconLogin from "~icons/tabler/login-2";
import { openExternal } from "@/composables/useExternalLinkInterceptor";
import { IS_MOBILE } from "@/lib/environment/userAgent";
import { getLogger } from "@/lib/logger";
import { useYmAuth } from "../composables/useYmAuth";
import YmQrCode from "./YmQrCode.vue";

const { t } = useI18n();
const { loggedIn, hasPlus, displayName, step, start, cancel, logout } = useYmAuth();

const busy = ref(false);
// Whoever is on a phone is already holding the device the code goes into.
const showQr = !IS_MOBILE;
const now = useNow({ interval: 1000 });

const uidLabel = computed(() => t("settings.sources.ym.account"));

const remainingLabel = computed(() => {
  if (step.value.kind !== "pending") return "";
  const seconds = Math.max(0, Math.round((step.value.expiresAt - now.value.getTime()) / 1000));
  return t("settings.sources.ym.codeExpiresIn", { minutes: Math.max(1, Math.ceil(seconds / 60)) });
});

const guarded = async (action: () => Promise<void>) => {
  busy.value = true;
  try {
    await action();
  }
  catch (error) {
    getLogger().error(`[YM] ${String(error)}`);
  }
  finally {
    busy.value = false;
  }
};

const signIn = () => guarded(start);
const signOut = () => guarded(logout);
const cancelSignIn = () => guarded(cancel);

const openYandex = () => {
  if (step.value.kind !== "pending") return;
  openExternal(step.value.verificationUrl)
    .catch(error => getLogger().error(`[YM] Opening the verification page failed: ${String(error)}`));
};
</script>
