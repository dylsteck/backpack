/**
 * Chat Component
 * OpenRouter-powered chat with API key management
 */

import { Component } from './Component';
import { createElement } from '../utils/dom';
import { hasApiKey, encryptApiKey, decryptApiKey, clearApiKey } from '../utils/crypto';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_MODEL = 'mistralai/devstral-2512:free';
const MODEL_STORAGE_KEY = 'cortex-model';

export class Chat extends Component {
  private messages: ChatMessage[] = [];
  private isStreaming = false;
  private apiKeyExists = false;
  private messagesContainer: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private apiUrl = 'http://localhost:3000';
  private settingsModal: HTMLElement | null = null;

  private getModel(): string {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
  }

  private setModel(model: string): void {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  }

  async init(): Promise<void> {
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

    this.apiKeyExists = hasApiKey();
    this.render();
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
      textContent: 'OpenRouter API Key Required',
    });
    header.appendChild(title);

    const description = createElement('p', {
      className: 'text-sm text-muted-foreground font-mono',
      textContent: 'Encrypted and stored locally. Get one from openrouter.ai/keys',
    });
    header.appendChild(description);

    wrapper.appendChild(header);

    // Input form
    const form = createElement('div', {
      className: 'flex flex-col gap-3 w-full max-w-md',
    });

    const input = createElement('input', {
      className: 'w-full px-4 py-3 bg-card border border-border text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary',
      attributes: {
        type: 'password',
        placeholder: 'sk-or-v1-...',
        autocomplete: 'off',
      },
    });
    form.appendChild(input);

    const button = createElement('button', {
      className: 'w-full px-4 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm border border-border hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      textContent: 'Save API Key',
    });

    // Handle save
    const handleSave = async () => {
      const apiKey = (input as HTMLInputElement).value.trim();
      if (!apiKey) return;

      button.setAttribute('disabled', 'true');
      button.textContent = 'ENCRYPTING...';

      try {
        await encryptApiKey(apiKey);
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

  private renderChatInterface(): void {
    this.container.innerHTML = '';

    const wrapper = createElement('div', {
      className: 'flex flex-col w-full h-full relative',
    });

    // Messages area
    this.messagesContainer = createElement('div', {
      className: 'flex-1 p-6 overflow-y-auto space-y-4',
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

    const inputWrapper = createElement('div', {
      className: 'flex items-center gap-2',
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
      className: `flex ${isUser ? 'justify-end' : 'justify-start'}`,
    });

    const bubble = createElement('div', {
      className: `max-w-[80%] px-4 py-3 border border-border ${isUser
        ? 'bg-primary text-primary-foreground'
        : 'bg-card text-foreground'
        }`,
    });

    // Role label
    const roleLabel = createElement('div', {
      className: `text-xs font-mono uppercase tracking-wider mb-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`,
      textContent: isUser ? 'You' : 'Cortex',
    });
    bubble.appendChild(roleLabel);

    const content = createElement('div', {
      className: 'text-sm whitespace-pre-wrap break-words font-mono',
      textContent: message.content,
    });

    bubble.appendChild(content);
    wrapper.appendChild(bubble);

    return wrapper;
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
    const apiKey = await decryptApiKey();
    if (!apiKey) {
      this.messages.push({
        role: 'assistant',
        content: 'Error: Could not retrieve API key. Please re-enter your key.'
      });
      clearApiKey();
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
      const response = await fetch(`${this.apiUrl}/api/chat/openrouter`, {
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
          model: this.getModel(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
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

  private showSettingsModal(): void {
    // Remove existing modal if any
    this.settingsModal?.remove();

    // Create modal backdrop
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
    });

    // Modal container
    const modal = createElement('div', {
      className: 'bg-background border border-border p-6 w-full max-w-md space-y-4',
    });

    // Title
    const title = createElement('h3', {
      className: 'text-lg font-mono uppercase tracking-wider text-foreground',
      textContent: 'Settings',
    });
    modal.appendChild(title);

    // API Key field
    const apiKeyLabel = createElement('label', {
      className: 'block text-sm font-mono text-muted-foreground uppercase tracking-wider',
      textContent: 'OpenRouter API Key',
    });
    modal.appendChild(apiKeyLabel);

    const apiKeyInput = createElement('input', {
      className: 'w-full px-4 py-2 bg-card border border-border text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary mt-1',
      attributes: {
        type: 'password',
        placeholder: 'sk-or-v1-... (leave blank to keep current)',
      },
    }) as HTMLInputElement;
    modal.appendChild(apiKeyInput);

    // Model field
    const modelLabel = createElement('label', {
      className: 'block text-sm font-mono text-muted-foreground uppercase tracking-wider mt-4',
      textContent: 'Model',
    });
    modal.appendChild(modelLabel);

    const modelInput = createElement('input', {
      className: 'w-full px-4 py-2 bg-card border border-border text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary mt-1',
      attributes: {
        type: 'text',
        placeholder: DEFAULT_MODEL,
      },
    }) as HTMLInputElement;
    modelInput.value = this.getModel();
    modal.appendChild(modelInput);

    // Helper text
    const helperText = createElement('p', {
      className: 'text-xs text-muted-foreground font-mono mt-1',
      textContent: 'e.g. openai/gpt-4o, anthropic/claude-3.5-sonnet',
    });
    modal.appendChild(helperText);

    // Buttons
    const buttonRow = createElement('div', {
      className: 'flex gap-2 mt-6',
    });

    const cancelButton = createElement('button', {
      className: 'flex-1 px-4 py-2 bg-card text-foreground font-mono uppercase tracking-wider text-sm border border-border hover:bg-accent transition-colors',
      textContent: 'Cancel',
    });
    cancelButton.addEventListener('click', () => {
      backdrop.remove();
      this.settingsModal = null;
    });
    buttonRow.appendChild(cancelButton);

    const saveButton = createElement('button', {
      className: 'flex-1 px-4 py-2 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm border border-border hover:bg-primary/90 transition-colors',
      textContent: 'Save',
    });
    saveButton.addEventListener('click', async () => {
      // Save API key if provided
      const newApiKey = apiKeyInput.value.trim();
      if (newApiKey) {
        await encryptApiKey(newApiKey);
      }

      // Save model
      const newModel = modelInput.value.trim() || DEFAULT_MODEL;
      this.setModel(newModel);

      backdrop.remove();
      this.settingsModal = null;
    });
    buttonRow.appendChild(saveButton);

    // Clear API key button
    const clearButton = createElement('button', {
      className: 'w-full px-4 py-2 bg-transparent text-muted-foreground font-mono uppercase tracking-wider text-xs border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors mt-2',
      textContent: 'Clear API Key',
    });
    clearButton.addEventListener('click', () => {
      clearApiKey();
      this.apiKeyExists = false;
      this.messages = [];
      backdrop.remove();
      this.settingsModal = null;
      this.render();
    });

    modal.appendChild(buttonRow);
    modal.appendChild(clearButton);

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
}

export default Chat;
