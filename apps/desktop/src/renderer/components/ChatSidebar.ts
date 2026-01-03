/**
 * ChatSidebar Component
 * Right-side chat sidebar for AI conversations using OpenRouter
 */

import { Component } from './Component';
import { createElement, clearChildren } from '../utils/dom';
import { api } from '../api';
import { hasApiKey, decryptApiKey } from '../utils/crypto';
import { router } from '../router';
import { store } from '../store';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

const DEFAULT_MODEL = 'mistralai/devstral-2512:free';
const MODEL_STORAGE_KEY = 'cortex-model';

export class ChatSidebar extends Component {
  private messagesContainer: HTMLElement | null = null;
  private inputElement: HTMLTextAreaElement | null = null;
  private messages: ChatMessage[] = [];
  private sessionId: string | null = null;
  private isLoading = false;
  private apiKeyMissing = false;
  
  private getModel(): string {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
  }
  
  async init(): Promise<void> {
    this.apiKeyMissing = !hasApiKey();
    this.render();
  }
  
  render(): void {
    this.container.innerHTML = '';
    
    // Sidebar container
    const panel = createElement('div', {
      className: 'flex flex-col h-full bg-card border-l border-border/50 shadow-2xl animate-in slide-in-from-right duration-300 w-full',
    });
    
    // Header
    const header = createElement('div', {
      className: 'flex items-center justify-between px-5 py-4 border-b border-border/50 flex-shrink-0 bg-background/80 backdrop-blur-sm',
    });
    
    const title = createElement('div', {
      className: 'flex items-center gap-2',
    });
    title.innerHTML = `
      <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary">
          <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
        </svg>
      </div>
      <h2 class="font-semibold text-sm">Ask Cortex</h2>
    `;
    header.appendChild(title);
    
    const closeButton = createElement('button', {
      className: 'p-1.5 hover:bg-secondary rounded-lg transition-colors',
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      `,
    });
    this.addListener(closeButton, 'click', () => store.chatSidebarOpen.set(false));
    header.appendChild(closeButton);
    
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
        className: 'p-4 border-t border-border/50 flex-shrink-0 bg-background/80 backdrop-blur-sm',
      });
      
      const inputWrapper = createElement('div', {
        className: 'flex items-end gap-2 bg-secondary/50 border border-border/50 rounded-2xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/20 transition-all',
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
        className: 'p-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0',
        innerHTML: `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="m5 12 14-9-9 14v-10z"/>
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
  
  private renderApiKeyMissingState(): void {
    if (!this.messagesContainer) return;
    
    this.messagesContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center px-4">
        <div class="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-amber-500">
            <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>
        <h3 class="font-semibold mb-2">API Key Required</h3>
        <p class="text-muted-foreground text-xs mb-6">
          Set up your OpenRouter key to start chatting.
        </p>
        <button id="go-to-chat-btn" class="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          Configure Key
        </button>
      </div>
    `;
    
    const goToChatBtn = this.messagesContainer.querySelector('#go-to-chat-btn') as HTMLElement | null;
    if (goToChatBtn) {
      this.addListener(goToChatBtn, 'click', () => {
        store.chatSidebarOpen.set(false);
        router.navigate('/chat');
      });
    }
  }
  
  private renderWelcomeState(): void {
    if (!this.messagesContainer) return;
    
    this.messagesContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center px-4">
        <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-primary">
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
    
    if (!hasApiKey()) {
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
      const errorMessageText = error instanceof Error && error.message === 'NO_API_KEY' 
        ? 'API key missing.' 
        : 'Error processing request.';
        
      if (error instanceof Error && error.message === 'NO_API_KEY') {
        this.apiKeyMissing = true;
        this.messages.pop();
        this.render();
        return;
      }
      
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: errorMessageText,
        createdAt: new Date(),
      };
      this.messages.push(errorMessage);
      this.renderMessages();
    }
    
    this.isLoading = false;
  }
  
  private async getAIResponse(): Promise<string> {
    const apiKey = await decryptApiKey();
    if (!apiKey) throw new Error('NO_API_KEY');
    
    try {
      const response = await fetch(`http://localhost:${await this.getServerPort()}/api/chat/openrouter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          messages: this.messages.map(m => ({ role: m.role, content: m.content })),
          model: this.getModel(),
        }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
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
    const wrapper = createElement('div', { className: `flex ${isUser ? 'justify-end' : 'justify-start'}` });
    const bubble = createElement('div', {
      className: `max-w-[90%] p-3.5 rounded-2xl text-sm leading-relaxed ${
        isUser ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-secondary border border-border/40 rounded-bl-md'
      }`,
      textContent: message.content,
    });
    wrapper.appendChild(bubble);
    return wrapper;
  }
  
  private renderLoadingMessage(): void {
    if (!this.messagesContainer) return;
    const wrapper = createElement('div', { className: 'flex justify-start loading-message' });
    const bubble = createElement('div', { className: 'max-w-[90%] p-3.5 rounded-2xl bg-secondary border border-border/40 rounded-bl-md' });
    bubble.innerHTML = `
      <div class="flex gap-1.5 items-center">
        <div class="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
        <div class="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
        <div class="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
      </div>
    `;
    wrapper.appendChild(bubble);
    this.messagesContainer.appendChild(wrapper);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  
  private updateLoadingMessageContent(content: string): void {
    if (!this.messagesContainer) return;
    const loadingMessage = this.messagesContainer.querySelector('.loading-message');
    if (loadingMessage) {
      const bubble = loadingMessage.querySelector('.bg-secondary');
      if (bubble && content.trim()) {
        bubble.innerHTML = `<p class="text-sm whitespace-pre-wrap leading-relaxed">${content}</p>`;
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }
  }
}

export default ChatSidebar;
