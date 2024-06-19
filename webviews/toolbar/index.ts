/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export {};

const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
    customElements.define("tooltip-container", Tooltip);
    const buttons = document.getElementsByClassName("task-button");
    for (let i = 0; i < buttons.length; i++) {
        buttons.item(i)?.addEventListener("click", _ev => {
            vscode.postMessage({ id: buttons.item(i)?.id });
        });
    }
}

class Tooltip extends HTMLElement {
    private trigger: HTMLElement | null = null;
    private popup: HTMLElement | null = null;
    private popupContent: HTMLElement | null = null;

    connectedCallback() {
        this.trigger = this.querySelector(".tooltip-trigger");
        this.popup = this.querySelector(".tooltip-popup");
        this.popupContent = this.querySelector(".tooltip-popup-content");

        this.trigger?.addEventListener("mouseover", this.updatePopupPos.bind(this));
    }

    updatePopupPos() {
        const padding = 8;

        if (!this.popup || !this.trigger || !this.popupContent) {
            return;
        }

        const popupBounds = this.popup.getBoundingClientRect();
        const triggerBounds = this.trigger.getBoundingClientRect();

        if (popupBounds.x + popupBounds.width + 2*padding > window.innerWidth) {
            this.popupContent.style.width = window.innerWidth - 2*padding + "px";
        }
        if (popupBounds.x < 0) {
            this.popup.style.left = "0";
            this.popup.style.right = "auto";
            this.popup.style.transform = `translateX(${-triggerBounds.x + padding}px)`;
        } else if (popupBounds.x + popupBounds.width > window.innerWidth) {
            this.popup.style.left = "auto";
            this.popup.style.right = "0";
            const triggerRightX = triggerBounds.x + triggerBounds.width;
            this.popup.style.transform = `translateX(${(window.innerWidth - triggerRightX) - padding}px)`;
        }
    }
}

