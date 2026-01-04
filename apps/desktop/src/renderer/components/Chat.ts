/**
 * Chat Component
 * Multi-provider chat with API key management and session history
 */

import { Component } from './Component';
import { createElement, clearChildren } from '../utils/dom';
import { 
  hasApiKeyForProvider, 
  encryptApiKeyForProvider, 
  decryptApiKeyForProvider, 
  clearApiKeyForProvider 
} from '../utils/crypto';
import { api } from '../api';
import { 
  type Provider, 
  PROVIDERS, 
  getProviderIds,
  getProviderConfig,
  validateApiKey 
} from '../utils/providers';
import { getChatStateManager, type ChatStateManager } from '../utils/chat-state';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Chat extends Component {
  private messages: ChatMessage[] = [];
  private isStreaming = false;
  private apiKeyExists = false;
  private messagesContainer: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private apiUrl = 'http://localhost:3000';
  private settingsModal: HTMLElement | null = null;
  
  // Chat history state
  private sessions: ChatSession[] = [];
  private currentSessionId: string | null = null;
  private expandedSessionId: string | null = null;
  private showHistory = true;

  // Multi-provider state
  private stateManager: ChatStateManager;
  private currentProvider: Provider = 'openrouter';

  async init(): Promise<void> {
    // Initialize state manager
    this.stateManager = getChatStateManager();
    this.currentProvider = this.stateManager.getProvider();

    // Get API URL from server port
    if (typeof window !== 'undefined' && window.serverApi) {
      try {
        const port = await window.serverApi.getPort();
        if (port) {
          this.apiUrl = `http://localhost:${port}`;
        }
      } catch (error) {
        console.warn('[Chat] Failed to get server port:', error);
      }
    }

    this.apiKeyExists = hasApiKeyForProvider(this.currentProvider);
    
    // Load chat sessions
    await this.loadSessions();
    
    this.render();
  }
  
  private async loadSessions(): Promise<void> {
    try {
      const result = await api.chat.getSessions.query({ limit: 50 });
      this.sessions = result.sessions.map(s => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));
    } catch (error) {
      console.error('[Chat] Failed to load sessions:', error);
    }
  }

  render(): void {
    this.container.innerHTML = '';

    if (!this.apiKeyExists) {
      this.renderApiKeyPrompt();
    } else {
      this.renderChatInterface();
    }
  }

  private renderApiKeyPrompt(): void {
    const providerConfig = getProviderConfig(this.currentProvider);
    
    const wrapper = createElement('div', {
      className: 'flex flex-col items-center justify-center w-full h-full gap-6 p-8',
    });

    // Terminal-style header
    const header = createElement('div', {
      className: 'flex flex-col items-center gap-4 text-center',
    });

    // Key icon in terminal style
    const icon = createElement('div', {
      className: 'w-16 h-16 border border-border flex items-center justify-center bg-card',
      innerHTML: `<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>`,
    });
    header.appendChild(icon);

    const title = createElement('h2', {
      className: 'text-lg font-mono uppercase tracking-wider text-foreground',
      textContent: `${providerConfig.displayName} API Key Required`,
    });
    header.appendChild(title);

    const description = createElement('p', {
      className: 'text-sm text-muted-foreground font-mono',
      textContent: `Encrypted and stored locally. ${providerConfig.keyHint}`,
    });
    header.appendChild(description);

    wrapper.appendChild(header);

    // Provider selector
    const providerSelector = this.createProviderSelector();
    wrapper.appendChild(providerSelector);

    // Input form
    const form = createElement('div', {
      className: 'flex flex-col gap-3 w-full max-w-md',
    });

    const input = createElement('input', {
      className: 'w-full px-4 py-3 bg-card border border-border text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary',
      attributes: {
        type: 'password',
        placeholder: providerConfig.keyPrefix ? `${providerConfig.keyPrefix}...` : 'Enter API key...',
        autocomplete: 'off',
      },
    });
    form.appendChild(input);

    // Validation message
    const validationMsg = createElement('p', {
      className: 'text-xs text-destructive font-mono hidden',
      attributes: { id: 'validation-msg' },
    });
    form.appendChild(validationMsg);

    const button = createElement('button', {
      className: 'w-full px-4 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm border border-border hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      textContent: 'Save API Key',
    });

    // Handle save
    const handleSave = async () => {
      const apiKey = (input as HTMLInputElement).value.trim();
      if (!apiKey) return;

      // Validate key format
      const validation = validateApiKey(apiKey, this.currentProvider);
      if (!validation.valid) {
        validationMsg.textContent = validation.error || 'Invalid API key';
        validationMsg.classList.remove('hidden');
        return;
      }

      validationMsg.classList.add('hidden');
      button.setAttribute('disabled', 'true');
      button.textContent = 'ENCRYPTING...';

      try {
        await encryptApiKeyForProvider(apiKey, this.currentProvider);
        this.apiKeyExists = true;
        this.render();
      } catch (error) {
        console.error('Failed to save API key:', error);
        button.removeAttribute('disabled');
        button.textContent = 'Save API Key';
      }
    };

    button.addEventListener('click', handleSave);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSave();
    });

    form.appendChild(button);
    wrapper.appendChild(form);

    this.container.appendChild(wrapper);

    // Focus input
    setTimeout(() => (input as HTMLInputElement).focus(), 100);
  }

  private createProviderSelector(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'flex items-center gap-2 mb-4',
    });

    const label = createElement('span', {
      className: 'text-xs font-mono text-muted-foreground uppercase tracking-wider',
      textContent: 'Provider:',
    });
    wrapper.appendChild(label);

    const select = createElement('select', {
      className: 'bg-card border border-border text-foreground font-mono text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer',
    }) as HTMLSelectElement;

    getProviderIds().forEach(providerId => {
      const config = getProviderConfig(providerId);
      const option = createElement('option', {
        attributes: { value: providerId },
        textContent: config.displayName,
      }) as HTMLOptionElement;
      if (providerId === this.currentProvider) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      this.currentProvider = select.value as Provider;
      this.stateManager.setProvider(this.currentProvider);
      this.apiKeyExists = hasApiKeyForProvider(this.currentProvider);
      this.render();
    });

    wrapper.appendChild(select);
    return wrapper;
  }

  private renderChatInterface(): void {
    this.container.innerHTML = '';

    const wrapper = createElement('div', {
      className: 'flex flex-col w-full h-full relative',
    });
    
    // If showing history and we have sessions, show history view
    if (this.showHistory && this.sessions.length > 0 && this.messages.length === 0) {
      this.renderHistoryView(wrapper);
      this.container.appendChild(wrapper);
      return;
    }

    // Messages area
    this.messagesContainer = createElement('div', {
      className: 'flex-1 p-6 overflow-y-auto',
    });

    // Welcome message if no messages
    if (this.messages.length === 0) {
      const welcome = createElement('div', {
        className: 'flex flex-col items-center justify-center h-full gap-4 text-center',
      });

      const welcomeIcon = createElement('div', {
        className: 'w-12 h-12 border border-border flex items-center justify-center bg-card',
        innerHTML: `<svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>`,
      });
      welcome.appendChild(welcomeIcon);

      const welcomeText = createElement('p', {
        className: 'text-muted-foreground font-mono text-sm uppercase tracking-wider',
        textContent: 'Start a conversation',
      });
      welcome.appendChild(welcomeText);

      // Settings button
      const settingsButton = createElement('button', {
        className: 'text-xs text-muted-foreground font-mono uppercase tracking-wider hover:text-foreground transition-colors mt-4 border-b border-transparent hover:border-muted-foreground',
        textContent: '[Settings]',
      });
      settingsButton.addEventListener('click', () => {
        this.showSettingsModal();
      });
      welcome.appendChild(settingsButton);

      this.messagesContainer.appendChild(welcome);
    } else {
      // Render messages
      this.renderMessages();
    }

    wrapper.appendChild(this.messagesContainer);

    // Input area - at bottom of wrapper
    const inputArea = createElement('div', {
      className: 'sticky bottom-0 bg-background p-4 border-t border-border',
    });

    const inputContainer = createElement('div', {
      className: 'max-w-4xl mx-auto',
    });

    // Provider/Model row
    const controlsRow = this.createInlinProviderControls();
    inputContainer.appendChild(controlsRow);

    const inputWrapper = createElement('div', {
      className: 'flex items-center gap-2 mt-2',
    });

    this.inputElement = createElement('input', {
      className: 'flex-1 px-4 py-3 bg-card border border-border font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary',
      attributes: {
        type: 'text',
        placeholder: '> Type a message...',
      },
    }) as HTMLInputElement;

    if (this.isStreaming) {
      this.inputElement.disabled = true;
      this.inputElement.placeholder = 'Waiting for response...';
    }

    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.isStreaming) {
        this.sendMessage();
      }
    });

    const sendButton = createElement('button', {
      className: 'px-4 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm border border-border hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      textContent: 'Send',
    });

    if (this.isStreaming) {
      sendButton.setAttribute('disabled', 'true');
    }

    sendButton.addEventListener('click', () => {
      if (!this.isStreaming) {
        this.sendMessage();
      }
    });

    inputWrapper.appendChild(this.inputElement);
    inputWrapper.appendChild(sendButton);
    inputContainer.appendChild(inputWrapper);
    inputArea.appendChild(inputContainer);
    wrapper.appendChild(inputArea);

    this.container.appendChild(wrapper);

    // Focus input
    if (!this.isStreaming) {
      setTimeout(() => this.inputElement?.focus(), 100);
    }
  }

  private createInlinProviderControls(): HTMLElement {
    const row = createElement('div', {
      className: 'flex items-center gap-3 text-xs font-mono text-muted-foreground',
    });

    // Provider selector
    const providerWrapper = createElement('div', {
      className: 'flex items-center gap-1.5',
    });
    
    const providerLabel = createElement('span', {
      className: 'uppercase tracking-wider',
      textContent: 'Provider:',
    });
    providerWrapper.appendChild(providerLabel);

    const providerSelect = createElement('select', {
      className: 'bg-transparent text-foreground focus:outline-none cursor-pointer',
    }) as HTMLSelectElement;

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

    providerSelect.addEventListener('change', () => {
      this.currentProvider = providerSelect.value as Provider;
      this.stateManager.setProvider(this.currentProvider);
      this.apiKeyExists = hasApiKeyForProvider(this.currentProvider);
      if (!this.apiKeyExists) {
        this.render();
      } else {
        // Just re-render the controls
        this.render();
      }
    });

    providerWrapper.appendChild(providerSelect);
    row.appendChild(providerWrapper);

    // Separator
    const sep = createElement('span', {
      className: 'text-border',
      textContent: '|',
    });
    row.appendChild(sep);

    // Model selector
    const modelWrapper = createElement('div', {
      className: 'flex items-center gap-1.5',
    });
    
    const modelLabel = createElement('span', {
      className: 'uppercase tracking-wider',
      textContent: 'Model:',
    });
    modelWrapper.appendChild(modelLabel);

    const modelSelect = createElement('select', {
      className: 'bg-transparent text-foreground focus:outline-none cursor-pointer max-w-[200px]',
    }) as HTMLSelectElement;

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

    modelSelect.addEventListener('change', () => {
      this.stateManager.setModel(this.currentProvider, modelSelect.value);
    });

    modelWrapper.appendChild(modelSelect);
    row.appendChild(modelWrapper);

    // Settings link
    const settingsLink = createElement('button', {
      className: 'ml-auto hover:text-foreground transition-colors',
      textContent: '[Settings]',
    });
    settingsLink.addEventListener('click', () => this.showSettingsModal());
    row.appendChild(settingsLink);

    return row;
  }

  private renderMessages(): void {
    if (!this.messagesContainer) return;

    // Clear existing messages but keep container
    this.messagesContainer.innerHTML = '';

    for (const message of this.messages) {
      const msgEl = this.createMessageElement(message);
      this.messagesContainer.appendChild(msgEl);
    }

    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private createMessageElement(message: ChatMessage): HTMLElement {
    const isUser = message.role === 'user';

    const wrapper = createElement('div', {
      className: `flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`,
    });

    if (isUser) {
      // User messages: clean, right-aligned
      const bubble = createElement('div', {
        className: 'max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-md bg-primary text-primary-foreground shadow-sm',
      });

      const content = createElement('div', {
        className: 'text-sm leading-relaxed',
        textContent: message.content,
      });
      bubble.appendChild(content);
      wrapper.appendChild(bubble);
    } else {
      // Assistant messages: left-aligned with subtle styling
      const messageContainer = createElement('div', {
        className: 'max-w-[75%] flex gap-2 items-start',
      });

      // Avatar
      const avatar = createElement('div', {
        className: 'w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1',
        innerHTML: `<svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>`,
      });
      messageContainer.appendChild(avatar);

      // Content
      const contentWrapper = createElement('div', {
        className: 'flex-1',
      });

      const bubble = createElement('div', {
        className: 'px-4 py-3 rounded-2xl rounded-tl-md bg-secondary/50 border border-border/50 shadow-sm',
      });

      // Parse content for tool usage indicators
      if (message.content.includes('[Using tool:')) {
        this.renderMessageWithTools(bubble, message.content);
      } else {
        const content = createElement('div', {
          className: 'text-sm leading-relaxed',
          textContent: message.content,
        });
        bubble.appendChild(content);
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
        // Regular text content
        const textContent = createElement('div', {
          className: 'text-sm leading-relaxed',
          textContent: part,
        });
        bubble.appendChild(textContent);
      }
    }
  }

  private createToolIndicator(toolName: string): HTMLElement {
    // Icon and label based on tool name
    let icon = '🔧';
    let label = toolName;
    let bgColor = 'bg-blue-500/5';
    let borderColor = 'border-blue-500/20';
    let textColor = 'text-blue-600';

    if (toolName === 'searchItems') {
      icon = '🔍';
      label = 'Searching your data';
      bgColor = 'bg-purple-500/5';
      borderColor = 'border-purple-500/20';
      textColor = 'text-purple-600';
    } else if (toolName.startsWith('obsidian_')) {
      icon = '📝';
      if (toolName === 'obsidian_list_notes') label = 'Listing notes';
      else if (toolName === 'obsidian_read_note') label = 'Reading note';
      else if (toolName === 'obsidian_create_note') label = 'Creating note';
      else if (toolName === 'obsidian_update_note') label = 'Updating note';
      else if (toolName === 'obsidian_search') label = 'Searching notes';
      else label = 'Obsidian';
      bgColor = 'bg-green-500/5';
      borderColor = 'border-green-500/20';
      textColor = 'text-green-600';
    }

    const indicator = createElement('div', {
      className: `flex items-center gap-2 px-3 py-2 my-2 rounded-lg border ${bgColor} ${borderColor}`,
    });

    const iconSpan = createElement('span', {
      className: 'text-base',
      textContent: icon,
    });
    indicator.appendChild(iconSpan);

    const labelSpan = createElement('span', {
      className: `text-xs font-medium ${textColor}`,
      textContent: label,
    });
    indicator.appendChild(labelSpan);

    return indicator;
  }

  private async sendMessage(): Promise<void> {
    if (!this.inputElement || this.isStreaming) return;

    const content = this.inputElement.value.trim();
    if (!content) return;

    // Add user message
    this.messages.push({ role: 'user', content });
    this.inputElement.value = '';

    // Re-render to show user message
    this.renderChatInterface();
    this.renderMessages();

    // Get API key
    const apiKey = await decryptApiKeyForProvider(this.currentProvider);
    if (!apiKey) {
      this.messages.push({
        role: 'assistant',
        content: 'Error: Could not retrieve API key. Please re-enter your key.'
      });
      clearApiKeyForProvider(this.currentProvider);
      this.apiKeyExists = false;
      this.render();
      return;
    }

    // Start streaming
    this.isStreaming = true;
    if (this.inputElement) {
      this.inputElement.setAttribute('disabled', 'true');
      this.inputElement.placeholder = 'Waiting for response...';
    }

    // Add empty assistant message for streaming
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    this.messages.push(assistantMessage);
    this.renderMessages();

    try {
      const endpoint = this.stateManager.getEndpoint(this.currentProvider, this.getServerPort());
      const model = this.stateManager.getModel(this.currentProvider);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: this.messages.slice(0, -1).map(m => ({
            role: m.role,
            content: m.content,
          })),
          model,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const providerName = getProviderConfig(this.currentProvider).displayName;
        throw new Error(errorData.error || `${providerName} HTTP ${response.status}`);
      }

      // Stream response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantMessage.content += chunk;

        // Update the last message bubble
        this.updateLastMessageContent(assistantMessage.content);
      }

    } catch (error) {
      console.error('Chat error:', error);
      assistantMessage.content = `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`;
      this.updateLastMessageContent(assistantMessage.content);
    } finally {
      this.isStreaming = false;
      if (this.inputElement) {
        this.inputElement.removeAttribute('disabled');
        this.inputElement.placeholder = '> Type a message...';
        this.inputElement.focus();
      }
    }
  }

  private getServerPort(): number {
    // Extract port from apiUrl
    const match = this.apiUrl.match(/:(\d+)/);
    return match ? parseInt(match[1], 10) : 3000;
  }

  private showSettingsModal(): void {
    // Remove existing modal if any
    this.settingsModal?.remove();

    // Create modal backdrop
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-black/50 backdrop-blur-2xl flex items-center justify-center z-50',
    });

    // Modal container
    const modal = createElement('div', {
      className: 'glass-panel bg-background border border-border rounded-3xl p-6 w-full max-w-lg space-y-4 elevation-3',
    });

    // Title
    const title = createElement('h3', {
      className: 'text-lg font-mono uppercase tracking-wider text-foreground',
      textContent: 'Chat Settings',
    });
    modal.appendChild(title);

    // Tabs
    const tabContainer = createElement('div', {
      className: 'flex gap-1 border-b border-border',
    });

    const providers = getProviderIds();
    let activeTab: Provider = this.currentProvider;

    const tabContent = createElement('div', {
      className: 'pt-4',
    });

    const renderTabContent = () => {
      tabContent.innerHTML = '';
      const config = getProviderConfig(activeTab);
      
      // API Key section
      const keySection = createElement('div', {
        className: 'space-y-2',
      });

      const keyLabel = createElement('label', {
        className: 'block text-sm font-mono text-muted-foreground uppercase tracking-wider',
        textContent: `${config.displayName} API Key`,
      });
      keySection.appendChild(keyLabel);

      const hasKey = hasApiKeyForProvider(activeTab);
      
      const keyInput = createElement('input', {
        className: 'w-full px-4 py-2 bg-card border border-border text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary',
        attributes: {
          type: 'password',
          placeholder: hasKey ? '••••••••••••••••' : (config.keyPrefix ? `${config.keyPrefix}...` : 'Enter API key...'),
        },
      }) as HTMLInputElement;
      keySection.appendChild(keyInput);

      // Key hint
      const keyHint = createElement('p', {
        className: 'text-xs text-muted-foreground font-mono',
        textContent: config.keyHint,
      });
      keySection.appendChild(keyHint);

      // Validation message
      const validationMsg = createElement('p', {
        className: 'text-xs text-destructive font-mono hidden',
      });
      keySection.appendChild(validationMsg);

      tabContent.appendChild(keySection);

      // Model section
      const modelSection = createElement('div', {
        className: 'space-y-2 mt-4',
      });

      const modelLabel = createElement('label', {
        className: 'block text-sm font-mono text-muted-foreground uppercase tracking-wider',
        textContent: 'Model',
      });
      modelSection.appendChild(modelLabel);

      const modelSelect = createElement('select', {
        className: 'w-full px-4 py-2 bg-card border border-border text-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer',
      }) as HTMLSelectElement;

      const currentModel = this.stateManager.getModel(activeTab);
      config.models.forEach(model => {
        const option = createElement('option', {
          attributes: { value: model.id },
          textContent: `${model.name}${model.contextWindow ? ` (${model.contextWindow})` : ''}`,
        }) as HTMLOptionElement;
        if (model.id === currentModel) {
          option.selected = true;
        }
        modelSelect.appendChild(option);
      });

      modelSection.appendChild(modelSelect);
      tabContent.appendChild(modelSection);

      // Status indicator
      const statusSection = createElement('div', {
        className: 'flex items-center gap-2 mt-4 pt-4 border-t border-border',
      });

      const statusDot = createElement('div', {
        className: `w-2 h-2 rounded-full ${hasKey ? 'bg-green-500' : 'bg-amber-500'}`,
      });
      statusSection.appendChild(statusDot);

      const statusText = createElement('span', {
        className: 'text-xs font-mono text-muted-foreground',
        textContent: hasKey ? 'API key configured' : 'No API key set',
      });
      statusSection.appendChild(statusText);

      // Clear key button (if key exists)
      if (hasKey) {
        const clearBtn = createElement('button', {
          className: 'ml-auto text-xs font-mono text-muted-foreground hover:text-destructive transition-colors',
          textContent: '[Clear Key]',
        });
        clearBtn.addEventListener('click', () => {
          clearApiKeyForProvider(activeTab);
          if (activeTab === this.currentProvider) {
            this.apiKeyExists = false;
          }
          renderTabContent();
        });
        statusSection.appendChild(clearBtn);
      }

      tabContent.appendChild(statusSection);

      // Save button for this tab
      const saveSection = createElement('div', {
        className: 'flex gap-2 mt-4',
      });

      const saveKeyBtn = createElement('button', {
        className: 'flex-1 px-4 py-2 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm border border-border hover:bg-primary/90 transition-colors',
        textContent: hasKey ? 'Update Key' : 'Save Key',
      });

      saveKeyBtn.addEventListener('click', async () => {
        const newKey = keyInput.value.trim();
        if (!newKey) {
          if (hasKey) {
            // No change needed, just close
            return;
          }
          validationMsg.textContent = 'Please enter an API key';
          validationMsg.classList.remove('hidden');
          return;
        }

        // Validate
        const validation = validateApiKey(newKey, activeTab);
        if (!validation.valid) {
          validationMsg.textContent = validation.error || 'Invalid API key';
          validationMsg.classList.remove('hidden');
          return;
        }

        validationMsg.classList.add('hidden');
        saveKeyBtn.textContent = 'Saving...';
        saveKeyBtn.setAttribute('disabled', 'true');

        try {
          await encryptApiKeyForProvider(newKey, activeTab);
          
          // Save model selection
          this.stateManager.setModel(activeTab, modelSelect.value);

          // Update current state if this is the active provider
          if (activeTab === this.currentProvider) {
            this.apiKeyExists = true;
          }

          renderTabContent();
        } catch (error) {
          console.error('Failed to save API key:', error);
          validationMsg.textContent = 'Failed to save API key';
          validationMsg.classList.remove('hidden');
        }
      });

      saveSection.appendChild(saveKeyBtn);
      tabContent.appendChild(saveSection);
    };

    // Create tabs
    providers.forEach(providerId => {
      const config = getProviderConfig(providerId);
      const tab = createElement('button', {
        className: `px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors ${
          activeTab === providerId
            ? 'text-foreground border-b-2 border-primary -mb-px'
            : 'text-muted-foreground hover:text-foreground'
        }`,
        textContent: config.name,
      });

      tab.addEventListener('click', () => {
        activeTab = providerId;
        // Re-render tabs
        tabContainer.querySelectorAll('button').forEach((btn, idx) => {
          const isActive = providers[idx] === activeTab;
          btn.className = `px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors ${
            isActive
              ? 'text-foreground border-b-2 border-primary -mb-px'
              : 'text-muted-foreground hover:text-foreground'
          }`;
        });
        renderTabContent();
      });

      tabContainer.appendChild(tab);
    });

    modal.appendChild(tabContainer);
    modal.appendChild(tabContent);

    // Initial render
    renderTabContent();

    // Close button
    const closeRow = createElement('div', {
      className: 'flex justify-end pt-4 border-t border-border mt-4',
    });

    const closeBtn = createElement('button', {
      className: 'px-4 py-2 bg-card text-foreground font-mono uppercase tracking-wider text-sm border border-border hover:bg-accent transition-colors',
      textContent: 'Close',
    });
    closeBtn.addEventListener('click', () => {
      backdrop.remove();
      this.settingsModal = null;
      this.render();
    });
    closeRow.appendChild(closeBtn);
    modal.appendChild(closeRow);

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
        this.settingsModal = null;
        this.render();
      }
    });

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this.settingsModal = backdrop;
  }

  private updateLastMessageContent(content: string): void {
    if (!this.messagesContainer) return;

    const bubbles = this.messagesContainer.querySelectorAll('.flex > div');
    const lastBubble = bubbles[bubbles.length - 1];
    if (lastBubble) {
      const contentEl = lastBubble.querySelector('.text-sm.whitespace-pre-wrap');
      if (contentEl) {
        contentEl.textContent = content || '...';
      }
    }

    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  
  private renderHistoryView(wrapper: HTMLElement): void {
    // Header
    const header = createElement('div', {
      className: 'flex items-center justify-between p-4 border-b border-border',
    });
    
    const title = createElement('h2', {
      className: 'font-mono uppercase tracking-wider text-sm',
      textContent: 'Chat History',
    });
    header.appendChild(title);
    
    const newChatBtn = createElement('button', {
      className: 'px-4 py-2 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-xs hover:opacity-90 transition-opacity',
      textContent: 'New Chat',
    });
    newChatBtn.addEventListener('click', () => {
      this.showHistory = false;
      this.messages = [];
      this.currentSessionId = null;
      this.render();
    });
    header.appendChild(newChatBtn);
    
    wrapper.appendChild(header);
    
    // Sessions list
    const sessionsList = createElement('div', {
      className: 'flex-1 overflow-y-auto p-4 space-y-2',
    });
    
    if (this.sessions.length === 0) {
      const emptyState = createElement('div', {
        className: 'flex flex-col items-center justify-center h-full text-center py-12',
      });
      emptyState.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-muted-foreground/30 mb-4">
          <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
        </svg>
        <p class="text-muted-foreground font-mono text-sm">No chat history yet</p>
      `;
      sessionsList.appendChild(emptyState);
    } else {
      for (const session of this.sessions) {
        const sessionCard = this.createSessionCard(session);
        sessionsList.appendChild(sessionCard);
      }
    }
    
    wrapper.appendChild(sessionsList);
    
    // Settings footer
    const footer = createElement('div', {
      className: 'p-4 border-t border-border',
    });
    
    const settingsBtn = createElement('button', {
      className: 'text-xs text-muted-foreground font-mono uppercase tracking-wider hover:text-foreground transition-colors',
      textContent: '[Settings]',
    });
    settingsBtn.addEventListener('click', () => this.showSettingsModal());
    footer.appendChild(settingsBtn);
    
    wrapper.appendChild(footer);
  }
  
  private createSessionCard(session: ChatSession): HTMLElement {
    const isExpanded = this.expandedSessionId === session.id;
    
    const card = createElement('div', {
      className: 'border border-border bg-card rounded-lg overflow-hidden',
    });
    
    // Card header (always visible)
    const header = createElement('button', {
      className: 'w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors text-left',
    });
    
    const titleSection = createElement('div', {
      className: 'flex-1 min-w-0',
    });
    
    const titleText = createElement('p', {
      className: 'font-mono text-sm truncate',
      textContent: session.title || 'New conversation',
    });
    titleSection.appendChild(titleText);
    
    const dateText = createElement('p', {
      className: 'text-xs text-muted-foreground font-mono',
      textContent: this.formatDate(session.updatedAt),
    });
    titleSection.appendChild(dateText);
    
    header.appendChild(titleSection);
    
    // Expand icon
    const expandIcon = createElement('div', {
      className: `transition-transform ${isExpanded ? 'rotate-180' : ''}`,
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      `,
    });
    header.appendChild(expandIcon);
    
    header.addEventListener('click', () => this.toggleSessionExpand(session.id));
    card.appendChild(header);
    
    // Expanded content
    if (isExpanded) {
      const content = createElement('div', {
        className: 'border-t border-border p-4 space-y-3 bg-background/50',
      });
      
      // Messages will be loaded here
      const messagesArea = createElement('div', {
        className: 'space-y-2 max-h-64 overflow-y-auto',
        attributes: { id: `session-messages-${session.id}` },
      });
      
      // Loading state
      messagesArea.innerHTML = `
        <div class="text-xs text-muted-foreground font-mono animate-pulse">Loading messages...</div>
      `;
      
      content.appendChild(messagesArea);
      
      // Load messages
      this.loadSessionMessages(session.id, messagesArea);
      
      // Action buttons
      const actions = createElement('div', {
        className: 'flex gap-2 pt-2 border-t border-border',
      });
      
      const continueBtn = createElement('button', {
        className: 'px-3 py-1.5 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-xs hover:opacity-90',
        textContent: 'Continue',
      });
      continueBtn.addEventListener('click', () => this.continueSession(session.id));
      actions.appendChild(continueBtn);
      
      const deleteBtn = createElement('button', {
        className: 'px-3 py-1.5 border border-border font-mono uppercase tracking-wider text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors',
        textContent: 'Delete',
      });
      deleteBtn.addEventListener('click', () => this.deleteSession(session.id));
      actions.appendChild(deleteBtn);
      
      content.appendChild(actions);
      card.appendChild(content);
    }
    
    return card;
  }
  
  private async toggleSessionExpand(sessionId: string): Promise<void> {
    if (this.expandedSessionId === sessionId) {
      this.expandedSessionId = null;
    } else {
      this.expandedSessionId = sessionId;
    }
    this.render();
  }
  
  private async loadSessionMessages(sessionId: string, container: HTMLElement): Promise<void> {
    try {
      const result = await api.chat.getSession.query({ sessionId });
      
      clearChildren(container);
      
      if (result.messages.length === 0) {
        container.innerHTML = `<p class="text-xs text-muted-foreground font-mono">No messages</p>`;
        return;
      }
      
      for (const msg of result.messages) {
        const msgEl = createElement('div', {
          className: `p-2 rounded text-xs font-mono ${msg.role === 'user' ? 'bg-primary/10' : 'bg-muted/50'}`,
        });
        
        const roleLabel = createElement('span', {
          className: 'uppercase tracking-wider text-muted-foreground',
          textContent: msg.role === 'user' ? 'You: ' : 'AI: ',
        });
        msgEl.appendChild(roleLabel);
        
        const content = createElement('span', {
          textContent: msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : ''),
        });
        msgEl.appendChild(content);
        
        container.appendChild(msgEl);
      }
    } catch (error) {
      console.error('[Chat] Failed to load session messages:', error);
      container.innerHTML = `<p class="text-xs text-destructive font-mono">Failed to load messages</p>`;
    }
  }
  
  private async continueSession(sessionId: string): Promise<void> {
    try {
      const result = await api.chat.getSession.query({ sessionId });
      
      this.currentSessionId = sessionId;
      this.messages = result.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      this.showHistory = false;
      this.expandedSessionId = null;
      
      this.render();
    } catch (error) {
      console.error('[Chat] Failed to continue session:', error);
    }
  }
  
  private async deleteSession(sessionId: string): Promise<void> {
    try {
      await api.chat.deleteSession.mutate({ sessionId });
      
      // Remove from local state
      this.sessions = this.sessions.filter(s => s.id !== sessionId);
      
      if (this.expandedSessionId === sessionId) {
        this.expandedSessionId = null;
      }
      
      this.render();
    } catch (error) {
      console.error('[Chat] Failed to delete session:', error);
    }
  }
  
  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

export default Chat;
