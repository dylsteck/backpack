import { X } from "lucide-react";
import { useDetailSidebar } from "@/contexts/DetailSidebarContext";
import { Button } from "@/components/ui/button";
import { renderEntryDetail } from "@/components/timeline/entry-detail";

export function DetailSidebar() {
	const { open, item, hide } = useDetailSidebar();
	if (!open || !item) return null;

	return (
		<aside className="flex w-96 shrink-0 flex-col bg-sidebar/80 shadow-[-1px_0_0_0_hsl(var(--border)/0.3)] backdrop-blur-xl backdrop-saturate-[180%]">
			<div className="flex h-12 items-center justify-between px-5 shadow-[0_1px_0_0_hsl(var(--border)/0.3)]">
				<span className="text-[13px] font-semibold tracking-tight capitalize">
					{item.source}
				</span>
				<Button variant="ghost" size="icon" onClick={hide}>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div className="flex-1 overflow-y-auto p-5">
				{renderEntryDetail(item)}
			</div>
		</aside>
	);
}
