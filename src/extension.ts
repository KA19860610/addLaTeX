// AddLaTeX: 日本語強制ビルド支援拡張 v1.7（言語自動判定：和文／英文でclass切替）

/*
         ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⣀⣤⣤⣤⣤⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀
         ⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⡿⠛⠉⠉⠙⠛⠋⠉⠉⠉⠛⠛⠿⣷⣦⣄⠀⠀⠀⠀⠀
         ⠀⠀⠀⠀⠀⠀⣰⣿⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⣿⣷⡀⠀⠀
         ⠀⠀⠀⠀⠀⣼⣿⠁⠀⠀⠀⠀⠀⠀⠀🖕⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⡄⠀
         ⠀⠀⠀⠀⣼⣿⠃⠀⠀⠀⠀⣀⣤⣶⣶⣾⣷⣶⣦⣄⡀⠀⠀⠀⠀⠀⠸⣿⣿⡄
         ⠀⠀⠀⣼⣿⠇⠀⠀⠀⣰⣿⡟⠉⠀⠀⠀⠀⠈⠉⢻⣿⣦⠀⠀⠀⠀⠀⠹⣿⣿
         ⠀⠀⣼⣿⠏⠀⠀⠀⠀⣿⣿⡇⠀⠀⣤⣤⣤⣤⠀⠀⢸⣿⣿⠀⠀⠀⠀⠀⠀⢿⣿
         ⠀⣼⣿⡏⠀⠀⠀⠀⠀⢿⣿⣷⡀⠀⠙⠿⠿⠋⠀⣰⣿⡿⠀⠀⠀⠀⠀⠀⠀⢸⣿
         ⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠙⣿⣿⣷⣦⣤⣤⣴⣾⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿
         ⠀⠸⣿⣿⡄⠀⠀⠀⠀⠀⠀⠀⠉⠛⠛⠻⠿⠿⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⡟
         ⠀⠀⠛⢿⣿⣦⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣴⣿⠟⠁
         ⠀⠀⠀⠀⠉⠛⠿⠿⣶⣦⣤⣀⣀⠀⠀⠀⠀⣀⣀⣤⣴⠶⠿⠿⠛⠋⠉⠀⠀⠀⠀
*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function containsJapanese(text: string): boolean {
    const noComment = text.replace(/%.*$/gm, '');
    return /[\u3040-\u30FF\u4E00-\u9FFF]/.test(noComment);
}

function ensureHeaderXeLaTeXCompatible(content: string): string {
    let updated = content;
    updated = updated.replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/, '\\documentclass{article}');

    if (!/\\usepackage\{fontspec\}/.test(updated)) {
        updated = updated.replace(/(\\begin\{document\})/, [
            '\\usepackage{fontspec}',
            '\\usepackage{xeCJK}',
            '\\setmainfont{Times New Roman}',
            '\\setCJKmainfont{MS Mincho}',
            '$1'
        ].join('\n'));
    }

    updated = updated.replace(/\\usepackage(?:\[[^\]]*\])?\{(?:otf|zxjatype|zxjafont)\}\n?/g, '');
    return updated;
}

function ensureHeaderEnglishCompatible(content: string): string {
    let updated = content;
    updated = updated.replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/, '\\documentclass{article}');
    updated = updated.replace(/\\usepackage(?:\[[^\]]*\])?\{(?:otf|zxjatype|zxjafont|fontspec|xeCJK)\}\n?/g, '');
    updated = updated.replace(/\\set(?:CJK)?mainfont\{[^}]+\}\n?/g, '');
    return updated;
}

function enforceXeLaTeXSettings() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const settingsDir = path.join(rootPath, '.vscode');
    const settingsPath = path.join(settingsDir, 'settings.json');

    if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir);

    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
        try {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch {
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

        let updatedContent = content;
        if (hasJP) {
            updatedContent = ensureHeaderXeLaTeXCompatible(content);
        } else {
            updatedContent = ensureHeaderEnglishCompatible(content);
        }

        if (updatedContent !== content) {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );
            edit.replace(document.uri, fullRange, updatedContent);
            vscode.workspace.applyEdit(edit).then(() => {
                document.save().then(() => {
                    vscode.commands.executeCommand('latex-workshop.build');
                    vscode.window.showInformationMessage('言語検出に基づいてヘッダーを書き換え、ビルドを実行したぞ！');
                });
            });
        } else {
            vscode.commands.executeCommand('latex-workshop.build');
        }
    });
}

export function deactivate() {}
