const VIDEO_ASPECT = 16 / 9;

/**
 * Where to place a YouTube iframe inside a slot of the given size. The iframe is as wide as the
 * slot and tall enough to cover it with a 16:9 picture, plus a band above and below that holds
 * YouTube's own title bar and "Watch on YouTube" button. The slot clips those bands away.
 */
export function getPlayerFrame(width: number, height: number) {
  const chromeCrop = Math.min(64, Math.max(12, Math.round(width * 0.06)));
  const frameHeight = Math.max(Math.round(width / VIDEO_ASPECT), height) + chromeCrop * 2;

  return { top: Math.round((height - frameHeight) / 2), height: frameHeight };
}
