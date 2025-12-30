/**
 * Onboarding Component
 * Welcome flow for new users
 */

import { Component } from './Component';
import { store, actions } from '../store';
import { router } from '../router';
import { fetchAppsWithCache } from '../api';
import { createElement, clearChildren } from '../utils/dom';
import type { AppServer } from '../types';

// Import icon
import iconImage from '@/assets/images/icon.png';

type OnboardingStep = 1 | 2 | 3;

export class Onboarding extends Component {
  private currentStep: OnboardingStep = 1;
  private selectedApps = new Set<string>();
  private contentContainer: HTMLElement | null = null;
  
  async init(): Promise<void> {
    this.render();
    
    // Prefetch apps for step 2
    fetchAppsWithCache();
  }
  
  render(): void {
    this.container.innerHTML = '';
    // Don't override container className - it has overflow-y-auto from Layout
    
    // Create inner wrapper for onboarding content
    const wrapper = createElement('div', {
      className: 'flex flex-col h-full w-full max-w-4xl mx-auto px-6 relative',
    });
    
    // Skip button (visible on step 2)
    if (this.currentStep === 2) {
      const skipButton = createElement('button', {
        className: 'absolute bottom-4 right-6 px-4 py-2 border hover:bg-accent transition-colors font-mono uppercase tracking-wider text-sm',
        textContent: 'Skip',
      });
      this.addListener(skipButton, 'click', () => this.completeOnboarding());
      wrapper.appendChild(skipButton);
    }
    
    // Main content area
    this.contentContainer = createElement('div', {
      className: 'flex-1 flex items-center justify-center',
    });
    this.renderStep();
    wrapper.appendChild(this.contentContainer);
    
    // Step indicators
    const indicators = this.createStepIndicators();
    wrapper.appendChild(indicators);
    
    this.container.appendChild(wrapper);
  }
  
  private renderStep(): void {
    if (!this.contentContainer) return;
    clearChildren(this.contentContainer);
    
    switch (this.currentStep) {
      case 1:
        this.renderWelcomeStep();
        break;
      case 2:
        this.renderConnectAppsStep();
        break;
      case 3:
        this.renderCompleteStep();
        break;
    }
  }
  
  private renderWelcomeStep(): void {
    if (!this.contentContainer) return;
    
    const wrapper = createElement('div', {
      className: 'flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700',
    });
    
    // Logo
    const logoWrapper = createElement('div', {
      className: 'relative',
    });
    const logo = createElement('img', {
      className: 'h-24 w-24 object-contain animate-in zoom-in duration-500',
      attributes: {
        src: iconImage,
        alt: 'Cortex',
      },
    });
    logoWrapper.appendChild(logo);
    wrapper.appendChild(logoWrapper);
    
    // Title and subtitle
    const textWrapper = createElement('div', {
      className: 'text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700',
    });
    textWrapper.innerHTML = `
      <h1 class="text-5xl font-mono uppercase tracking-wider">
        Cortex
      </h1>
      <p class="text-xl text-muted-foreground max-w-md font-mono">
        Your life in one app
      </p>
    `;
    wrapper.appendChild(textWrapper);
    
    // Continue button
    const continueButton = createElement('button', {
      className: 'mt-8 px-6 py-3 bg-primary text-primary-foreground flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 font-mono uppercase tracking-wider',
      innerHTML: `
        Continue
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      `,
    });
    this.addListener(continueButton, 'click', () => this.nextStep());
    wrapper.appendChild(continueButton);
    
    this.contentContainer.appendChild(wrapper);
  }
  
  private async renderConnectAppsStep(): Promise<void> {
    if (!this.contentContainer) return;
    
    const wrapper = createElement('div', {
      className: 'flex flex-col items-center justify-center space-y-8 w-full animate-in fade-in slide-in-from-right-4 duration-500',
    });
    
    // Title
    const titleWrapper = createElement('div', {
      className: 'text-center space-y-2',
    });
    titleWrapper.innerHTML = `
      <h2 class="text-4xl font-mono uppercase tracking-wider">Connect Your Apps</h2>
      <p class="text-lg text-muted-foreground">
        Link your favorite apps to see everything in one place
      </p>
    `;
    wrapper.appendChild(titleWrapper);
    
    // Apps grid
    const appsContainer = createElement('div', {
      className: 'w-full max-w-2xl',
    });
    
    const apps = store.apps.get();
    
    if (apps.length === 0) {
      appsContainer.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          ${[1, 2, 3, 4, 5, 6].map(() => '<div class="h-24 border bg-muted animate-pulse"></div>').join('')}
        </div>
      `;
    } else {
      const grid = createElement('div', {
        className: 'grid grid-cols-2 md:grid-cols-3 gap-4',
      });
      
      for (const app of apps.slice(0, 6)) {
        const card = this.createAppCard(app);
        grid.appendChild(card);
      }
      
      appsContainer.appendChild(grid);
    }
    
    wrapper.appendChild(appsContainer);
    
    // Navigation buttons
    const navWrapper = createElement('div', {
      className: 'flex justify-center items-center gap-3',
    });
    
    const backButton = createElement('button', {
      className: 'px-4 py-2 border flex items-center gap-2 hover:bg-accent transition-colors font-mono uppercase tracking-wider text-sm',
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        Back
      `,
    });
    this.addListener(backButton, 'click', () => this.prevStep());
    navWrapper.appendChild(backButton);
    
    const continueButton = createElement('button', {
      className: `px-4 py-2 bg-primary text-primary-foreground flex items-center gap-2 font-mono uppercase tracking-wider text-sm ${
        this.selectedApps.size === 0 ? 'opacity-50 cursor-not-allowed' : ''
      }`,
      innerHTML: `
        Continue
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      `,
    });
    if (this.selectedApps.size > 0) {
      this.addListener(continueButton, 'click', () => this.nextStep());
    }
    navWrapper.appendChild(continueButton);
    
    wrapper.appendChild(navWrapper);
    this.contentContainer.appendChild(wrapper);
  }
  
  private createAppCard(app: AppServer): HTMLElement {
    const isSelected = this.selectedApps.has(app.id);
    const isConnected = app.connection?.status === 'connected';
    
    const card = createElement('button', {
      className: `group relative flex flex-col items-center justify-center p-6 border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-primary bg-accent'
          : 'border-border bg-card hover:bg-accent'
      }`,
    });
    
    // Icon
    if (app.iconUrl) {
      const icon = createElement('img', {
        className: 'h-12 w-12 object-contain mb-3',
        attributes: {
          src: app.iconUrl,
          alt: app.name,
        },
      });
      card.appendChild(icon);
    }
    
    // Name
    const name = createElement('p', {
      className: 'text-sm font-mono uppercase tracking-wider text-center',
      textContent: app.name,
    });
    card.appendChild(name);
    
    // Selection indicator
    if (isSelected) {
      const indicator = createElement('div', {
        className: 'absolute top-2 right-2 w-2 h-2 bg-primary',
      });
      card.appendChild(indicator);
    } else if (isConnected) {
      const indicator = createElement('div', {
        className: 'absolute top-2 right-2 w-2 h-2 bg-status-connected',
      });
      card.appendChild(indicator);
    }
    
    // Click handler
    this.addListener(card, 'click', () => {
      if (this.selectedApps.has(app.id)) {
        this.selectedApps.delete(app.id);
      } else {
        this.selectedApps.add(app.id);
      }
      this.render();
    });
    
    return card;
  }
  
  private renderCompleteStep(): void {
    if (!this.contentContainer) return;
    
    const wrapper = createElement('div', {
      className: 'flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500',
    });
    
    // Success icon
    const iconWrapper = createElement('div', {
      className: 'relative',
    });
    iconWrapper.innerHTML = `
      <div class="relative bg-card p-8 border border-status-connected">
        <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-status-connected animate-in zoom-in duration-500">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
    `;
    wrapper.appendChild(iconWrapper);
    
    // Title and subtitle
    const textWrapper = createElement('div', {
      className: 'text-center space-y-4',
    });
    textWrapper.innerHTML = `
      <h2 class="text-4xl font-mono uppercase tracking-wider">You're All Set!</h2>
      <p class="text-lg text-muted-foreground max-w-md">
        Start exploring your unified timeline and connect more apps anytime from Settings.
      </p>
    `;
    wrapper.appendChild(textWrapper);
    
    // Get started button
    const startButton = createElement('button', {
      className: 'mt-4 px-6 py-3 bg-primary text-primary-foreground flex items-center gap-2 font-mono uppercase tracking-wider',
      innerHTML: `
        Get Started
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      `,
    });
    this.addListener(startButton, 'click', () => this.completeOnboarding());
    wrapper.appendChild(startButton);
    
    this.contentContainer.appendChild(wrapper);
  }
  
  private createStepIndicators(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'flex justify-center gap-2 pb-4',
    });
    
    for (let i = 1; i <= 3; i++) {
      const dot = createElement('div', {
        className: `h-2 transition-all duration-300 ${
          this.currentStep === i
            ? 'bg-primary w-8'
            : 'bg-muted-foreground/30 w-2'
        }`,
      });
      wrapper.appendChild(dot);
    }
    
    return wrapper;
  }
  
  private nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep = (this.currentStep + 1) as OnboardingStep;
      this.render();
    }
  }
  
  private prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as OnboardingStep;
      this.render();
    }
  }
  
  private completeOnboarding(): void {
    actions.completeOnboarding();
    router.navigate('/');
  }
}

export default Onboarding;

