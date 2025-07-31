export function formatResolution(width: number, height: number): string {
  return `${width}x${height}`;
}

export function getSize(screenSize?: { width: number; height: number }, viewportSize?: { width: number; height: number }): string {
  const size = screenSize || viewportSize || { width: 0, height: 0 };
  return formatResolution(size.width, size.height);
}