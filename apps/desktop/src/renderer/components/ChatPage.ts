/**
 * ChatPage Component
 * Full-page chat interface accessible from the left sidebar
 */

import '../styles/chat-theme.css';
import { Component } from './Component';
import { createElement, clearChildren, escapeHtml } from '../utils/dom';
import {
    hasApiKeyForProvider,
    encryptApiKeyForProvider,
    decryptApiKeyForProvider,
    clearApiKeyForProvider
} from '../utils/crypto';
import { api } from '../api';
import {
    type Provider,
    getProviderIds,
    getProviderConfig,
    validateApiKey
} from '../utils/providers';
import { getChatStateManager, type ChatStateManager } from '../utils/chat-state';
import { parseMarkdown, setupMarkdownInteractivity } from '../utils/markdown';
import { renderJsonUIFromString, extractJsonRenderBlocks } from '../utils/json-render-mount';
import { getCatalogDescription } from '../utils/chat-ui-catalog';
import { store } from '../store';
import { router } from '../router';

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

export class ChatPage extends Component {
    private messagesContainer: HTMLElement | null = null;
    private inputElement: HTMLTextAreaElement | null = null;
    private messages: ChatMessage[] = [];
    private sessionId: string | null = null;
    private isLoading = false;
    private apiKeyMissing = false;
    private sessions: ChatSession[] = [];
    private apiUrl = 'http://localhost:3000';

    private stateManager!: ChatStateManager;
    private currentProvider: Provider = 'openrouter';
    
    // Flag to prevent multiple transfers when multiple browser tools are called
    private hasTransferredChat = false;

    async init(): Promise<void> {
        this.stateManager = getChatStateManager();
        this.currentProvider = this.stateManager.getProvider();
        this.apiKeyMissing = !hasApiKeyForProvider(this.currentProvider);

        // Get API URL from server port
        if (typeof window !== 'undefined' && window.serverApi) {
            try {
                const port = await window.serverApi.getPort();
                if (port) {
                    this.apiUrl = `http://localhost:${port}`;
                }
            } catch (error) {
                console.warn('[ChatPage] Failed to get server port:', error);
            }
        }

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
            console.error('[ChatPage] Failed to load sessions:', error);
        }
    }

    render(): void {
        this.container.innerHTML = '';
        this.container.className = 'h-full w-full';

        const wrapper = createElement('div', {
            className: 'flex h-full w-full',
        });

        // Main chat area
        const mainArea = createElement('div', {
            className: 'flex-1 flex flex-col h-full',
        });
        (mainArea as HTMLElement).style.cssText = `
      background: var(--cc-gradient-bg);
      max-width: 100%;
      min-width: 0;
    `;

        if (this.apiKeyMissing) {
            this.renderApiKeyPrompt(mainArea);
        } else {
            this.renderChatInterface(mainArea);
        }

        wrapper.appendChild(mainArea);
        this.container.appendChild(wrapper);
    }

    private renderApiKeyPrompt(container: HTMLElement): void {
        const providerConfig = getProviderConfig(this.currentProvider);

        const promptWrapper = createElement('div', {
            className: 'flex flex-col items-center justify-center h-full p-8',
        });

        const card = createElement('div', {
            className: 'w-full max-w-md p-8 rounded-2xl',
        });
        (card as HTMLElement).style.cssText = `
      background: var(--cc-glass-bg);
      border: 1px solid var(--cc-glass-border);
      backdrop-filter: blur(20px);
    `;

        // Icon
        const iconWrapper = createElement('div', {
            className: 'w-14 h-14 rounded-2xl flex items-center justify-center mb-6 mx-auto',
        });
        (iconWrapper as HTMLElement).style.cssText = `
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
    `;
        iconWrapper.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: #6366f1;">
        <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
      </svg>
    `;
        card.appendChild(iconWrapper);

        const title = createElement('h2', {
            className: 'text-lg font-semibold text-center mb-2',
            textContent: `${providerConfig.displayName} API Key`,
        });
        (title as HTMLElement).style.color = 'var(--cc-text-primary)';
        card.appendChild(title);

        const desc = createElement('p', {
            className: 'text-sm text-center mb-6',
            textContent: providerConfig.keyHint,
        });
        (desc as HTMLElement).style.color = 'var(--cc-text-tertiary)';
        card.appendChild(desc);

        // Provider selector
        const providerRow = createElement('div', {
            className: 'flex items-center gap-2 mb-4',
        });
        const providerLabel = createElement('span', {
            className: 'text-xs font-medium',
            textContent: 'Provider',
        });
        (providerLabel as HTMLElement).style.color = 'var(--cc-text-tertiary)';
        providerRow.appendChild(providerLabel);

        const providerSelect = createElement('select', {
            className: 'flex-1 px-3 py-2 rounded-lg text-sm',
        }) as HTMLSelectElement;
        (providerSelect as HTMLElement).style.cssText = `
      background: hsl(var(--muted) / 0.4);
      border: 1px solid hsl(var(--border) / 0.8);
      color: var(--cc-text-primary);
      outline: none;
    `;
        getProviderIds().forEach(id => {
            const config = getProviderConfig(id);
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = config.displayName;
            if (id === this.currentProvider) opt.selected = true;
            providerSelect.appendChild(opt);
        });
        this.addListener(providerSelect, 'change', () => {
            this.currentProvider = providerSelect.value as Provider;
            this.stateManager.setProvider(this.currentProvider);
            this.apiKeyMissing = !hasApiKeyForProvider(this.currentProvider);
            this.render();
        });
        providerRow.appendChild(providerSelect);
        card.appendChild(providerRow);

        // API Key input
        const input = createElement('input', {
            className: 'w-full px-4 py-3 rounded-xl text-sm mb-3',
            attributes: {
                type: 'password',
                placeholder: providerConfig.keyPrefix ? `${providerConfig.keyPrefix}...` : 'Enter API key...',
                autocomplete: 'off',
            },
        }) as HTMLInputElement;
        (input as HTMLElement).style.cssText = `
      background: hsl(var(--muted) / 0.4);
      border: 1px solid hsl(var(--border) / 0.8);
      color: var(--cc-text-primary);
      outline: none;
    `;
        card.appendChild(input);

        const errorMsg = createElement('p', {
            className: 'text-xs mb-3 hidden',
        });
        (errorMsg as HTMLElement).style.color = '#ef4444';
        card.appendChild(errorMsg);

        const saveBtn = createElement('button', {
            className: 'w-full py-3 rounded-xl text-sm font-medium',
            textContent: 'Save & Continue',
        });
        (saveBtn as HTMLElement).style.cssText = `
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
        saveBtn.addEventListener('mouseenter', () => (saveBtn as HTMLElement).style.opacity = '0.9');
        saveBtn.addEventListener('mouseleave', () => (saveBtn as HTMLElement).style.opacity = '1');

        const handleSave = async () => {
            const key = input.value.trim();
            if (!key) return;

            const validation = validateApiKey(key, this.currentProvider);
            if (!validation.valid) {
                errorMsg.textContent = validation.error || 'Invalid key';
                errorMsg.classList.remove('hidden');
                return;
            }

            errorMsg.classList.add('hidden');
            saveBtn.textContent = 'Saving...';
            (saveBtn as HTMLButtonElement).disabled = true;

            try {
                await encryptApiKeyForProvider(key, this.currentProvider);
                this.apiKeyMissing = false;
                this.render();
            } catch (e) {
                console.error('Failed to save key:', e);
                saveBtn.textContent = 'Save & Continue';
                (saveBtn as HTMLButtonElement).disabled = false;
            }
        };

        this.addListener(saveBtn, 'click', handleSave);
        this.addListener(input, 'keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') handleSave();
        });
        card.appendChild(saveBtn);

        promptWrapper.appendChild(card);
        container.appendChild(promptWrapper);
        setTimeout(() => input.focus(), 100);
    }

    private renderChatInterface(container: HTMLElement): void {
        // Header with provider controls
        const header = createElement('div', {
            className: 'px-6 py-4 flex items-center gap-4 shrink-0',
        });
        (header as HTMLElement).style.cssText = `
      border-bottom: 1px solid var(--cc-glass-border);
    `;

        // Provider selector
        const providerWrapper = createElement('div', {
            className: 'flex items-center gap-2',
        });
        const providerSelect = createElement('select', {
            className: 'px-3 py-1.5 rounded-lg text-xs font-medium',
        }) as HTMLSelectElement;
        (providerSelect as HTMLElement).style.cssText = `
      background: hsl(var(--muted) / 0.4);
      border: 1px solid var(--cc-glass-border);
      color: var(--cc-text-secondary);
      outline: none;
    `;
        getProviderIds().forEach(id => {
            const config = getProviderConfig(id);
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = config.displayName;
            if (id === this.currentProvider) opt.selected = true;
            providerSelect.appendChild(opt);
        });
        this.addListener(providerSelect, 'change', () => {
            this.currentProvider = providerSelect.value as Provider;
            this.stateManager.setProvider(this.currentProvider);
            this.apiKeyMissing = !hasApiKeyForProvider(this.currentProvider);
            this.render();
        });
        providerWrapper.appendChild(providerSelect);

        // Model selector
        const modelSelect = createElement('select', {
            className: 'px-3 py-1.5 rounded-lg text-xs font-medium',
        }) as HTMLSelectElement;
        (modelSelect as HTMLElement).style.cssText = `
      background: var(--cc-glass-bg);
      border: 1px solid var(--cc-glass-border);
      color: var(--cc-text-secondary);
      outline: none;
    `;
        const providerConfig = getProviderConfig(this.currentProvider);
        const currentModel = this.stateManager.getModel(this.currentProvider);
        providerConfig.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            if (m.id === currentModel) opt.selected = true;
            modelSelect.appendChild(opt);
        });
        this.addListener(modelSelect, 'change', () => {
            this.stateManager.setModel(this.currentProvider, modelSelect.value);
        });
        providerWrapper.appendChild(modelSelect);
        header.appendChild(providerWrapper);

        // Recent conversations dropdown + New chat button group
        const chatActionsGroup = createElement('div', {
            className: 'ml-auto flex items-center gap-2',
        });

        // Recent conversations dropdown (clock icon)
        let historyDropdownOpen = false;
        const historyButton = createElement('button', {
            className: 'flex items-center justify-center relative',
            attributes: {
                'aria-label': 'Recent chats',
                'aria-expanded': 'false',
            },
        });
        (historyButton as HTMLElement).style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: hsl(var(--muted) / 0.4);
      border: 1px solid var(--cc-glass-border);
      color: var(--cc-text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
        historyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    `;
        historyButton.addEventListener('mouseenter', () => {
            (historyButton as HTMLElement).style.background = 'var(--cc-glass-bg)';
            (historyButton as HTMLElement).style.color = 'var(--cc-text-primary)';
        });
        historyButton.addEventListener('mouseleave', () => {
            (historyButton as HTMLElement).style.background = 'hsl(var(--muted) / 0.4)';
            (historyButton as HTMLElement).style.color = 'var(--cc-text-secondary)';
        });

        // Dropdown menu
        const dropdown = createElement('div', {
            className: 'absolute top-full right-0 mt-1 rounded-lg overflow-hidden shadow-xl z-50',
        });
        (dropdown as HTMLElement).style.cssText = `
      background: hsl(var(--card));
      backdrop-filter: blur(20px);
      border: 1px solid hsl(var(--border) / 0.8);
      min-width: 240px;
      max-width: 320px;
      max-height: 400px;
      overflow-y: auto;
      display: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    `;

        const updateDropdown = () => {
            dropdown.innerHTML = '';
            
            // New chat option
            const newChatOption = createElement('button', {
                className: 'w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-white/5 transition-colors',
            });
            (newChatOption as HTMLElement).style.cssText = `
        border-bottom: 1px solid var(--cc-glass-border);
      `;
            newChatOption.innerHTML = `
        <div style="width: 20px; height: 20px; border-radius: 6px; background: rgba(99, 102, 241, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #6366f1;">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
        <span style="font-size: 13px; font-weight: 500; color: var(--cc-text-primary);">New Chat</span>
      `;
            this.addListener(newChatOption, 'click', () => {
                this.sessionId = null;
                this.messages = [];
                this.hasTransferredChat = false; // Reset transfer flag for new chat
                historyDropdownOpen = false;
                dropdown.style.display = 'none';
                this.render();
            });
            dropdown.appendChild(newChatOption);

            // Recent sessions
            if (this.sessions.length > 0) {
                const recentLabel = createElement('div', {
                    className: 'px-4 py-2',
                });
                (recentLabel as HTMLElement).style.cssText = `
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--cc-text-muted);
        `;
                recentLabel.textContent = 'Recent';
                dropdown.appendChild(recentLabel);

                this.sessions.slice(0, 10).forEach(session => {
                    const sessionRow = createElement('div', {
                        className: 'flex items-center gap-2 px-4 py-2.5 transition-colors group relative',
                    });
                    (sessionRow as HTMLElement).style.cssText = `
                        position: relative;
                    `;
                    
                    // Hover effect for row
                    sessionRow.addEventListener('mouseenter', () => {
                        (sessionRow as HTMLElement).style.background = 'var(--cc-glass-bg)';
                        const deleteBtn = sessionRow.querySelector('.delete-btn') as HTMLElement;
                        if (deleteBtn) deleteBtn.style.opacity = '1';
                    });
                    sessionRow.addEventListener('mouseleave', () => {
                        (sessionRow as HTMLElement).style.background = 'transparent';
                        const deleteBtn = sessionRow.querySelector('.delete-btn') as HTMLElement;
                        if (deleteBtn) deleteBtn.style.opacity = '0';
                    });

                    const isCurrent = this.sessionId === session.id;
                    
                    // Chat button (clickable area for loading session)
                    const chatBtn = createElement('button', {
                        className: 'flex items-center gap-2 flex-1 min-w-0 text-left',
                    });
                    chatBtn.innerHTML = `
            <div style="width: 20px; height: 20px; border-radius: 6px; background: hsl(var(--primary) / 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6366f1;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 13px; font-weight: ${isCurrent ? '600' : '400'}; color: ${isCurrent ? '#6366f1' : 'var(--cc-text-secondary)'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(session.title || 'Untitled chat')}
              </div>
              <div style="font-size: 10px; color: var(--cc-text-muted); margin-top: 2px;">
                ${this.formatRelativeTime(session.updatedAt)}
              </div>
            </div>
          `;
                    this.addListener(chatBtn, 'click', () => {
                        this.loadSession(session.id);
                        historyDropdownOpen = false;
                        dropdown.style.display = 'none';
                    });
                    sessionRow.appendChild(chatBtn);

                    // Delete button (X icon)
                    const deleteBtn = createElement('button', {
                        className: 'delete-btn p-1 rounded transition-all',
                    });
                    deleteBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    `;
                    (deleteBtn as HTMLElement).style.cssText = `
                        opacity: 0;
                        color: var(--cc-text-muted);
                        flex-shrink: 0;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: opacity 0.2s ease, color 0.2s ease, background 0.2s ease;
                    `;
                    deleteBtn.addEventListener('mouseenter', () => {
                        (deleteBtn as HTMLElement).style.color = '#ef4444';
                        (deleteBtn as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)';
                    });
                    deleteBtn.addEventListener('mouseleave', () => {
                        (deleteBtn as HTMLElement).style.color = 'var(--cc-text-muted)';
                        (deleteBtn as HTMLElement).style.background = 'transparent';
                    });
                    this.addListener(deleteBtn, 'click', async (e: Event) => {
                        e.stopPropagation();
                        await this.deleteSession(session.id);
                        // Refresh dropdown after deletion (keep it open)
                        updateDropdown();
                        // Only close dropdown if there are no more sessions
                        if (this.sessions.length === 0) {
                            historyDropdownOpen = false;
                            dropdown.style.display = 'none';
                        }
                    });
                    sessionRow.appendChild(deleteBtn);
                    
                    dropdown.appendChild(sessionRow);
                });
            } else {
                const emptyState = createElement('div', {
                    className: 'px-4 py-8 text-center',
                });
                (emptyState as HTMLElement).style.cssText = `
          font-size: 12px;
          color: var(--cc-text-muted);
        `;
                emptyState.textContent = 'No recent chats';
                dropdown.appendChild(emptyState);
            }
        };

        this.addListener(historyButton, 'click', (e: Event) => {
            e.stopPropagation();
            historyDropdownOpen = !historyDropdownOpen;
            historyButton.setAttribute('aria-expanded', String(historyDropdownOpen));
            if (historyDropdownOpen) {
                updateDropdown();
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e: MouseEvent) => {
            if (!historyButton.contains(e.target as Node) && !dropdown.contains(e.target as Node)) {
                historyDropdownOpen = false;
                historyButton.setAttribute('aria-expanded', 'false');
                dropdown.style.display = 'none';
            }
        });

        const historyWrapper = createElement('div', {
            className: 'relative',
        });
        historyWrapper.appendChild(historyButton);
        historyWrapper.appendChild(dropdown);
        chatActionsGroup.appendChild(historyWrapper);

        // New chat button (plus icon)
        const newChatBtn = createElement('button', {
            className: 'flex items-center justify-center',
            attributes: {
                'aria-label': 'New chat',
            },
        });
        (newChatBtn as HTMLElement).style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: hsl(var(--muted) / 0.4);
      border: 1px solid var(--cc-glass-border);
      color: var(--cc-text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
        newChatBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    `;
        newChatBtn.addEventListener('mouseenter', () => {
            (newChatBtn as HTMLElement).style.background = 'var(--cc-glass-bg)';
            (newChatBtn as HTMLElement).style.color = 'var(--cc-text-primary)';
        });
        newChatBtn.addEventListener('mouseleave', () => {
            (newChatBtn as HTMLElement).style.background = 'hsl(var(--muted) / 0.4)';
            (newChatBtn as HTMLElement).style.color = 'var(--cc-text-secondary)';
        });
        this.addListener(newChatBtn, 'click', () => {
            this.sessionId = null;
            this.messages = [];
            this.hasTransferredChat = false; // Reset transfer flag for new chat
            this.render();
        });
        chatActionsGroup.appendChild(newChatBtn);

        header.appendChild(chatActionsGroup);

        container.appendChild(header);

        // Messages area
        this.messagesContainer = createElement('div', {
            className: 'flex-1 overflow-y-auto px-6 py-6',
        });
        (this.messagesContainer as HTMLElement).style.cssText = `
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
    `;

        if (this.messages.length === 0) {
            this.renderWelcomeState();
        } else {
            this.renderMessages();
        }

        container.appendChild(this.messagesContainer);

        // Input area
        const inputArea = createElement('div', {
            className: 'px-6 py-3 shrink-0',
        });

        const inputWrapper = createElement('div', {
            className: 'max-w-3xl mx-auto flex items-end gap-2.5 px-3.5 py-2.5 rounded-xl',
        });
        (inputWrapper as HTMLElement).style.cssText = `
      background: hsl(var(--muted) / 0.3);
      border: 1px solid hsl(var(--border) / 0.5);
      backdrop-filter: blur(8px);
    `;

        this.inputElement = createElement('textarea', {
            className: 'flex-1 bg-transparent resize-none outline-none min-h-[20px] max-h-28',
            attributes: {
                placeholder: 'Message...',
                rows: '1',
            },
        }) as HTMLTextAreaElement;
        (this.inputElement as HTMLElement).style.cssText = `
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
      font-size: 14px;
      font-weight: 400;
      color: var(--cc-text-primary);
      line-height: 1.5;
      letter-spacing: -0.01em;
    `;
        // Add placeholder styling via CSS
        setTimeout(() => {
            const styleId = 'chat-input-placeholder-style';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
          textarea[placeholder="Message..."]::placeholder {
            color: var(--cc-text-muted);
            opacity: 0.6;
            font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
            font-weight: 400;
            letter-spacing: -0.01em;
          }
        `;
                document.head.appendChild(style);
            }
        }, 0);

        this.addListener(this.inputElement, 'input', () => {
            if (this.inputElement) {
                this.inputElement.style.height = 'auto';
                this.inputElement.style.height = Math.min(this.inputElement.scrollHeight, 112) + 'px';
            }
        });

        this.addListener(this.inputElement, 'keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.isLoading) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        inputWrapper.appendChild(this.inputElement);

        const sendBtn = createElement('button', {
            className: 'p-2 rounded-lg shrink-0',
            attributes: {
                'aria-label': 'Send message',
            },
        });
        (sendBtn as HTMLElement).style.cssText = `
      background: hsl(var(--primary));
      color: white;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    `;
        sendBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
      </svg>
    `;
        sendBtn.addEventListener('mouseenter', () => {
            (sendBtn as HTMLElement).style.background = 'hsl(var(--primary) / 0.9)';
            (sendBtn as HTMLElement).style.transform = 'scale(1.05)';
        });
        sendBtn.addEventListener('mouseleave', () => {
            (sendBtn as HTMLElement).style.background = 'hsl(var(--primary))';
            (sendBtn as HTMLElement).style.transform = 'scale(1)';
        });
        this.addListener(sendBtn, 'click', () => {
            if (!this.isLoading) this.sendMessage();
        });
        inputWrapper.appendChild(sendBtn);

        inputArea.appendChild(inputWrapper);
        container.appendChild(inputArea);

        setTimeout(() => this.inputElement?.focus(), 100);
    }

    private renderWelcomeState(): void {
        if (!this.messagesContainer) return;

        const welcome = createElement('div', {
            className: 'flex items-center justify-center h-full',
        });
        (welcome as HTMLElement).style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

        const title = createElement('h2', {
            className: 'text-2xl font-semibold',
            textContent: 'Chat',
        });
        (title as HTMLElement).style.cssText = `
      color: var(--cc-text-primary);
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    `;
        welcome.appendChild(title);

        this.messagesContainer.appendChild(welcome);
    }

    private renderMessages(): void {
        if (!this.messagesContainer) return;
        this.messagesContainer.innerHTML = '';

        const messagesWrapper = createElement('div', {
            className: 'max-w-3xl mx-auto space-y-4',
        });

        for (const msg of this.messages) {
            const msgEl = this.createMessageElement(msg);
            messagesWrapper.appendChild(msgEl);
        }

        this.messagesContainer.appendChild(messagesWrapper);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        // Render UI blocks for loaded messages
        this.renderJsonUIBlocks(messagesWrapper);
    }

    private createMessageElement(message: ChatMessage): HTMLElement {
        const isUser = message.role === 'user';

        const wrapper = createElement('div', {
            className: `flex ${isUser ? 'justify-end' : 'justify-start'}`,
        });

        const bubble = createElement('div', {
            className: 'max-w-[85%] px-4 py-3 rounded-2xl',
        });

        if (isUser) {
            (bubble as HTMLElement).style.cssText = `
        background: linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary) / 0.12) 100%);
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-bottom-right-radius: 6px;
      `;
        } else {
            (bubble as HTMLElement).style.cssText = `
        background: var(--cc-glass-bg);
        border: 1px solid var(--cc-glass-border);
        border-bottom-left-radius: 6px;
      `;
        }

        const content = createElement('div', {
            className: 'text-sm leading-relaxed',
        });
        (content as HTMLElement).style.color = isUser ? 'var(--cc-text-primary)' : 'var(--cc-text-secondary)';

        // Parse markdown for assistant messages
        if (!isUser) {
            if (!message.content || message.content.trim() === '') {
                // Show loading indicator when content is empty
                content.innerHTML = `
                    <div class="flex items-center gap-2 text-muted-foreground">
                        <div class="flex gap-1">
                            <div class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style="animation-delay: 0ms;"></div>
                            <div class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style="animation-delay: 150ms;"></div>
                            <div class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style="animation-delay: 300ms;"></div>
                        </div>
                        <span class="text-xs" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);">Thinking...</span>
                    </div>
                `;
            } else {
                content.innerHTML = parseMarkdown(message.content);
                setTimeout(() => setupMarkdownInteractivity(content), 0);
            }
        } else {
            content.textContent = message.content;
        }

        bubble.appendChild(content);
        wrapper.appendChild(bubble);

        return wrapper;
    }

    private async sendMessage(): Promise<void> {
        if (!this.inputElement || this.isLoading) return;

        const content = this.inputElement.value.trim();
        if (!content) return;

        // Add user message
        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
            createdAt: new Date(),
        };
        this.messages.push(userMsg);
        this.inputElement.value = '';
        this.inputElement.style.height = '20px';

        this.renderMessages();

        // Get API key
        const apiKey = await decryptApiKeyForProvider(this.currentProvider);
        if (!apiKey) {
            this.messages.push({
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Error: Could not retrieve API key.',
                createdAt: new Date(),
            });
            clearApiKeyForProvider(this.currentProvider);
            this.apiKeyMissing = true;
            this.render();
            return;
        }

        this.isLoading = true;

        // Add placeholder for assistant
        const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            createdAt: new Date(),
        };
        this.messages.push(assistantMsg);
        this.renderMessages();

        try {
            const endpoint = this.stateManager.getEndpoint(this.currentProvider, this.getServerPort());
            // Add system prompt for json-render
            const model = this.stateManager.getModel(this.currentProvider);

            const messages = this.messages.slice(0, -1).map(m => ({
                role: m.role,
                content: m.content,
            }));

            // Inject catalog description into system prompt or last user message?
            // Simplified: Add a system message context about available UI components
            const systemContext = `
You can generate interactive UIs using json-render.
${getCatalogDescription()}
To render a UI, output a JSON block with language 'json-ui' or 'jsonui'.
Example:
\`\`\`json-ui
{
  "root": "card",
  "elements": {
    "card": { "key": "card", "type": "StatCard", "props": { "title": "Sales", "valuePath": "/sales", "color": "green" } }
  }
}
\`\`\`
Always ensure the JSON is valid and follows the UITree structure.
`;

            // Prepend system message if not present (simple hack for now)
            // Or just prepend to the request
            const requestMessages = [
                { role: 'system', content: systemContext },
                ...messages
            ];

            console.log('[ChatPage] Sending request to:', endpoint);
            console.log('[ChatPage] Request messages count:', requestMessages.length);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    messages: requestMessages,
                    model,
                }),
            });

            console.log('[ChatPage] Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[ChatPage] Response error:', errorData);
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                console.error('[ChatPage] No response body reader available');
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let hasReceivedData = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[ChatPage] Stream complete. Final content length:', assistantMsg.content.length);
                    break;
                }

                hasReceivedData = true;
                const chunk = decoder.decode(value, { stream: true });
                assistantMsg.content += chunk;
                this.updateLastMessage(assistantMsg.content, false);
            }

            if (!hasReceivedData && assistantMsg.content === '') {
                console.warn('[ChatPage] No data received from stream');
                assistantMsg.content = 'No response received from the server. Please try again.';
            }

            // Final update with completion flag
            this.updateLastMessage(assistantMsg.content, true);

            // Auto-save generated blocks
            const blocks = extractJsonRenderBlocks(assistantMsg.content);
            for (const block of blocks) {
                if (this.sessionId) {
                    // Try to parse to ensure it's valid
                    try {
                        JSON.parse(block.json);
                        await api.chat.saveUIBlock.mutate({
                            sessionId: this.sessionId,
                            messageId: assistantMsg.id,
                            uiJson: block.json,
                            title: 'Generated UI',
                        });
                    } catch (e) {
                        console.warn('Failed to save invalid UI block', e);
                    }
                }
            }

        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to get response';
            assistantMsg.content = `Error: ${errorMessage}`;
            this.updateLastMessage(assistantMsg.content, true);
            
            // Log more details for debugging
            if (error instanceof Error) {
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                });
            }
        } finally {
            this.isLoading = false;
            this.inputElement?.focus();
        }
    }

    private updateLastMessage(content: string, isComplete: boolean = false): void {
        if (!this.messagesContainer) return;

        // Check for browser tool calls and transfer chat to sidebar if on /chat
        // Transfer BEFORE the tool executes to ensure browser is ready
        if (this.detectBrowserToolCall(content) && router.getCurrentPath() === '/chat' && !this.hasTransferredChat) {
            // Transfer immediately when browser tool is detected (await to ensure navigation completes)
            this.transferChatToSidebar().catch(err => {
                console.error('[ChatPage] Failed to transfer chat to sidebar:', err);
            });
        }

        const bubbles = this.messagesContainer.querySelectorAll('[class*="justify-start"]');
        const lastBubble = bubbles[bubbles.length - 1];
        if (lastBubble) {
            const contentEl = lastBubble.querySelector('.text-sm');
            if (contentEl) {
                // Show loading indicator if content is empty, otherwise show parsed content
                if (!content || content.trim() === '') {
                    (contentEl as HTMLElement).innerHTML = `
                        <div class="flex items-center gap-2 text-muted-foreground">
                            <div class="flex gap-1">
                                <div class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style="animation-delay: 0ms;"></div>
                                <div class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style="animation-delay: 150ms;"></div>
                                <div class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style="animation-delay: 300ms;"></div>
                            </div>
                            <span class="text-xs" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);">Thinking...</span>
                        </div>
                    `;
                } else {
                    (contentEl as HTMLElement).innerHTML = parseMarkdown(content);
                    setupMarkdownInteractivity(contentEl as HTMLElement);

                    if (isComplete) {
                        this.renderJsonUIBlocks(contentEl as HTMLElement);
                    }
                }
            }
        }

        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * Detect if content contains browser tool calls
     */
    private detectBrowserToolCall(content: string): boolean {
        const browserToolPatterns = [
            /\[TOOL_START:browser_/i,
            /\[Using tool: browser_/i,
            /browser_navigate/i,
            /browser_click/i,
            /browser_screenshot/i,
            /browser_snapshot/i,
            /browser_fill/i,
            /browser_wait/i,
            /browser_evaluate/i,
        ];
        return browserToolPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Transfer current chat session to the sidebar and navigate to browser
     */
    private async transferChatToSidebar(): Promise<void> {
        if (this.hasTransferredChat) return;
        this.hasTransferredChat = true;

        // Store chat state for sidebar to pick up
        store.chatSessionTransfer.set({
            sessionId: this.sessionId,
            messages: this.messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.createdAt,
            })),
            provider: this.currentProvider,
            model: this.stateManager.getModel(this.currentProvider),
        });

        // Open sidebar first
        store.chatSidebarOpen.set(true);
        
        // Navigate to browser route immediately
        router.navigate('/browser');
        
        // Wait for navigation, browser component initialization, and ensure tabs are ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Ensure browser has at least one tab before proceeding
        if (window.browser) {
          let attempts = 0;
          while (attempts < 20) {
            try {
              const tabs = await window.browser.getAllTabs();
              if (tabs && tabs.length > 0) {
                break;
              }
            } catch (e) {
              // Browser not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
        }
        
        // Final wait for layout to stabilize
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    private renderJsonUIBlocks(container: HTMLElement): void {
        const codeBlocks = container.querySelectorAll('code.language-json-ui, code.language-jsonui');

        codeBlocks.forEach((block, index) => {
            const jsonString = block.textContent || '';
            const pre = block.parentElement;

            if (pre && jsonString.trim()) {
                const blockId = `ui-block-${Date.now()}-${index}`;

                const uiContainer = createElement('div', {
                    attributes: { id: blockId },
                    className: 'my-4 rounded-xl overflow-hidden border min-h-[100px]',
                });
                (uiContainer as HTMLElement).style.cssText = `
                    border-color: hsl(var(--border) / 0.6);
                    background: hsl(var(--muted) / 0.2);
                `;

                // Keep original code in a hidden attribute/element just in case? 
                // Replacing triggers unmount of previous.
                pre.replaceWith(uiContainer);

                // Add default data context (could be enhanced)
                const dataContext = {
                    sales: 15420,
                    revenue: 450000,
                    users: 1250,
                    growth: 0.15,
                    timestamp: new Date().toISOString()
                };

                renderJsonUIFromString(blockId, jsonString, dataContext);
            }
        });
    }

    private async loadSession(sessionId: string): Promise<void> {
        try {
            const result = await api.chat.getMessages.query({ sessionId, limit: 100 });
            this.sessionId = sessionId;
            this.messages = result.messages.map((m: { id: string; role: 'user' | 'assistant'; content: string; createdAt: string | Date }) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: new Date(m.createdAt),
            }));
            this.hasTransferredChat = false; // Reset transfer flag when loading a session
            this.render();
        } catch (error) {
            console.error('[ChatPage] Failed to load session:', error);
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
                // Re-render messages area if we deleted the current session
                if (this.messagesContainer) {
                    if (this.messages.length === 0) {
                        this.renderWelcomeState();
                    } else {
                        this.renderMessages();
                    }
                }
            }
            // Don't call this.render() here - let the dropdown handler manage its own state
            // The dropdown will call updateDropdown() to refresh its content
        } catch (error) {
            console.error('[ChatPage] Failed to delete session:', error);
        }
    }

    private getServerPort(): number {
        const match = this.apiUrl.match(/:(\d+)/);
        return match ? parseInt(match[1], 10) : 3000;
    }

    private formatRelativeTime(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
}

export default ChatPage;
