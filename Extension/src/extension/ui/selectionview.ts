
'use strict';

import * as Vscode from "vscode";
import { Command } from "../command/command";
import { InputModel } from "../model/model";

export interface SelectionView<T> {
    readonly controller: Command;
    readonly model: InputModel<T>;
    defaultText: string;
    label: string;

    show(): void;
    hide(): void;
}

class SelectionViewImpl<T> implements SelectionView<T> {
    private ui: Vscode.StatusBarItem;
    private defaultText_: string;
    private label_: string;

    readonly controller: Command;
    readonly model: InputModel<T>;

    constructor(controller: Command, model: InputModel<T>, priority?: number) {
        this.controller = controller;
        this.model = model;

        this.model.addOnSelectedHandler(this.onSelectionChanged, this);

        this.ui = Vscode.window.createStatusBarItem(Vscode.StatusBarAlignment.Left, priority);
        this.ui.command = this.controller.command;

        this.label_ = "Select: ";
        this.defaultText_ = "Nothing selected";
    }

    get label(): string {
        return this.label_;
    }

    set label(value: string) {
        if (this.label_ !== value) {
            this.label_ = value;
            this.updateText();
        }
    }

    get defaultText(): string {
        return this.defaultText_;
    }

    set defaultText(value: string) {
        if (this.defaultText_ !== value) {
            this.defaultText_ = value;
            this.updateText();
        }
    }

    public show() {
        this.ui.show();
    }

    public hide() {
        this.ui.hide();
    }

    private onSelectionChanged(): void {
        this.updateText();
    }

    private updateText(): void {
        if (this.model.selected) {
            this.ui.text = this.label_ + this.model.selectedText;
        } else {
            this.ui.text = this.label_ + this.defaultText_;
        }
    }
}

export namespace SelectionView {

    export function createSelectionView<T>(controller: Command, model: InputModel<T>, priority?: number) {
        return new SelectionViewImpl(controller, model, priority);
    }
}
