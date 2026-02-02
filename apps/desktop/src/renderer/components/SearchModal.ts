/**
 * Search Modal Component
 * Full-screen search modal with instant results
 */

import { Component } from './Component';
import { createElement, clearChildren } from '../utils/dom';
import { store } from '../store';
import { router } from '../router';

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

// Singleton instance for global access
let modalInstance: SearchModal | null = null;

export class SearchModal extends Component {
	private overlay: HTMLElement | null = null;
	private modal: HTMLElement | null = null;
	private input: HTMLInputElement | null = null;
	private resultsContainer: HTMLElement | null = null;
	private syncButton: HTMLElement | null = null;
	private syncStatus: HTMLElement | null = null;
	private results: SearchResult[] = [];
	private selectedIndex: number = 0;
	private searchTimeout: ReturnType<typeof setTimeout> | null = null;
	private isOpen: boolean = false;
	private isSyncing: boolean = false;

	async init(): Promise<void> {
		this.render();
		this.setupKeyboardShortcuts();
		modalInstance = this;
	}

	render(): void {
		// Create overlay (hidden by default)
		this.overlay = createElement('div', {
			className: 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 hidden',
			id: 'search-modal-overlay',
		});

		// Create modal
		this.modal = createElement('div', {
			className: 'fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl z-50 hidden overflow-hidden',
			id: 'search-modal',
		});

		// Search input container
		const inputContainer = createElement('div', {
			className: 'flex items-center gap-3 px-4 py-3 border-b border-border',
		});

		// Search icon
		const searchIcon = createElement('svg', {
			className: 'w-5 h-5 text-muted-foreground shrink-0',
			innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
		});
		inputContainer.appendChild(searchIcon);

		// Input
		this.input = createElement('input', {
			className: 'flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base',
			attributes: {
				type: 'text',
				placeholder: 'Search everything...',
				spellcheck: 'false',
				autocomplete: 'off',
			},
		}) as HTMLInputElement;
		inputContainer.appendChild(this.input);

		// Escape hint
		const escHint = createElement('kbd', {
			className: 'hidden sm:inline-block px-2 py-1 text-xs font-mono bg-muted text-muted-foreground rounded',
			textContent: 'esc',
		});
		inputContainer.appendChild(escHint);

		this.modal.appendChild(inputContainer);

		// Results container
		this.resultsContainer = createElement('div', {
			className: 'max-h-[60vh] overflow-y-auto',
		});
		this.modal.appendChild(this.resultsContainer);

		// Footer
		const footer = createElement('div', {
			className: 'flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground',
		});

		// Left side - keyboard hints
		const hints = createElement('div', {
			className: 'flex items-center gap-4',
		});
		hints.innerHTML = `
			<span>↑↓ navigate</span>
			<span>↵ select</span>
			<span>esc close</span>
		`;
		footer.appendChild(hints);

		// Right side - sync button
		const syncContainer = createElement('div', {
			className: 'flex items-center gap-2',
		});

		this.syncStatus = createElement('span', {
			className: 'text-muted-foreground',
			textContent: '',
		});
		syncContainer.appendChild(this.syncStatus);

		this.syncButton = createElement('button', {
			className: 'flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/50 transition-colors cursor-pointer',
			attributes: {
				title: 'Sync search index',
			},
		});
		this.syncButton.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sync-icon">
				<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
				<path d="M3 3v5h5"/>
				<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
				<path d="M16 16h5v5"/>
			</svg>
			<span>Sync</span>
		`;
		this.addListener(this.syncButton, 'click', () => this.handleSync());
		syncContainer.appendChild(this.syncButton);

		footer.appendChild(syncContainer);
		this.modal.appendChild(footer);

		// Add to container
		this.container.appendChild(this.overlay);
		this.container.appendChild(this.modal);

		// Event listeners
		this.addListener(this.overlay, 'click', () => this.close());
		this.addListener(this.input, 'input', () => this.handleInput());
		this.addListener(this.input, 'keydown', (e) => this.handleKeydown(e as KeyboardEvent));
	}

	private setupKeyboardShortcuts(): void {
		// Global Cmd+K / Ctrl+K shortcut
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				this.toggle();
			}
			if (e.key === 'Escape' && this.isOpen) {
				this.close();
			}
		};
		document.addEventListener('keydown', handler);
		this.registerCleanup(() => document.removeEventListener('keydown', handler));
	}

	private handleInput(): void {
		const query = this.input?.value || '';

		// Debounce search
		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout);
		}

		if (!query.trim()) {
			this.results = [];
			this.renderResults();
			return;
		}

		this.searchTimeout = setTimeout(async () => {
			await this.search(query);
		}, 150);
	}

	private async search(query: string): Promise<void> {
		try {
			if (!window.searchApi) {
				console.error('Search API not available');
				this.results = [];
				this.renderResults();
				return;
			}
			
			const response = await window.searchApi.search(query, 20);
			
			if (response && Array.isArray(response.results)) {
				this.results = response.results;
			} else {
				console.warn('Invalid search response:', response);
				this.results = [];
			}
			
			this.selectedIndex = 0;
			this.renderResults();
		} catch (error) {
			console.error('Search error:', error);
			this.results = [];
			this.renderResults();
			
			// Show error message in results
			if (this.resultsContainer) {
				const errorMsg = createElement('div', {
					className: 'px-4 py-8 text-center',
				});
				const errorText = createElement('div', {
					className: 'text-red-400 text-sm mb-2',
					textContent: 'Search failed',
				});
				const errorDetail = createElement('div', {
					className: 'text-muted-foreground text-xs',
					textContent: error instanceof Error ? error.message : 'Unknown error',
				});
				errorMsg.appendChild(errorText);
				errorMsg.appendChild(errorDetail);
				this.resultsContainer.appendChild(errorMsg);
			}
		}
	}

	private renderResults(): void {
		if (!this.resultsContainer) return;
		clearChildren(this.resultsContainer);

		if (this.results.length === 0) {
			const empty = createElement('div', {
				className: 'px-4 py-8 text-center text-muted-foreground',
			});
			empty.innerHTML = this.input?.value
				? 'No results found'
				: 'Start typing to search...';
			this.resultsContainer.appendChild(empty);
			return;
		}

		this.results.forEach((result, index) => {
			const item = createElement('div', {
				className: `flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
					index === this.selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
				}`,
				dataset: { index: String(index) },
			});

			// Source badge
			const sourceColors: Record<string, string> = {
				farcaster: 'bg-purple-500/20 text-purple-400',
				teller: 'bg-green-500/20 text-green-400',
				obsidian: 'bg-blue-500/20 text-blue-400',
				chrome: 'bg-yellow-500/20 text-yellow-400',
				brave: 'bg-red-500/20 text-red-400',
				user: 'bg-cyan-500/20 text-cyan-400',
			};
			const sourceClass = sourceColors[result.source] || 'bg-gray-500/20 text-gray-400';

			const badge = createElement('span', {
				className: `shrink-0 px-2 py-0.5 text-xs font-medium rounded ${sourceClass}`,
				textContent: result.source,
			});
			item.appendChild(badge);

			// Content
			const content = createElement('div', {
				className: 'flex-1 min-w-0',
			});

			const title = createElement('div', {
				className: 'font-medium text-foreground truncate',
				textContent: result.title || result.id,
			});
			content.appendChild(title);

			if (result.snippet) {
				const snippet = createElement('div', {
					className: 'text-sm text-muted-foreground truncate mt-0.5',
					textContent: result.snippet.slice(0, 100),
				});
				content.appendChild(snippet);
			}

			item.appendChild(content);

			// Score
			const scorePercent = Math.round(result.score * 100);
			const scoreColor = scorePercent > 70 ? 'text-green-400' : scorePercent > 40 ? 'text-yellow-400' : 'text-muted-foreground';
			const score = createElement('span', {
				className: `shrink-0 text-xs ${scoreColor}`,
				textContent: `${scorePercent}%`,
			});
			item.appendChild(score);

			// Click handler
			this.addListener(item, 'click', () => this.selectResult(index));

			this.resultsContainer?.appendChild(item);
		});
	}

	private handleKeydown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
				this.renderResults();
				break;
			case 'ArrowUp':
				e.preventDefault();
				this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
				this.renderResults();
				break;
			case 'Enter':
				e.preventDefault();
				if (this.results[this.selectedIndex]) {
					this.selectResult(this.selectedIndex);
				}
				break;
		}
	}

	private selectResult(index: number): void {
		const result = this.results[index];
		if (!result) return;

		this.close();

		// Navigate based on source
		if (result.source === 'farcaster' || result.source === 'teller' || result.source === 'user') {
			// Go to timeline with this item highlighted
			router.navigate('/');
			// Store selected item for highlighting
			store.selectedItemId.set(result.id);
		} else if (result.source === 'obsidian') {
			// Could open in detail modal or navigate to obsidian
			router.navigate(`/apps/obsidian`);
		}
	}

	private async handleSync(): Promise<void> {
		if (this.isSyncing) return;

		this.isSyncing = true;
		this.updateSyncUI('syncing');

		try {
			const response = await window.searchApi.embedSync(false);

			if (response.success) {
				this.updateSyncUI('success', response.exportedCount);
				// Clear status after 3 seconds
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
				this.syncStatus.textContent = 'Syncing...';
				this.syncStatus.className = 'text-muted-foreground';
				break;
			case 'success':
				this.syncButton.classList.remove('opacity-50', 'pointer-events-none');
				if (icon) icon.classList.remove('animate-spin');
				this.syncStatus.textContent = count !== undefined ? `Synced ${count} items` : 'Synced!';
				this.syncStatus.className = 'text-green-400';
				break;
			case 'error':
				this.syncButton.classList.remove('opacity-50', 'pointer-events-none');
				if (icon) icon.classList.remove('animate-spin');
				this.syncStatus.textContent = error || 'Sync failed';
				this.syncStatus.className = 'text-red-400';
				break;
			case 'idle':
			default:
				this.syncButton.classList.remove('opacity-50', 'pointer-events-none');
				if (icon) icon.classList.remove('animate-spin');
				this.syncStatus.textContent = '';
				this.syncStatus.className = 'text-muted-foreground';
				break;
		}
	}

	open(): void {
		if (this.isOpen) return;
		this.isOpen = true;
		this.overlay?.classList.remove('hidden');
		this.modal?.classList.remove('hidden');
		this.input?.focus();
		this.input!.value = '';
		this.results = [];
		this.renderResults();
	}

	close(): void {
		if (!this.isOpen) return;
		this.isOpen = false;
		this.overlay?.classList.add('hidden');
		this.modal?.classList.add('hidden');
		this.input!.value = '';
		this.results = [];
	}

	toggle(): void {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	destroy(): void {
		modalInstance = null;
		super.destroy();
	}
}

// Export singleton getter
export function getSearchModal(): SearchModal | null {
	return modalInstance;
}

// Export function to open search modal from anywhere
export function openSearchModal(): void {
	modalInstance?.open();
}
