/**
 * ChatPage Component
 * Full-page chat interface with OpenCode SDK integration
 */

import '../styles/chat-theme.css';
import { Component } from './Component';
import { createElement, escapeHtml } from '../utils/dom';
import { api } from '../api';
import { getChatStateManager, type ChatStateManager, type AuthMethod, type OpenCodeState } from '../utils/chat-state';
import { getOpenCodeService, type OpenCodeService } from '../utils/opencode-service';
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
    private sessions: ChatSession[] = [];
    private settingsOpen = false;

    private stateManager!: ChatStateManager;
    private openCodeService!: OpenCodeService;
    private openCodeState!: OpenCodeState;
    private unsubscribe: (() => void) | null = null;

    async init(): Promise<void> {
        this.stateManager = getChatStateManager();
        this.openCodeService = getOpenCodeService();
        this.openCodeState = this.openCodeService.getState();

        // Subscribe to OpenCode state changes
        this.unsubscribe = this.openCodeService.subscribe((state) => {
            this.openCodeState = state;
            // Only re-render header when providers change, not full page
            this.updateStatusIndicator();
        });

        // Set up OAuth callback listener
        this.setupOAuthListener();

        // Try to connect to OpenCode first, if not already connected or in fallback mode
        if (this.openCodeState.status === 'disconnected' && !this.openCodeState.useFallback) {
            console.log('[ChatPage] Attempting to connect to OpenCode...');
            try {
                const connected = await this.openCodeService.connect();
                this.openCodeState = this.openCodeService.getState();
                
                // If connection failed, immediately enable fallback mode
                if (!connected) {
                    console.log('[ChatPage] OpenCode connection failed, enabling fallback mode');
                    this.openCodeService.enableFallback();
                    this.openCodeState = this.openCodeService.getState();
                }
            } catch (error) {
                // Any error during connection attempt should trigger fallback
                console.log('[ChatPage] OpenCode connection error, enabling fallback mode:', error);
                this.openCodeService.enableFallback();
                this.openCodeState = this.openCodeService.getState();
            }
        }
        
        // Also check if we're in error state and should enable fallback
        if (this.openCodeState.status === 'error' && !this.openCodeState.useFallback) {
            console.log('[ChatPage] OpenCode in error state, enabling fallback mode');
            this.openCodeService.enableFallback();
            this.openCodeState = this.openCodeService.getState();
        }

        await this.loadSessions();
        this.render();
    }

    private setupOAuthListener(): void {
        // Listen for OpenCode OAuth callbacks via deep link
        if (typeof window !== 'undefined' && (window as unknown as { electronDeepLink?: { onCallback: (cb: (data: unknown) => void) => void } }).electronDeepLink) {
            const electronDeepLink = (window as unknown as { electronDeepLink: { onCallback: (cb: (data: unknown) => void) => void } }).electronDeepLink;
            electronDeepLink.onCallback(async (data: unknown) => {
                const callbackData = data as { type?: string; success?: boolean; token?: string; provider?: string; error?: string };
                if (callbackData.type === 'opencode-oauth') {
                    console.log('[ChatPage] Received OpenCode OAuth callback:', callbackData);
                    const success = await this.openCodeService.handleOAuthCallback({
                        success: callbackData.success || false,
                        token: callbackData.token,
                        provider: callbackData.provider,
                        error: callbackData.error,
                    });
                    if (success) {
                        this.render();
                    }
                }
            });
        }
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        super.destroy();
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

    private updateStatusIndicator(): void {
        const statusEl = document.getElementById('opencode-status');
        if (statusEl) {
            const { status } = this.openCodeState;
            const statusColor = status === 'connected' ? '#10b981' : status === 'connecting' ? '#f59e0b' : '#ef4444';
            const statusText = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected';
            statusEl.innerHTML = `
                <div style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></div>
                <span style="font-size: 11px; font-weight: 500; color: var(--cc-text-muted);">${statusText}</span>
            `;
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

        // In fallback mode or error state, show fallback chat interface
        // Also enable fallback if we're in error state but haven't enabled it yet
        if (this.openCodeState.status === 'error' && !this.openCodeState.useFallback) {
            console.log('[ChatPage] Error state detected, enabling fallback mode');
            this.openCodeService.enableFallback();
            this.openCodeState = this.openCodeService.getState();
        }
        
        if (this.openCodeState.useFallback || this.openCodeState.status === 'error') {
            this.renderFallbackChatInterface(mainArea);
        } else {
            // Check if we need to show OpenCode setup
            const needsSetup = this.openCodeState.status !== 'connected' || 
                (this.openCodeState.authMethod === 'apikey' && !this.openCodeState.isAuthenticated);

            if (needsSetup && this.openCodeState.providers.length === 0) {
                this.renderSetupPrompt(mainArea);
            } else {
                this.renderChatInterface(mainArea);
            }
        }

        wrapper.appendChild(mainArea);
        this.container.appendChild(wrapper);
    }

    private renderSetupPrompt(container: HTMLElement): void {
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

        // OpenCode logo/icon
        const iconWrapper = createElement('div', {
            className: 'w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto',
        });
        (iconWrapper as HTMLElement).style.cssText = `
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%);
        `;
        iconWrapper.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: #10b981;">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
        `;
        card.appendChild(iconWrapper);

        const title = createElement('h2', {
            className: 'text-xl font-semibold text-center mb-2',
            textContent: 'Connect to OpenCode',
        });
        (title as HTMLElement).style.cssText = `
            color: var(--cc-text-primary);
            font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
            letter-spacing: -0.02em;
        `;
        card.appendChild(title);

        const desc = createElement('p', {
            className: 'text-sm text-center mb-8',
            textContent: this.openCodeState.error || 'Enter your OpenCode server URL to connect',
        });
        (desc as HTMLElement).style.cssText = `
            color: ${this.openCodeState.error ? '#ef4444' : 'var(--cc-text-tertiary)'};
        `;
        card.appendChild(desc);

        // Server URL input
        const urlInput = createElement('input', {
            className: 'w-full px-4 py-3 rounded-xl text-sm mb-4',
            attributes: {
                type: 'url',
                placeholder: 'http://localhost:4096',
                value: this.openCodeState.serverUrl,
            },
        }) as HTMLInputElement;
        (urlInput as HTMLElement).style.cssText = `
            background: hsl(var(--muted) / 0.4);
            border: 1px solid hsl(var(--border) / 0.8);
            color: var(--cc-text-primary);
            outline: none;
            font-family: var(--font-mono, 'Geist Mono', monospace);
        `;
        card.appendChild(urlInput);

        const connectBtn = createElement('button', {
            className: 'w-full py-3 rounded-xl text-sm font-medium',
            textContent: this.openCodeState.status === 'connecting' ? 'Connecting...' : 'Connect',
        });
        (connectBtn as HTMLElement).style.cssText = `
            background: hsl(var(--primary));
            color: white;
            border: none;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
            font-weight: 500;
            letter-spacing: -0.01em;
        `;
        connectBtn.addEventListener('mouseenter', () => {
            (connectBtn as HTMLElement).style.background = 'hsl(var(--primary) / 0.9)';
            (connectBtn as HTMLElement).style.transform = 'translateY(-1px)';
        });
        connectBtn.addEventListener('mouseleave', () => {
            (connectBtn as HTMLElement).style.background = 'hsl(var(--primary))';
            (connectBtn as HTMLElement).style.transform = 'translateY(0)';
        });
        connectBtn.addEventListener('mousedown', () => {
            (connectBtn as HTMLElement).style.transform = 'translateY(0)';
        });
        connectBtn.addEventListener('mouseup', () => {
            (connectBtn as HTMLElement).style.transform = 'translateY(-1px)';
        });

        this.addListener(connectBtn, 'click', async () => {
            connectBtn.textContent = 'Connecting...';
            (connectBtn as HTMLButtonElement).disabled = true;
            
            try {
                const connected = await this.openCodeService.connect(urlInput.value.trim() || undefined);
                this.openCodeState = this.openCodeService.getState();
                
                if (connected) {
                    this.render();
                } else {
                    // Connection failed - enable fallback mode
                    console.log('[ChatPage] Connection failed, enabling fallback mode');
                    this.openCodeService.enableFallback();
                    this.openCodeState = this.openCodeService.getState();
                    this.render(); // Re-render to show fallback interface
                }
            } catch (error) {
                // Any error - enable fallback mode
                console.log('[ChatPage] Connection error, enabling fallback mode:', error);
                this.openCodeService.enableFallback();
                this.openCodeState = this.openCodeService.getState();
                this.render(); // Re-render to show fallback interface
            }
        });
        card.appendChild(connectBtn);

        promptWrapper.appendChild(card);
        container.appendChild(promptWrapper);
    }

    /**
     * Render fallback chat interface using local Cortex server
     * This is shown when OpenCode is not available
     */
    private renderFallbackChatInterface(container: HTMLElement): void {
        // Check if we have an API key stored
        const storedKey = this.openCodeService.getStoredApiKey(this.openCodeState.currentProviderId || 'anthropic');
        
        if (!storedKey) {
            // Show API key entry
            this.renderFallbackApiKeyPrompt(container);
        } else {
            // Show chat interface
            this.renderFallbackChat(container);
        }
    }

    /**
     * Render API key prompt for fallback mode
     */
    private renderFallbackApiKeyPrompt(container: HTMLElement): void {
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
            background: hsl(var(--primary) / 0.1);
        `;
        iconWrapper.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: hsl(var(--primary));">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
        `;
        card.appendChild(iconWrapper);

        const title = createElement('h2', {
            className: 'text-xl font-semibold text-center mb-2',
            textContent: 'Chat',
        });
        (title as HTMLElement).style.cssText = `
            color: var(--cc-text-primary);
            font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
            letter-spacing: -0.02em;
        `;
        card.appendChild(title);

        const desc = createElement('p', {
            className: 'text-sm text-center mb-6',
            textContent: 'Enter your API key to start chatting',
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
        
        // Fallback providers
        const fallbackProviders = [
            { id: 'anthropic', name: 'Anthropic' },
            { id: 'openai', name: 'OpenAI' },
            { id: 'openrouter', name: 'OpenRouter' },
        ];
        
        fallbackProviders.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            if (p.id === (this.openCodeState.currentProviderId || 'anthropic')) opt.selected = true;
            providerSelect.appendChild(opt);
        });
        
        this.addListener(providerSelect, 'change', () => {
            this.openCodeService.setProvider(providerSelect.value);
            this.openCodeState = this.openCodeService.getState();
        });
        providerRow.appendChild(providerSelect);
        card.appendChild(providerRow);

        // API Key input
        const keyInput = createElement('input', {
            className: 'w-full px-4 py-3 rounded-xl text-sm mb-4',
            attributes: {
                type: 'password',
                placeholder: 'Enter API key...',
            },
        }) as HTMLInputElement;
        (keyInput as HTMLElement).style.cssText = `
            background: hsl(var(--muted) / 0.4);
            border: 1px solid hsl(var(--border) / 0.8);
            color: var(--cc-text-primary);
            outline: none;
            font-family: var(--font-mono, 'Geist Mono', monospace);
        `;
        card.appendChild(keyInput);

        const saveBtn = createElement('button', {
            className: 'w-full py-3 rounded-xl text-sm font-medium',
            textContent: 'Start Chatting',
        });
        (saveBtn as HTMLElement).style.cssText = `
            background: hsl(var(--primary));
            color: white;
            border: none;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
            font-weight: 500;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            (saveBtn as HTMLElement).style.background = 'hsl(var(--primary) / 0.9)';
        });
        saveBtn.addEventListener('mouseleave', () => {
            (saveBtn as HTMLElement).style.background = 'hsl(var(--primary))';
        });

        this.addListener(saveBtn, 'click', async () => {
            const key = keyInput.value.trim();
            if (!key) return;

            saveBtn.textContent = 'Saving...';
            (saveBtn as HTMLButtonElement).disabled = true;

            const providerId = providerSelect.value;
            await this.openCodeService.setApiKey(providerId, key);
            this.openCodeState = this.openCodeService.getState();
            this.render();
        });
        card.appendChild(saveBtn);

        promptWrapper.appendChild(card);
        container.appendChild(promptWrapper);
    }

    /**
     * Render chat interface for fallback mode
     */
    private renderFallbackChat(container: HTMLElement): void {
        // Header
        const header = createElement('div', {
            className: 'px-6 py-4 flex items-center gap-4 shrink-0',
        });
        (header as HTMLElement).style.cssText = `
            border-bottom: 1px solid var(--cc-glass-border);
        `;

        // Provider/Model selector
        const controlsGroup = createElement('div', {
            className: 'flex items-center gap-3',
        });

        // Status indicator (Local mode)
        const statusIndicator = createElement('div', {
            className: 'flex items-center gap-1.5',
        });
        statusIndicator.innerHTML = `
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #f59e0b;"></div>
            <span style="font-size: 11px; font-weight: 500; color: var(--cc-text-muted);">Local</span>
        `;
        controlsGroup.appendChild(statusIndicator);

        // Divider
        const divider = createElement('div');
        (divider as HTMLElement).style.cssText = `width: 1px; height: 16px; background: var(--cc-glass-border);`;
        controlsGroup.appendChild(divider);

        // Provider selector
        const providerSelect = createElement('select', {
            className: 'px-3 py-1.5 rounded-lg text-xs font-medium',
        }) as HTMLSelectElement;
        (providerSelect as HTMLElement).style.cssText = `
            background: hsl(var(--muted) / 0.4);
            border: 1px solid var(--cc-glass-border);
            color: var(--cc-text-secondary);
            outline: none;
            cursor: pointer;
        `;
        
        const fallbackProviders = [
            { id: 'anthropic', name: 'Anthropic' },
            { id: 'openai', name: 'OpenAI' },
            { id: 'openrouter', name: 'OpenRouter' },
        ];
        
        fallbackProviders.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            if (p.id === (this.openCodeState.currentProviderId || 'anthropic')) opt.selected = true;
            providerSelect.appendChild(opt);
        });
        
        this.addListener(providerSelect, 'change', () => {
            this.openCodeService.setProvider(providerSelect.value);
            this.openCodeState = this.openCodeService.getState();
            // Check if we have API key for new provider
            const hasKey = this.openCodeService.getStoredApiKey(providerSelect.value);
            if (!hasKey) {
                this.render();
            }
        });
        controlsGroup.appendChild(providerSelect);

        header.appendChild(controlsGroup);

        // Right side: History + New chat
        const actionsGroup = createElement('div', {
            className: 'ml-auto flex items-center gap-2',
        });

        // History dropdown
        const historyWrapper = this.renderHistoryDropdown();
        actionsGroup.appendChild(historyWrapper);

        // New chat button
        const newChatBtn = this.createIconButton('plus', 'New chat');
        this.addListener(newChatBtn, 'click', () => {
            this.sessionId = null;
            this.messages = [];
            this.render();
        });
        actionsGroup.appendChild(newChatBtn);

        header.appendChild(actionsGroup);
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
        this.renderInputArea(container);
    }

    private renderChatInterface(container: HTMLElement): void {
        // Header with OpenCode controls
        const header = createElement('div', {
            className: 'px-6 py-4 flex items-center gap-4 shrink-0',
        });
        (header as HTMLElement).style.cssText = `
            border-bottom: 1px solid var(--cc-glass-border);
        `;

        // Status indicator + Provider/Model selector group
        const controlsGroup = createElement('div', {
            className: 'flex items-center gap-3',
        });

        // Connection status indicator
        const statusIndicator = createElement('div', {
            className: 'flex items-center gap-1.5',
            attributes: { id: 'opencode-status' },
        });
        const statusColor = this.openCodeState.status === 'connected' ? '#10b981' : 
            this.openCodeState.status === 'connecting' ? '#f59e0b' : '#ef4444';
        statusIndicator.innerHTML = `
            <div style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></div>
            <span style="font-size: 11px; font-weight: 500; color: var(--cc-text-muted);">${
                this.openCodeState.status === 'connected' ? 'Connected' : 
                this.openCodeState.status === 'connecting' ? 'Connecting...' : 'Disconnected'
            }</span>
        `;
        controlsGroup.appendChild(statusIndicator);

        // Divider
        const divider = createElement('div');
        (divider as HTMLElement).style.cssText = `
            width: 1px;
            height: 16px;
            background: var(--cc-glass-border);
        `;
        controlsGroup.appendChild(divider);

        // Provider selector
        const providerSelect = this.createSelectDropdown({
            options: this.openCodeState.providers.map(p => ({ value: p.id, label: p.name })),
            value: this.openCodeState.currentProviderId || '',
            onChange: (value) => {
                this.openCodeService.setProvider(value);
            },
            placeholder: 'Select provider',
        });
        controlsGroup.appendChild(providerSelect);

        // Model selector
        const currentProvider = this.openCodeState.providers.find(p => p.id === this.openCodeState.currentProviderId);
        const modelSelect = this.createSelectDropdown({
            options: (currentProvider?.models || []).map(m => ({ value: m.id, label: m.name })),
            value: this.openCodeState.currentModelId || '',
            onChange: (value) => {
                this.openCodeService.setModel(value);
            },
            placeholder: 'Select model',
        });
        controlsGroup.appendChild(modelSelect);

        header.appendChild(controlsGroup);

        // Right side: Settings + History + New chat
        const actionsGroup = createElement('div', {
            className: 'ml-auto flex items-center gap-2',
        });

        // Settings button with drawer
        const settingsWrapper = createElement('div', {
            className: 'relative',
        });
        const settingsBtn = this.createIconButton('settings', 'Settings');
        this.addListener(settingsBtn, 'click', () => {
            this.settingsOpen = !this.settingsOpen;
            this.render();
        });
        settingsWrapper.appendChild(settingsBtn);

        // Settings drawer (rendered when open)
        if (this.settingsOpen) {
            const settingsDrawer = this.renderSettingsDrawer();
            settingsWrapper.appendChild(settingsDrawer);
        }
        actionsGroup.appendChild(settingsWrapper);

        // Recent conversations dropdown
        const historyWrapper = this.renderHistoryDropdown();
        actionsGroup.appendChild(historyWrapper);

        // New chat button
        const newChatBtn = this.createIconButton('plus', 'New chat');
        this.addListener(newChatBtn, 'click', () => {
            this.sessionId = null;
            this.messages = [];
            this.hasTransferredChat = false;
            this.render();
        });
        actionsGroup.appendChild(newChatBtn);

        header.appendChild(actionsGroup);
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
        this.renderInputArea(container);
    }

    private renderSettingsDrawer(): HTMLElement {
        const drawer = createElement('div', {
            className: 'absolute top-full right-0 mt-2 rounded-xl overflow-hidden shadow-2xl z-50',
        });
        (drawer as HTMLElement).style.cssText = `
            background: hsl(var(--card));
            backdrop-filter: blur(24px);
            border: 1px solid hsl(var(--border) / 0.6);
            width: 320px;
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
        `;

        // Header
        const drawerHeader = createElement('div', {
            className: 'px-4 py-3 flex items-center justify-between',
        });
        (drawerHeader as HTMLElement).style.cssText = `
            border-bottom: 1px solid hsl(var(--border) / 0.4);
        `;
        const drawerTitle = createElement('span', {
            textContent: 'Settings',
        });
        (drawerTitle as HTMLElement).style.cssText = `
            font-size: 13px;
            font-weight: 600;
            color: var(--cc-text-primary);
            font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
        `;
        drawerHeader.appendChild(drawerTitle);

        const closeBtn = createElement('button');
        closeBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        `;
        (closeBtn as HTMLElement).style.cssText = `
            color: var(--cc-text-muted);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.15s;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            (closeBtn as HTMLElement).style.background = 'hsl(var(--muted) / 0.5)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            (closeBtn as HTMLElement).style.background = 'transparent';
        });
        this.addListener(closeBtn, 'click', () => {
            this.settingsOpen = false;
            this.render();
        });
        drawerHeader.appendChild(closeBtn);
        drawer.appendChild(drawerHeader);

        // Content
        const content = createElement('div', {
            className: 'p-4 space-y-5',
        });

        // Auth Method Section
        const authSection = createElement('div');
        const authLabel = createElement('label', {
            textContent: 'Authentication',
        });
        (authLabel as HTMLElement).style.cssText = `
            display: block;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--cc-text-muted);
            margin-bottom: 8px;
        `;
        authSection.appendChild(authLabel);

        // Segmented control for auth method
        const authMethods: { id: AuthMethod; label: string; icon: string }[] = [
            { id: 'oauth', label: 'OAuth', icon: 'user' },
            { id: 'apikey', label: 'API Key', icon: 'key' },
            { id: 'zen', label: 'Zen', icon: 'sparkle' },
        ];

        const segmentedControl = createElement('div', {
            className: 'flex rounded-lg overflow-hidden',
            attributes: { role: 'tablist' },
        });
        (segmentedControl as HTMLElement).style.cssText = `
            background: hsl(var(--muted) / 0.3);
            padding: 3px;
            gap: 2px;
        `;

        authMethods.forEach(method => {
            const isActive = this.openCodeState.authMethod === method.id;
            const segment = createElement('button', {
                className: 'flex-1 px-3 py-2 rounded-md transition-all',
                attributes: {
                    role: 'tab',
                    'aria-selected': String(isActive),
                },
            });
            (segment as HTMLElement).style.cssText = `
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                background: ${isActive ? 'hsl(var(--background))' : 'transparent'};
                color: ${isActive ? 'var(--cc-text-primary)' : 'var(--cc-text-muted)'};
                box-shadow: ${isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            `;
            segment.textContent = method.label;
            
            this.addListener(segment, 'click', () => {
                this.openCodeService.setAuthMethod(method.id);
                this.render();
            });
            segmentedControl.appendChild(segment);
        });
        authSection.appendChild(segmentedControl);

        // Auth-specific content
        const authContent = createElement('div', {
            className: 'mt-3',
        });

        if (this.openCodeState.authMethod === 'oauth') {
            authContent.innerHTML = `
                <div style="text-align: center; padding: 12px;">
                    <p style="font-size: 12px; color: var(--cc-text-muted); margin-bottom: 12px;">
                        Sign in with GitHub or Google to use OpenCode
                    </p>
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        <button id="oauth-github" style="
                            display: flex; align-items: center; gap: 6px;
                            padding: 8px 16px; border-radius: 8px;
                            background: hsl(var(--muted) / 0.5);
                            border: 1px solid hsl(var(--border) / 0.5);
                            color: var(--cc-text-primary);
                            font-size: 12px; font-weight: 500;
                            cursor: pointer; transition: all 0.15s;
                        ">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            GitHub
                        </button>
                        <button id="oauth-google" style="
                            display: flex; align-items: center; gap: 6px;
                            padding: 8px 16px; border-radius: 8px;
                            background: hsl(var(--muted) / 0.5);
                            border: 1px solid hsl(var(--border) / 0.5);
                            color: var(--cc-text-primary);
                            font-size: 12px; font-weight: 500;
                            cursor: pointer; transition: all 0.15s;
                        ">
                            <svg width="14" height="14" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Google
                        </button>
                    </div>
                </div>
            `;
            // Add event listeners after render
            setTimeout(() => {
                const githubBtn = document.getElementById('oauth-github');
                const googleBtn = document.getElementById('oauth-google');
                githubBtn?.addEventListener('click', () => {
                    this.openCodeService.initiateOAuth('github');
                });
                googleBtn?.addEventListener('click', () => {
                    this.openCodeService.initiateOAuth('google');
                });
            }, 0);
        } else if (this.openCodeState.authMethod === 'apikey') {
            const currentProvider = this.openCodeState.providers.find(p => p.id === this.openCodeState.currentProviderId);
            const providerName = currentProvider?.name || 'Provider';
            
            const apiKeyInput = createElement('input', {
                className: 'w-full px-3 py-2.5 rounded-lg text-sm',
                attributes: {
                    type: 'password',
                    placeholder: `Enter ${providerName} API key...`,
                    id: 'api-key-input',
                },
            }) as HTMLInputElement;
            (apiKeyInput as HTMLElement).style.cssText = `
                background: hsl(var(--muted) / 0.4);
                border: 1px solid hsl(var(--border) / 0.6);
                color: var(--cc-text-primary);
                outline: none;
                font-family: var(--font-mono, 'Geist Mono', monospace);
                font-size: 12px;
            `;

            const saveKeyBtn = createElement('button', {
                textContent: 'Save Key',
                className: 'w-full mt-2 py-2 rounded-lg text-sm font-medium',
            });
            (saveKeyBtn as HTMLElement).style.cssText = `
                background: hsl(var(--primary));
                color: white;
                border: none;
                cursor: pointer;
                transition: opacity 0.15s;
            `;
            saveKeyBtn.addEventListener('mouseenter', () => {
                (saveKeyBtn as HTMLElement).style.opacity = '0.9';
            });
            saveKeyBtn.addEventListener('mouseleave', () => {
                (saveKeyBtn as HTMLElement).style.opacity = '1';
            });

            this.addListener(saveKeyBtn, 'click', async () => {
                const key = apiKeyInput.value.trim();
                if (key && this.openCodeState.currentProviderId) {
                    saveKeyBtn.textContent = 'Saving...';
                    const success = await this.openCodeService.setApiKey(this.openCodeState.currentProviderId, key);
                    if (success) {
                        apiKeyInput.value = '';
                        saveKeyBtn.textContent = 'Saved!';
                        setTimeout(() => {
                            saveKeyBtn.textContent = 'Save Key';
                        }, 2000);
                    } else {
                        saveKeyBtn.textContent = 'Failed';
                        setTimeout(() => {
                            saveKeyBtn.textContent = 'Save Key';
                        }, 2000);
                    }
                }
            });

            authContent.appendChild(apiKeyInput);
            authContent.appendChild(saveKeyBtn);
        } else if (this.openCodeState.authMethod === 'zen') {
            authContent.innerHTML = `
                <div style="text-align: center; padding: 12px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%); border-radius: 8px;">
                    <div style="font-size: 20px; margin-bottom: 8px;">✨</div>
                    <p style="font-size: 12px; font-weight: 500; color: var(--cc-text-primary); margin-bottom: 4px;">
                        Zen Mode
                    </p>
                    <p style="font-size: 11px; color: var(--cc-text-muted);">
                        Validated models, no API key required
                    </p>
                    <a href="https://opencode.ai/docs/config/zen" target="_blank" style="
                        display: inline-block; margin-top: 8px;
                        font-size: 11px; color: #10b981;
                        text-decoration: none;
                    ">Learn more →</a>
                </div>
            `;
        }
        authSection.appendChild(authContent);
        content.appendChild(authSection);

        // Server URL Section
        const serverSection = createElement('div');
        const serverLabel = createElement('label', {
            textContent: 'Server URL',
        });
        (serverLabel as HTMLElement).style.cssText = `
            display: block;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--cc-text-muted);
            margin-bottom: 8px;
        `;
        serverSection.appendChild(serverLabel);

        const serverRow = createElement('div', {
            className: 'flex gap-2',
        });
        const serverInput = createElement('input', {
            className: 'flex-1 px-3 py-2 rounded-lg text-xs',
            attributes: {
                type: 'url',
                value: this.openCodeState.serverUrl,
                id: 'server-url-input',
            },
        }) as HTMLInputElement;
        (serverInput as HTMLElement).style.cssText = `
            background: hsl(var(--muted) / 0.4);
            border: 1px solid hsl(var(--border) / 0.6);
            color: var(--cc-text-primary);
            outline: none;
            font-family: var(--font-mono, 'Geist Mono', monospace);
        `;
        serverRow.appendChild(serverInput);

        const reconnectBtn = createElement('button', {
            textContent: 'Connect',
        });
        (reconnectBtn as HTMLElement).style.cssText = `
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 500;
            background: hsl(var(--muted) / 0.5);
            border: 1px solid hsl(var(--border) / 0.5);
            color: var(--cc-text-primary);
            cursor: pointer;
            transition: all 0.15s;
        `;
        this.addListener(reconnectBtn, 'click', async () => {
            reconnectBtn.textContent = '...';
            await this.openCodeService.connect(serverInput.value.trim());
            reconnectBtn.textContent = 'Connect';
        });
        serverRow.appendChild(reconnectBtn);
        serverSection.appendChild(serverRow);
        content.appendChild(serverSection);

        drawer.appendChild(content);

        // Close drawer when clicking outside
        setTimeout(() => {
            const closeHandler = (e: MouseEvent) => {
                const settingsWrapper = drawer.parentElement;
                if (settingsWrapper && !settingsWrapper.contains(e.target as Node)) {
                    this.settingsOpen = false;
                    document.removeEventListener('click', closeHandler);
                    this.render();
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);

        return drawer;
    }

    private createSelectDropdown(config: {
        options: Array<{ value: string; label: string }>;
        value: string;
        onChange: (value: string) => void;
        placeholder?: string;
    }): HTMLElement {
        const select = createElement('select', {
            className: 'px-3 py-1.5 rounded-lg text-xs font-medium',
        }) as HTMLSelectElement;
        (select as HTMLElement).style.cssText = `
            background: hsl(var(--muted) / 0.4);
            border: 1px solid var(--cc-glass-border);
            color: var(--cc-text-secondary);
            outline: none;
            cursor: pointer;
            min-width: 120px;
            font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
        `;

        if (config.placeholder) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = config.placeholder;
            placeholder.disabled = true;
            if (!config.value) placeholder.selected = true;
            select.appendChild(placeholder);
        }

        config.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === config.value) option.selected = true;
            select.appendChild(option);
        });

        this.addListener(select, 'change', () => {
            config.onChange(select.value);
        });

        return select;
    }

    private createIconButton(icon: string, label: string): HTMLElement {
        const btn = createElement('button', {
            className: 'flex items-center justify-center',
            attributes: { 'aria-label': label },
        });
        (btn as HTMLElement).style.cssText = `
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

        const icons: Record<string, string> = {
            settings: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>`,
            clock: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>`,
            plus: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14"/>
            </svg>`,
        };

        btn.innerHTML = icons[icon] || '';
        
        btn.addEventListener('mouseenter', () => {
            (btn as HTMLElement).style.background = 'var(--cc-glass-bg)';
            (btn as HTMLElement).style.color = 'var(--cc-text-primary)';
        });
        btn.addEventListener('mouseleave', () => {
            (btn as HTMLElement).style.background = 'hsl(var(--muted) / 0.4)';
            (btn as HTMLElement).style.color = 'var(--cc-text-secondary)';
        });

        return btn;
    }

    private renderHistoryDropdown(): HTMLElement {
        const wrapper = createElement('div', {
            className: 'relative',
        });

        let isOpen = false;
        const btn = this.createIconButton('clock', 'Recent chats');

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
                className: 'w-full px-4 py-2.5 flex items-center gap-2 text-left transition-colors',
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
            newChatOption.addEventListener('mouseenter', () => {
                (newChatOption as HTMLElement).style.background = 'var(--cc-glass-bg)';
            });
            newChatOption.addEventListener('mouseleave', () => {
                (newChatOption as HTMLElement).style.background = 'transparent';
            });
            this.addListener(newChatOption, 'click', () => {
                this.sessionId = null;
                this.messages = [];
                this.hasTransferredChat = false;
                isOpen = false;
                dropdown.style.display = 'none';
                this.render();
            });
            dropdown.appendChild(newChatOption);

            // Recent sessions
            if (this.sessions.length > 0) {
                const recentLabel = createElement('div', {
                    className: 'px-4 py-2',
                    textContent: 'Recent',
                });
                (recentLabel as HTMLElement).style.cssText = `
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: var(--cc-text-muted);
                `;
                dropdown.appendChild(recentLabel);

                this.sessions.slice(0, 10).forEach(session => {
                    const sessionRow = createElement('div', {
                        className: 'flex items-center gap-2 px-4 py-2.5 transition-colors relative',
                    });
                    
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
                        isOpen = false;
                        dropdown.style.display = 'none';
                    });
                    sessionRow.appendChild(chatBtn);

                    // Delete button
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
                        updateDropdown();
                        if (this.sessions.length === 0) {
                            isOpen = false;
                            dropdown.style.display = 'none';
                        }
                    });
                    sessionRow.appendChild(deleteBtn);
                    
                    dropdown.appendChild(sessionRow);
                });
            } else {
                const emptyState = createElement('div', {
                    className: 'px-4 py-8 text-center',
                    textContent: 'No recent chats',
                });
                (emptyState as HTMLElement).style.cssText = `
                    font-size: 12px;
                    color: var(--cc-text-muted);
                `;
                dropdown.appendChild(emptyState);
            }
        };

        this.addListener(btn, 'click', (e: Event) => {
            e.stopPropagation();
            isOpen = !isOpen;
            btn.setAttribute('aria-expanded', String(isOpen));
            if (isOpen) {
                updateDropdown();
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        });

        document.addEventListener('click', (e: MouseEvent) => {
            if (!wrapper.contains(e.target as Node)) {
                isOpen = false;
                btn.setAttribute('aria-expanded', 'false');
                dropdown.style.display = 'none';
            }
        });

        wrapper.appendChild(btn);
        wrapper.appendChild(dropdown);
        return wrapper;
    }

    private renderInputArea(container: HTMLElement): void {
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
            attributes: { 'aria-label': 'Send message' },
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

        if (!isUser) {
            if (!message.content || message.content.trim() === '') {
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

        // Check if we're ready to send
        const inFallbackMode = this.openCodeState.useFallback;
        const providerId = this.openCodeState.currentProviderId || 'anthropic';
        
        if (inFallbackMode) {
            // In fallback mode, check if we have an API key
            const hasKey = this.openCodeService.getStoredApiKey(providerId);
            if (!hasKey) {
                alert('Please enter your API key to start chatting.');
                return;
            }
        } else if (!this.openCodeService.isReady()) {
            alert('Not connected to OpenCode server. Please check settings.');
            return;
        }

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
            // For now, fall back to the local server endpoint until OpenCode SDK is fully integrated
            // In production, this would use: await this.openCodeService.sendPrompt(sessionId, content)
            const serverUrl = this.openCodeState.serverUrl;
            const providerId = this.openCodeState.currentProviderId || 'anthropic';
            const modelId = this.openCodeState.currentModelId || 'claude-3-5-sonnet';

            const messages = this.messages.slice(0, -1).map(m => ({
                role: m.role,
                content: m.content,
            }));

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

            const requestMessages = [
                { role: 'system', content: systemContext },
                ...messages
            ];

            // Try to use stored API key
            const apiKey = this.openCodeService.getStoredApiKey(providerId) || '';

            console.log('[ChatPage] Sending request via OpenCode to:', providerId, modelId);
            
            // Use local server endpoint as fallback
            const endpoint = `http://localhost:3000/api/chat/${providerId}`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    messages: requestMessages,
                    model: modelId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let hasReceivedData = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                hasReceivedData = true;
                const chunk = decoder.decode(value, { stream: true });
                assistantMsg.content += chunk;
                this.updateLastMessage(assistantMsg.content, false);
            }

            if (!hasReceivedData && assistantMsg.content === '') {
                assistantMsg.content = 'No response received from the server. Please try again.';
            }

            this.updateLastMessage(assistantMsg.content, true);

            // Auto-save generated blocks
            const blocks = extractJsonRenderBlocks(assistantMsg.content);
            for (const block of blocks) {
                if (this.sessionId) {
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
        } finally {
            this.isLoading = false;
            this.inputElement?.focus();
        }
    }

    private updateLastMessage(content: string, isComplete: boolean = false): void {
        if (!this.messagesContainer) return;

        const bubbles = this.messagesContainer.querySelectorAll('[class*="justify-start"]');
        const lastBubble = bubbles[bubbles.length - 1];
        if (lastBubble) {
            const contentEl = lastBubble.querySelector('.text-sm');
            if (contentEl) {
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

                pre.replaceWith(uiContainer);

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
            this.hasTransferredChat = false;
            this.render();
        } catch (error) {
            console.error('[ChatPage] Failed to load session:', error);
        }
    }

    private async deleteSession(sessionId: string): Promise<void> {
        try {
            await api.chat.deleteSession.mutate({ sessionId });
            this.sessions = this.sessions.filter(s => s.id !== sessionId);

            if (this.sessionId === sessionId) {
                this.sessionId = null;
                this.messages = [];
                if (this.messagesContainer) {
                    if (this.messages.length === 0) {
                        this.renderWelcomeState();
                    } else {
                        this.renderMessages();
                    }
                }
            }
        } catch (error) {
            console.error('[ChatPage] Failed to delete session:', error);
        }
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
