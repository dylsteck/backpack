import { Button } from "@/components/ui/button";

export function ActionButtons({ actions }: { actions: string[] }) {
	return (
		<div className="flex flex-wrap gap-2">
			{actions.map((action) => (
				<Button key={action} variant="outline" size="sm" className="text-xs bg-transparent">
					{action}
				</Button>
			))}
		</div>
	);
}

