import { workspace, window, commands, TextDocumentContentProvider,
    Event, Uri, TextDocumentChangeEvent, ViewColumn, EventEmitter,
    TextDocument, Disposable } from "vscode";
import * as path from "path";
import fileUrl = require("file-url");
import { SourceType } from "./extension";

export class HtmlDocumentView {
    private provider: HtmlDocumentContentProvider;
    private registrations: Disposable[] = [];
    private title: string;
    private previewUri: Uri;
    private doc: TextDocument;

    constructor(document: TextDocument) {
        this.doc = document;
        this.title = `Preview: '${path.basename(window.activeTextEditor.document.fileName)}'`;
        this.provider = new HtmlDocumentContentProvider(this.doc);
        this.registrations.push(workspace.registerTextDocumentContentProvider("cmacc-preview", this.provider));
        this.previewUri = Uri.parse(`cmacc-preview://preview/${this.title}`);
        this.registerEvents();
    }
    
    public get uri(): Uri {
        return this.previewUri;
    }

    private registerEvents() {
        this.registrations.push(workspace.onDidSaveTextDocument((e: TextDocument) => {
            this.provider.update(this.previewUri);
        }));
    }

    private get visible(): boolean {
        for (let i in window.visibleTextEditors) {
            if (window.visibleTextEditors[i].document.uri === this.previewUri) {
                return true;
            }
        }
        return false;
    }

    public executeToggle(column: ViewColumn) {
        if (this.visible) {
            window.showTextDocument(this.doc, column);
            this.visible = false;
        } else {
            this.execute(column);
        }
    }

    public executeSide(column: ViewColumn) {
        this.execute(column);
    }

    private execute(column: ViewColumn) {
        commands.executeCommand("vscode.previewHtml", this.previewUri, column).then((success) => {
        }, (reason) => {
            console.warn(reason);
            window.showErrorMessage(reason);
        });
    }
    
    public dispose() {
        for (let i in this.registrations) {
            this.registrations[i].dispose();
        }
    }
}

class HtmlDocumentContentProvider implements TextDocumentContentProvider {
    private _onDidChange = new EventEmitter<Uri>();
    private doc: TextDocument;

    constructor(document: TextDocument) {
        this.doc = document;
    }

    public provideTextDocumentContent(uri: Uri): string {
        return this.createHtmlSnippet();
    }

    get onDidChange(): Event<Uri> {
        return this._onDidChange.event;
    }

    public update(uri: Uri) {
        this._onDidChange.fire(uri);
    }

    private createHtmlSnippet(): string {
        if (this.doc.languageId !== "cmacc") {
            return this.errorSnippet("Active editor doesn't show a cmacc.");
        }
        return this.preview();
    }

    private errorSnippet(error: string): string {
        return `
                <body>
                    ${error}
                </body>`;
    }

    private render(): string {

        var cmacc = require('cmacc-compiler');
        var path = require('path');

        var text = this.doc.getText();
        var file = this.doc.fileName

        var options = {
            path: 'file://' + path.dirname(file)
        };

        try{
            var ast = cmacc.compile(text, options)
            var md = cmacc.resolve(ast);
            var html = cmacc.marked(md);
            
            return html

        }catch (e){
            window.showErrorMessage(e.message);
            return ''
        }


        
    }

    public preview(): string {
        return this.render();
    }
}
