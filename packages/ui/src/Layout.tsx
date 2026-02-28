import type { JSX } from "solid-js";

export interface LayoutProps {
	children: JSX.Element;
	/** Optional nav items: { href, label } */
	nav?: Array<{ href: string; label: string }>;
	/** Optional: custom link component for SPA routing (e.g. A from @solidjs/router) */
	Link?: (props: { href: string; class?: string; children: JSX.Element }) => JSX.Element;
}

export function Layout(props: LayoutProps) {
	const Link = props.Link ?? ((p: { href: string; class?: string; children: JSX.Element }) => (
		<a href={p.href} class={p.class}>{p.children}</a>
	));

	return (
		<div class="min-h-screen bg-zinc-950 text-zinc-100">
			<header class="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
				<nav class="flex items-center gap-6">
					<Link href="/" class="text-lg font-semibold text-zinc-100 hover:text-white">
						Backpack
					</Link>
					{props.nav?.map((item) => (
						<Link
							href={item.href}
							class="text-sm text-zinc-400 hover:text-zinc-100"
						>
							{item.label}
						</Link>
					))}
				</nav>
			</header>
			<main class="mx-auto max-w-4xl px-4 py-6">{props.children}</main>
		</div>
	);
}
