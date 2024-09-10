import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Variável global que contém os dados das keywords
let keywordData: { [key: string]: { description: string, file: string } } = {};

function getExtensionConfig() {
    const config = vscode.workspace.getConfiguration('cmghelp');
    const rootPrefix = config.get<string>('rootPrefix');
    const version = config.get<string>('version');
    const solver = config.get<string>('solver');
    return { rootPrefix, version, solver };
}

function loadKeywordData(rootPrefix: string, version: string) {
    const config = vscode.workspace.getConfiguration('cmghelp');
    let keywordDataPath = config.get<string>('cmghelp.keywordDataPath');

    // Se o caminho não foi definido, usa o diretório home do usuário como padrão
    if (!keywordDataPath) {
        const homeDir = require('os').homedir();  // Diretório home do usuário
        keywordDataPath = path.join(homeDir, 'CMGKeywords.json');
    }

    if (!fs.existsSync(keywordDataPath)) {
        vscode.window.showErrorMessage(`O arquivo CMGKeywords.json não foi encontrado no caminho: ${keywordDataPath}`);
        console.log(`Verifique se o caminho está correto: ${keywordDataPath}`);
        return null;
    }

    const rawData = fs.readFileSync(keywordDataPath, 'utf8');
    const keywordData = JSON.parse(rawData);

    // Verifica se a versão existe
    if (!keywordData.version[version]) {
        vscode.window.showErrorMessage(`A versão ${version} não foi encontrada no CMGKeywords.json.`);
        console.log(`As versões disponíveis são: ${Object.keys(keywordData.version).join(', ')}`);
        return null;
    }

    return keywordData.version[version];
}

// Função para buscar a keyword com base nas configurações do usuário
function searchKeyword(keyword: string, solver: string, keywordData: any) {
    const solverData = keywordData[solver];

    if (!solverData || !solverData[keyword]) {
        //vscode.window.showErrorMessage(`A keyword ${keyword} não foi encontrada para o solver ${solver}.`);
        console.error(`A keyword ${keyword} não foi encontrada para o solver ${solver}.`);
        return null;
    }

    return solverData[keyword];
}

export function activate(context: vscode.ExtensionContext) {

    console.log("CMGHelp has been Activated");

    // HoverProvider para exibir a descrição ao passar o mouse sobre uma keyword
    const hoverProvider = vscode.languages.registerHoverProvider('cmgLang', {
        provideHover(document, position, token) {

            const { rootPrefix, version, solver } = getExtensionConfig();

            if (!rootPrefix || !version || !solver) {
                return new vscode.Hover('Configurações de rootPrefix, versão ou solver não estão definidas.');
            }

            const keywordData = loadKeywordData(rootPrefix, version);

            if (!keywordData) {
                return new vscode.Hover('O arquivo keywordData.json não foi carregado corretamente.');
            }

            const range = document.getWordRangeAtPosition(position);
            const keyword = document.getText(range).toUpperCase().trim();
            console.log(`Keyword capturada no hover: ${keyword}`);

            const keywordInfo = searchKeyword(keyword, solver, keywordData);

            if (!keywordInfo) {
                return new vscode.Hover(`Nenhuma documentação encontrada para a keyword: ${keyword}`);
            }


            const hoverContent = new vscode.MarkdownString();
            hoverContent.appendMarkdown(`**${keyword}**\n\n`);
            hoverContent.appendMarkdown(`${keywordInfo.description}\n\n`);
            console.log(`Keyword passada para o comando cmghelp.openKeywordDocumentation: ${keyword}`);
            hoverContent.appendMarkdown(`[Mais informações](command:cmghelp.openKeywordDocumentation?${encodeURIComponent(JSON.stringify(keyword))})`);


            // Permitir que o link de "Mais informações" seja clicável
            hoverContent.isTrusted = true;

            return new vscode.Hover(hoverContent);
        }
    });

    context.subscriptions.push(hoverProvider);

    vscode.commands.registerCommand('cmghelp.openKeywordDocumentation', (keyword: string) => {
        const { rootPrefix, version, solver } = getExtensionConfig();
        //console.log('Config loaded:', rootPrefix, version, solver );
        console.log('** Vou buscar pela keyword:', keyword);

        if (!rootPrefix || !version || !solver) {
            vscode.window.showErrorMessage('Configurações de rootPrefix, versão ou solver não estão definidas.');
            return;
        }

        const keywordData = loadKeywordData(rootPrefix, version);

        if (!keywordData) {
            return;
        }

        let keywordInfo = searchKeyword(keyword.toUpperCase(), solver, keywordData);

        // if (!keywordInfo) {
        //     // Procura no keywordData por um arquivo que tenha um caminho que termine com o nome do linkPath
        //     keywordInfo = Object.values(keywordData).find(info => info.file && info.file.endsWith(path.basename(linkPath)));
        // }

        if (!keywordInfo) {
            vscode.window.showErrorMessage(`Nenhuma documentação encontrada para o caminho ${rootPrefix} ou keyword ${keyword}`);
            return;
        }

        const htmlFilePath = path.join(rootPrefix, version, keywordInfo.file);

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
                    vscode.Uri.file(rootPrefix)
                ]
            }
        );

        // Lê o arquivo HTML e ajusta os caminhos das imagens
        fs.readFile(htmlFilePath, 'utf8', (err, data) => {
            console.log(`Tentando abrir a keyword: ${keyword} no arquivo ${htmlFilePath}`);
            if (err) {
                vscode.window.showErrorMessage(`Erro ao carregar o arquivo HTML: ${err.message}`);
                return;
            }

            const adjustedHtmlContent = adjustHtmlReferences(data, htmlFilePath, panel);
            panel.webview.html = adjustedHtmlContent;
        });
    });

    // vscode.commands.registerCommand('cmghelp.openHtmlFile', (fileUri: string) => {
    //     const panel = vscode.window.createWebviewPanel(
    //         'htmlDocumentation',
    //         'HTML Documentation',
    //         vscode.ViewColumn.One,
    //         {
    //             enableScripts: true,
    //             localResourceRoots: [vscode.Uri.file(path.dirname(vscode.Uri.parse(fileUri).fsPath))]
    //         }
    //     );
    
    //     // Ler e carregar o novo arquivo HTML
    //     const filePath = vscode.Uri.parse(fileUri).fsPath;
    //     fs.readFile(filePath, 'utf8', (err, data) => {
    //         if (err) {
    //             vscode.window.showErrorMessage(`Erro ao carregar o arquivo HTML: ${err.message}`);
    //             return;
    //         }
    
    //         // Ajustar referências dentro do novo HTML
    //         const adjustedHtmlContent = adjustHtmlReferences(data, filePath, panel);
    //         panel.webview.html = adjustedHtmlContent;
    //     });
    // });

    
    // Adicionar comandos específicos para keywords do JSON (opcional, mas útil para testes rápidos)
    // for (const keyword in keywordData) {
    //     context.subscriptions.push(vscode.commands.registerCommand(`cmghelp.open${keyword}Documentation`, () => {
    //         vscode.commands.executeCommand('cmghelp.openKeywordDocumentation', keyword);
    //     }));
    // }

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
            return match.replace(linkPath, `command:cmghelp.openKeywordDocumentation?${encodeURIComponent(JSON.stringify(linkPath))}`);
        });
    
        // Adicionar script para capturar cliques em links
        const script = `
        <script>
            (function() {
                const vscode = window.acquireVsCodeApi(); // Chama apenas uma vez
                document.addEventListener('click', function(event) {
                    const target = event.target.closest('a');
                    if (target && target.href.startsWith('command:cmghelp.openKeywordDocumentation')) {
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
