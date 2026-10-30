/** One corner line while a live cue is being spoken. Not a history. */
export type LiveCaption = {
  text: string;
  visible: boolean;
  /** Bumps so a replacement can replay the fade-in. */
  fade: number;
};

export const hiddenCaption: LiveCaption = { text: "", visible: false, fade: 0 };

export function showLiveCaption(current: LiveCaption, line: string): LiveCaption {
  const text = line.replace(/\s+/g, " ").trim();
  if (!text) return hideLiveCaption(current);
  return { text, visible: true, fade: current.fade + 1 };
}

export function hideLiveCaption(current: LiveCaption): LiveCaption {
  if (!current.visible) return current;
  return { ...current, visible: false };
}
