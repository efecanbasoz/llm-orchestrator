export type ContentType = "copywriting" | "ui-text" | "content";

export function buildGeminiPrompt(
  type: ContentType,
  prompt: string,
  context?: string,
  language?: string,
): string {
  const lang = language || "en";
  const ctx = context ? `\nContext: ${context}` : "";

  const systemPrompts: Record<ContentType, string> = {
    copywriting:
      "You are a professional copywriter. Write compelling, conversion-focused copy. Be concise and impactful.",
    "ui-text":
      "You are a UX writer specializing in interface microcopy. Write clear, concise UI text (labels, tooltips, error messages, CTAs). Use active voice.",
    content:
      "You are a content strategist. Create well-structured, engaging content.",
  };

  return `${systemPrompts[type]}${ctx}\nOutput language: ${lang}\n\n${prompt}`;
}

export function buildCodexPrompt(code: string, focus?: string): string {
  const focusLine = focus ? `\nFocus area: ${focus}` : "";
  return `You are a code reviewer. Review the following code and provide actionable feedback. Do NOT modify any files — only return your review as text.${focusLine}\n\nCode to review:\n\`\`\`\n${code}\n\`\`\``;
}
