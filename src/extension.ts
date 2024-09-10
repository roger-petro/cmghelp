import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Variável global que contém os dados das keywords
let keywordData: { [key: string]: { description: string, file: string } } = {};

// Carregar o JSON com os dados das keywords
function loadKeywordData() {
    const jsonFilePath = path.join(__dirname, 'keywordData.json');
    const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
    keywordData = JSON.parse(jsonContent);
}

export function activate(context: vscode.ExtensionContext) {
    // Carregar o JSON ao ativar a extensão
    loadKeywordData();

    // HoverProvider para exibir a descrição ao passar o mouse sobre uma keyword
    const hoverProvider = vscode.languages.registerHoverProvider('cmgLang', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);

            const keywordInfo = keywordData[word.toUpperCase()];

            if (keywordInfo) {
                const hoverContent = new vscode.MarkdownString();
                hoverContent.isTrusted = true; // Permite links clicáveis

                // Adiciona a descrição e o link para mais informações
                hoverContent.appendMarkdown(`${keywordInfo.description}\n\n`);
                hoverContent.appendMarkdown(`[More Info](command:cmghelp.openKeywordDocumentation?${encodeURIComponent(JSON.stringify(word))})`);

                return new vscode.Hover(hoverContent);
            }

            return null;
        }
    });

    context.subscriptions.push(hoverProvider);

    vscode.commands.registerCommand('cmghelp.openKeywordDocumentation', (linkPath: string) => {
        const keyword = path.basename(linkPath, path.extname(linkPath)).toUpperCase();
        console.log("Open:",keyword);
        let keywordInfo: { description: string; file: string } | undefined = keywordData[keyword];

        if (!keywordInfo) {
            // Procura no keywordData por um arquivo que tenha um caminho que termine com o nome do linkPath
            keywordInfo = Object.values(keywordData).find(info => info.file && info.file.endsWith(path.basename(linkPath)));
        }

        if (!keywordInfo) {
            vscode.window.showErrorMessage(`Nenhuma documentação encontrada para o caminho ${linkPath} ou keyword ${keyword}`);
            return;
        }

        const htmlFilePath = keywordInfo.file;

        // Verifica se o arquivo existe
        if (!fs.existsSync(htmlFilePath)) {
            vscode.window.showErrorMessage(`O arquivo de documentação ${htmlFilePath} não foi encontrado.`);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'keywordDocumentation', 
            `${keyword} Documentation`, 
            vscode.ViewColumn.One, 
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.dirname(htmlFilePath)),
                    vscode.Uri.file('C:\\Program Files\\CMG\\Manuals\\2020.10\\IMEX\\Skins\\Default\\Stylesheets\\'),
                    vscode.Uri.file('C:\\Program Files\\CMG\\Manuals\\')
                ]
            }
        );

        // Lê o arquivo HTML e ajusta os caminhos das imagens
        fs.readFile(htmlFilePath, 'utf8', (err, data) => {
            if (err) {
                vscode.window.showErrorMessage(`Erro ao carregar o arquivo HTML: ${err.message}`);
                return;
            }

            const adjustedHtmlContent = adjustHtmlReferences(data, htmlFilePath, panel);
            panel.webview.html = adjustedHtmlContent;
        });
    });

    vscode.commands.registerCommand('cmghelp.openHtmlFile', (fileUri: string) => {
        const panel = vscode.window.createWebviewPanel(
            'htmlDocumentation',
            'HTML Documentation',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.dirname(vscode.Uri.parse(fileUri).fsPath))]
            }
        );
    
        // Ler e carregar o novo arquivo HTML
        const filePath = vscode.Uri.parse(fileUri).fsPath;
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                vscode.window.showErrorMessage(`Erro ao carregar o arquivo HTML: ${err.message}`);
                return;
            }
    
            // Ajustar referências dentro do novo HTML
            const adjustedHtmlContent = adjustHtmlReferences(data, filePath, panel);
            panel.webview.html = adjustedHtmlContent;
        });
    });

    
    // Adicionar comandos específicos para keywords do JSON (opcional, mas útil para testes rápidos)
    for (const keyword in keywordData) {
        context.subscriptions.push(vscode.commands.registerCommand(`cmghelp.open${keyword}Documentation`, () => {
            vscode.commands.executeCommand('cmghelp.openKeywordDocumentation', keyword);
        }));
    }

    function adjustHtmlReferences(htmlContent: string, htmlFilePath: string, panel: vscode.WebviewPanel): string {
        // Ajustar referências de CSS
        htmlContent = htmlContent.replace(/<link.*?href="(.*?)".*?>/g, (match, cssPath) => {
            const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(path.dirname(htmlFilePath), cssPath)));
            return match.replace(cssPath, cssUri.toString());
        });
    
        // Ajustar referências de JS
        htmlContent = htmlContent.replace(/<script.*?src="(.*?)".*?>/g, (match, jsPath) => {
            const jsUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(path.dirname(htmlFilePath), jsPath)));
            return match.replace(jsPath, jsUri.toString());
        });
    
        // Ajustar referências de imagens (como SVG)
        htmlContent = htmlContent.replace(/<img.*?src="(.*?)".*?>/g, (match, imgPath) => {
            const imgUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(path.dirname(htmlFilePath), imgPath)));
            return match.replace(imgPath, imgUri.toString());
        });
    
        //Ajustar links internos para abrir no WebView
        htmlContent = htmlContent.replace(/<a.*?href="(.*?)".*?>/g, (match, linkPath) => {
            const keyword = path.basename(linkPath, path.extname(linkPath)).toUpperCase();
            return match.replace(linkPath, `command:cmghelp.openKeywordDocumentation?${encodeURIComponent(JSON.stringify(linkPath))}`);
        });
        




        htmlContent = htmlContent.replace(/<a.*?href="(.*?)".*?>/g, (match, linkPath) => {
            const keyword = path.basename(linkPath, path.extname(linkPath)).toUpperCase();
            return match.replace(linkPath, `command:extension.openKeywordDocumentation?${encodeURIComponent(JSON.stringify(linkPath))}`);
        });
    
        // Adicionar script para capturar cliques em links
        const script = `
        <script>
            (function() {
                const vscode = window.acquireVsCodeApi(); // Chama apenas uma vez
                document.addEventListener('click', function(event) {
                    const target = event.target.closest('a');
                    if (target && target.href.startsWith('command:extension.openKeywordDocumentation')) {
                        event.preventDefault();
                        const commandUri = target.href.split('command:')[1];
                        vscode.postMessage({ command: commandUri }); // Envia mensagens usando a instância armazenada
                    }
                });
            })();
        </script>
        `;
        return htmlContent + script;




// Ajustar links internos para abrir o arquivo HTML diretamente em outro WebView
    // htmlContent = htmlContent.replace(/<a.*?href="(.*?)".*?>/g, (match, linkPath) => {
    //     const fileUri = vscode.Uri.file(path.join(path.dirname(htmlFilePath), linkPath));
    //     const webviewUri = panel.webview.asWebviewUri(fileUri);
    //     return match.replace(linkPath, `command:cmghelp.openHtmlFile?${encodeURIComponent(webviewUri.toString())}`);
    // });

        //return htmlContent;
    }
}
