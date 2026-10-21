import IconCircleCheck from "~icons/tabler/circle-check-filled";
import IconCircleX from "~icons/tabler/circle-x-filled";
import IconInfoCircle from "~icons/tabler/info-circle-filled";
import IconAlertTriangle from "~icons/tabler/alert-triangle-filled";
import {
  type ToastManager,
  type ToastOptions,
  type ToastRecord,
  createToaster as createCoreToaster,
  provideToaster as provideCoreToaster,
  useToast as useCoreToast,
} from "@kappa-ui/core/toast";
import type { Component } from "vue";

export { default as ToastAction } from "./ToastAction.vue";
export { default as ToastClose } from "./ToastClose.vue";
export { default as ToastDescription } from "./ToastDescription.vue";
export { default as ToastRow } from "./ToastRow.vue";
export { default as ToastTitle } from "./ToastTitle.vue";
export { default as Toaster } from "./Toaster.vue";

export type ToastColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export type ToastPosition = "top-start" | "top-center" | "top-end" | "bottom-start" | "bottom-center" | "bottom-end";

export interface ToastActionOptions {
  label: string;
  altText?: string;
  onClick?: (event: MouseEvent) => void;
}

export interface ToastContent {
  title?: string;
  description?: string;
  color?: ToastColor;
  icon?: Component | false;
  close?: boolean;
  actions?: ToastActionOptions[];
  data?: Record<string, unknown>;
}

export type Toast = ToastRecord<ToastContent>;
export type ToastInput = ToastOptions<ToastContent>;
export type Toasts = ToastManager<ToastContent>;

export const toastIcons: Record<ToastColor, Component | undefined> = {
  primary: IconInfoCircle,
  neutral: undefined,
  destructive: IconCircleX,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
};

export const createToaster = (): Toasts =>
  createCoreToaster<ToastContent>({ promise: { success: { color: "success" }, error: { color: "destructive" } } });

export const useToast = (): Toasts => useCoreToast<ToastContent>();

export const provideToaster = (manager: Toasts) => provideCoreToaster(manager);
