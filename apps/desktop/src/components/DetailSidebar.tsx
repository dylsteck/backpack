import { X } from "lucide-react";
import { useDetailSidebar } from "@/contexts/DetailSidebarContext";
import { Button } from "@/components/ui/button";
import { renderEntryDetail } from "@/components/timeline/entry-detail";

export function DetailSidebar() {
	const { open, item, hide } = useDetailSidebar();
	if (!open || !item) return null;

	return (
		<aside className="flex w-96 shrink-0 flex-col border-l bg-sidebar">
			<div className="flex h-12 items-center justify-between border-b px-4">
				<span className="text-sm font-medium capitalize">{item.source}</span>
				<Button variant="ghost" size="icon" onClick={hide}>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div className="flex-1 overflow-y-auto p-4">
				{renderEntryDetail(item)}
			</div>
		</aside>
	);
}
