/**
 * Manage Connections Modal Component
 * Shows connected apps with management options
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { api, fetchAppsWithCache } from '../api';
import { createElement, clearChildren, formatDate, formatTime } from '../utils/dom';
import type { AppServer } from '../types';

export class ManageConnectionsModal extends Component {
  private editingAppId: string | null = null;

  constructor(container: HTMLElement, private onClose: () => void) {
    super(container);
  }

  async init(): Promise<void> {
    this.render();
    
    // Subscribe to apps changes
    this.subscribe(store.apps, () => this.renderConnectionsList());
  }

  render(): void {
    this.container.innerHTML = '';
    
    // Backdrop with blur
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 modal-backdrop-enter',
    });
    
    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });
    
    // Modal container
    const modal = createElement('div', {
      className: 'bg-card border border-border/60 w-full max-w-4xl max-h-[85vh] flex flex-col elevation-2 rounded-2xl modal-enter relative overflow-hidden',
    });
    
    // Header
    const header = createElement('div', {
      className: 'flex items-center justify-between p-5 border-b border-border/60',
    });
    
    const titleSection = createElement('div');
    const title = createElement('h2', {
      className: 'text-lg text-foreground',
      textContent: 'Manage Connections',
    });
    (title as HTMLElement).style.cssText = `
      font-family: var(--font-sans);
      font-weight: 600;
      letter-spacing: -0.01em;
    `;
    const subtitle = createElement('p', {
      className: 'text-sm text-muted-foreground mt-1',
      textContent: 'View and manage your connected apps',
    });
    (subtitle as HTMLElement).style.cssText = `
      font-family: var(--font-sans);
    `;
    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);
    header.appendChild(titleSection);
    
    // Close button
    const closeBtn = createElement('button', {
      className: 'p-2 hover:bg-secondary/70 rounded-lg transition-all text-muted-foreground hover:text-foreground',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
      attributes: { 'aria-label': 'Close' }
    });
    this.addListener(closeBtn, 'click', () => {
      this.cleanup();
      this.onClose();
    });
    header.appendChild(closeBtn);
    
    modal.appendChild(header);
    
    // Content area (scrollable)
    const content = createElement('div', {
      className: 'flex-1 overflow-y-auto p-5',
    });
    
    // Connections list container
    const listContainer = createElement('div', {
      className: 'space-y-3',
      attributes: { id: 'manage-connections-list' },
    });
    
    content.appendChild(listContainer);
    modal.appendChild(content);
    
    backdrop.appendChild(modal);
    this.container.appendChild(backdrop);
    
    // Initial render
    this.renderConnectionsList();
    
    // ESC key to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.editingAppId) {
          // Cancel editing if in edit mode
          this.editingAppId = null;
          this.renderConnectionsList();
        } else {
          this.cleanup();
          this.onClose();
        }
      }
    };
    window.addEventListener('keydown', escHandler);
    this.registerCleanup(() => window.removeEventListener('keydown', escHandler));
  }
  
  private renderConnectionsList(): void {
    const listContainer = this.container.querySelector('#manage-connections-list') as HTMLElement;
    if (!listContainer) return;
    
    const apps = store.apps.get();
    
    // Filter to show only connected apps
    const connectedApps = apps.filter(app => app.connection?.status === 'connected');
    
    clearChildren(listContainer);
    
    if (connectedApps.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-12 px-6">
          <div class="w-14 h-14 mx-auto bg-secondary rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground">
              <path d="M5 12h14"/>
              <path d="M12 5v14"/>
            </svg>
          </div>
          <p class="text-sm text-muted-foreground">No connected apps yet</p>
        </div>
      `;
      return;
    }
    
    for (const app of connectedApps) {
      const item = this.createConnectionItem(app);
      listContainer.appendChild(item);
    }
  }
  
  private createConnectionItem(app: AppServer): HTMLElement {
    const isEditing = this.editingAppId === app.id;
    
    const item = createElement('div', {
      className: 'card-modern border border-border/70 bg-card rounded-xl overflow-hidden transition-all',
      dataset: { appId: app.id },
    });
    
    // Main content row
    const mainRow = createElement('div', {
      className: 'flex items-center gap-4 p-3.5 hover:bg-secondary/60 transition-colors',
    });
    
    // Icon
    if (app.iconUrl) {
      const icon = createElement('img', {
        className: 'w-10 h-10 object-contain shrink-0',
        attributes: {
          src: app.iconUrl,
          alt: app.name,
          loading: 'lazy',
        },
      });
      item.appendChild(icon);
    } else {
      const placeholder = createElement('div', {
        className: 'w-10 h-10 bg-muted shrink-0 flex items-center justify-center text-muted-foreground rounded-lg',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
      });
      mainRow.appendChild(placeholder);
    }
    
    // Info section
    const infoSection = createElement('div', {
      className: 'flex-1 min-w-0',
    });
    
    const name = createElement('p', {
      className: 'text-sm font-semibold tracking-tight',
      textContent: app.name,
    });
    (name as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
    infoSection.appendChild(name);
    
    // Connection details row
    const detailsRow = createElement('div', {
      className: 'flex items-center gap-4 mt-2 flex-wrap',
    });
    
    // Status
    const statusRow = createElement('div', {
      className: 'flex items-center gap-2',
    });
    const statusDot = createElement('div', {
      className: 'w-2 h-2 rounded-full bg-status-connected',
    });
    statusRow.appendChild(statusDot);
    const statusText = createElement('span', {
      className: 'text-xs text-muted-foreground',
      textContent: 'Connected',
    });
    (statusText as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
    statusRow.appendChild(statusText);
    detailsRow.appendChild(statusRow);
    
    // Connection type
    if (app.connectionType) {
      const typeBadge = createElement('span', {
        className: 'px-2 py-0.5 bg-secondary text-xs text-muted-foreground font-semibold uppercase tracking-wider rounded border border-border/60',
        textContent: app.connectionType,
      });
      (typeBadge as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
      detailsRow.appendChild(typeBadge);
    }
    
    // Last synced (if available in metadata)
    const lastSyncedAt = app.connection?.connectionMetadata?.lastSyncedAt;
    if (lastSyncedAt && typeof lastSyncedAt === 'string') {
      const lastSynced = new Date(lastSyncedAt);
      const lastSyncedText = createElement('span', {
        className: 'text-xs text-muted-foreground',
        textContent: `Last synced: ${formatDate(lastSynced)} ${formatTime(lastSynced)}`,
      });
      (lastSyncedText as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
      detailsRow.appendChild(lastSyncedText);
    }
    
    infoSection.appendChild(detailsRow);
    
    // Show metadata if available
    if (app.connection?.connectionMetadata) {
      const metadata = app.connection.connectionMetadata;
      if (metadata.localPath || metadata.fid) {
        const metadataRow = createElement('div', {
          className: 'mt-2 text-xs text-muted-foreground',
        });
        (metadataRow as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
        if (metadata.localPath) {
          metadataRow.textContent = `Path: ${metadata.localPath}`;
        } else if (metadata.fid) {
          metadataRow.textContent = `FID: ${metadata.fid}`;
        }
        infoSection.appendChild(metadataRow);
      }
    }
    
    mainRow.appendChild(infoSection);
    
    // Actions section
    const actionsSection = createElement('div', {
      className: 'flex items-center gap-2 shrink-0',
    });
    
    // Edit button
    const editButton = createElement('button', {
      className: `px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border hover:bg-secondary/70 transition-colors rounded ${
        isEditing ? 'bg-primary text-primary-foreground border-primary' : ''
      }`,
      textContent: isEditing ? 'Cancel' : 'Edit',
    });
    (editButton as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
    
    this.addListener(editButton, 'click', (e) => {
      e.stopPropagation();
      if (isEditing) {
        this.editingAppId = null;
      } else {
        this.editingAppId = app.id;
      }
      this.renderConnectionsList();
    });
    
    actionsSection.appendChild(editButton);
    
    // View Details button (only show when not editing)
    if (!isEditing) {
      const viewButton = createElement('button', {
        className: 'px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border hover:bg-secondary/70 transition-colors rounded',
        textContent: 'View Details',
      });
      (viewButton as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
      
      this.addListener(viewButton, 'click', (e) => {
        e.stopPropagation();
        this.cleanup();
        this.onClose();
        router.navigate(`/apps/${app.id}`);
      });
      
      actionsSection.appendChild(viewButton);
      
      // Disconnect button
      const disconnectButton = createElement('button', {
        className: 'px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors rounded',
        textContent: 'Disconnect',
        dataset: { connectionId: app.connection?.id || '' },
      });
      (disconnectButton as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
      
      this.addListener(disconnectButton, 'click', async (e) => {
        e.stopPropagation();
        await this.handleDisconnect(app);
      });
      
      actionsSection.appendChild(disconnectButton);
    }
    
    mainRow.appendChild(actionsSection);
    item.appendChild(mainRow);
    
    // Edit form (expandable)
    if (isEditing) {
      const editForm = this.createEditForm(app);
      item.appendChild(editForm);
    }
    
    return item;
  }
  
  private createEditForm(app: AppServer): HTMLElement {
    const form = createElement('div', {
      className: 'border-t border-border/60 bg-secondary/40 p-4 space-y-4',
    });
    
    const formTitle = createElement('h3', {
      className: 'text-xs font-semibold uppercase tracking-wider mb-3',
      textContent: 'Edit Connection Settings',
    });
    (formTitle as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.1em;';
    form.appendChild(formTitle);
    
    // API Key field (for Farcaster and other API-based apps)
    if (app.connectionType === 'api' && app.id === 'farcaster') {
      const apiKeyGroup = createElement('div', {
        className: 'space-y-2',
      });
      
      const apiKeyLabel = createElement('label', {
        className: 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground',
        textContent: 'Neynar API Key',
      });
      (apiKeyLabel as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
      apiKeyGroup.appendChild(apiKeyLabel);
      
      const apiKeyWrapper = createElement('div', {
        className: 'relative',
      });
      
      const apiKeyInput = createElement('input', {
        className: 'w-full px-3 py-2 pr-10 bg-card border border-border text-sm',
        attributes: {
          type: 'password',
          placeholder: 'Enter your Neynar API key',
          'data-api-key-input': 'true',
        },
      });
      (apiKeyInput as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
      apiKeyWrapper.appendChild(apiKeyInput);
      
      // Toggle visibility button
      const toggleBtn = createElement('button', {
        className: 'absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary/70 transition-colors rounded',
        attributes: { type: 'button', 'aria-label': 'Toggle API key visibility' },
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
      });
      
      this.addListener(toggleBtn, 'click', () => {
        const input = apiKeyInput as HTMLInputElement;
        input.type = input.type === 'password' ? 'text' : 'password';
      });
      
      apiKeyWrapper.appendChild(toggleBtn);
      apiKeyGroup.appendChild(apiKeyLabel);
      apiKeyGroup.appendChild(apiKeyWrapper);
      form.appendChild(apiKeyGroup);
      
      // FID field
      const fidGroup = createElement('div', {
        className: 'space-y-2',
      });
      
      const fidLabel = createElement('label', {
        className: 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground',
        textContent: 'Farcaster ID (FID)',
      });
      (fidLabel as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
      fidGroup.appendChild(fidLabel);
      
      const fidInput = createElement('input', {
        className: 'w-full px-3 py-2 bg-card border border-border text-sm',
        attributes: {
          type: 'number',
          placeholder: 'Enter your Farcaster ID',
          'data-fid-input': 'true',
          value: (app.connection?.connectionMetadata?.fid as string) || '',
        },
      });
      (fidInput as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
      fidGroup.appendChild(fidLabel);
      fidGroup.appendChild(fidInput);
      form.appendChild(fidGroup);
    }
    
    // Local path field (for Obsidian, Chrome, Brave)
    if (app.connection?.connectionMetadata?.localPath) {
      const pathGroup = createElement('div', {
        className: 'space-y-2',
      });
      
      const pathLabel = createElement('label', {
        className: 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground',
        textContent: 'Local Path',
      });
      (pathLabel as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
      pathGroup.appendChild(pathLabel);
      
      const pathInput = createElement('input', {
        className: 'w-full px-3 py-2 bg-card border border-border text-sm',
        attributes: {
          type: 'text',
          readonly: 'true',
          value: app.connection.connectionMetadata.localPath as string,
        },
      });
      (pathInput as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
      pathGroup.appendChild(pathInput);
      
      const pathNote = createElement('p', {
        className: 'text-xs text-muted-foreground',
        textContent: 'To change the path, disconnect and reconnect this app.',
      });
      (pathNote as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
      pathGroup.appendChild(pathNote);
      form.appendChild(pathGroup);
    }
    
    // Action buttons
    const buttonRow = createElement('div', {
      className: 'flex items-center gap-2 pt-2',
    });
    
    const saveButton = createElement('button', {
      className: 'px-4 py-2 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-xs rounded transition-colors hover:bg-primary/90',
      textContent: 'Save Changes',
    });
    (saveButton as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
    
    this.addListener(saveButton, 'click', async () => {
      await this.handleSave(app, form);
    });
    
    buttonRow.appendChild(saveButton);
    form.appendChild(buttonRow);
    
    return form;
  }
  
  private async handleSave(app: AppServer, form: HTMLElement): Promise<void> {
    try {
      // Get form values
      const apiKeyInput = form.querySelector('[data-api-key-input]') as HTMLInputElement;
      const fidInput = form.querySelector('[data-fid-input]') as HTMLInputElement;
      
      // For Farcaster, update API key and FID
      if (app.id === 'farcaster' && apiKeyInput && fidInput) {
        const apiKey = apiKeyInput.value.trim();
        const fid = fidInput.value.trim();
        
        if (!apiKey) {
          alert('Please enter your Neynar API key');
          return;
        }
        
        if (!fid) {
          alert('Please enter your Farcaster ID (FID)');
          return;
        }
        
        const fidNumber = parseInt(fid, 10);
        if (isNaN(fidNumber) || fidNumber <= 0) {
          alert('Farcaster ID must be a valid positive number');
          return;
        }
        
        // Show loading state
        const saveButton = form.querySelector('button') as HTMLButtonElement;
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = 'Saving...';
        }
        
        // Save API key and FID
        await api.apps.saveApiKey.mutate({
          appId: app.id,
          apiKey: apiKey,
          connectionMetadata: {
            fid: fidNumber.toString(),
          },
        });
        
        // Refresh apps
        await fetchAppsWithCache();
        
        // Exit edit mode
        this.editingAppId = null;
        this.renderConnectionsList();
      } else {
        // No changes to save
        this.editingAppId = null;
        this.renderConnectionsList();
      }
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async handleDisconnect(app: AppServer): Promise<void> {
    if (!app.connection?.id) return;
    
    // Confirm disconnect
    const confirmed = confirm(`Are you sure you want to disconnect ${app.name}? This will stop syncing data from this app.`);
    if (!confirmed) return;
    
    try {
      // Find the disconnect button to show loading state
      const disconnectButton = this.container.querySelector(`[data-connection-id="${app.connection.id}"]`) as HTMLButtonElement;
      if (disconnectButton) {
        disconnectButton.disabled = true;
        disconnectButton.textContent = 'Disconnecting...';
      }
      
      // Remove the connection
      await api.apps.removeConnection.mutate({
        id: app.connection.id,
      });
      
      // Refresh apps to get updated connection status
      await fetchAppsWithCache();
      
      // Re-render list (will automatically update via subscription)
    } catch (error) {
      console.error('Failed to disconnect app:', error);
      alert(`Failed to disconnect ${app.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Re-render to restore button state
      this.renderConnectionsList();
    }
  }
  
  private cleanup(): void {
    this.editingAppId = null;
  }
}

export default ManageConnectionsModal;

