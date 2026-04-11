import { useEffect } from "react";

/**
 * The only sanctioned wrapper around useEffect.
 *
 * Use for one-shot external sync on mount (DOM integration, third-party widget
 * lifecycles, browser API subscriptions). Runs exactly once per mount. Reset
 * behavior with a `key` prop on the parent — not with dependency arrays.
 *
 * See /.claude/skills/no-use-effect/SKILL.md for the full no-useEffect rule.
 */
export function useMountEffect(effect: () => void | (() => void)): void {
	/* eslint-disable-next-line react-hooks/exhaustive-deps */
	useEffect(effect, []);
}
