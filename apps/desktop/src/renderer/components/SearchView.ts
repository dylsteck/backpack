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
	private loadMoreRef: HTMLElement | null = null;
	private observer: IntersectionObserver | null = null;
	private isLoadingMore: boolean = false;
	private currentLimit: number = 50;

	async init(): Promise<void> {
		this.render();
		this.setupKeyboardShortcuts();
		this.setupInfiniteScroll();
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
		(header as HTMLElement).style.cssText = `
			-webkit-app-region: drag;
		`;

		const headerInner = createElement('div', {
			className: 'content-wrap flex items-center gap-3 h-[var(--topbar-height)]',
		});

		// Back button - refined minimal style
		this.backButton = createElement('button', {
			className: 'btn btn-ghost icon-btn',
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
			className: 'flex-1 input-pill',
		});
		(inputContainer as HTMLElement).style.cssText = `
			-webkit-app-region: no-drag;
			pointer-events: auto !important;
		`;
		// Ensure container doesn't block input clicks
		this.addListener(inputContainer, 'click', (e) => {
			if (e.target === inputContainer || (e.target as HTMLElement).tagName !== 'INPUT') {
				this.input?.focus();
			}
		});

		// Search icon
		const searchIcon = createElement('svg', {
			className: 'w-4 h-4 text-muted-foreground shrink-0',
			attributes: {
				viewBox: '0 0 24 24',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
				'aria-hidden': 'true',
			},
			innerHTML: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
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
			pointer-events: auto !important;
			cursor: text !important;
		`;
		// Ensure input is clickable and focusable
		this.addListener(this.input, 'click', () => {
			this.input?.focus();
		});
		inputContainer.appendChild(this.input);

		// Keyboard shortcut hint - subtle
		const shortcutHint = createElement('kbd', {
			className: 'hidden sm:inline-flex kbd',
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
			className: 'btn btn-ghost',
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
			className: 'flex-1 overflow-y-auto content-wrap py-6',
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
			this.currentLimit = 50; // Reset limit for new search
			await this.search(query, false);
		}, 100); // Reduced debounce from 150ms to 100ms for faster response
	}

	private async search(query: string, append: boolean = false): Promise<void> {
		try {
			if (!window.searchApi) {
				console.error('Search API not available');
				if (!append) {
					this.results = [];
					this.lastError = 'Search API not available';
				}
				this.isSearching = false;
				this.renderResults();
				return;
			}

			// Add timeout wrapper to prevent hanging forever - reduced to 8s for faster feedback
			const searchPromise = window.searchApi.search(query, this.currentLimit);
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('Search timed out after 8 seconds')), 8000);
			});

			const response = await Promise.race([searchPromise, timeoutPromise]);

			if (response?.error) {
				console.warn('Search API error:', response.error);
				if (!append) {
					this.results = [];
					this.lastError = response.error;
				}
			} else if (response && Array.isArray(response.results)) {
				if (append) {
					// Append new results, avoiding duplicates
					const existingIds = new Set(this.results.map(r => r.id));
					const newResults = response.results.filter(r => !existingIds.has(r.id));
					this.results = [...this.results, ...newResults];
				} else {
					this.results = response.results;
					this.currentLimit = 50; // Reset limit for new search
				}
			} else {
				console.warn('Invalid search response:', response);
				if (!append) {
					this.results = [];
					this.lastError = 'Invalid search response';
				}
			}

			this.isSearching = false;
			this.isLoadingMore = false;
			if (!append) {
				this.selectedIndex = 0;
			}
			this.renderResults();
		} catch (error) {
			console.error('Search error:', error);
			if (!append) {
				this.results = [];
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				this.lastError = errorMessage.includes('timeout') || errorMessage.includes('timed out')
					? 'Search timed out. Try a simpler query or check if QMD is running.'
					: errorMessage;
			}
			this.isSearching = false;
			this.isLoadingMore = false;
			this.renderResults();
		}
	}

	private renderResults(): void {
		if (!this.resultsContainer) return;
		
		// Save loadMoreRef before clearing
		const savedLoadMoreRef = this.loadMoreRef;
		clearChildren(this.resultsContainer);
		// Restore loadMoreRef
		this.loadMoreRef = savedLoadMoreRef;

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
			className: 'space-y-3 relative',
		});

		this.results.forEach((result, index) => {
			// Item wrapper matching Timeline style
			const messageWrapper = createElement('div', {
				className: 'relative flex items-start gap-3',
			});

			// Avatar/icon matching Timeline style
			const avatar = createElement('div', {
				className: 'avatar-pill flex-shrink-0',
			});
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
				className: 'search-result flex-1 cursor-pointer',
				attributes: {
					role: 'button',
					tabindex: '0',
					'aria-label': `Search result: ${result.title || result.id}`,
					'aria-selected': String(index === this.selectedIndex),
				},
			});
			bubble.dataset.index = String(index);
			bubble.dataset.selected = String(index === this.selectedIndex);

			// Source badge - matching Timeline style
			const sourceLabel = createElement('div', {
				className: 'search-result-meta',
			});
			const sourceName = createElement('span', {
				className: 'search-result-source',
			});
			sourceName.textContent = result.source;
			sourceLabel.appendChild(sourceName);
			bubble.appendChild(sourceLabel);

			// Title - matching Timeline content style
			const title = createElement('div', {
				className: 'search-result-title',
			});
			title.textContent = result.title || result.id;
			if (!result.snippet) {
				title.classList.add('no-snippet');
			}
			bubble.appendChild(title);

			// Snippet - matching Timeline style
			if (result.snippet) {
				const snippet = createElement('div', {
					className: 'search-result-snippet',
				});
				snippet.textContent = result.snippet;
				bubble.appendChild(snippet);
			}

			// Timestamp - matching Timeline style (right-aligned)
			if (result.timestamp) {
				const absoluteTime = createElement('div', {
					className: 'search-result-time',
				});
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
			resultsList.appendChild(messageWrapper);
		});

		this.resultsContainer.appendChild(resultsList);
		
		// Add load more trigger at the end for infinite scroll
		if (this.results.length > 0 && !this.isSearching && !this.lastError) {
			if (!this.loadMoreRef) {
				this.loadMoreRef = createElement('div', { className: 'h-8' });
			}
			// Remove from old parent if exists
			if (this.loadMoreRef.parentElement && this.loadMoreRef.parentElement !== this.resultsContainer) {
				this.loadMoreRef.parentElement.removeChild(this.loadMoreRef);
			}
			// Add to results container
			if (!this.resultsContainer.contains(this.loadMoreRef)) {
				this.resultsContainer.appendChild(this.loadMoreRef);
			}
			
			// Observe for infinite scroll
			if (this.observer && this.loadMoreRef) {
				this.observer.observe(this.loadMoreRef);
			}
		} else if (this.loadMoreRef && this.observer) {
			// Disconnect observer when no more results to load
			this.observer.unobserve(this.loadMoreRef);
		}
	}
	
	private setupInfiniteScroll(): void {
		// Create observer that will observe loadMoreRef when it's added
		this.observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting && !this.isLoadingMore && !this.isSearching && this.lastQuery && this.results.length > 0) {
				this.isLoadingMore = true;
				this.currentLimit += 50; // Load 50 more results
				this.search(this.lastQuery, true).finally(() => {
					this.isLoadingMore = false;
				});
			}
		}, { rootMargin: '400px' });
		
		this.registerCleanup(() => this.observer?.disconnect());
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
			this.syncStatus.textContent = `Syncing… ${elapsed}s`;
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
