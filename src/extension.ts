// Activate時
//・TeX Liveのインストール有無確認
//・LaTeX Workshopのインストール有無確認
//・.vscode/ 下の設定が存在するときだけ動作する
//　.vscode/settings.json が存在しない場合は拡張が自動生成
//・拡張機能インストール時に "addlatex.mainFile" は設定しない
//・texファイル保存時に、mainFile が未定義なら「このファイルを設定しますか？」と確認
//・settings.json に「このファイルは AddLaTeX によって管理されています」旨の note プロパティを追加

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function containsJapaneseExcludingComments(content: string): boolean {
    const noComment = content.replace(/%.*$/gm, '');
    const japanesePattern = /[\u3040-\u30FF\u4E00-\u9FFF]/;
    return japanesePattern.test(noComment);
}

export function activate(context: vscode.ExtensionContext) {
    console.log('AddLaTeX 拡張機能が起動したぞ！');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const vscodeDir = path.join(rootPath, '.vscode');
    const settingsPath = path.join(vscodeDir, 'AddLaTeXsettings.json');

    // TeX Live のインストール確認
    try {
        const result = process.platform === 'win32'
            ? execSync('where pdflatex')
            : execSync('which pdflatex');
        console.log('TeX Live が見つかったぞ！');
    } catch {
        vscode.window.showWarningMessage('TeX Live が見つかりません。LaTeX のビルドに失敗する可能性があります。');
    }

    // LaTeX Workshop の拡張があるか確認
    const latexWorkshop = vscode.extensions.getExtension('James-Yu.latex-workshop');
    if (!latexWorkshop) {
        vscode.window.showWarningMessage('LaTeX Workshop 拡張機能がインストールされていません。PDFビルドができません。');
    } else {
        console.log('LaTeX Workshop は正常にインストールされておるぞ。');
    }

    try {
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir);
        }

        if (!fs.existsSync(settingsPath)) {
            const defaultSettings = {
                "addlatex.__note": "このファイルは AddLaTeX によって自動生成・管理されています。削除や変更は自己責任で行ってください。",
                "addlatex.MainRecipe": "AutoEN",
                "addlatex.ENRecipe1": "AddLaTeX: pdfLaTeX",
                "addlatex.ENRecipe2": "AddLaTeX: XeLaTeX",
                "addlatex.ENRecipe3": "AddLaTeX: LuaLaTeX",
                "addlatex.JPRecipe1": "AddLaTeX: upLaTeX + dvipdfmx",
                "addlatex.JPRecipe2": "AddLaTeX: XeLaTeX (Japanese)",
                "addlatex.JPRecipe3": "AddLaTeX: LuaLaTeX (with luatexja)",
                "addlatex.AutoJP1": "AddLaTeX: upLaTeX + dvipdfmx",
                "addlatex.AutoJP2": "AddLaTeX: XeLaTeX (Japanese)",
                "addlatex.AutoEN": "AddLaTeX: pdfLaTeX"
            };
            fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 4));
        }

        // LaTeX Workshop 用の recipe/tools 追記
        const workshopSettingsPath = path.join(vscodeDir, 'settings.json');
        let workshopSettings: { [key: string]: any } = {};
        if (fs.existsSync(workshopSettingsPath)) {
            workshopSettings = JSON.parse(fs.readFileSync(workshopSettingsPath, 'utf8'));
        }

        const ensureArray = (obj: any, key: string) => {
            if (!obj[key]) obj[key] = [];
            if (!Array.isArray(obj[key])) obj[key] = [];
        };

        ensureArray(workshopSettings, 'latex-workshop.latex.tools');
        ensureArray(workshopSettings, 'latex-workshop.latex.recipes');

        const toolsToAdd = [
            {
                name: 'addlatex-uplatex+dvipdfmx',
                command: 'latexmk',
                args: [
                    '-synctex=1',
                    '-interaction=nonstopmode',
                    '-file-line-error',
                    '-e', "$latex=q/uplatex %O -synctex=1 -interaction=nonstopmode %S/",
                    '-e', "$dvipdf=q/dvipdfmx %O -o %D %S/",
                    '-pdfdvi',
                    '%DOC%'
                ]
            },
            {
                name: 'addlatex-pdflatex',
                command: 'pdflatex',
                args: ['-synctex=1', '-interaction=nonstopmode', '-file-line-error', '%DOC%']
            }
        ];

        const recipesToAdd = [
            {
                name: 'AddLaTeX: upLaTeX + dvipdfmx',
                tools: ['addlatex-uplatex+dvipdfmx']
            },
            {
                name: 'AddLaTeX: pdfLaTeX',
                tools: ['addlatex-pdflatex']
            }
        ];

        for (const tool of toolsToAdd) {
            if (!workshopSettings['latex-workshop.latex.tools'].some((t: any) => t.name === tool.name)) {
                workshopSettings['latex-workshop.latex.tools'].push(tool);
            }
        }

        for (const recipe of recipesToAdd) {
            if (!workshopSettings['latex-workshop.latex.recipes'].some((r: any) => r.name === recipe.name)) {
                workshopSettings['latex-workshop.latex.recipes'].push(recipe);
            }
        }

        fs.writeFileSync(workshopSettingsPath, JSON.stringify(workshopSettings, null, 4));
    } catch (err) {
        console.error('AddLaTeX 初期化中にエラーが発生したぞ！', err);
    }

    // 保存時にmainFileを提案し、自動ビルドを行う
    vscode.workspace.onDidSaveTextDocument((document) => {
        const fileName = path.basename(document.uri.fsPath);
        const ext = path.extname(fileName);
        if (ext !== '.tex') return;

        try {
            if (!fs.existsSync(settingsPath)) return;
            const raw = fs.readFileSync(settingsPath, 'utf8');
            const settings: { [key: string]: any } = JSON.parse(raw);

            if (!settings['addlatex.mainFile']) {
                vscode.window.showInformationMessage(
                    `"${fileName}" を LaTeXビルドのメインファイルとして設定しますか？`,
                    'はい', 'いいえ'
                ).then(selection => {
                    if (selection === 'はい') {
                        settings['addlatex.mainFile'] = fileName;
                        if (!settings['addlatex.__note']) {
                            settings['addlatex.__note'] = "このファイルは AddLaTeX によって自動生成・管理されています。削除や変更は自己責任で行ってください。";
                        }
                        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
                        vscode.window.showInformationMessage(`"${fileName}" をビルド対象に設定しました`);
                    }
                });
            }

            const content = document.getText();
            const hasJapanese = containsJapaneseExcludingComments(content);

            // レシピ推定（パッケージ使用状況による上書きを含む）
            const usesZxjatype = /\\usepackage(?:\\[[^\\]]*\\])?\\{zxjatype\\}/.test(content);
            const usesOtfDeluxe = /\\usepackage\\[deluxe\\]\\{otf\\}/.test(content);

            function detectRecipeFromHeader(): string {
                if (hasJapanese && usesZxjatype) return 'AutoJP2'; // XeLaTeX 強制
                if (hasJapanese && usesOtfDeluxe) return 'AutoJP1'; // upLaTeX 強制
                return hasJapanese ? 'AutoJP1' : 'AutoEN';
            }

            const expectedRecipe = detectRecipeFromHeader();

            const noComment = content.replace(/%.*$/gm, '');
            const fullWidthAlphaNumericPattern = /[\uFF01-\uFF5E]/; // ！-～までの特殊記号
            const hasFullWidthAlpha = fullWidthAlphaNumericPattern.test(noComment);
            if (hasFullWidthAlpha) {
                vscode.window.showWarningMessage('全角アルファベットや記号が含まれています。IMEの切り替えミスかもしれません。');
            }
            console.log(`日本語判定: ${hasJapanese}`);

            // 言語に応じて MainRecipe を初回自動設定（AutoJP1/AutoEN 経由で）
            // ヘッダー書き換え（推奨構成への変換）
            let updatedContent = content;
            let headerModified = false;

            if (!hasJapanese) {
                // 英語文書 → article + inputenc に置き換え
                updatedContent = updatedContent
                    .replace(/\\documentclass(?:\\[[^\\]]*\\])?\\{[^}]+\\}/, '\\\\documentclass{article}')
                    .replace(/\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*inputenc[^}]*\\}/, '')
                    .replace(/(\\\\documentclass\\{article\\})/, '$1\\n\\\\usepackage[utf8]{inputenc}');
                headerModified = true;
            } else if (/\\documentclass(?:\\[[^\\]]*\\])?\\{article\\}/.test(content) && /\\usepackage(?:\\[[^\\]]*\\])?\\{inputenc\\}/.test(content)) {
                // 日本語あり + 欧文構成 → jsarticle + otf に変換
                updatedContent = updatedContent
                    .replace(/\\documentclass(?:\\[[^\\]]*\\])?\\{article\\}/, '\\\\documentclass[uplatex]{jsarticle}')
                    .replace(/\\usepackage(?:\\[[^\\]]*\\])?\\{inputenc\\}/, '\\\\usepackage[deluxe]{otf}');
                headerModified = true;
            }


            if (headerModified && updatedContent !== content) {
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(content.length)
                );
                edit.replace(document.uri, fullRange, updatedContent);
                vscode.workspace.applyEdit(edit).then(() => {
                    console.log('ヘッダーを推奨構成に書き換えたぞ！');
                });
            }
            const currentRecipe: string = settings['addlatex.MainRecipe'] ?? '';
            if (!currentRecipe || currentRecipe === 'AutoJP1' || currentRecipe === 'AutoEN') {
                settings['addlatex.MainRecipe'] = expectedRecipe;
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
                console.log(`MainRecipe を "${expectedRecipe}" に更新したぞ！`);

                // 自動ビルドを実行
                const recipeName = settings[`addlatex.${expectedRecipe}`];
                if (recipeName && settings['addlatex.mainFile'] === fileName) {
                    vscode.commands.executeCommand('latex-workshop.build', { recipe: recipeName });
                    console.log(`LaTeX Workshop にレシピ "${recipeName}" を渡してビルドしたぞ！`);
                }
            } else {
                console.log(`MainRecipe (${currentRecipe}) は手動設定とみなされ、自動変更は行わない。`);
            }

        }
        catch (err) {
            console.error('保存時の設定更新エラー:', err);
        }
    });
}
