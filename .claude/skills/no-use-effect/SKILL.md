---
name: no-use-effect
description: Banned useEffect + the 5 replacement patterns
---

# No useEffect

Direct `useEffect` is **banned** across the Backpack desktop app. The only sanctioned escape hatch is `apps/desktop/src/hooks/useMountEffect.ts`, which wraps `useEffect(fn, [])` for one-shot mount sync. Everything else must use one of the 5 alternatives below.

This doctrine is lifted straight from the React docs page ["You Might Not Need an Effect"](https://react.dev/learn/you-might-not-need-an-effect). If you find yourself reaching for `useEffect`, 99% of the time the fix is one of these five patterns.

An ESLint rule (`no-restricted-syntax` in `apps/desktop/eslint.config.mjs`) will fail the build if you import or call `useEffect` anywhere other than `useMountEffect.ts`.

---

## The 5 rules

### 1. Derived state → inline compute

Don't `useState` + `useEffect` to mirror props or other state. Just compute the value during render.

Bad:

```tsx
function FullName({ first, last }: { first: string; last: string }) {
	const [full, setFull] = useState("");
	useEffect(() => {
		setFull(`${first} ${last}`);
	}, [first, last]);
	return <h1>{full}</h1>;
}
```

Good:

```tsx
function FullName({ first, last }: { first: string; last: string }) {
	const full = `${first} ${last}`;
	return <h1>{full}</h1>;
}
```

If the computation is expensive, wrap it in `useMemo` — still no effect needed.

---

### 2. Data fetching → TanStack Query

Don't `useEffect(fetch → setState)`. Use `useQuery` / `useMutation`. It handles caching, race conditions, retries, refocus, and Suspense for you.

Bad:

```tsx
function Timeline() {
	const [items, setItems] = useState<Item[] | null>(null);
	useEffect(() => {
		fetch("/api/items").then(r => r.json()).then(setItems);
	}, []);
	if (!items) return <Spinner />;
	return <List items={items} />;
}
```

Good:

```tsx
import { useQuery } from "@tanstack/react-query";

function Timeline() {
	const { data: items, isPending } = useQuery({
		queryKey: ["items"],
		queryFn: () => window.backpack.items(),
	});
	if (isPending) return <Spinner />;
	return <List items={items} />;
}
```

For writes, use `useMutation`. For IPC in Electron, the `queryFn` calls `window.backpack.*` bridged from the preload script.

---

### 3. User actions → event handlers

If a side effect is caused by a click, submit, or keystroke, put it in the handler — not in an effect that watches some state the handler updated.

Bad:

```tsx
function Buy() {
	const [clicked, setClicked] = useState(false);
	useEffect(() => {
		if (clicked) postOrder();
	}, [clicked]);
	return <button onClick={() => setClicked(true)}>Buy</button>;
}
```

Good:

```tsx
function Buy() {
	return <button onClick={() => postOrder()}>Buy</button>;
}
```

---

### 4. One-shot external sync on mount → `useMountEffect`

For DOM integration, third-party widget lifecycles, and browser API subscriptions that must run exactly once per mount — use `useMountEffect`. It enforces the empty-deps pattern and is the only file allowed to import `useEffect` directly.

```tsx
import { useMountEffect } from "@/hooks/useMountEffect";

function MonacoEditor() {
	const ref = useRef<HTMLDivElement>(null);
	useMountEffect(() => {
		const editor = monaco.editor.create(ref.current!);
		return () => editor.dispose();
	});
	return <div ref={ref} className="h-full" />;
}
```

Rules of thumb:

- Return a cleanup function for anything that needs tearing down.
- Never put a dep array — if you think you need one, you actually need rule 5 (reset via `key`).
- Don't use it for data fetching — that's rule 2.

---

### 5. Reset state when a prop changes → `key` prop on the parent

If state needs to reset when a prop changes, don't watch the prop in an effect. Remount the component by keying it.

Bad:

```tsx
function Profile({ userId }: { userId: string }) {
	const [draft, setDraft] = useState("");
	useEffect(() => {
		setDraft("");
	}, [userId]);
	return <textarea value={draft} onChange={e => setDraft(e.target.value)} />;
}
```

Good:

```tsx
function ProfilePage({ userId }: { userId: string }) {
	return <Profile key={userId} userId={userId} />;
}

function Profile({ userId }: { userId: string }) {
	const [draft, setDraft] = useState("");
	return <textarea value={draft} onChange={e => setDraft(e.target.value)} />;
}
```

When `userId` changes, React unmounts and remounts `Profile` — its state is fresh, no effect required.

---

## Quick decision tree

1. Am I computing a value from existing state/props? → **Rule 1** (inline compute).
2. Am I loading data from somewhere? → **Rule 2** (TanStack Query).
3. Is this happening because the user did something? → **Rule 3** (event handler).
4. Am I wiring up a DOM lib / browser API once per mount? → **Rule 4** (`useMountEffect`).
5. Do I need to reset local state when a prop changes? → **Rule 5** (`key` prop).

If none of these fit, stop and think harder before reaching for the escape hatch. The answer is almost always one of the five.

---

## See also

- `apps/desktop/src/hooks/useMountEffect.ts` — the one allowed wrapper.
- `apps/desktop/eslint.config.mjs` — the ESLint rule that enforces this.
- React docs: https://react.dev/learn/you-might-not-need-an-effect
