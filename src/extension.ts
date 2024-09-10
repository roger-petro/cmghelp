import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let keywordData: { [key: string]: { description: string; url: string } } = {};

export function activate(context: vscode.ExtensionContext) {
    // Caminho para o arquivo JSON contendo as descrições e URLs
    const filePath = path.join(context.extensionPath, 'src', 'keywords.json');
	console.log("Ativando a extensão");
    // Carregar o arquivo JSON
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Erro ao carregar o arquivo JSON:', err);
            return;
        }
        keywordData = JSON.parse(data);
		console.log("Arquivo de keywords carregado");
    });

    const hoverProvider = vscode.languages.registerHoverProvider('cmgLang', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);

            const keywordInfo = keywordData[word.toUpperCase()];

            if (keywordInfo) {
                // Exibe a descrição e um link para "Mais"
                const hoverContent = new vscode.MarkdownString();
                hoverContent.isTrusted = true; // Permite links clicáveis
                hoverContent.appendText(keywordInfo.description + '\n\n');
                hoverContent.appendMarkdown(`[Mais informações](command:cmghelp.openKeywordUrl?${encodeURIComponent(JSON.stringify(keywordInfo.url))})`);

                return new vscode.Hover(hoverContent);
            }
            return null;
        }
    });

	let curVersion = vscode.commands.registerCommand('cmghelp.version', function() {
		vscode.window.showInformationMessage("Versão não informada");
	});

    context.subscriptions.push(hoverProvider);
	context.subscriptions.push(curVersion);

	// Registrar o comando que abre a URL no navegador
    vscode.commands.registerCommand('cmghelp.openKeywordUrl', (url: string) => {
        vscode.env.openExternal(vscode.Uri.parse(url));
    });
}

