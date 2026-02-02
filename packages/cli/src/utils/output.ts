import chalk from "chalk";

export type OutputFormat = "json" | "pretty" | "csv";

export interface OutputOptions {
	format: OutputFormat;
	noColor?: boolean;
}

/**
 * Output data in the specified format
 */
export function output(data: unknown, options: OutputOptions): void {
	if (options.format === "json") {
		console.log(JSON.stringify(data, null, 2));
		return;
	}

	if (options.format === "csv") {
		outputCsv(data);
		return;
	}

	// Pretty format - let the caller handle specific formatting
	// This is a pass-through for pretty output
}

/**
 * Output data as CSV
 */
function outputCsv(data: unknown): void {
	if (!Array.isArray(data)) {
		console.error("CSV output requires array data");
		return;
	}

	if (data.length === 0) {
		return;
	}

	// Get headers from first item
	const headers = Object.keys(data[0] as Record<string, unknown>);
	console.log(headers.join(","));

	// Output rows
	for (const item of data) {
		const row = headers.map((header) => {
			const value = (item as Record<string, unknown>)[header];
			if (value === null || value === undefined) {
				return "";
			}
			if (typeof value === "object") {
				return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
			}
			const strValue = String(value);
			if (strValue.includes(",") || strValue.includes('"') || strValue.includes("\n")) {
				return `"${strValue.replace(/"/g, '""')}"`;
			}
			return strValue;
		});
		console.log(row.join(","));
	}
}

/**
 * Format a timestamp for pretty output
 */
export function formatTimestamp(date: Date | string | number): string {
	const d = new Date(date);
	const now = new Date();
	const diff = now.getTime() - d.getTime();
	
	// Less than a minute
	if (diff < 60 * 1000) {
		return "just now";
	}
	
	// Less than an hour
	if (diff < 60 * 60 * 1000) {
		const mins = Math.floor(diff / (60 * 1000));
		return `${mins}m ago`;
	}
	
	// Less than a day
	if (diff < 24 * 60 * 60 * 1000) {
		const hours = Math.floor(diff / (60 * 60 * 1000));
		return `${hours}h ago`;
	}
	
	// Less than a week
	if (diff < 7 * 24 * 60 * 60 * 1000) {
		const days = Math.floor(diff / (24 * 60 * 60 * 1000));
		return `${days}d ago`;
	}
	
	// Format as date
	return d.toLocaleDateString();
}

/**
 * Format a source name with color
 */
export function formatSource(source: string): string {
	const colors: Record<string, (s: string) => string> = {
		farcaster: chalk.magenta,
		teller: chalk.green,
		obsidian: chalk.blue,
		chrome: chalk.yellow,
		brave: chalk.red,
		user: chalk.cyan,
	};
	
	const colorFn = colors[source] || chalk.white;
	return colorFn(source);
}

/**
 * Format an item type
 */
export function formatType(type: string): string {
	return chalk.dim(`[${type}]`);
}

/**
 * Format currency amount
 */
export function formatAmount(amount: number): string {
	const formatted = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(Math.abs(amount));
	
	if (amount < 0) {
		return chalk.red(`-${formatted}`);
	}
	return chalk.green(`+${formatted}`);
}

/**
 * Truncate text to a max length
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.slice(0, maxLength - 3) + "...";
}

/**
 * Print a success message
 */
export function success(message: string): void {
	console.log(chalk.green("✓"), message);
}

/**
 * Print an error message
 */
export function error(message: string): void {
	console.error(chalk.red("✗"), message);
}

/**
 * Print an info message
 */
export function info(message: string): void {
	console.log(chalk.blue("ℹ"), message);
}

/**
 * Print a warning message
 */
export function warn(message: string): void {
	console.log(chalk.yellow("⚠"), message);
}

/**
 * Create a simple spinner
 */
export function createSpinner(message: string) {
	const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	let i = 0;
	let intervalId: ReturnType<typeof setInterval>;
	
	return {
		start() {
			process.stdout.write(`${chalk.cyan(frames[0])} ${message}`);
			intervalId = setInterval(() => {
				i = (i + 1) % frames.length;
				process.stdout.write(`\r${chalk.cyan(frames[i])} ${message}`);
			}, 80);
		},
		stop(finalMessage?: string) {
			clearInterval(intervalId);
			process.stdout.write("\r" + " ".repeat(message.length + 3) + "\r");
			if (finalMessage) {
				console.log(finalMessage);
			}
		},
		succeed(msg?: string) {
			this.stop(chalk.green("✓") + " " + (msg || message));
		},
		fail(msg?: string) {
			this.stop(chalk.red("✗") + " " + (msg || message));
		},
	};
}
