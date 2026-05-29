import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import {
  applyConfigToElement,
  copyScriptDatasetToElement,
  readElementConfig,
  readScriptConfig,
} from './utils/config';
import styles from './styles.css?inline';
import type { ChatWidgetConfig, WidgetController } from './types';

const ELEMENT_NAME = 'xchannel-chat-widget';

class XChannelChatWidgetElement extends HTMLElement {
  private reactRoot?: Root;
  private mountPoint?: HTMLDivElement;
  private controller?: WidgetController;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      this.mountPoint = document.createElement('div');

      style.textContent = styles;
      shadow.append(style, this.mountPoint);
    }

    this.renderWidget();
  }

  disconnectedCallback(): void {
    this.reactRoot?.unmount();
    this.reactRoot = undefined;
  }

  open(): void {
    this.controller?.open();
  }

  close(): void {
    this.controller?.close();
  }

  toggle(): void {
    this.controller?.toggle();
  }

  destroy(): void {
    this.controller?.destroy();
  }

  private renderWidget(): void {
    if (!this.mountPoint) {
      return;
    }

    const config = readElementConfig(this);
    this.mountPoint.replaceChildren();
    this.reactRoot ??= createRoot(this.mountPoint);
    this.reactRoot.render(
      <React.StrictMode>
        <App
          config={config}
          host={this}
          onControllerReady={(controller) => {
            this.controller = controller;
          }}
        />
      </React.StrictMode>
    );
  }
}

if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, XChannelChatWidgetElement);
}

function autoInstall(): HTMLElement | null {
  const script = findLoaderScript();

  if (script?.dataset.autoInit === 'false') {
    return null;
  }

  const existing = document.querySelector(ELEMENT_NAME);

  if (existing) {
    return existing as HTMLElement;
  }

  const element = document.createElement(ELEMENT_NAME);

  if (script) {
    copyScriptDatasetToElement(script, element);
  } else {
    applyConfigToElement(element, readScriptConfig(null));
  }

  document.body.appendChild(element);
  return element;
}

function findLoaderScript(): HTMLScriptElement | null {
  const currentScript = document.currentScript;

  if (currentScript instanceof HTMLScriptElement) {
    return currentScript;
  }

  return document.querySelector(
    'script[data-xchannel-webchat], script[data-widget-key]'
  );
}

function installWhenReady(): void {
  if (document.body) {
    autoInstall();
    return;
  }

  window.addEventListener('DOMContentLoaded', () => autoInstall(), { once: true });
}

window.XChannelWebChat = {
  init: (options: Partial<ChatWidgetConfig> = {}) => {
    const element = document.createElement(ELEMENT_NAME);
    applyConfigToElement(element, {
      ...readScriptConfig(null),
      ...options,
    });
    document.body.appendChild(element);
    return element;
  },
  open: () => findWidget()?.open(),
  close: () => findWidget()?.close(),
  toggle: () => findWidget()?.toggle(),
  destroy: () => findWidget()?.destroy(),
};

installWhenReady();

function findWidget(): XChannelChatWidgetElement | null {
  return document.querySelector(ELEMENT_NAME) as XChannelChatWidgetElement | null;
}

export {};
