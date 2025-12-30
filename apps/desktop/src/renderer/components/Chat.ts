/**
 * Chat Component
 * Blank page for chat functionality - Terminal styled
 */

import { Component } from './Component';
import { createElement } from '../utils/dom';

export class Chat extends Component {
  async init(): Promise<void> {
    this.render();
  }
  
  render(): void {
    this.container.innerHTML = '';
    // Don't override container className - it has overflow-y-auto from Layout
    
    // Terminal-styled chat container
    const wrapper = createElement('div', {
      className: 'flex flex-col w-full h-full relative',
    });
    
    // Chat messages area (empty for now) - takes available space with bottom padding for input
    const messagesArea = createElement('div', {
      className: 'flex-1 p-6 overflow-y-auto pb-24',
    });
    wrapper.appendChild(messagesArea);
    
    // Input area - fixed at bottom, matching sidebar footer exactly
    // Sidebar footer has: border-t + p-4 (1rem all sides)
    // Border-t extends left to match content area padding (p-6 = 1.5rem) + a bit more
    // Padding only applied to content inside
    // Positioned slightly higher and extends fully to right edge
    const inputArea = createElement('div', {
      className: 'border-t border-border bg-background',
      attributes: {
        style: 'position: fixed; bottom: 0.75rem; left: calc(16rem - 2rem); right: 0; z-index: 10; padding-top: 1rem; padding-bottom: 1rem; padding-right: 0;',
      },
    });
    
    const inputWrapper = createElement('div', {
      className: 'flex items-center gap-2 pl-4 pr-4',
    });
    
    const inputLabel = createElement('span', {
      className: 'font-mono text-muted-foreground',
      textContent: '>',
    });
    inputWrapper.appendChild(inputLabel);
    
    const input = createElement('input', {
      className: 'flex-1 bg-transparent border-none outline-none font-mono text-foreground placeholder:text-muted-foreground/50',
      attributes: {
        type: 'text',
        placeholder: 'Type a message...',
        disabled: 'true',
      },
    });
    inputWrapper.appendChild(input);
    
    inputArea.appendChild(inputWrapper);
    
    // Append input area to container (not wrapper) so it's fixed relative to viewport
    this.container.appendChild(wrapper);
    this.container.appendChild(inputArea);
  }
}

export default Chat;

