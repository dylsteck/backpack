import type { JSX } from "solid-js";

export interface LayoutProps {
	children: JSX.Element;
	nav?: Array<{ href: string; label: string }>;
	Link?: (props: { href: string; class?: string; children: JSX.Element }) => JSX.Element;
	activePath?: string;
}

export function Layout(props: LayoutProps) {
	const Link = props.Link ?? ((p: { href: string; class?: string; children: JSX.Element }) => (
		<a href={p.href} class={p.class}>{p.children}</a>
	));

	return (
		<div class="min-h-screen bg-[#0a0a0f] text-[#e4e4ed]">
			<header class="sticky top-0 z-50 border-b border-[#1e1e2e] backdrop-blur-md bg-[#0a0a0f]/80">
				<nav class="mx-auto flex max-w-5xl items-center px-6 py-3">
					<Link href="/" class="text-lg font-semibold text-[#e4e4ed] hover:text-white">
						Backpack
					</Link>
					<div class="ml-8 flex items-center gap-1">
						{props.nav?.map((item) => {
							const isActive = props.activePath === item.href ||
								(item.href !== "/" && props.activePath?.startsWith(item.href));
							return (
								<Link
									href={item.href}
									class={`rounded-md px-3 py-1.5 text-sm transition-colors ${
										isActive
											? "bg-[#1a1a25] text-[#e4e4ed] font-medium"
											: "text-[#8b8ba0] hover:text-[#e4e4ed] hover:bg-[#1a1a25]"
									}`}
								>
									{item.label}
								</Link>
							);
						})}
					</div>
					<div class="ml-auto">
						<Link href="/settings" class="text-[#5a5a70] hover:text-[#8b8ba0] transition-colors">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
								<circle cx="12" cy="12" r="3"/>
							</svg>
						</Link>
					</div>
				</nav>
			</header>
			<main class="mx-auto max-w-5xl px-6 py-8">{props.children}</main>
		</div>
	);
}
