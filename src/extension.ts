import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type CMGKeywords = {
    prefix?: string; // prefix é opcional
    versions: {
        [version: string]: {
            [solver in "CMG" | "IMEX" | "STARS"]: {
                [keyword: string]: {
                    description: string;
                    file: string;
                }
            }
        }
    };
}


let cmgKeywords: CMGKeywords;

let outLog: vscode.OutputChannel;

function getExtensionConfig() {
    const config = vscode.workspace.getConfiguration('cmghelp');
    const rootPrefix = config.get<string>('rootPrefix');
    const preferredVersion = config.get<string>('preferredVersion');
    const availableSolvers = config.get<string[]>('availableSolvers',['GEM']);
    const keywordDataPath = config.get<string>('keywordDataPath');
    return { rootPrefix, preferredVersion, availableSolvers, keywordDataPath };
}

/**
 * Carrega do arquivo CMGKeywords.json
 * @returns CMGKeywords | null
 */
function loadKeywordData() {

    let { keywordDataPath } = getExtensionConfig();

    // Se o caminho não foi definido, usa o diretório home do usuário como padrão
    if (!keywordDataPath) {
        const homeDir = require('os').homedir();  // Diretório home do usuário
        keywordDataPath = path.join(homeDir, 'CMGKeywords.json');
    }

    if (!fs.existsSync(keywordDataPath)) {
        vscode.window.showErrorMessage(`O arquivo CMGKeywords.json não foi encontrado no caminho: ${keywordDataPath}`);
        outLog.appendLine(`Verifique se o caminho está correto: ${keywordDataPath}`);
        return null;
    }

    const rawData = fs.readFileSync(keywordDataPath, 'utf8');
    cmgKeywords = JSON.parse(rawData) as CMGKeywords;
    return cmgKeywords;
}

function sortVersions(versions: string[]): string[] {
    return versions.sort((a, b) => {
        const [yearA, subversionA] = a.split('.').map(Number);
        const [yearB, subversionB] = b.split('.').map(Number);

        if (yearA !== yearB) {
            return yearB - yearA;  // Compara os anos em ordem decrescente
        }

        return subversionB - subversionA;  // Compara as subversões em ordem decrescente
    });
}

/**
 * Procura a melhor versão possível para consultar tanto o disco quanto CMGKeywords.
 * @param cmgKeywords
 * @param configuredVersion
 * @returns
 */
function findBestVersion(availableVersions: string[], searchVersion: string): string {
    // Verifica se a versão configurada existe
    if (availableVersions.includes(searchVersion)) {
        return searchVersion;  // Retorna a versão configurada se ela for encontrada
    }
    // Ordena as versões em ordem decrescente
    const sortedVersions = sortVersions(availableVersions);

    // Retorna a maior versão (a primeira no array ordenado)
    return sortedVersions[0];
}

/**
 * Procura por todas as versões de fato instaladas no disco
 * @param rootPrefix
 * @returns
 */
function findAvailableDiskVersions(rootPrefix: string): string[] | null {
    // Verifica se o diretório existe
    if (!fs.existsSync(rootPrefix)) {
        return null;  // Se o diretório não existir, retorna null
    }

    // Regex para verificar se o nome da pasta tem o formato NNNN.NN
    const versionRegex = /^[0-9]{4}\.[0-9]{2}$/;

    // Lê o conteúdo do diretório
    const folders = fs.readdirSync(rootPrefix, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())  // Filtra apenas diretórios
        .map(dirent => dirent.name)              // Obtém os nomes dos diretórios
        .filter(name => versionRegex.test(name)); // Filtra os que correspondem ao formato NNNN.NN

    return folders;
}

function findKeyword(
    cmgKeywords: CMGKeywords,
    searchTerm: string,
    version?: string,
    solver?: "CMG" | "IMEX" | "STARS"
): { description: string; file: string } | null {

    // Se a versão e o solver forem fornecidos, procurar apenas nesta seção
    if (version && solver) {
        const solvers = cmgKeywords.versions[version];
        if (solvers) {
            const keywords = solvers[solver];
            if (keywords && keywords[searchTerm]) {
                return keywords[searchTerm];
            }
        }
        return null;
    }

    // Se apenas a versão for fornecida, procurar em todos os solvers desta versão
    if (version) {
        const solvers = cmgKeywords.versions[version];
        if (solvers) {
            for (const solverKey of Object.keys(solvers) as Array<keyof typeof solvers>) {
                const keywords = solvers[solverKey];
                if (keywords[searchTerm]) {
                    return keywords[searchTerm];
                }
            }
        }
        return null;
    }

    // Caso nem a versão nem o solver sejam fornecidos, procurar em todas as versões e solvers
    for (const versionKey in cmgKeywords.versions) {
        const solvers = cmgKeywords.versions[versionKey];
        for (const solverKey of Object.keys(solvers) as Array<keyof typeof solvers>) {
            const keywords = solvers[solverKey];
            if (keywords[searchTerm]) {
                return keywords[searchTerm];
            }
        }
    }

    // Se não encontrar a keyword, retorna null
    return null;
}


export function activate(context: vscode.ExtensionContext) {
    outLog = vscode.window.createOutputChannel('CMG Help Logs');
    outLog.appendLine('CMG Help extension has been activated');

    let cmgShowLogs = vscode.commands.registerCommand('cmghelp.showLogs', () => {
        outLog.show();  // Exibe o canal de saída no painel Output
        outLog.appendLine('Log information: Command executed');
    });
    context.subscriptions.push(cmgShowLogs);

    const { rootPrefix, preferredVersion, availableSolvers } = getExtensionConfig();
    if (!rootPrefix || !preferredVersion) {
        return new vscode.Hover('Configurações de rootPrefix, versão ou solver não estão definidas.');
    }
    const keywordData = loadKeywordData();
    if (!keywordData) {
        return new vscode.Hover('O arquivo keywordData.json não foi carregado corretamente.');
    }

    // HoverProvider para exibir a descrição sintética ao passar o mouse sobre uma keyword
    const hoverProvider = vscode.languages.registerHoverProvider(
        { scheme: 'file', pattern: '**/*.{dat,inc}' }, {
        provideHover(document, position, token) {
            const isDisable = vscode.workspace.getConfiguration().get('cmghelp.disable', false);
            if (isDisable) {
                return null;
            }
            const range = document.getWordRangeAtPosition(position);
            const lineText = document.lineAt(position).text.trim();  // Captura a linha completa onde o cursor está

            // Verificar se a linha começa com a keyword no formato correto (pode ter espaços ou * antes)
            const keywordPattern = /^[\s\*]*([A-Z-]{2,}[A-Z0-9-]*)/;
            const match = lineText.match(keywordPattern);

            if (!match) {
              // Se a keyword não corresponder ao padrão ou não estiver na posição correta, não faça nada
              return;
            }

            const keyword = match[1].toUpperCase().trim();  // Extrai a keyword do match

            outLog.appendLine(`Keyword capturada no hover: ${keyword}`);

            const keywordInfo = findKeyword(keywordData,keyword);

            if (!keywordInfo) {
              return new vscode.Hover(`Nenhuma documentação encontrada para a keyword: ${keyword}`);
            }

            const hoverContent = new vscode.MarkdownString();
            hoverContent.appendMarkdown(`📖 **${keyword}**\n\n`);
            hoverContent.appendMarkdown(`${keywordInfo.description}\n\n`);
            outLog.appendLine(`Keyword passada para o comando cmghelp.openKeywordDocumentation: ${keyword}`);
            let clickString = '';
            for (const solver of availableSolvers) {
                clickString += `[${solver}](command:cmghelp.openKeywordDocumentation?${encodeURIComponent(JSON.stringify(solver+'|'+keyword))}) `;
            }
            hoverContent.appendMarkdown(`🔗 ${clickString}`);

            // Permitir que o link de "Mais informações" seja clicável
            hoverContent.isTrusted = true;

            return new vscode.Hover(hoverContent);
        }
    });

    context.subscriptions.push(hoverProvider);

    /**
     * Carrega o arquivo htm da documentação, para a keyword escolhida e
     * apresenta no webview. O htm é preprocessado para permitir funcionar
     * corretamente no webview.
     */
    vscode.commands.registerCommand('cmghelp.openKeywordDocumentation', (searchElement: string) => {
        const { rootPrefix, preferredVersion, availableSolvers } = getExtensionConfig();
        //outLog.appendLine('Config loaded:', rootPrefix, version, solver );
        outLog.appendLine(`** Vou buscar pela keyword: ${searchElement}`);

        if (!rootPrefix || !preferredVersion) {
            vscode.window.showErrorMessage('Configurações de rootPrefix, versão ou solver não estão definidas.');
            return;
        }

        if (!cmgKeywords) {
            outLog.appendLine(`Não há uma estrutura de dados de keywords carregada em memória`);
            return;
        }
        const diskVersions = findAvailableDiskVersions(rootPrefix);

        if (!diskVersions) {
            vscode.window.showErrorMessage(`Não há sequer uma versão da documentação instalada`);
            outLog.appendLine(`Não há sequer uma versão da documentação instalada`);
            return;
        }
        const bestDiskVersion = findBestVersion(diskVersions,preferredVersion);

        let htmlFilePath = '';
        let keywordInfo;
        let fileEnd='';

        if (searchElement.indexOf(".htm") === -1) {
            if (searchElement.split('|').length !==2) {
                outLog.appendLine(`O elemento a pesquisar não carrega o solver ${searchElement}`);
                return;
            }
            let bestMemoryVersion = findBestVersion(Object.keys(cmgKeywords.versions),preferredVersion);

            keywordInfo = findKeyword(cmgKeywords, searchElement.split('|')[1], bestMemoryVersion,searchElement.split('|')[0] as "CMG" | "IMEX" | "STARS");

            if (!keywordInfo) {
                vscode.window.showErrorMessage(`Keyword ${searchElement} não encontrada em memória`);
                return;
            }
            fileEnd = keywordInfo.file;
            htmlFilePath = path.join(rootPrefix, bestDiskVersion, keywordInfo.file);
        }
        else {
            console.log('Veio este htm: ',searchElement);
            fileEnd = searchElement.split('#')[0];
            htmlFilePath = path.join(rootPrefix,bestDiskVersion,fileEnd);
            searchElement = path.basename(searchElement).split('_')[0];
        }

        // Verifica se o arquivo existe
        if (fs.existsSync(htmlFilePath)) {
            outLog.appendLine(`Encontrados os manuais em ${htmlFilePath}`);
        } else {
                vscode.window.showErrorMessage(`A pasta de instalação do CMG (${htmlFilePath}) para os manuais não foi encontrada.`);
                return;
        }

        const panel = vscode.window.createWebviewPanel(
            'keywordDocumentation',
            `${searchElement}`,
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
            outLog.appendLine(`Tentando abrir a keyword: ${searchElement} no arquivo ${htmlFilePath}`);
            if (err) {
                vscode.window.showErrorMessage(`Erro ao carregar o arquivo HTML: ${err.message}`);
                return;
            }

            const adjustedHtmlContent = adjustHtmlReferences(data, htmlFilePath, fileEnd, panel);
            panel.webview.html = adjustedHtmlContent;
            panel.webview.onDidReceiveMessage(async (message:any) => {
                outLog.appendLine('Recebido este evento: ' + decodeURIComponent(message.command));
                outLog.appendLine('Recebido este evento: '+ decodeURIComponent(message.originalPath));
                const uri = path.join(decodeURIComponent(message.originalPath),decodeURIComponent(message.command).split('?')[1].replaceAll('"',''));
                vscode.commands.executeCommand('cmghelp.openKeywordDocumentation',uri);
            });
        });
    });

    /**
     * Comando para habilitar a extensão
     */
    vscode.commands.registerCommand('cmghelp.enable', () => {
        // Atualizar a configuração para definir cmghelp.disable como false
        vscode.workspace.getConfiguration().update('cmghelp.disable', false, vscode.ConfigurationTarget.Global)
            .then(() => {
                vscode.window.showInformationMessage('CMG Help has been enabled.');
                outLog.appendLine('CMG Help has been enabled.');
            }, err => {
                vscode.window.showErrorMessage(`Failed to enable CMG Help: ${err}`);
                outLog.appendLine(`Failed to enable CMG Help: ${err}`);
            });
    });

    /**
     * Comando para desabilitar a extensão
     */
    vscode.commands.registerCommand('cmghelp.disable', () => {
        // Atualizar a configuração para definir cmghelp.disable como true
        vscode.workspace.getConfiguration().update('cmghelp.disable', true, vscode.ConfigurationTarget.Global)
            .then(() => {
                vscode.window.showInformationMessage('CMG Help has been disabled.');
                outLog.appendLine('CMG Help has been disabled.');
            }, err => {
                vscode.window.showErrorMessage(`Failed to disable CMG Help: ${err}`);
                outLog.appendLine(`Failed to disable CMG Help: ${err}`);
            });
    });

    /**
     * Altera os links do htm carregado para funcionar com o esquema asWebView do VSCODE
     */
    function adjustHtmlReferences(htmlContent: string, htmlFilePath: string, fileEnd:string, panel: vscode.WebviewPanel): string {
        // Ajustar referências de CSS
        const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;

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
                        vscode.postMessage({ command: commandUri, originalPath: "${encodeURIComponent(path.dirname(fileEnd))}" }); // Envia mensagens usando a instância armazenada
                        //console.log('PostMessage enviado com ', commandUri)
                    }
                });
            })();

            (function() {
                const isDark = ${isDarkTheme};

                // Cria uma tag <style> e injeta os estilos
                const style = document.createElement('style');
                style.textContent = \`
                    body {
                        background-color: \${isDark ? '#1e1e1e' : '#ffffff'} !important;
                        color: \${isDark ? '#d4d4d4' : '#000000'} !important;
                    }
                    a {
                        color: \${isDark ? '#569cd6' : '#0066cc'} !important;
                    }
                    /* Outros estilos */
                \`;
                document.head.appendChild(style);
            })();
        </script>
        `;
        return htmlContent + script;
    }
}
