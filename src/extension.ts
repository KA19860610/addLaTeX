// Activate時
//・TeX Liveのインストール有無確認
//・LaTeX Workshopのインストール有無確認
//・.vscode/ 下の設定が存在するときだけ動作する
//　.vscode/settings.json が存在しない場合は拡張が自動生成
//・拡張機能インストール時に "addlatex.mainFile" は設定しない
//・texファイル保存時に、mainFile が未定義なら「このファイルを設定しますか？」と確認

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    console.log('AddLaTeX 拡張機能が起動したぞ！');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const vscodeDir = path.join(rootPath, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

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
            fs.writeFileSync(settingsPath, '{}');
        }
    } catch (err) {
        console.error('AddLaTeX 初期化中にエラーが発生したぞ！', err);
    }

    // 保存時にmainFileを提案する
    vscode.workspace.onDidSaveTextDocument((document) => {
        const fileName = path.basename(document.uri.fsPath);
        const ext = path.extname(fileName);
        if (ext !== '.tex') return;

        try {
            const raw = fs.readFileSync(settingsPath, 'utf8');
            const settings: { [key: string]: any } = JSON.parse(raw);

            if (!settings['addlatex.mainFile']) {
                vscode.window.showInformationMessage(
                    `"${fileName}" を LaTeXビルドのメインファイルとして設定しますか？`,
                    'はい', 'いいえ'
                ).then(selection => {
                    if (selection === 'はい') {
                        settings['addlatex.mainFile'] = fileName;
                        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
                        vscode.window.showInformationMessage(`"${fileName}" をビルド対象に設定しました`);
                    }
                });
            }
        } catch (err) {
            console.error('保存時の設定更新エラー:', err);
        }
    });
}

export function deactivate() {}


//・settings.jsonにLaTeX Workshopの設定として複数レシピを追記
//・texファイルのコメント以外に日本語が含まれていれば「\documentclass[uplatex,dvipdfmx]{jsarticle}」を
//　コメント以外に日本語が含まれていなければ「\documentclass{article}」を自動でdocumentclassを変更
//・LaTeXでPDFを作る際、「日本語」「英語」「日本語＋英語」に応じてレシピを自動選択してビルド
//・日本語の場合はデフォルトのフォントとしてどのOSにも入っているであろう日本語用フォントを設定

//・*.sty や *.cls ファイルなどは処理対象外にする
//・レシピ名が固定で "PDFLaTeX", "XeLaTeX", "upLaTeX + dvipdfmx" など前提
//・日本語文字（平仮名・漢字）がコメント以外で1つでもあれば「日本語扱い」にする
