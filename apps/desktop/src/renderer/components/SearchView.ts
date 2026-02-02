/**
 * Search View Component
 * Full-page search interface with elegant transitions
 */

import { Component } from './Component';
import { createElement, clearChildren } from '../utils/dom';
import { router } from '../router';
import { DetailModal } from './DetailModal';
import type { TimelineItem } from '../types';

interface SearchResult {
	id: string;
	source: string;
	type: string;
	title?: string;
	snippet?: string;
	score: number;
	timestamp?: string;
	data?: unknown;
}

export class SearchView extends Component {
	private input: HTMLInputElement | null = null;
	private resultsContainer: HTMLElement | null = null;
	private syncButton: HTMLElement | null = null;
	private syncStatus: HTMLElement | null = null;
	private results: SearchResult[] = [];
	private selectedIndex: number = 0;
	private searchTimeout: ReturnType<typeof setTimeout> | null = null;
	private isSyncing: boolean = false;
	private backButton: HTMLElement | null = null;
	private isSearching: boolean = false;
	private lastQuery: string = '';
	private lastError: string | null = null;
	private syncStartTime: number = 0;
	private syncTimer: ReturnType<typeof setInterval> | null = null;

	async init(): Promise<void> {
		this.render();
		this.setupKeyboardShortcuts();
		// Focus input on mount
		setTimeout(() => this.input?.focus(), 100);
	}

	render(): void {
		this.container.innerHTML = '';
		this.container.className = 'relative flex flex-col h-full w-full bg-background';

		// Header with refined minimal design
		const header = createElement('div', {
			className: 'sticky top-0 z-20 border-b border-border/40 bg-background/95 backdrop-blur-md',
		});

		const headerInner = createElement('div', {
			className: 'flex items-center gap-4 px-8 py-5 max-w-6xl mx-auto',
		});

		// Back button - refined minimal style
		this.backButton = createElement('button', {
			className: 'flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all group',
			attributes: {
				'aria-label': 'Go back',
				type: 'button',
			},
		});
		(this.backButton as HTMLElement).style.cssText = `
			-webkit-app-region: no-drag;
			pointer-events: auto;
		`;
		this.backButton.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:-translate-x-0.5 transition-transform duration-200">
				<path d="m12 19-7-7 7-7"/>
				<path d="M19 12H5"/>
			</svg>
		`;
		this.addListener(this.backButton, 'click', () => {
			router.navigate('/');
		});
		headerInner.appendChild(this.backButton);

		// Search input container - cleaner, more refined
		const inputContainer = createElement('div', {
			className: 'flex-1 flex items-center gap-3 px-4 py-2.5 bg-muted/30 border border-border/50 rounded-xl focus-within:border-border focus-within:bg-muted/40 focus-within:shadow-sm transition-all',
		});
		(inputContainer as HTMLElement).style.cssText = `
			-webkit-app-region: no-drag;
		`;

		// Search icon
		const searchIcon = createElement('svg', {
			className: 'w-4 h-4 text-muted-foreground shrink-0',
			innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
		});
		inputContainer.appendChild(searchIcon);

		// Input
		this.input = createElement('input', {
			className: 'flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 outline-none text-sm font-sans',
			attributes: {
				type: 'text',
				placeholder: 'Search everything...',
				spellcheck: 'false',
				autocomplete: 'off',
				'aria-label': 'Search input',
			},
		}) as HTMLInputElement;
		(this.input as HTMLInputElement).style.cssText = `
			-webkit-app-region: no-drag;
		`;
		inputContainer.appendChild(this.input);

		// Keyboard shortcut hint - subtle
		const shortcutHint = createElement('kbd', {
			className: 'hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-background/80 text-muted-foreground rounded border border-border/40',
			textContent: '⌘K',
		});
		inputContainer.appendChild(shortcutHint);

		headerInner.appendChild(inputContainer);

		// Sync button - refined minimal style
		const syncContainer = createElement('div', {
			className: 'flex items-center gap-2 shrink-0',
		});

		this.syncStatus = createElement('span', {
			className: 'text-[10px] font-mono text-muted-foreground',
			textContent: '',
		});
		syncContainer.appendChild(this.syncStatus);

		this.syncButton = createElement('button', {
			className: 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors',
			attributes: {
				title: 'Sync search index',
				type: 'button',
				'aria-label': 'Sync search index',
			},
		});
		(this.syncButton as HTMLElement).style.cssText = `
			-webkit-app-region: no-drag;
			pointer-events: auto;
		`;
		this.syncButton.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sync-icon">
				<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
				<path d="M3 3v5h5"/>
				<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
				<path d="M16 16h5v5"/>
			</svg>
			<span class="text-xs font-medium">Sync</span>
		`;
		this.addListener(this.syncButton, 'click', () => this.handleSync());
		syncContainer.appendChild(this.syncButton);

		headerInner.appendChild(syncContainer);
		header.appendChild(headerInner);
		this.container.appendChild(header);

		// Results container - cleaner spacing
		this.resultsContainer = createElement('div', {
			className: 'flex-1 overflow-y-auto px-8 py-6 max-w-6xl mx-auto w-full',
		});
		this.container.appendChild(this.resultsContainer);

		// Event listeners
		this.addListener(this.input, 'input', () => this.handleInput());
		this.addListener(this.input, 'keydown', (e) => this.handleKeydown(e as KeyboardEvent));

		// Initial empty state
		this.renderResults();
	}

	private setupKeyboardShortcuts(): void {
		const handler = (e: KeyboardEvent) => {
			// Focus input when Command+K is pressed in search view
			if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
				e.preventDefault();
				e.stopPropagation();
				this.input?.focus();
				this.input?.select();
			}
			// Escape to go back
			if (e.key === 'Escape') {
				if (this.input?.matches(':focus')) {
					this.input.blur();
				}
				router.navigate('/');
			}
		};
		// Use capture phase but don't stop propagation for other keys
		document.addEventListener('keydown', handler, true);
		this.registerCleanup(() => document.removeEventListener('keydown', handler, true));
	}

	private handleInput(): void {
		const query = this.input?.value || '';
		this.lastQuery = query;
		this.lastError = null;

		// Debounce search
		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout);
		}

		if (!query.trim()) {
			this.results = [];
			this.isSearching = false;
			this.renderResults();
			return;
		}

		this.isSearching = true;
		this.renderResults();

		this.searchTimeout = setTimeout(async () => {
			await this.search(query);
		}, 100); // Reduced debounce from 150ms to 100ms for faster response
	}

	private async search(query: string): Promise<void> {
		try {
			if (!window.searchApi) {
				console.error('Search API not available');
				this.results = [];
				this.lastError = 'Search API not available';
				this.isSearching = false;
				this.renderResults();
				return;
			}

			// Add timeout wrapper to prevent hanging forever - reduced to 8s for faster feedback
			const searchPromise = window.searchApi.search(query, 50);
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('Search timed out after 8 seconds')), 8000);
			});

			const response = await Promise.race([searchPromise, timeoutPromise]);

			if (response?.error) {
				console.warn('Search API error:', response.error);
				this.results = [];
				this.lastError = response.error;
			} else if (response && Array.isArray(response.results)) {
				this.results = response.results;
			} else {
				console.warn('Invalid search response:', response);
				this.results = [];
				this.lastError = 'Invalid search response';
			}

			this.isSearching = false;
			this.selectedIndex = 0;
			this.renderResults();
		} catch (error) {
			console.error('Search error:', error);
			this.results = [];
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.lastError = errorMessage.includes('timeout') || errorMessage.includes('timed out')
				? 'Search timed out. Try a simpler query or check if QMD is running.'
				: errorMessage;
			this.isSearching = false;
			this.renderResults();
		}
	}

	private renderResults(): void {
		if (!this.resultsContainer) return;
		clearChildren(this.resultsContainer);

		if (this.isSearching) {
			const searching = createElement('div', {
				className: 'flex flex-col items-center justify-center h-full text-center py-16',
			});
			const spinner = createElement('div', {
				className: 'w-12 h-12 rounded-full border-2 border-muted border-t-primary animate-spin mb-4',
			});
			const text = createElement('div', {
				className: 'text-sm font-medium text-muted-foreground',
				textContent: `Searching${this.lastQuery ? ` “${this.lastQuery}”` : ''}...`,
			});
			searching.appendChild(spinner);
			searching.appendChild(text);
			this.resultsContainer.appendChild(searching);
			return;
		}

		if (this.lastError) {
			const errorState = createElement('div', {
				className: 'flex flex-col items-center justify-center h-full text-center py-16',
			});
			const icon = createElement('div', {
				className: 'w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4',
			});
			icon.innerHTML = `
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="8" x2="12" y2="12"/>
					<line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
			`;
			const text = createElement('div', {
				className: 'text-muted-foreground',
			});
			text.innerHTML = `<div class="text-sm font-medium mb-1 text-red-500">Search unavailable</div><div class="text-xs text-muted-foreground">${this.lastError}</div>`;
			errorState.appendChild(icon);
			errorState.appendChild(text);
			this.resultsContainer.appendChild(errorState);
			return;
		}

		if (this.results.length === 0) {
			const empty = createElement('div', {
				className: 'flex flex-col items-center justify-center h-full text-center py-16',
			});
			const icon = createElement('div', {
				className: 'w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4',
			});
			icon.innerHTML = `
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
					<circle cx="11" cy="11" r="8"/>
					<path d="m21 21-4.3-4.3"/>
				</svg>
			`;
			empty.appendChild(icon);

			const text = createElement('div', {
				className: 'text-muted-foreground',
			});
			if (this.lastQuery?.trim()) {
				text.innerHTML = '<div class="text-sm font-medium mb-1">No results found</div><div class="text-xs text-muted-foreground">Try a different search term or sync the index</div>';
			} else {
				text.innerHTML = '<div class="text-sm font-medium mb-1">Start typing to search</div><div class="text-xs text-muted-foreground">Search across all your data</div>';
			}
			empty.appendChild(text);

			this.resultsContainer.appendChild(empty);
			return;
		}

		// Results list - styled like Timeline items
		const resultsList = createElement('div', {
			className: 'space-y-4 relative',
		});

		this.results.forEach((result, index) => {
			// Item wrapper matching Timeline style
			const messageWrapper = createElement('div', {
				className: 'relative flex items-start gap-3',
			});
			(messageWrapper as HTMLElement).style.cssText = `
				position: relative;
			`;

			// Avatar/icon matching Timeline style
			const avatar = createElement('div', {
				className: 'flex-shrink-0',
			});
			(avatar as HTMLElement).style.cssText = `
				width: 20px;
				height: 20px;
				border-radius: 9999px;
				background: hsl(var(--secondary) / 0.9);
				display: flex;
				align-items: center;
				justify-content: center;
				overflow: hidden;
				border: 1px solid hsl(var(--border) / 0.6);
			`;
			// Use source color for avatar
			const sourceColors: Record<string, string> = {
				farcaster: 'hsl(270 40% 60%)',
				teller: 'hsl(145 45% 40%)',
				obsidian: 'hsl(210 40% 40%)',
				chrome: 'hsl(36 82% 50%)',
				brave: 'hsl(2 74% 52%)',
				user: 'hsl(195 60% 50%)',
			};
			const avatarColor = sourceColors[result.source] || 'hsl(var(--muted-foreground) / 0.35)';
			avatar.innerHTML = `<div style="width: 8px; height: 8px; border-radius: 9999px; background: ${avatarColor};"></div>`;
			messageWrapper.appendChild(avatar);

			// Card/bubble matching Timeline style
			const bubble = createElement('div', {
				className: 'flex-1 cursor-pointer',
				attributes: {
					role: 'button',
					tabindex: '0',
					'aria-label': `Search result: ${result.title || result.id}`,
				},
			});
			(bubble as HTMLElement).style.cssText = `
				background: hsl(var(--card));
				border: 1px solid hsl(var(--border) / 0.7);
				border-radius: 0.65rem;
				padding: 0.85rem 1rem;
				transition: all 0.2s ease;
				box-shadow: 0 1px 2px rgba(18, 16, 13, 0.04);
				position: relative;
			`;
			
			// Hover effects matching Timeline
			bubble.addEventListener('mouseenter', () => {
				(bubble as HTMLElement).style.background = 'hsl(var(--card) / 0.98)';
				(bubble as HTMLElement).style.borderColor = 'hsl(var(--border) / 0.9)';
				(bubble as HTMLElement).style.boxShadow = '0 4px 12px rgba(18, 16, 13, 0.08)';
			});
			bubble.addEventListener('mouseleave', () => {
				(bubble as HTMLElement).style.background = 'hsl(var(--card))';
				(bubble as HTMLElement).style.borderColor = 'hsl(var(--border) / 0.7)';
				(bubble as HTMLElement).style.boxShadow = '0 1px 2px rgba(18, 16, 13, 0.04)';
			});

			// Source badge - matching Timeline style
			const sourceLabel = createElement('div', {
				className: 'flex items-center gap-2 mb-1.5',
			});
			const sourceName = createElement('span');
			(sourceName as HTMLElement).style.cssText = `
				font-family: var(--font-sans, 'Manrope', sans-serif);
				font-size: 0.75rem;
				font-weight: 600;
				color: hsl(var(--foreground) / 0.6);
				text-transform: capitalize;
			`;
			sourceName.textContent = result.source;
			sourceLabel.appendChild(sourceName);
			bubble.appendChild(sourceLabel);

			// Title - matching Timeline content style
			const title = createElement('div');
			(title as HTMLElement).style.cssText = `
				font-family: var(--font-sans, 'Manrope', sans-serif);
				font-size: 0.8125rem;
				line-height: 1.55;
				color: var(--foreground);
				margin-bottom: ${result.snippet ? '0.5rem' : '0'};
				font-weight: 500;
			`;
			title.textContent = result.title || result.id;
			bubble.appendChild(title);

			// Snippet - matching Timeline style
			if (result.snippet) {
				const snippet = createElement('div');
				(snippet as HTMLElement).style.cssText = `
					font-family: var(--font-sans, 'Manrope', sans-serif);
					font-size: 0.8125rem;
					line-height: 1.55;
					color: hsl(var(--muted-foreground));
					margin-bottom: 0.5rem;
				`;
				snippet.textContent = result.snippet;
				bubble.appendChild(snippet);
			}

			// Timestamp - matching Timeline style (right-aligned)
			if (result.timestamp) {
				const absoluteTime = createElement('div', {
					className: 'absolute right-0 top-0',
				});
				(absoluteTime as HTMLElement).style.cssText = `
					font-family: var(--font-sans, 'Manrope', sans-serif);
					font-size: 0.6875rem;
					color: hsl(var(--muted-foreground));
					opacity: 0.55;
					white-space: nowrap;
					padding: 0.85rem 1rem;
				`;
				const date = new Date(result.timestamp);
				const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
				const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
				absoluteTime.textContent = `${timeStr} · ${dateStr}`;
				bubble.appendChild(absoluteTime);
			}

			messageWrapper.appendChild(bubble);

			// Click handlers
			this.addListener(bubble, 'click', () => this.selectResult(result));
			this.addListener(bubble, 'keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this.selectResult(result);
				}
			});
			this.addListener(messageWrapper, 'mouseenter', () => {
				this.selectedIndex = index;
				this.renderResults();
			});

			resultsList.appendChild(messageWrapper);
		});

		this.resultsContainer.appendChild(resultsList);
	}

	private handleKeydown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
				this.renderResults();
				this.scrollToSelected();
				break;
			case 'ArrowUp':
				e.preventDefault();
				this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
				this.renderResults();
				this.scrollToSelected();
				break;
			case 'Enter':
				e.preventDefault();
				if (this.results[this.selectedIndex]) {
					this.selectResult(this.results[this.selectedIndex]);
				}
				break;
		}
	}

	private scrollToSelected(): void {
		if (!this.resultsContainer) return;
		const selected = this.resultsContainer.querySelector(`[data-index="${this.selectedIndex}"]`);
		if (selected) {
			selected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	private async selectResult(result: SearchResult): Promise<void> {
		// Convert search result to timeline item format
		// Use the data from search result if available, otherwise construct minimal item
		const timelineItem: TimelineItem = {
			id: result.id,
			source: result.source as any,
			type: result.type,
			timestamp: result.timestamp ? new Date(result.timestamp) : new Date(),
			data: result.data || {},
		};

		// Open detail modal
		const modalContainer = createElement('div');
		document.body.appendChild(modalContainer);
		const modal = new DetailModal(modalContainer, timelineItem, () => {
			modal.destroy();
			document.body.removeChild(modalContainer);
		});
		await modal.init();
	}

	private async handleSync(): Promise<void> {
		if (this.isSyncing) return;

		this.isSyncing = true;
		this.updateSyncUI('syncing');

		try {
			const response = await Promise.race([
				window.searchApi.embedSync(false),
				new Promise<{ success: false; error: string }>((_, reject) =>
					setTimeout(() => reject(new Error('Sync timed out')), 60000)
				),
			]);

			if (response.success) {
				this.updateSyncUI('success', response.exportedCount);
				setTimeout(() => {
					if (!this.isSyncing) {
						this.updateSyncUI('idle');
					}
				}, 3000);
			} else {
				this.updateSyncUI('error', undefined, response.error);
			}
		} catch (error) {
			this.updateSyncUI('error', undefined, error instanceof Error ? error.message : 'Unknown error');
		}

		this.isSyncing = false;
	}

	private updateSyncUI(status: 'idle' | 'syncing' | 'success' | 'error', count?: number, error?: string): void {
		if (!this.syncButton || !this.syncStatus) return;

		const icon = this.syncButton.querySelector('.sync-icon') as SVGElement;

		switch (status) {
			case 'syncing':
				this.syncButton.classList.add('opacity-50', 'pointer-events-none');
				if (icon) icon.classList.add('animate-spin');
				this.syncStatus.textContent = 'Syncing…';
				this.syncStatus.className = 'text-[10px] font-mono text-muted-foreground';
				this.startSyncTimer();
				break;
			case 'success':
				this.syncButton.classList.remove('opacity-50', 'pointer-events-none');
				if (icon) icon.classList.remove('animate-spin');
				this.syncStatus.textContent = count !== undefined ? `${count} synced` : 'Synced';
				this.syncStatus.className = 'text-[10px] font-mono text-green-600 dark:text-green-400';
				this.stopSyncTimer();
				break;
			case 'error':
				this.syncButton.classList.remove('opacity-50', 'pointer-events-none');
				if (icon) icon.classList.remove('animate-spin');
				this.syncStatus.textContent = error || 'Failed';
				this.syncStatus.className = 'text-[10px] font-mono text-destructive';
				this.stopSyncTimer();
				break;
			case 'idle':
			default:
				this.syncButton.classList.remove('opacity-50', 'pointer-events-none');
				if (icon) icon.classList.remove('animate-spin');
				this.syncStatus.textContent = '';
				this.syncStatus.className = 'text-[10px] font-mono text-muted-foreground';
				this.stopSyncTimer();
				break;
		}
	}

	private startSyncTimer(): void {
		this.stopSyncTimer();
		this.syncStartTime = Date.now();
		this.syncTimer = setInterval(() => {
			const elapsed = Math.floor((Date.now() - this.syncStartTime) / 1000);
			if (!this.syncStatus) return;
			if (elapsed < 15) {
				this.syncStatus.textContent = `Syncing… ${elapsed}s`;
			} else if (elapsed < 45) {
				this.syncStatus.textContent = `Syncing… ${elapsed}s`;
			} else {
				this.syncStatus.textContent = `Syncing… ${elapsed}s`;
			}
		}, 1000);
	}

	private stopSyncTimer(): void {
		if (this.syncTimer) {
			clearInterval(this.syncTimer);
			this.syncTimer = null;
		}
	}
}

export default SearchView;
