import { SIGNAL_KEYS, type SignalKey } from "./signals";

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#65a30d", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#9333ea", "#475569"];

export const SIGNAL_COLORS: Record<SignalKey, string> = Object.fromEntries(
  SIGNAL_KEYS.map((key, i) => [key, COLORS[i]]),
) as Record<SignalKey, string>;

export const SIGNAL_DESCRIPTIONS: Record<SignalKey, string> = {
  audioSimilarity: "Похожесть по аудио-анализу (essentia). Сейчас выключен",
  coOccurrence: "Как часто трек слушался в одной сессии с исходным",
  artistCoOccurrence: "То же на уровне артистов",
  sameArtist: "Тот же артист, что у исходного",
  tagOverlap: "Общие теги/жанры с исходным",
  artistAffinity: "Сколько ты вообще слушаешь артиста кандидата",
  completionRate: "Доля дослушиваний кандидата",
  skipRate: "1 минус доля скипов кандидата",
  liked: "Лайк",
  recency: "Недавно играл (выше = недавнее)",
  novelty: "Давно не играл (выше = дольше)",
};
