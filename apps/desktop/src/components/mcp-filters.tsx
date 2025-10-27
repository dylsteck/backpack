import { useState } from "react";
import { Input, Popover, PopoverContent, PopoverTrigger, Button, Checkbox, Label } from "@cortex/shared/components";
import { Filter } from "lucide-react";

interface MCPFiltersProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	selectedVendors: string[];
	onVendorsChange: (vendors: string[]) => void;
	selectedCategories: string[];
	onCategoriesChange: (categories: string[]) => void;
	availableVendors: string[];
	availableCategories: string[];
}

export default function MCPFilters({
	searchQuery,
	onSearchChange,
	selectedVendors,
	onVendorsChange,
	selectedCategories,
	onCategoriesChange,
	availableVendors,
	availableCategories,
}: MCPFiltersProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleVendorToggle = (vendor: string) => {
		if (selectedVendors.includes(vendor)) {
			onVendorsChange(selectedVendors.filter((v) => v !== vendor));
		} else {
			onVendorsChange([...selectedVendors, vendor]);
		}
	};

	const handleCategoryToggle = (category: string) => {
		if (selectedCategories.includes(category)) {
			onCategoriesChange(selectedCategories.filter((c) => c !== category));
		} else {
			onCategoriesChange([...selectedCategories, category]);
		}
	};

	const clearFilters = () => {
		onVendorsChange([]);
		onCategoriesChange([]);
	};

	const activeFilterCount = selectedVendors.length + selectedCategories.length;

	return (
		<div className="flex gap-3">
			<Input
				type="text"
				placeholder="Search MCP servers..."
				value={searchQuery}
				onChange={(e) => onSearchChange(e.target.value)}
				className="flex-1"
			/>
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" className="gap-2">
						<Filter className="h-4 w-4" />
						Filters
						{activeFilterCount > 0 && (
							<span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
								{activeFilterCount}
							</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-80">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="font-semibold">Filters</h4>
							{activeFilterCount > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={clearFilters}
									className="h-auto p-0 text-xs"
								>
									Clear all
								</Button>
							)}
						</div>

						{availableVendors.length > 0 && (
							<div>
								<h5 className="mb-2 text-sm font-medium">Vendor</h5>
								<div className="space-y-2 max-h-40 overflow-y-auto">
									{availableVendors.map((vendor) => (
										<div key={vendor} className="flex items-center space-x-2">
											<Checkbox
												id={`vendor-${vendor}`}
												checked={selectedVendors.includes(vendor)}
												onCheckedChange={() => handleVendorToggle(vendor)}
											/>
											<Label
												htmlFor={`vendor-${vendor}`}
												className="text-sm font-normal cursor-pointer"
											>
												{vendor}
											</Label>
										</div>
									))}
								</div>
							</div>
						)}

						{availableCategories.length > 0 && (
							<div>
								<h5 className="mb-2 text-sm font-medium">Categories</h5>
								<div className="space-y-2 max-h-40 overflow-y-auto">
									{availableCategories.map((category) => (
										<div key={category} className="flex items-center space-x-2">
											<Checkbox
												id={`category-${category}`}
												checked={selectedCategories.includes(category)}
												onCheckedChange={() => handleCategoryToggle(category)}
											/>
											<Label
												htmlFor={`category-${category}`}
												className="text-sm font-normal cursor-pointer"
											>
												{category}
											</Label>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}

