export function shouldRePrompt(current: string|undefined, required: string|undefined) {
  if (!required) return false;
  return current !== required;
}