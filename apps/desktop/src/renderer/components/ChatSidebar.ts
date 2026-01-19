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

  // Message queue for queuing messages while waiting for response
  private messageQueue: string[] = [];

  // Multi-provider state
  private stateManager!: ChatStateManager;
  private currentProvider: Provider = 'openrouter';
  
  async init(): Promise<void> {
    this.stateManager = getChatStateManager();
    this.currentProvider = this.stateManager.getProvider();
    this.apiKeyMissing = !hasApiKeyForProvider(this.currentProvider);
    
    // Check for transferred chat session from ChatPage (e.g., when browser tools are used)
    const transferredSession = store.chatSessionTransfer.get();
    if (transferredSession) {
      this.loadTransferredSession(transferredSession);
      store.chatSessionTransfer.set(null); // Clear the transfer
    }
    
    // Subscribe to future transfers (in case sidebar is already open)
    this.subscribe(store.chatSessionTransfer, (transfer) => {
      if (transfer) {
        this.loadTransferredSession(transfer);
        store.chatSessionTransfer.set(null);
      }
    });
    
    await this.loadSessions();
    this.render();
  }

  /**
   * Load a chat session transferred from ChatPage
   */
  private loadTransferredSession(transfer: { 
    sessionId: string | null; 
    messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: Date }>;
    provider: string;
    model: string;
  }): void {
    this.sessionId = transfer.sessionId;
    this.messages = transfer.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
    
    // Update provider and model if valid
    const validProvider = transfer.provider as Provider;
    if (validProvider && ['openrouter', 'anthropic'].includes(validProvider)) {
      this.currentProvider = validProvider;
      this.stateManager.setProvider(validProvider);
    }
    if (transfer.model) {
      this.stateManager.setModel(this.currentProvider, transfer.model);
    }
    
    this.apiKeyMissing = !hasApiKeyForProvider(this.currentProvider);
    this.render();
    this.renderMessages();
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
    
    // Sidebar container - sleek glass panel
    const panel = createElement('div', {
      className: 'flex flex-col h-full w-full relative',
    });
    (panel as HTMLElement).style.cssText = `
      background: linear-gradient(180deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%);
      border-left: 1px solid rgba(255, 255, 255, 0.04);
      animation: cc-slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      min-width: 0;
      overflow: hidden;
    `;
    
    // Resize handle on the left edge
    const resizeHandle = createElement('div', {
      className: 'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-primary/30 transition-colors',
    });
    (resizeHandle as HTMLElement).style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      cursor: col-resize;
      z-index: 50;
      transition: background-color 0.2s;
    `;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    this.addListener(resizeHandle, 'mousedown', (e: MouseEvent) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = this.container.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = startX - e.clientX; // Inverted because we're resizing from the left
      const newWidth = Math.max(280, Math.min(800, startWidth + deltaX));
      this.container.style.width = `${newWidth}px`;
      this.container.dataset.resized = 'true';
      
      // Update topbar right offset
      const topbarContainer = document.querySelector('.topbar-container') as HTMLElement;
      if (topbarContainer) {
        topbarContainer.style.right = `${newWidth}px`;
      }
    };
    
    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    this.registerCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
    
    resizeHandle.addEventListener('mouseenter', () => {
      (resizeHandle as HTMLElement).style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
    });
    resizeHandle.addEventListener('mouseleave', () => {
      if (!isResizing) {
        (resizeHandle as HTMLElement).style.backgroundColor = 'transparent';
      }
    });
    
    panel.appendChild(resizeHandle);
    
    // Header - minimal and clean
    const header = createElement('div', {
      className: 'flex flex-col shrink-0 sticky top-0 z-30',
    });
    (header as HTMLElement).style.cssText = `
      min-width: 0;
      width: 100%;
      overflow: hidden;
    `;

    const topRow = createElement('div', {
      className: 'flex items-center justify-between px-4 py-3 min-w-0',
    });
    (topRow as HTMLElement).style.cssText = `
      min-width: 0;
      width: 100%;
      overflow: hidden;
    `;

    // History dropdown button - minimal design
    const historyButton = createElement('button', {
      className: 'flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 flex-1 text-left group min-w-0',
    });
    (historyButton as HTMLElement).style.cssText = `
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid transparent;
      min-width: 0;
      overflow: hidden;
    `;
    const historyText = createElement('span');
    (historyText as HTMLElement).style.cssText = `
      font-family: var(--cc-font-body, 'Archivo', sans-serif);
      font-weight: 500;
      font-size: 13px;
      color: var(--cc-text-primary, #f8fafc);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      flex: 1;
    `;
    historyText.textContent = this.sessionId ? 'Current Chat' : 'New Chat';
    historyButton.appendChild(historyText);
    
    const chevronWrapper = createElement('span');
    (chevronWrapper as HTMLElement).style.cssText = `
      color: var(--cc-text-muted, #475569);
      transition: transform 0.2s;
      transform: ${this.historyDropdownOpen ? 'rotate(180deg)' : 'rotate(0)'};
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
    `;
    chevronWrapper.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>`;
    historyButton.appendChild(chevronWrapper);
    historyButton.addEventListener('mouseenter', () => {
      (historyButton as HTMLElement).style.background = 'rgba(255, 255, 255, 0.04)';
      (historyButton as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.06)';
    });
    historyButton.addEventListener('mouseleave', () => {
      (historyButton as HTMLElement).style.background = 'rgba(255, 255, 255, 0.02)';
      (historyButton as HTMLElement).style.borderColor = 'transparent';
    });
    this.addListener(historyButton, 'click', () => {
      this.historyDropdownOpen = !this.historyDropdownOpen;
      this.render();
    });
    topRow.appendChild(historyButton);

    // Close button - simple X
    const closeButton = createElement('button', {
      className: 'p-2 rounded-lg transition-all duration-200',
    });
    (closeButton as HTMLElement).style.cssText = `
      color: var(--cc-text-tertiary, #64748b);
    `;
    closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
      </svg>
    `;
    closeButton.addEventListener('mouseenter', () => {
      (closeButton as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
      (closeButton as HTMLElement).style.color = 'var(--cc-text-primary, #f8fafc)';
    });
    closeButton.addEventListener('mouseleave', () => {
      (closeButton as HTMLElement).style.background = 'transparent';
      (closeButton as HTMLElement).style.color = 'var(--cc-text-tertiary, #64748b)';
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
    
    // Messages container - optimized spacing
    this.messagesContainer = createElement('div', {
      className: 'flex-1 overflow-y-auto p-3',
    });
    (this.messagesContainer as HTMLElement).style.cssText = `
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
      width: 100%;
      min-width: 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
    `;
    
    if (this.apiKeyMissing) {
      this.renderApiKeyMissingState();
    } else if (this.messages.length === 0) {
      this.renderWelcomeState();
    }
    
    panel.appendChild(this.messagesContainer);
    
    // Input area - refined floating design
    if (!this.apiKeyMissing) {
      const inputArea = createElement('div', {
        className: 'p-4 shrink-0',
      });
      (inputArea as HTMLElement).style.cssText = `
        background: linear-gradient(180deg, transparent 0%, rgba(10, 10, 15, 0.8) 100%);
      `;

      const inputWrapper = createElement('div', {
        className: 'flex items-end gap-3 px-4 py-3 rounded-2xl transition-all',
      });
      (inputWrapper as HTMLElement).style.cssText = `
        background: rgba(255, 255, 255, 0.04);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
      `;
      inputWrapper.addEventListener('focusin', () => {
        (inputWrapper as HTMLElement).style.borderColor = 'rgba(99, 102, 241, 0.4)';
        (inputWrapper as HTMLElement).style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(99, 102, 241, 0.1)';
      });
      inputWrapper.addEventListener('focusout', () => {
        (inputWrapper as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.08)';
        (inputWrapper as HTMLElement).style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.2)';
      });

      this.inputElement = createElement('textarea', {
        className: 'flex-1 bg-transparent border-none outline-none resize-none min-h-[22px] max-h-32 py-0.5',
        attributes: {
          placeholder: 'Message...',
          rows: '1',
        },
      }) as HTMLTextAreaElement;
      (this.inputElement as HTMLElement).style.cssText = `
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 14px;
        color: var(--cc-text-primary, #f8fafc);
        line-height: 1.5;
      `;

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
        className: 'p-2.5 rounded-xl transition-all shrink-0',
        innerHTML: `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        `,
      });
      (sendButton as HTMLElement).style.cssText = `
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        box-shadow: 0 2px 12px rgba(99, 102, 241, 0.3);
        border-radius: 12px;
      `;
      sendButton.addEventListener('mouseenter', () => {
        (sendButton as HTMLElement).style.transform = 'scale(1.05)';
        (sendButton as HTMLElement).style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.4)';
      });
      sendButton.addEventListener('mouseleave', () => {
        (sendButton as HTMLElement).style.transform = 'scale(1)';
        (sendButton as HTMLElement).style.boxShadow = '0 2px 12px rgba(99, 102, 241, 0.3)';
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
      className: 'flex items-center gap-2 px-4 py-2 min-w-0',
    });
    (controlsRow as HTMLElement).style.cssText = `
      background: rgba(255, 255, 255, 0.015);
      min-width: 0;
      width: 100%;
      overflow: hidden;
      flex-wrap: wrap;
    `;

    // Provider selector - minimal styling
    const providerWrapper = createElement('div', {
      className: 'flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200 min-w-0 shrink-0',
    });
    (providerWrapper as HTMLElement).style.cssText = `
      background: rgba(255, 255, 255, 0.03);
      min-width: 0;
      max-width: 45%;
    `;

    const providerSelect = createElement('select', {
      className: 'bg-transparent focus:outline-none cursor-pointer min-w-0',
    }) as HTMLSelectElement;
    (providerSelect as HTMLElement).style.cssText = `
      font-family: var(--cc-font-body, 'Archivo', sans-serif);
      font-size: 11px;
      font-weight: 500;
      color: var(--cc-text-secondary, #cbd5e1);
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

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
    
    // Make select text truncate on narrow widths
    providerSelect.addEventListener('change', () => {
      const selectedOption = providerSelect.options[providerSelect.selectedIndex];
      if (selectedOption) {
        providerSelect.title = selectedOption.text;
      }
    });

    this.addListener(providerSelect, 'change', () => {
      this.onProviderChange(providerSelect.value as Provider);
    });
    providerWrapper.appendChild(providerSelect);
    controlsRow.appendChild(providerWrapper);

    // Separator - subtle dot (hide on very narrow widths)
    const separator = createElement('span', {
      textContent: '·',
    });
    (separator as HTMLElement).style.cssText = `
      color: var(--cc-text-muted, #475569);
      font-size: 10px;
      flex-shrink: 0;
    `;
    controlsRow.appendChild(separator);

    // Model selector - minimal
    const modelWrapper = createElement('div', {
      className: 'flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors min-w-0',
    });
    (modelWrapper as HTMLElement).style.cssText = `
      background: rgba(255, 255, 255, 0.03);
      min-width: 0;
      flex: 1 1 0%;
      max-width: 50%;
    `;

    const modelSelect = createElement('select', {
      className: 'flex-1 bg-transparent focus:outline-none cursor-pointer min-w-0',
    }) as HTMLSelectElement;
    (modelSelect as HTMLElement).style.cssText = `
      font-family: var(--cc-font-body, 'Archivo', sans-serif);
      font-size: 11px;
      font-weight: 500;
      color: var(--cc-text-secondary, #cbd5e1);
      min-width: 0;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

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
    
    // Make select text truncate on narrow widths
    modelSelect.addEventListener('change', () => {
      const selectedOption = modelSelect.options[modelSelect.selectedIndex];
      if (selectedOption) {
        modelSelect.title = selectedOption.text;
      }
    });

    this.addListener(modelSelect, 'change', () => {
      this.onModelChange(modelSelect.value);
    });
    modelWrapper.appendChild(modelSelect);
    controlsRow.appendChild(modelWrapper);

    // Settings button - minimal
    const settingsBtn = createElement('button', {
      className: 'p-1.5 rounded-md transition-all duration-200 shrink-0',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
      attributes: { title: 'AI Settings' }
    });
    (settingsBtn as HTMLElement).style.cssText = `
      color: var(--cc-text-tertiary, #64748b);
      flex-shrink: 0;
    `;
    settingsBtn.addEventListener('mouseenter', () => {
      (settingsBtn as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
      (settingsBtn as HTMLElement).style.color = 'var(--cc-text-primary, #f8fafc)';
    });
    settingsBtn.addEventListener('mouseleave', () => {
      (settingsBtn as HTMLElement).style.background = 'transparent';
      (settingsBtn as HTMLElement).style.color = 'var(--cc-text-tertiary, #64748b)';
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
    // If loading, queue the message instead of blocking
    if (this.isLoading) {
      this.messageQueue.push(content);
      this.updateQueueIndicator();
      return;
    }

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

        if (error.message.includes('401') || error.message.includes('Invalid API key') || error.message.includes('authentication_error')) {
          this.showErrorMessage(`${providerName} API key is invalid or expired. Please update it in settings.`);
          return;
        }

        if (error.message.includes('429') || error.message.includes('rate_limit')) {
          // Extract retry-after if available
          const retryMatch = error.message.match(/retry.?after.*?(\d+)/i);
          const retrySeconds = retryMatch ? Math.ceil(parseInt(retryMatch[1]) / 60) : null;
          const retryMsg = retrySeconds ? ` Try again in ~${retrySeconds} minutes.` : ' Please wait a moment and try again.';
          this.showErrorMessage(`Rate limit reached.${retryMsg}`);
          return;
        }

        if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
          this.showErrorMessage(`${providerName} is temporarily unavailable. Please try again in a moment.`);
          return;
        }

        if (error.message.includes('network') || error.message.includes('fetch')) {
          this.showErrorMessage('Network error. Check your connection and try again.');
          return;
        }

        // Show the actual error message for debugging
        this.showErrorMessage(`Error: ${error.message.slice(0, 150)}${error.message.length > 150 ? '...' : ''}`);
        return;
      }

      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'An unexpected error occurred. Please try again.',
        createdAt: new Date(),
      };
      this.messages.push(errorMessage);
      this.renderMessages();
    }
    
    this.isLoading = false;

    // Process queued messages if any
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.messageQueue.length > 0 && !this.isLoading) {
      const nextMessage = this.messageQueue.shift();
      this.updateQueueIndicator();
      if (nextMessage) {
        await this.sendMessage(nextMessage);
      }
    }
  }

  private updateQueueIndicator(): void {
    // Find or create queue indicator near the input
    const inputArea = this.container.querySelector('.chat-input-area');
    if (!inputArea) return;

    // Remove existing indicator
    const existing = inputArea.querySelector('.queue-indicator');
    if (existing) existing.remove();

    if (this.messageQueue.length === 0) return;

    // Create queue indicator
    const indicator = createElement('div', {
      className: 'queue-indicator',
    });
    (indicator as HTMLElement).style.cssText = `
      position: absolute;
      top: -28px;
      left: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 8px;
      font-family: var(--cc-font-body, 'Archivo', sans-serif);
      font-size: 11px;
      color: rgba(99, 102, 241, 0.9);
    `;
    indicator.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
      </svg>
      <span>${this.messageQueue.length} message${this.messageQueue.length > 1 ? 's' : ''} queued</span>
    `;

    inputArea.insertBefore(indicator, inputArea.firstChild);
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
      className: `flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`
    });
    (wrapper as HTMLElement).style.cssText = `
      animation: cc-slideIn 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    if (isUser) {
      // User messages: refined gradient with glow
      const bubble = createElement('div', {
        className: 'max-w-[80%] px-4 py-3 rounded-2xl markdown-content',
      });
      (bubble as HTMLElement).style.cssText = `
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(139, 92, 246, 0.12) 100%);
        border: 1px solid rgba(99, 102, 241, 0.25);
        border-radius: 18px 18px 4px 18px;
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 14px;
        line-height: 1.6;
        color: var(--cc-text-primary, #f8fafc);
        box-shadow: 0 2px 12px rgba(99, 102, 241, 0.08);
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: break-word;
        min-width: 0;
        max-width: 100%;
      `;
      bubble.textContent = message.content;
      wrapper.appendChild(bubble);
    } else {
      // Assistant messages: clean minimal with subtle avatar
      const messageContainer = createElement('div', {
        className: 'max-w-[88%] flex gap-2.5 items-start min-w-0'
      });
      (messageContainer as HTMLElement).style.cssText = `
        min-width: 0;
        max-width: 88%;
        width: 100%;
      `;

      // Small avatar indicator
      const avatar = createElement('div', {
        className: 'flex-shrink-0',
      });
      (avatar as HTMLElement).style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
        border: 1px solid rgba(99, 102, 241, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 2px;
      `;
      avatar.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: rgba(99, 102, 241, 0.8);"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 3a3 3 0 1 1-3 3 3 3 0 0 1 3-3zm0 14a8 8 0 0 1-6.5-3.3c0-2.2 4.3-3.4 6.5-3.4s6.5 1.2 6.5 3.4A8 8 0 0 1 12 19z"/></svg>`;
      messageContainer.appendChild(avatar);

      // Message content
      const bubble = createElement('div', {
        className: 'px-4 py-3 rounded-2xl markdown-content flex-1',
      });
      (bubble as HTMLElement).style.cssText = `
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 4px 18px 18px 18px;
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 14px;
        line-height: 1.6;
        color: var(--cc-text-secondary, #e2e8f0);
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: break-word;
        min-width: 0;
        max-width: 100%;
      `;

      // Check for tool usage indicators and render them (support both old and new format)
      if (message.content.includes('[Using tool:') || message.content.includes('[TOOL_START:')) {
        this.renderMessageWithTools(bubble, message.content);
      } else {
        bubble.innerHTML = parseMarkdown(message.content);
        // Ensure markdown content wraps
        const markdownElements = bubble.querySelectorAll('*');
        markdownElements.forEach((el: Element) => {
          (el as HTMLElement).style.wordWrap = 'break-word';
          (el as HTMLElement).style.overflowWrap = 'break-word';
          (el as HTMLElement).style.wordBreak = 'break-word';
          (el as HTMLElement).style.maxWidth = '100%';
        });
        setupMarkdownInteractivity(bubble);
      }

      messageContainer.appendChild(bubble);
      wrapper.appendChild(messageContainer);
    }

    return wrapper;
  }

  private renderMessageWithTools(bubble: HTMLElement, content: string): void {
    // Parse tool data from content
    const toolData: Map<string, { name: string; input?: string; result?: string }> = new Map();

    // Extract TOOL_START markers: [TOOL_START:toolName:index]
    const startMatches = content.matchAll(/\[TOOL_START:([^:]+):(\d+)\]/g);
    for (const match of startMatches) {
      const [, toolName, index] = match;
      toolData.set(index, { name: toolName });
    }

    // Extract TOOL_INPUT markers: [TOOL_INPUT:index:jsonData]
    const inputMatches = content.matchAll(/\[TOOL_INPUT:(\d+):([^\]]*)\]/g);
    for (const match of inputMatches) {
      const [, index, input] = match;
      const existing = toolData.get(index);
      if (existing) {
        existing.input = input;
      }
    }

    // Extract TOOL_RESULT markers: [TOOL_RESULT:toolName:summary]
    const resultMatches = content.matchAll(/\[TOOL_RESULT:([^:]+):([^\]]*)\]/g);
    for (const match of resultMatches) {
      const [, toolName, result] = match;
      // Find matching tool by name
      for (const [, data] of toolData) {
        if (data.name === toolName && !data.result) {
          data.result = result;
          break;
        }
      }
    }

    // Remove all tool markers from content for text rendering - be more aggressive
    let cleanContent = content
      .replace(/\[TOOL_START:[^\]]+\]/g, '')
      .replace(/\[TOOL_INPUT:[^\]]*\]/g, '')
      .replace(/\[TOOL_RESULT:[^\]]*\]/g, '')
      .replace(/\[Using tool: [^\]]+\]/g, '')
      .replace(/"imageDataUrl"\s*:\s*"[^"]+"/g, '')
      .replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, '')
      .replace(/Let me try again with the proper URL parameter:/g, '')
      .replace(/Let me try again:/g, '')
      .trim();
    
    // Remove common AI "thinking" phrases that clutter the UI
    cleanContent = cleanContent
      .replace(/^I'll navigate to [^.]+\.[^.]+\s*/gim, '')
      .replace(/^I'll [^.]+\s*/gim, '')
      .replace(/^Let me [^.]+\s*/gim, '')
      .replace(/^I'm [^.]+\s*/gim, '')
      .replace(/^I can [^.]+\s*/gim, '')
      .replace(/^I'll help you [^.]+\s*/gim, '')
      .replace(/^I'll [^.]+\s*/gim, '')
      .replace(/^Let me [^.]+\s*/gim, '')
      .trim();

    // Render tool indicators first if we have any
    if (toolData.size > 0) {
      for (const [, data] of toolData) {
        const toolIndicator = this.createToolIndicator(data.name, data.input, data.result);
        bubble.appendChild(toolIndicator);
      }
    } else {
      // Fallback: parse old format [Using tool: name]
      const oldParts = content.split(/(\[Using tool: [^\]]+\])/g);
      for (const part of oldParts) {
        if (part.startsWith('[Using tool:')) {
          const toolName = part.match(/\[Using tool: ([^\]]+)\]/)?.[1];
          if (toolName) {
            const toolIndicator = this.createToolIndicator(toolName);
            bubble.appendChild(toolIndicator);
          }
        }
      }
    }

    // If screenshot data is present, render it below tool indicators
    const screenshotToolPresent = Array.from(toolData.values()).some(data => data.name === 'browser_screenshot');
    const normalizedContent = content.replace(/\\\//g, '/');
    const imageDataUrlMatch = normalizedContent.match(/"imageDataUrl"\s*:\s*"([^"]+)"/);
    const screenshotDataUrlMatch = normalizedContent.match(/"screenshot"\s*:\s*"(data:image\/[^"]+)"/);
    const screenshotMatch =
      normalizedContent.match(/"type"\s*:\s*"image"[^}]*"data"\s*:\s*"([^"]+)"/) ||
      normalizedContent.match(/data:image\/png;base64,([^"\s]+)/);
    const screenshotBase64 = screenshotMatch?.[1];
    const imgSrc =
      (imageDataUrlMatch?.[1] && imageDataUrlMatch[1].startsWith('data:image'))
        ? imageDataUrlMatch[1]
        : screenshotDataUrlMatch?.[1] ||
          (screenshotMatch?.[0]?.startsWith('data:image')
            ? screenshotMatch[0]
            : screenshotBase64
              ? `data:image/png;base64,${screenshotBase64}`
              : null);

    if (screenshotToolPresent && imgSrc) {
      const img = createElement('img', {
        attributes: {
          src: imgSrc,
          alt: 'Browser screenshot',
        },
      });
      (img as HTMLImageElement).style.cssText = `
        margin-top: 8px;
        width: 100%;
        max-width: 100%;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(0, 0, 0, 0.2);
      `;
      bubble.appendChild(img);
    }

    // Render remaining text content - only if there's meaningful content
    const textContent = cleanContent.trim();
    // Filter out empty or very short messages that are just tool noise
    if (textContent && textContent.length > 3 && !textContent.match(/^(I'll|Let me|I'm|I can)[\s\.,!]*$/i)) {
      const textDiv = createElement('div', {
        className: 'markdown-content',
      });
      (textDiv as HTMLElement).style.cssText = `
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: break-word;
        min-width: 0;
        max-width: 100%;
      `;
      textDiv.innerHTML = parseMarkdown(textContent);
      // Ensure all markdown elements wrap properly
      const allElements = textDiv.querySelectorAll('*');
      allElements.forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.wordWrap = 'break-word';
        htmlEl.style.overflowWrap = 'break-word';
        htmlEl.style.wordBreak = 'break-word';
        htmlEl.style.maxWidth = '100%';
        // Code blocks should scroll horizontally if needed, but wrap text
        if (el.tagName === 'PRE' || el.tagName === 'CODE') {
          htmlEl.style.whiteSpace = 'pre-wrap';
          htmlEl.style.overflowX = 'auto';
        }
      });
      setupMarkdownInteractivity(textDiv);
      bubble.appendChild(textDiv);
    }
  }

  private createToolIndicator(toolName: string, toolInput?: string, toolResult?: string): HTMLElement {
    const wrapper = createElement('div', {
      className: 'my-2',
    });
    (wrapper as HTMLElement).style.cssText = `
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
      min-width: 0;
      max-width: 100%;
    `;

    const indicator = createElement('div', {
      className: 'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all',
    });
    (indicator as HTMLElement).style.cssText = `
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      animation: cc-fadeIn 0.2s ease-out;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
      min-width: 0;
      max-width: 100%;
    `;

    // Icon, label, and color based on tool name
    let icon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
    let label = toolName;
    let iconColor = 'rgba(99, 102, 241, 0.9)';

    if (toolName === 'searchItems') {
      icon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
      label = 'Searching data';
      iconColor = 'rgba(59, 130, 246, 0.9)';
    } else if (toolName === 'analyzeAllItems') {
      icon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`;
      label = 'Analyzing all data';
      iconColor = 'rgba(16, 185, 129, 0.9)';
    } else if (toolName === 'querySQLite') {
      icon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`;
      label = 'Querying database';
      iconColor = 'rgba(245, 158, 11, 0.9)';
    } else if (toolName.startsWith('obsidian_')) {
      icon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
      iconColor = 'rgba(168, 85, 247, 0.9)';
      if (toolName === 'obsidian_list_notes') label = 'Listing notes';
      else if (toolName === 'obsidian_read_note') label = 'Reading note';
      else if (toolName === 'obsidian_create_note') label = 'Creating note';
      else if (toolName === 'obsidian_update_note') label = 'Updating note';
      else if (toolName === 'obsidian_search') label = 'Searching notes';
      else label = 'Obsidian';
    } else if (toolName.startsWith('browser_')) {
      icon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
      iconColor = 'rgba(99, 102, 241, 0.9)';
      if (toolName === 'browser_navigate') label = 'Navigating';
      else if (toolName === 'browser_click') label = 'Clicking';
      else if (toolName === 'browser_fill') label = 'Filling form';
      else if (toolName === 'browser_screenshot') label = 'Taking screenshot';
      else if (toolName === 'browser_snapshot') label = 'Reading page';
      else if (toolName === 'browser_network') label = 'Checking network';
      else if (toolName === 'browser_evaluate') label = 'Running script';
      else if (toolName === 'browser_wait') label = 'Waiting';
      else label = 'Browser';
    }

    // Icon container - larger and more prominent
    const iconContainer = createElement('div', {
      className: 'flex items-center justify-center flex-shrink-0',
    });
    (iconContainer as HTMLElement).style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: ${iconColor.replace('0.9', '0.15')};
      color: ${iconColor};
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid ${iconColor.replace('0.9', '0.2')};
    `;
    iconContainer.innerHTML = icon.replace('width="12"', 'width="14"').replace('height="12"', 'height="14"');
    indicator.appendChild(iconContainer);

    // Label - larger and more readable
    const labelSpan = createElement('span', {
      textContent: label,
    });
    (labelSpan as HTMLElement).style.cssText = `
      font-family: var(--cc-font-body, 'Archivo', sans-serif);
      font-size: 12px;
      font-weight: 600;
      color: var(--cc-text-primary, #f1f5f9);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    indicator.appendChild(labelSpan);

    // Status badge showing success/result preview
    if (toolResult) {
      const isSuccess = !toolResult.toLowerCase().includes('error') && !toolResult.toLowerCase().includes('failed');
      const resultPreview = toolResult.length > 40 ? toolResult.substring(0, 40) + '...' : toolResult;
      const statusBadge = createElement('div', {
        className: 'flex items-center gap-1.5 flex-shrink-0',
      });
      (statusBadge as HTMLElement).style.cssText = `
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 10px;
        font-weight: 500;
        color: ${isSuccess ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
        background: ${isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
        padding: 3px 8px;
        border-radius: 6px;
        border: 1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      
      // Add checkmark or X icon
      const statusIcon = createElement('span');
      statusIcon.innerHTML = isSuccess 
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      statusBadge.appendChild(statusIcon);
      
      const statusText = createElement('span', {
        textContent: isSuccess ? 'Success' : 'Error',
      });
      statusBadge.appendChild(statusText);
      
      indicator.appendChild(statusBadge);
    } else {
      // Loading state
      const loadingBadge = createElement('div', {
        className: 'flex items-center gap-1.5 flex-shrink-0',
      });
      (loadingBadge as HTMLElement).style.cssText = `
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 10px;
        font-weight: 500;
        color: rgba(99, 102, 241, 0.9);
        background: rgba(99, 102, 241, 0.1);
        padding: 3px 8px;
        border-radius: 6px;
        border: 1px solid rgba(99, 102, 241, 0.2);
      `;
      loadingBadge.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span>Running</span>
      `;
      indicator.appendChild(loadingBadge);
    }

    // Expand/collapse chevron - only show if there's input/result to expand
    let chevron: HTMLElement | null = null;
    if (toolInput || (toolResult && !toolResult.startsWith('data:image'))) {
      chevron = createElement('div', {
        className: 'flex-shrink-0 transition-transform duration-200',
      });
      (chevron as HTMLElement).style.cssText = `
        color: var(--cc-text-muted, #475569);
        opacity: 0.6;
      `;
      chevron.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>`;
      indicator.appendChild(chevron);
    }

    wrapper.appendChild(indicator);

    // Expandable details section (hidden by default)
    const details = createElement('div', {
      className: 'overflow-hidden transition-all duration-300 ease-out',
    });
    (details as HTMLElement).style.cssText = `
      max-height: 0;
      opacity: 0;
      margin-top: 0;
    `;

    const detailsInner = createElement('div', {
      className: 'px-3 py-2.5 mt-2 rounded-lg space-y-2',
    });
    (detailsInner as HTMLElement).style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    `;

    // Tool name header
    const toolHeader = createElement('div', {
      className: 'flex items-center gap-2',
    });
    const toolLabel = createElement('div', {});
    (toolLabel as HTMLElement).style.cssText = `
      font-family: var(--cc-font-body, 'Archivo', sans-serif);
      font-size: 11px;
      font-weight: 600;
      color: var(--cc-text-secondary, #cbd5e1);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;
    toolLabel.textContent = toolName.replace(/_/g, ' ');
    toolHeader.appendChild(toolLabel);
    
    // Add a subtle divider
    const divider = createElement('div');
    (divider as HTMLElement).style.cssText = `
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.05);
    `;
    toolHeader.appendChild(divider);
    detailsInner.appendChild(toolHeader);

    // Input section
    if (toolInput) {
      const inputSection = createElement('div', {});
      (inputSection as HTMLElement).style.cssText = `margin-top: 6px;`;

      const inputLabel = createElement('div', {
        textContent: 'Input',
      });
      (inputLabel as HTMLElement).style.cssText = `
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 10px;
        font-weight: 600;
        color: var(--cc-text-secondary, #94a3b8);
        margin-bottom: 6px;
      `;
      inputSection.appendChild(inputLabel);

      // Parse and format JSON input
      let formattedInput = toolInput;
      try {
        const parsed = JSON.parse(toolInput);
        formattedInput = Object.entries(parsed)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('\n');
      } catch {
        // Keep as-is if not valid JSON
      }

      const inputValue = createElement('pre', {
        textContent: formattedInput,
      });
      (inputValue as HTMLElement).style.cssText = `
        font-family: var(--cc-font-mono, 'JetBrains Mono', monospace);
        font-size: 11px;
        color: var(--cc-text-primary, #f1f5f9);
        background: rgba(0, 0, 0, 0.4);
        padding: 8px 10px;
        border-radius: 8px;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 120px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.05);
        line-height: 1.5;
      `;
      inputSection.appendChild(inputValue);
      detailsInner.appendChild(inputSection);
    }

    // Result section
    if (toolResult) {
      const resultSection = createElement('div', {});
      (resultSection as HTMLElement).style.cssText = `margin-top: 6px;`;

      const resultLabel = createElement('div', {
        textContent: 'Result',
      });
      (resultLabel as HTMLElement).style.cssText = `
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 10px;
        font-weight: 600;
        color: var(--cc-text-secondary, #94a3b8);
        margin-bottom: 6px;
      `;
      resultSection.appendChild(resultLabel);

      // Special rendering for browser screenshot
      if (toolName === 'browser_screenshot' && toolResult.startsWith('data:image')) {
        const imgWrapper = createElement('div', {});
        imgWrapper.style.cssText = `
          margin-top: 8px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        `;
        
        const img = createElement('img', {
          attributes: {
            src: toolResult,
            alt: 'Browser screenshot',
          },
        });
        img.style.cssText = `
          width: 100%;
          height: auto;
          display: block;
        `;
        
        imgWrapper.appendChild(img);
        
        // Click to expand
        let expanded = false;
        this.addListener(imgWrapper, 'click', () => {
          if (!expanded) {
            imgWrapper.style.position = 'fixed';
            imgWrapper.style.top = '50%';
            imgWrapper.style.left = '50%';
            imgWrapper.style.transform = 'translate(-50%, -50%)';
            imgWrapper.style.maxWidth = '90vw';
            imgWrapper.style.maxHeight = '90vh';
            imgWrapper.style.zIndex = '10000';
            imgWrapper.style.background = 'rgba(0, 0, 0, 0.9)';
            imgWrapper.style.padding = '20px';
            expanded = true;
          } else {
            imgWrapper.style.position = '';
            imgWrapper.style.top = '';
            imgWrapper.style.left = '';
            imgWrapper.style.transform = '';
            imgWrapper.style.maxWidth = '';
            imgWrapper.style.maxHeight = '';
            imgWrapper.style.zIndex = '';
            imgWrapper.style.background = '';
            imgWrapper.style.padding = '';
            expanded = false;
          }
        });
        
        resultSection.appendChild(imgWrapper);
      } else {
        // Regular text result - try to parse as JSON for better formatting
        let resultText = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
        let isJSON = false;
        
        try {
          const parsed = JSON.parse(resultText);
          if (typeof parsed === 'object' && parsed !== null) {
            resultText = JSON.stringify(parsed, null, 2);
            isJSON = true;
          }
        } catch {
          // Not JSON, keep as-is
        }
        
        const resultValue = createElement('pre', {
          textContent: resultText,
        });
        (resultValue as HTMLElement).style.cssText = `
          font-family: ${isJSON ? 'var(--cc-font-mono, "JetBrains Mono", monospace)' : 'var(--cc-font-body, "Archivo", sans-serif)'};
          font-size: ${isJSON ? '11px' : '11px'};
          color: var(--cc-text-primary, #f1f5f9);
          font-weight: ${isJSON ? '400' : '500'};
          max-height: 200px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          background: rgba(0, 0, 0, 0.4);
          padding: 8px 10px;
          border-radius: 8px;
          margin: 0;
          border: 1px solid rgba(255, 255, 255, 0.05);
          line-height: 1.5;
        `;
        resultSection.appendChild(resultValue);
      }
      
      detailsInner.appendChild(resultSection);
    }

    // Status (shown if no result yet)
    if (!toolResult) {
      const statusLabel = createElement('div', {});
      (statusLabel as HTMLElement).style.cssText = `
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 10px;
        color: ${iconColor};
      `;
      statusLabel.textContent = '✓ Completed';
      detailsInner.appendChild(statusLabel);
    }

    details.appendChild(detailsInner);
    wrapper.appendChild(details);

    // Calculate dynamic height based on content
    const hasInput = !!toolInput;
    const hasResult = !!toolResult && !toolResult.startsWith('data:image');
    const expandedHeight = hasInput && hasResult ? '250px' : hasInput ? '150px' : hasResult ? '120px' : '60px';

    // Toggle expand/collapse - only if there's content to expand
    let isExpanded = false;
    if (toolInput || (toolResult && !toolResult.startsWith('data:image'))) {
      indicator.addEventListener('click', () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
          (details as HTMLElement).style.maxHeight = expandedHeight;
          (details as HTMLElement).style.opacity = '1';
          if (chevron) chevron.style.transform = 'rotate(180deg)';
          (indicator as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
        } else {
          (details as HTMLElement).style.maxHeight = '0';
          (details as HTMLElement).style.opacity = '0';
          if (chevron) chevron.style.transform = 'rotate(0)';
          (indicator as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
        }
      });
    }

    // Hover effect
    indicator.addEventListener('mouseenter', () => {
      (indicator as HTMLElement).style.background = isExpanded ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.05)';
      (indicator as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.08)';
    });
    indicator.addEventListener('mouseleave', () => {
      (indicator as HTMLElement).style.background = isExpanded ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)';
      (indicator as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.05)';
    });

    return wrapper;
  }
  
  private renderLoadingMessage(): void {
    if (!this.messagesContainer) return;
    const wrapper = createElement('div', { className: 'flex justify-start loading-message mb-1' });
    (wrapper as HTMLElement).style.cssText = `
      animation: cc-slideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    const messageContainer = createElement('div', { className: 'max-w-[88%] flex gap-2.5 items-start' });

    // Small avatar indicator (same as createMessageElement)
    const avatar = createElement('div', {
      className: 'flex-shrink-0',
    });
    (avatar as HTMLElement).style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    `;
    avatar.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: rgba(99, 102, 241, 0.8);"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 3a3 3 0 1 1-3 3 3 3 0 0 1 3-3zm0 14a8 8 0 0 1-6.5-3.3c0-2.2 4.3-3.4 6.5-3.4s6.5 1.2 6.5 3.4A8 8 0 0 1 12 19z"/></svg>`;
    messageContainer.appendChild(avatar);

    // Loading bubble with Apple-style typing indicator
    const bubble = createElement('div', {
      className: 'px-4 py-3 rounded-2xl relative overflow-hidden flex-1',
    });
    (bubble as HTMLElement).style.cssText = `
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 4px 18px 18px 18px;
    `;

    // Apple-style typing dots
    bubble.innerHTML = `
      <div style="display: flex; align-items: center; gap: 5px; padding: 2px 0;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(99, 102, 241, 0.6); animation: cc-typingDot 1.4s ease-in-out infinite;"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(99, 102, 241, 0.6); animation: cc-typingDot 1.4s ease-in-out 0.2s infinite;"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(99, 102, 241, 0.6); animation: cc-typingDot 1.4s ease-in-out 0.4s infinite;"></div>
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
        (bubble as HTMLElement).style.cssText = `
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 4px 18px 18px 18px;
          font-family: var(--cc-font-body, 'Archivo', sans-serif);
          font-size: 14px;
          line-height: 1.6;
          color: var(--cc-text-secondary, #e2e8f0);
          padding: 12px 16px;
        `;
        bubble.className = 'px-4 py-3 rounded-2xl markdown-content flex-1';

        // Clear and render with tool indicators if present
        while (bubble.firstChild) {
          bubble.removeChild(bubble.firstChild);
        }

        // Check for tool markers (both old and new formats)
        if (content.includes('[Using tool:') || content.includes('[TOOL_START:')) {
          this.renderMessageWithTools(bubble as HTMLElement, content);
        } else {
          bubble.innerHTML = parseMarkdown(content);
          setupMarkdownInteractivity(bubble as HTMLElement);
        }

        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }
  }

  private createHistoryDropdown(): HTMLElement {
    const dropdown = createElement('div', {
      className: 'max-h-80 overflow-y-auto',
    });
    (dropdown as HTMLElement).style.cssText = `
      background: rgba(10, 10, 15, 0.95);
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    `;

    // New chat button
    const newChatBtn = createElement('button', {
      className: 'w-full px-4 py-2.5 flex items-center gap-2 transition-colors text-left',
    });
    (newChatBtn as HTMLElement).style.cssText = `
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    `;
    newChatBtn.addEventListener('mouseenter', () => {
      (newChatBtn as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
    });
    newChatBtn.addEventListener('mouseleave', () => {
      (newChatBtn as HTMLElement).style.background = 'transparent';
    });
    newChatBtn.innerHTML = `
      <div style="width: 20px; height: 20px; border-radius: 6px; background: rgba(99, 102, 241, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--cc-primary, #6366f1);">
          <path d="M5 12h14"/><path d="M12 5v14"/>
        </svg>
      </div>
      <span style="font-family: var(--cc-font-body, 'Archivo', sans-serif); font-size: 13px; font-weight: 500; color: var(--cc-text-primary, #f8fafc);">New Chat</span>
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
        className: 'px-4 py-2',
      });
      (recentLabel as HTMLElement).style.cssText = `
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--cc-text-muted, #475569);
      `;
      recentLabel.textContent = 'Recent';
      dropdown.appendChild(recentLabel);

      for (const session of this.sessions.slice(0, 10)) {
        const sessionRow = createElement('div', {
          className: 'flex items-center gap-2 px-4 py-2.5 transition-colors group',
        });
        sessionRow.addEventListener('mouseenter', () => {
          (sessionRow as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
          const deleteBtn = sessionRow.querySelector('.delete-btn') as HTMLElement;
          if (deleteBtn) deleteBtn.style.opacity = '1';
        });
        sessionRow.addEventListener('mouseleave', () => {
          (sessionRow as HTMLElement).style.background = 'transparent';
          const deleteBtn = sessionRow.querySelector('.delete-btn') as HTMLElement;
          if (deleteBtn) deleteBtn.style.opacity = '0';
        });

        const isCurrentSession = this.sessionId === session.id;

        // Chat button (clickable area for loading session)
        const chatBtn = createElement('button', {
          className: 'flex items-center gap-2 flex-1 min-w-0 text-left',
        });
        chatBtn.innerHTML = `
          <span style="font-family: var(--cc-font-body, 'Archivo', sans-serif); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${isCurrentSession ? 'var(--cc-primary, #6366f1)' : 'var(--cc-text-secondary, #cbd5e1)'}; font-weight: ${isCurrentSession ? '600' : '400'};">${escapeHtml(session.title || 'Untitled chat')}</span>
        `;
        this.addListener(chatBtn, 'click', async () => {
          await this.loadSession(session.id);
        });
        sessionRow.appendChild(chatBtn);

        // Time label
        const timeLabel = createElement('span', {
          textContent: this.formatDate(session.updatedAt),
        });
        (timeLabel as HTMLElement).style.cssText = `
          font-family: var(--cc-font-body, 'Archivo', sans-serif);
          font-size: 10px;
          color: var(--cc-text-muted, #475569);
          flex-shrink: 0;
        `;
        sessionRow.appendChild(timeLabel);

        // Delete button
        const deleteBtn = createElement('button', {
          className: 'delete-btn p-1 rounded transition-all',
          innerHTML: `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          `,
        });
        (deleteBtn as HTMLElement).style.cssText = `
          opacity: 0;
          color: var(--cc-text-muted, #475569);
          flex-shrink: 0;
        `;
        deleteBtn.addEventListener('mouseenter', () => {
          (deleteBtn as HTMLElement).style.color = '#ef4444';
          (deleteBtn as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)';
        });
        deleteBtn.addEventListener('mouseleave', () => {
          (deleteBtn as HTMLElement).style.color = 'var(--cc-text-muted, #475569)';
          (deleteBtn as HTMLElement).style.background = 'transparent';
        });
        this.addListener(deleteBtn, 'click', async (e: Event) => {
          e.stopPropagation();
          await this.deleteSession(session.id);
        });
        sessionRow.appendChild(deleteBtn);

        dropdown.appendChild(sessionRow);
      }
    } else {
      const emptyState = createElement('div', {
        className: 'px-4 py-8 text-center',
      });
      (emptyState as HTMLElement).style.cssText = `
        font-family: var(--cc-font-body, 'Archivo', sans-serif);
        font-size: 12px;
        color: var(--cc-text-muted, #475569);
      `;
      emptyState.textContent = 'No chat history yet';
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

  private async deleteSession(sessionId: string): Promise<void> {
    try {
      await api.chat.deleteSession.mutate({ sessionId });

      // Remove from local state
      this.sessions = this.sessions.filter(s => s.id !== sessionId);

      // If we deleted the current session, clear it
      if (this.sessionId === sessionId) {
        this.sessionId = null;
        this.messages = [];
      }

      this.render();
    } catch (error) {
      console.error('[ChatSidebar] Failed to delete session:', error);
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
