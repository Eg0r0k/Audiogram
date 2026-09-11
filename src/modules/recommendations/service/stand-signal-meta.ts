import { COMPONENT_KEYS, type ComponentKey } from "../lib/scoring";

/** The five weighted components plus the fixed recency penalty the bar also shows. */
export type StandBarKey = ComponentKey | "recencyPenalty";

export const STAND_BAR_KEYS: readonly StandBarKey[] = [...COMPONENT_KEYS, "recencyPenalty"];

export const COMPONENT_COLORS: Record<StandBarKey, string> = {
  audio: "#7c3aed",
  trackTransition: "#2563eb",
  artistTransition: "#0891b2",
  affinity: "#059669",
  explore: "#ca8a04",
  recencyPenalty: "#dc2626",
};

export const COMPONENT_DESCRIPTIONS: Record<StandBarKey, string> = {
  audio: "Похожесть по аудио-анализу: темп с октавной толерантностью, энергия, центроид, танцевальность, лад, тональность по кварто-квинтовому кругу; процентиль среди кандидатов",
  trackTransition: "Как часто этот трек шёл следом за исходным в твоих сессиях: ближе по позиции — весомее, автоплей слабее, скип уводит в минус; процентиль среди кандидатов",
  artistTransition: "То же на уровне артистов: как часто артист кандидата шёл после артиста исходного трека; процентиль среди кандидатов",
  affinity: "Насколько ты любишь сам трек: дослушивания, скипы и лайк, затухающие за 60 дней; процентиль среди кандидатов",
  explore: "1 у трека, которого ещё нет в истории, но он уже проанализирован — шанс для незнакомого; иначе 0",
  recencyPenalty: "Штраф за недавнее прослушивание: −0.3 за последние 6 часов, −0.1 за сутки. Не зависит от весов и всегда ≤ 0",
};
