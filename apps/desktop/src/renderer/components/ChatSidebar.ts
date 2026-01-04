/**
 * ChatSidebar Component
 * Right-side chat sidebar for AI conversations with multi-provider support
 */

import { Component } from './Component';
import { createElement, clearChildren, escapeHtml } from '../utils/dom';
import { api } from '../api';
import { 
  hasApiKeyForProvider, 
  decryptApiKeyForProvider,
  encryptApiKeyForProvider,
  clearApiKeyForProvider 
} from '../utils/crypto';
import { store } from '../store';
import { parseMarkdown, setupMarkdownInteractivity } from '../utils/markdown';
import { 
  type Provider, 
  getProviderIds,
  getProviderConfig,
  validateApiKey 
} from '../utils/providers';
import { getChatStateManager, type ChatStateManager } from '../utils/chat-state';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface ChatSession {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatSidebar extends Component {
  private messagesContainer: HTMLElement | null = null;
  private inputElement: HTMLTextAreaElement | null = null;
  private messages: ChatMessage[] = [];
  private sessionId: string | null = null;
  private isLoading = false;
  private apiKeyMissing = false;
  private sessions: ChatSession[] = [];
  private historyDropdownOpen = false;
  private settingsModal: HTMLElement | null = null;
  
  // Multi-provider state
  private stateManager!: ChatStateManager;
  private currentProvider: Provider = 'openrouter';
  
  async init(): Promise<void> {
    this.stateManager = getChatStateManager();
    this.currentProvider = this.stateManager.getProvider();
    this.apiKeyMissing = !hasApiKeyForProvider(this.currentProvider);
    await this.loadSessions();
    this.render();
  }

  private async loadSessions(): Promise<void> {
    try {
      const result = await api.chat.getSessions.query({ limit: 20 });
      this.sessions = result.sessions.map((s: { id: string; title: string | null; createdAt: string | Date; updatedAt: string | Date }) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));
    } catch (error) {
      console.error('[ChatSidebar] Failed to load sessions:', error);
    }
  }
  
  render(): void {
    this.container.innerHTML = '';
    
    // Sidebar container
    const panel = createElement('div', {
      className: 'flex flex-col h-full bg-card border-l border-border/50 shadow-2xl animate-in slide-in-from-right duration-300 w-full',
    });
    
    // Header with history dropdown
    const header = createElement('div', {
      className: 'flex flex-col border-b border-border/50 shrink-0 bg-background/95 backdrop-blur-xl sticky top-0 z-30',
    });

    const topRow = createElement('div', {
      className: 'flex items-center justify-between px-4 py-3.5',
    });

    // History dropdown button
    const historyButton = createElement('button', {
      className: 'flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/60 transition-all duration-200 flex-1 text-left group/history',
    });
    historyButton.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 group-hover/history:scale-105 transition-transform duration-200 shadow-lg shadow-primary/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="flex flex-col flex-1 min-w-0">
        <span class="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70 font-bold leading-none mb-0.5">Chat Session</span>
        <span class="font-semibold text-sm truncate text-foreground/90">${this.sessionId ? 'Current Chat' : 'New Chat'}</span>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted-foreground/50 transition-transform duration-300 ${this.historyDropdownOpen ? 'rotate-180' : ''}">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    `;
    this.addListener(historyButton, 'click', () => {
      this.historyDropdownOpen = !this.historyDropdownOpen;
      this.render();
    });
    topRow.appendChild(historyButton);

    const closeButton = createElement('button', {
      className: 'ml-1 p-2.5 hover:bg-secondary/80 rounded-xl transition-all duration-200 group/close active:scale-95',
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/60 group-hover/close:text-foreground transition-colors">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
          <line x1="15" x2="15" y1="3" y2="21"/>
          <path d="m11 9-3 3 3 3" class="opacity-0 group-hover/close:opacity-100 transition-opacity" />
        </svg>
      `,
    });
    this.addListener(closeButton, 'click', () => store.chatSidebarOpen.set(false));
    topRow.appendChild(closeButton);

    header.appendChild(topRow);

    // Provider/Model controls row
    const controlsRow = this.createProviderControls();
    header.appendChild(controlsRow);

    // History dropdown
    if (this.historyDropdownOpen) {
      const dropdown = this.createHistoryDropdown();
      header.appendChild(dropdown);
    }

    panel.appendChild(header);
    
    // Messages container
    this.messagesContainer = createElement('div', {
      className: 'flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide',
    });
    
    if (this.apiKeyMissing) {
      this.renderApiKeyMissingState();
    } else if (this.messages.length === 0) {
      this.renderWelcomeState();
    }
    
    panel.appendChild(this.messagesContainer);
    
    // Input area
    if (!this.apiKeyMissing) {
      const inputArea = createElement('div', {
        className: 'p-4 border-t border-border/50 shrink-0 bg-background/80 backdrop-blur-sm',
      });
      
      const inputWrapper = createElement('div', {
        className: 'flex items-end gap-2 bg-secondary/50 border border-border/50 rounded-2xl px-4 py-3 focus-within:bg-secondary/70 focus-within:border-primary/30 transition-all shadow-sm',
      });
      
      this.inputElement = createElement('textarea', {
        className: 'flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm resize-none min-h-[20px] max-h-32 py-1',
        attributes: {
          placeholder: 'Ask anything...',
          rows: '1',
        },
      }) as HTMLTextAreaElement;
      
      // Auto-resize
      this.addListener(this.inputElement, 'input', () => {
        if (this.inputElement) {
          this.inputElement.style.height = 'auto';
          this.inputElement.style.height = Math.min(this.inputElement.scrollHeight, 128) + 'px';
        }
      });
      
      this.addListener(this.inputElement, 'keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.altKey && !e.shiftKey && !this.isLoading) {
          e.preventDefault();
          const value = this.inputElement!.value.trim();
          if (value) {
            this.sendMessage(value);
            this.inputElement!.value = '';
            this.inputElement!.style.height = 'auto';
          }
        }
      });
      
      inputWrapper.appendChild(this.inputElement);
      
      const sendButton = createElement('button', {
        className: 'p-2.5 bg-gradient-to-br from-primary to-primary/80 text-white rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0',
        innerHTML: `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        `,
      });
      this.addListener(sendButton, 'click', () => {
        if (!this.isLoading) {
          const value = this.inputElement!.value.trim();
          if (value) {
            this.sendMessage(value);
            this.inputElement!.value = '';
            this.inputElement!.style.height = 'auto';
          }
        }
      });
      inputWrapper.appendChild(sendButton);
      
      inputArea.appendChild(inputWrapper);
      panel.appendChild(inputArea);
    }
    
    this.container.appendChild(panel);
    
    if (!this.apiKeyMissing) {
      setTimeout(() => this.inputElement?.focus(), 100);
    }
  }

  private createProviderControls(): HTMLElement {
    const controlsRow = createElement('div', {
      className: 'flex items-center gap-2 px-4 py-2 bg-secondary/20 border-t border-border/20',
    });

    // Provider selector
    const providerWrapper = createElement('div', {
      className: 'flex items-center gap-2 px-2.5 py-1 bg-background/50 rounded-lg border border-border/30 hover:border-primary/20 transition-all duration-200 group/provider',
    });

    const providerLabel = createElement('span', {
      className: 'text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60 font-bold hidden sm:block',
      textContent: 'AI',
    });
    providerWrapper.appendChild(providerLabel);

    const providerSelect = createElement('select', {
      className: 'bg-transparent text-[11px] font-medium focus:outline-none cursor-pointer text-foreground pr-1',
    }) as HTMLSelectElement;

    // Populate with providers
    getProviderIds().forEach(providerId => {
      const config = getProviderConfig(providerId);
      const option = createElement('option', {
        attributes: { value: providerId },
        textContent: config.displayName,
      }) as HTMLOptionElement;
      if (providerId === this.currentProvider) {
        option.selected = true;
      }
      providerSelect.appendChild(option);
    });

    this.addListener(providerSelect, 'change', () => {
      this.onProviderChange(providerSelect.value as Provider);
    });
    providerWrapper.appendChild(providerSelect);
    controlsRow.appendChild(providerWrapper);

    // Separator
    const separator = createElement('div', {
      className: 'w-px h-4 bg-border/50',
    });
    controlsRow.appendChild(separator);

    // Model selector
    const modelWrapper = createElement('div', {
      className: 'flex-1 flex items-center gap-1.5 px-2 py-1 bg-secondary/30 rounded-lg border border-border/40 hover:border-border transition-colors min-w-0',
    });

    const modelLabel = createElement('span', {
      className: 'text-[9px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:block shrink-0',
      textContent: 'Model',
    });
    modelWrapper.appendChild(modelLabel);

    const modelSelect = createElement('select', {
      className: 'flex-1 bg-transparent text-[11px] font-medium focus:outline-none cursor-pointer text-foreground min-w-0 truncate',
    }) as HTMLSelectElement;

    // Populate with models for current provider
    const providerConfig = getProviderConfig(this.currentProvider);
    const currentModel = this.stateManager.getModel(this.currentProvider);
    
    providerConfig.models.forEach(model => {
      const option = createElement('option', {
        attributes: { value: model.id },
        textContent: model.name,
      }) as HTMLOptionElement;
      if (model.id === currentModel) {
        option.selected = true;
      }
      modelSelect.appendChild(option);
    });

    this.addListener(modelSelect, 'change', () => {
      this.onModelChange(modelSelect.value);
    });
    modelWrapper.appendChild(modelSelect);
    controlsRow.appendChild(modelWrapper);

    // Settings button
    const settingsBtn = createElement('button', {
      className: 'p-1.5 hover:bg-secondary/80 rounded-lg text-muted-foreground/60 hover:text-foreground transition-all duration-200 active:scale-90',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
      attributes: { title: 'AI Settings' }
    });
    this.addListener(settingsBtn, 'click', () => this.showSettingsModal());
    controlsRow.appendChild(settingsBtn);

    return controlsRow;
  }

  private onProviderChange(newProvider: Provider): void {
    this.currentProvider = newProvider;
    this.stateManager.setProvider(newProvider);
    this.apiKeyMissing = !hasApiKeyForProvider(newProvider);
    this.render();
  }

  private onModelChange(model: string): void {
    this.stateManager.setModel(this.currentProvider, model);
  }
  
  private renderApiKeyMissingState(): void {
    if (!this.messagesContainer) return;
    
    const providerConfig = getProviderConfig(this.currentProvider);
    
    this.messagesContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center px-4">
        <div class="w-16 h-16 rounded-2xl bg-linear-to-br from-amber-500/10 to-amber-600/10 flex items-center justify-center mb-4 relative">
          <div class="absolute inset-0 rounded-2xl bg-amber-500/20 blur-xl animate-pulse"></div>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-amber-500 relative z-10">
            <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>
        <h3 class="font-semibold mb-2">${providerConfig.displayName} API Key Required</h3>
        <p class="text-muted-foreground text-xs mb-6">
          ${providerConfig.keyHint}
        </p>
        <button id="go-to-chat-btn" class="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          Configure Key
        </button>
      </div>
    `;
    
    const goToChatBtn = this.messagesContainer.querySelector('#go-to-chat-btn') as HTMLElement | null;
    if (goToChatBtn) {
      this.addListener(goToChatBtn, 'click', () => {
        this.showSettingsModal();
      });
    }
  }

  private showSettingsModal(): void {
    // Remove existing modal if any
    this.settingsModal?.remove();

    // Create modal backdrop
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/60 backdrop-blur-2xl flex items-center justify-center z-[10000] p-6 animate-in fade-in duration-300',
    });

    // Modal container
    const modal = createElement('div', {
      className: 'glass-panel bg-card border border-border/50 rounded-[2rem] p-8 w-full max-w-lg space-y-6 shadow-2xl modal-enter relative overflow-hidden',
    });

    // Close button
    const closeBtn = createElement('button', {
      className: 'absolute top-6 right-6 p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    });
    this.addListener(closeBtn, 'click', () => {
      backdrop.remove();
      this.settingsModal = null;
    });
    modal.appendChild(closeBtn);

    // Title
    const titleSection = createElement('div', { className: 'space-y-1' });
    const title = createElement('h3', {
      className: 'text-xl font-bold text-foreground',
      textContent: 'AI Settings',
    });
    const subtitle = createElement('p', {
      className: 'text-xs text-muted-foreground font-medium uppercase tracking-wider',
      textContent: 'Manage Providers & API Keys',
    });
    titleSection.appendChild(subtitle);
    titleSection.appendChild(title);
    modal.appendChild(titleSection);

    // Provider Tabs
    const tabContainer = createElement('div', {
      className: 'flex gap-1 bg-secondary/30 p-1 rounded-xl border border-border/30',
    });

    const providers = getProviderIds();
    let activeTab: Provider = this.currentProvider;

    const tabContent = createElement('div', {
      className: 'pt-2',
    });

    const renderTabContent = () => {
      clearChildren(tabContent);
      const config = getProviderConfig(activeTab);
      const hasKey = hasApiKeyForProvider(activeTab);
      
      // API Key section
      const keySection = createElement('div', { className: 'space-y-3' });

      const keyLabel = createElement('label', {
        className: 'block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1',
        textContent: `${config.displayName} API Key`,
      });
      keySection.appendChild(keyLabel);

      const inputWrapper = createElement('div', { className: 'relative' });
      const keyInput = createElement('input', {
        className: 'w-full px-4 py-3 bg-secondary/20 border border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all',
        attributes: {
          type: 'password',
          placeholder: hasKey ? '••••••••••••••••' : (config.keyPrefix ? `${config.keyPrefix}...` : 'Enter API key...'),
          autocomplete: 'off',
        },
      }) as HTMLInputElement;
      inputWrapper.appendChild(keyInput);
      keySection.appendChild(inputWrapper);

      const hintRow = createElement('div', { className: 'flex justify-between items-start gap-4' });
      const keyHint = createElement('p', {
        className: 'text-[11px] text-muted-foreground/70 leading-relaxed flex-1',
        textContent: config.keyHint,
      });
      hintRow.appendChild(keyHint);

      if (hasKey) {
        const clearBtn = createElement('button', {
          className: 'text-[10px] font-bold text-destructive/70 hover:text-destructive uppercase tracking-wider transition-colors shrink-0',
          textContent: 'Clear Key',
        });
        clearBtn.addEventListener('click', () => {
          if (confirm(`Are you sure you want to clear the ${config.displayName} API key?`)) {
            clearApiKeyForProvider(activeTab);
            if (activeTab === this.currentProvider) {
              this.apiKeyMissing = true;
            }
            renderTabContent();
          }
        });
        hintRow.appendChild(clearBtn);
      }
      keySection.appendChild(hintRow);

      const validationMsg = createElement('p', {
        className: 'text-xs text-status-error font-medium hidden',
      });
      keySection.appendChild(validationMsg);

      tabContent.appendChild(keySection);

      // Model section
      const modelSection = createElement('div', { className: 'space-y-3 mt-6' });
      const modelLabel = createElement('label', {
        className: 'block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]',
        textContent: 'Default Model',
      });
      modelSection.appendChild(modelLabel);

      const modelSelect = createElement('select', {
        className: 'w-full px-4 py-3 bg-secondary/20 border border-border/50 rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all cursor-pointer appearance-none',
      }) as HTMLSelectElement;

      const currentModel = this.stateManager.getModel(activeTab);
      config.models.forEach(model => {
        const option = createElement('option', {
          attributes: { value: model.id },
          textContent: model.name,
        }) as HTMLOptionElement;
        if (model.id === currentModel) option.selected = true;
        modelSelect.appendChild(option);
      });
      modelSection.appendChild(modelSelect);
      tabContent.appendChild(modelSection);

      // Save button
      const saveBtn = createElement('button', {
        className: 'w-full mt-8 py-3.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50',
        textContent: hasKey ? 'Update Configuration' : 'Save Connection',
      });

      saveBtn.addEventListener('click', async () => {
        const newKey = keyInput.value.trim();
        
        // If updating model but not key
        if (!newKey && hasKey) {
          this.stateManager.setModel(activeTab, modelSelect.value);
          backdrop.remove();
          this.settingsModal = null;
          this.render();
          return;
        }

        if (!newKey) {
          validationMsg.textContent = 'Please enter an API key';
          validationMsg.classList.remove('hidden');
          return;
        }

        // Validate
        const validation = validateApiKey(newKey, activeTab);
        if (!validation.valid) {
          validationMsg.textContent = validation.error || 'Invalid API key format';
          validationMsg.classList.remove('hidden');
          return;
        }

        validationMsg.classList.add('hidden');
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
          await encryptApiKeyForProvider(newKey, activeTab);
          this.stateManager.setModel(activeTab, modelSelect.value);
          
          if (activeTab === this.currentProvider) {
            this.apiKeyMissing = false;
          }
          
          backdrop.remove();
          this.settingsModal = null;
          this.render();
        } catch (error) {
          console.error('Failed to save API key:', error);
          validationMsg.textContent = 'Failed to encrypt and save key';
          validationMsg.classList.remove('hidden');
          saveBtn.textContent = hasKey ? 'Update Configuration' : 'Save Connection';
          saveBtn.disabled = false;
        }
      });
      tabContent.appendChild(saveBtn);
    };

    // Create tabs
    providers.forEach(providerId => {
      const config = getProviderConfig(providerId);
      const tab = createElement('button', {
        className: `flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
          activeTab === providerId
            ? 'bg-background text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`,
        textContent: config.name,
      });

      tab.addEventListener('click', () => {
        activeTab = providerId;
        tabContainer.querySelectorAll('button').forEach((btn, idx) => {
          const isActive = providers[idx] === activeTab;
          btn.className = `flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
            isActive ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`;
        });
        renderTabContent();
      });
      tabContainer.appendChild(tab);
    });

    modal.appendChild(tabContainer);
    modal.appendChild(tabContent);

    renderTabContent();

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
        this.settingsModal = null;
      }
    });

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this.settingsModal = backdrop;
  }
  
  private renderWelcomeState(): void {
    if (!this.messagesContainer) return;
    
    this.messagesContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center px-4">
        <div class="w-16 h-16 rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 shadow-lg shadow-primary/5">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-primary">
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
          </svg>
        </div>
        <h3 class="font-semibold mb-2">Ask anything</h3>
        <p class="text-muted-foreground text-xs">
          Explore your data or get summaries using AI.
        </p>
        <div class="grid grid-cols-1 gap-2 mt-8 w-full">
          <button class="suggestion-btn px-4 py-2 bg-secondary/50 border border-border/40 rounded-xl text-xs hover:bg-secondary transition-colors text-left">
            What did I do yesterday?
          </button>
          <button class="suggestion-btn px-4 py-2 bg-secondary/50 border border-border/40 rounded-xl text-xs hover:bg-secondary transition-colors text-left">
            Summarize my activity
          </button>
        </div>
      </div>
    `;
    
    const suggestionBtns = this.messagesContainer.querySelectorAll('.suggestion-btn');
    suggestionBtns.forEach(btn => {
      this.addListener(btn as HTMLElement, 'click', () => {
        const text = btn.textContent?.trim();
        if (text) this.sendMessage(text);
      });
    });
  }
  
  private async sendMessage(content: string): Promise<void> {
    if (this.isLoading) return;
    
    if (!hasApiKeyForProvider(this.currentProvider)) {
      this.apiKeyMissing = true;
      this.render();
      return;
    }
    
    this.isLoading = true;
    
    if (!this.sessionId) {
      try {
        const result = await api.chat.createSession.mutate({});
        if (result.success) this.sessionId = result.session.id;
      } catch (error) {
        console.error('Session error:', error);
        this.isLoading = false;
        return;
      }
    }
    
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    this.messages.push(userMessage);
    this.renderMessages();
    
    try {
      await api.chat.addMessage.mutate({
        sessionId: this.sessionId!,
        role: 'user',
        content,
      });
    } catch {
      // Ignore
    }
    
    this.renderLoadingMessage();
    
    try {
      const response = await this.getAIResponse();
      
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: response,
        createdAt: new Date(),
      };
      this.messages.push(assistantMessage);
      
      await api.chat.addMessage.mutate({
        sessionId: this.sessionId!,
        role: 'assistant',
        content: response,
      });
      
      this.renderMessages();
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === 'NO_API_KEY') {
          this.apiKeyMissing = true;
          this.messages.pop();
          this.render();
          return;
        }

        // Provider-specific error handling
        const providerName = getProviderConfig(this.currentProvider).displayName;
        
        if (error.message.includes('401') || error.message.includes('Invalid API key')) {
          this.showErrorMessage(`${providerName} API key is invalid. Update in settings.`);
          return;
        }

        if (error.message.includes('429')) {
          this.showErrorMessage('Rate limit reached. Try again later.');
          return;
        }
      }
      
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'Error processing request.',
        createdAt: new Date(),
      };
      this.messages.push(errorMessage);
      this.renderMessages();
    }
    
    this.isLoading = false;
  }

  private showErrorMessage(text: string): void {
    const errorMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: text,
      createdAt: new Date(),
    };
    this.messages.push(errorMessage);
    this.renderMessages();
  }
  
  private async getAIResponse(): Promise<string> {
    const apiKey = await decryptApiKeyForProvider(this.currentProvider);
    if (!apiKey) throw new Error('NO_API_KEY');
    
    try {
      const serverPort = await this.getServerPort();
      const endpoint = this.stateManager.getEndpoint(this.currentProvider, serverPort);
      const model = this.stateManager.getModel(this.currentProvider);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}` 
        },
        body: JSON.stringify({
          messages: this.messages.map(m => ({ role: m.role, content: m.content })),
          model,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const providerName = getProviderConfig(this.currentProvider).displayName;
        throw new Error(`${providerName} error: ${response.status} - ${errorText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No body');
      
      let fullResponse = '';
      const decoder = new TextDecoder();
      
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        fullResponse += decoder.decode(result.value, { stream: true });
        this.updateLoadingMessageContent(fullResponse);
      }
      
      return fullResponse || 'No response generated.';
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }
  
  private async getServerPort(): Promise<number> {
    interface ServerApi { getPort?: () => Promise<number> }
    const serverApi = (window as unknown as { serverApi?: ServerApi }).serverApi;
    const port = serverApi?.getPort ? await serverApi.getPort() : 3000;
    return port || 3000;
  }
  
  private renderMessages(): void {
    if (!this.messagesContainer) return;
    clearChildren(this.messagesContainer);
    for (const message of this.messages) {
      this.messagesContainer.appendChild(this.createMessageElement(message));
    }
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  
  private createMessageElement(message: ChatMessage): HTMLElement {
    const isUser = message.role === 'user';
    const wrapper = createElement('div', {
      className: `flex ${isUser ? 'justify-end' : 'justify-start'} stagger-item`
    });

    if (isUser) {
      // User messages: editorial cut with gradient
      const bubble = createElement('div', {
        className: 'max-w-[85%] p-4 rounded-2xl rounded-tr-sm text-sm leading-relaxed font-body bg-gradient-to-br from-primary via-primary to-primary/90 text-white shadow-sm',
      });
      bubble.textContent = message.content;
      wrapper.appendChild(bubble);
    } else {
      // Assistant messages: refined layout with decorative accent
      const messageContainer = createElement('div', {
        className: 'max-w-[85%] flex gap-3 items-start'
      });

      // Decorative accent bar (left side)
      const accent = createElement('div', {
        className: 'w-1 h-full bg-gradient-to-b from-primary/40 to-primary/10 rounded-full mt-1 shrink-0'
      });
      messageContainer.appendChild(accent);

      // Message content
      const contentWrapper = createElement('div', { className: 'flex-1' });
      const bubble = createElement('div', {
        className: 'p-4 rounded-2xl rounded-bl-sm bg-surface-2 border border-border/50 text-sm leading-relaxed font-body markdown-content shadow-sm',
      });

      // Check for tool usage indicators and render them
      if (message.content.includes('[Using tool:')) {
        this.renderMessageWithTools(bubble, message.content);
      } else {
        bubble.innerHTML = parseMarkdown(message.content);
        setupMarkdownInteractivity(bubble);
      }

      contentWrapper.appendChild(bubble);
      messageContainer.appendChild(contentWrapper);

      wrapper.appendChild(messageContainer);
    }

    return wrapper;
  }

  private renderMessageWithTools(bubble: HTMLElement, content: string): void {
    // Split content by tool usage indicators
    const parts = content.split(/(\[Using tool: [^\]]+\])/g);

    for (const part of parts) {
      if (part.startsWith('[Using tool:')) {
        // Extract tool name
        const toolName = part.match(/\[Using tool: ([^\]]+)\]/)?.[1];
        if (toolName) {
          const toolIndicator = this.createToolIndicator(toolName);
          bubble.appendChild(toolIndicator);
        }
      } else if (part.trim()) {
        // Regular text content - parse as markdown
        const textDiv = createElement('div', {
          className: 'markdown-content',
        });
        textDiv.innerHTML = parseMarkdown(part);
        setupMarkdownInteractivity(textDiv);
        bubble.appendChild(textDiv);
      }
    }
  }

  private createToolIndicator(toolName: string): HTMLElement {
    const indicator = createElement('div', {
      className: 'flex items-center gap-2 px-3 py-2 my-2 bg-primary/5 border border-primary/20 rounded-lg text-xs',
    });

    // Icon and label based on tool name
    let icon = '🔧';
    let label = toolName;
    let badgeColor = 'bg-blue-500/10 text-blue-400';

    if (toolName === 'searchItems') {
      icon = '🔍';
      label = 'Searching data';
      badgeColor = 'bg-purple-500/10 text-purple-400';
    } else if (toolName.startsWith('obsidian_')) {
      icon = '📝';
      if (toolName === 'obsidian_list_notes') label = 'Listing notes';
      else if (toolName === 'obsidian_read_note') label = 'Reading note';
      else if (toolName === 'obsidian_create_note') label = 'Creating note';
      else if (toolName === 'obsidian_update_note') label = 'Updating note';
      else if (toolName === 'obsidian_search') label = 'Searching notes';
      else label = 'Obsidian';
      badgeColor = 'bg-green-500/10 text-green-400';
    }

    const iconSpan = createElement('span', {
      textContent: icon,
    });
    indicator.appendChild(iconSpan);

    const labelSpan = createElement('span', {
      className: 'flex-1 font-medium',
      textContent: label,
    });
    indicator.appendChild(labelSpan);

    const badge = createElement('span', {
      className: `px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeColor}`,
      textContent: 'Tool',
    });
    indicator.appendChild(badge);

    return indicator;
  }
  
  private renderLoadingMessage(): void {
    if (!this.messagesContainer) return;
    const wrapper = createElement('div', { className: 'flex justify-start loading-message' });

    const messageContainer = createElement('div', { className: 'max-w-[85%] flex gap-3 items-start' });

    // Decorative accent bar (matches assistant messages)
    const accent = createElement('div', {
      className: 'w-1 h-12 bg-gradient-to-b from-primary/40 to-primary/10 rounded-full shrink-0'
    });
    messageContainer.appendChild(accent);

    // Loading bubble with shimmer effect
    const bubble = createElement('div', {
      className: 'flex-1 p-4 rounded-2xl rounded-bl-sm bg-surface-2 border border-border/50 relative overflow-hidden'
    });

    bubble.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-16 h-2 shimmer-loading rounded-full"></div>
        <div class="w-12 h-2 shimmer-loading rounded-full"></div>
        <div class="w-20 h-2 shimmer-loading rounded-full"></div>
      </div>
    `;

    messageContainer.appendChild(bubble);
    wrapper.appendChild(messageContainer);
    this.messagesContainer.appendChild(wrapper);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  
  private updateLoadingMessageContent(content: string): void {
    if (!this.messagesContainer) return;
    const loadingMessage = this.messagesContainer.querySelector('.loading-message');
    if (loadingMessage && content.trim()) {
      const bubble = loadingMessage.querySelector('.rounded-2xl');
      if (bubble) {
        bubble.className = 'flex-1 p-4 rounded-2xl rounded-bl-sm bg-surface-2 border border-border/50 text-sm leading-relaxed font-body markdown-content shadow-sm';
        bubble.innerHTML = parseMarkdown(content);
        setupMarkdownInteractivity(bubble as HTMLElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }
  }

  private createHistoryDropdown(): HTMLElement {
    const dropdown = createElement('div', {
      className: 'border-t border-border/50 bg-background max-h-80 overflow-y-auto',
    });

    // New chat button
    const newChatBtn = createElement('button', {
      className: 'w-full px-5 py-2.5 flex items-center gap-2 hover:bg-secondary/50 transition-colors border-b border-border/50 text-left',
    });
    newChatBtn.innerHTML = `
      <div class="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-primary">
          <path d="M5 12h14"/><path d="M12 5v14"/>
        </svg>
      </div>
      <span class="text-sm font-medium">New Chat</span>
    `;
    this.addListener(newChatBtn, 'click', () => {
      this.sessionId = null;
      this.messages = [];
      this.historyDropdownOpen = false;
      this.render();
    });
    dropdown.appendChild(newChatBtn);

    // Recent sessions
    if (this.sessions.length > 0) {
      const recentLabel = createElement('div', {
        className: 'px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider',
        textContent: 'Recent',
      });
      dropdown.appendChild(recentLabel);

      for (const session of this.sessions.slice(0, 10)) {
        const sessionBtn = createElement('button', {
          className: 'w-full px-5 py-2.5 hover:bg-secondary/50 transition-colors text-left group',
        });

        const isCurrentSession = this.sessionId === session.id;

        sessionBtn.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <div class="w-5 h-5 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground">
                  <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
                </svg>
              </div>
              <span class="text-xs truncate ${isCurrentSession ? 'font-medium' : ''}">${escapeHtml(session.title || 'Untitled chat')}</span>
            </div>
            <span class="text-[10px] text-muted-foreground">${this.formatDate(session.updatedAt)}</span>
          </div>
        `;

        this.addListener(sessionBtn, 'click', async () => {
          await this.loadSession(session.id);
        });

        dropdown.appendChild(sessionBtn);
      }
    } else {
      const emptyState = createElement('div', {
        className: 'px-5 py-8 text-center text-xs text-muted-foreground',
        textContent: 'No chat history yet',
      });
      dropdown.appendChild(emptyState);
    }

    return dropdown;
  }

  private async loadSession(sessionId: string): Promise<void> {
    try {
      const result = await api.chat.getSession.query({ sessionId });
      this.sessionId = sessionId;
      this.messages = result.messages.map((m: { id: string; role: string; content: string; createdAt: string | Date }) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: new Date(m.createdAt),
      }));
      this.historyDropdownOpen = false;
      this.render();
      this.renderMessages();
    } catch (error) {
      console.error('[ChatSidebar] Failed to load session:', error);
    }
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export default ChatSidebar;
