"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./user-menu";
import CortexIcon from "./cortex-icon";

export default function Navbar() {
	const pathname = usePathname();

	const links = [
		{ to: "/", label: "Home" },
		{ to: "/apps", label: "Apps" },
		{ to: "/backpack", label: "Backpack" },
	] as const;

	return (
		<div className="border-b">
			<div className="flex h-16 items-center px-6">
				<Link href="/" className="mr-8">
					<CortexIcon size={28} />
				</Link>
				<nav className="flex gap-6 text-sm">
					{links.map(({ to, label }) => {
						const isActive = pathname === to;
						return (
							<Link
								key={to}
								href={to}
								className={`transition-colors hover:text-foreground/80 ${
									isActive ? "text-foreground font-medium" : "text-foreground/60"
								}`}
							>
								{label}
							</Link>
						);
					})}
				</nav>
				<div className="ml-auto">
					<UserMenu />
				</div>
			</div>
		</div>
	);
}

