// AddLaTeX: 日本語強制ビルド支援拡張 v1.6（フォント依存潰し／Winデフォフォントに固定）

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function containsJapanese(text: string): boolean {
    const noComment = text.replace(/%.*$/gm, '');
    return /[\u3040-\u30FF\u4E00-\u9FFF]/.test(noComment);
}

function ensureHeaderXeLaTeXCompatible(content: string): string {
    let updated = content;

    // 完全に pLaTeX クラス破壊（jsarticle等）
    updated = updated.replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/, '\\documentclass{article}');

    // 日本語処理に必要な最低限の XeLaTeX パッケージ構成（Windows環境で確実にあるフォント）
    if (!/\\usepackage\{fontspec\}/.test(updated)) {
        updated = updated.replace(/(\\begin\{document\})/, [
            '\\usepackage{fontspec}',
            '\\usepackage{xeCJK}',
            '\\setmainfont{Times New Roman}',
            '\\setCJKmainfont{MS Mincho}',
            '$1'
        ].join('\n'));
    }

    // otf.sty / zxjatype / zxjafont など pLaTeX 系残骸を完全除去（オプション付きも）
    updated = updated.replace(/\\usepackage(?:\[[^\]]*\])?\{(?:otf|zxjatype|zxjafont)\}\n?/g, '');

    return updated;
}

function enforceXeLaTeXSettings() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const settingsDir = path.join(rootPath, '.vscode');
    const settingsPath = path.join(settingsDir, 'settings.json');

    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir);
    }

    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
        try {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (e) {
            vscode.window.showWarningMessage('settings.json の読み込みに失敗したため初期化するぞい。');
        }
    }

    settings['latex-workshop.latex.recipes'] = [
        {
            name: 'AddLaTeX: XeLaTeX (Japanese)',
            tools: ['addlatex-xelatex']
        }
    ];

    settings['latex-workshop.latex.tools'] = [
        {
            name: 'addlatex-xelatex',
            command: 'xelatex',
            args: ['-synctex=1', '-interaction=nonstopmode', '-file-line-error', '%DOC%']
        }
    ];

    settings['latex-workshop.latex.recipe.default'] = 'AddLaTeX: XeLaTeX (Japanese)';

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
    vscode.window.showInformationMessage('XeLaTeX 設定を .vscode/settings.json に強制書き込み完了じゃ！');
}

export function activate(context: vscode.ExtensionContext) {
    enforceXeLaTeXSettings();

    vscode.workspace.onDidSaveTextDocument((document) => {
        const fileName = path.basename(document.uri.fsPath);
        const ext = path.extname(fileName);
        if (ext !== '.tex') return;

        const content = document.getText();
        const hasJP = containsJapanese(content);
        const updatedContent = hasJP ? ensureHeaderXeLaTeXCompatible(content) : content;

        if (hasJP && updatedContent !== content) {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );
            edit.replace(document.uri, fullRange, updatedContent);
            vscode.workspace.applyEdit(edit).then(() => {
                document.save().then(() => {
                    vscode.commands.executeCommand('latex-workshop.build');
                    vscode.window.showInformationMessage('pLaTeXを完全に駆逐してXeLaTeX構成に変換したぞ！');
                });
            });
        } else {
            vscode.commands.executeCommand('latex-workshop.build');
        }
    });
}

export function deactivate() {}
