import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

type CMGKeywords = {
  prefix?: string; // prefix é opcional
  versions: {
    [version: string]: {
      [solver in "CMG" | "IMEX" | "STARS"]: {
        [keyword: string]: {
          description: string;
          file: string;
        };
      };
    };
  };
};

let cmgKeywords: CMGKeywords | null = null;

let outLog: vscode.OutputChannel;

function getExtensionConfig() {
  const config = vscode.workspace.getConfiguration("cmghelp");
  const rootPrefix = config.get<string>("rootPrefix");
  const preferredVersion = config.get<string>("preferredVersion");
  const availableSolvers = config.get<string[]>("availableSolvers", ["GEM"]);
  const keywordDataPath = config.get<string>("keywordDataPath");
  const fileExtensions: string[] = config.get("fileExtensions", [
    ".dat",
    ".inc",
    ".cmg",
  ]);
  return {
    rootPrefix,
    preferredVersion,
    availableSolvers,
    keywordDataPath,
    fileExtensions,
  };
}

/**
 * Carrega do arquivo CMGKeywords.json
 * @returns CMGKeywords | null
 */
function loadKeywordData(
  context: vscode.ExtensionContext,
  outLog: vscode.OutputChannel
): CMGKeywords | null {
  let { keywordDataPath } = getExtensionConfig();

  if (!keywordDataPath) {
    keywordDataPath = path.join(context.extensionPath, "CMGKeywords.json");
  }

  if (fs.existsSync(keywordDataPath)) {
    try {
      const rawData = fs.readFileSync(keywordDataPath, "utf-8");
      const data = JSON.parse(rawData) as CMGKeywords;
      outLog.appendLine(
        `CMGKeywords.json carregado da origem ${keywordDataPath}`
      );
      return data;
    } catch (error: any) {
      vscode.window.showErrorMessage(
        "Erro ao carregar CMGKeywords.json: " + error.message
      );
      outLog.appendLine(`Erro ao carregar CMGKeywords.json: ${error.message}`);
    }
  } else {
    vscode.window.showErrorMessage("CMGKeywords.json não encontrado.");
    outLog.appendLine(`CMGKeywords.json não encontrado em ${keywordDataPath}`);
  }
  return null;
}

function sortVersions(versions: string[]): string[] {
  return versions.sort((a, b) => {
    const [yearA, subversionA] = a.split(".").map(Number);
    const [yearB, subversionB] = b.split(".").map(Number);

    if (yearA !== yearB) {
      return yearB - yearA; // Compara os anos em ordem decrescente
    }

    return subversionB - subversionA; // Compara as subversões em ordem decrescente
  });
}

/**
 * Procura a melhor versão possível para consultar tanto o disco quanto CMGKeywords.
 * @param cmgKeywords
 * @param configuredVersion
 * @returns
 */
function findBestVersion(
  availableVersions: string[],
  searchVersion: string
): string {
  // Verifica se a versão configurada existe
  if (availableVersions.includes(searchVersion)) {
    return searchVersion; // Retorna a versão configurada se ela for encontrada
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
function findAvailableDiskVersions(rootPrefix: string): string[] {
  if (!fs.existsSync(rootPrefix)) {
    return [];
  }

  const versionRegex = /^[0-9]{4}\.[0-9]{2}$/;

  try {
    const folders = fs
      .readdirSync(rootPrefix, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => versionRegex.test(name));

    return folders;
  } catch (error: any) {
    return [];
  }
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
      for (const solverKey of Object.keys(solvers) as Array<
        keyof typeof solvers
      >) {
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
    for (const solverKey of Object.keys(solvers) as Array<
      keyof typeof solvers
    >) {
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
  outLog = vscode.window.createOutputChannel("CMG Help Logs");
  outLog.appendLine("CMG Help extension has been activated");

  let cmgShowLogs = vscode.commands.registerCommand("cmghelp.showLogs", () => {
    outLog.show();
    outLog.appendLine("Log information: Command executed");
  });
  context.subscriptions.push(cmgShowLogs);

  let { rootPrefix, preferredVersion, availableSolvers, fileExtensions } =
    getExtensionConfig();

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("cmghelp")) {
      outLog.appendLine("Configurações alteradas, recarregando.");
      ({ rootPrefix, preferredVersion, availableSolvers, fileExtensions } =
        getExtensionConfig());

      // Recarrega keywords se o caminho mudou
      if (event.affectsConfiguration("cmghelp.keywordDataPath")) {
        cmgKeywords = loadKeywordData(context, outLog);
      }
    }
  });

  // Carrega os dados de keywords na ativação
  cmgKeywords = loadKeywordData(context, outLog);

  if (!rootPrefix || !preferredVersion) {
    vscode.window.showWarningMessage(
      "CMG Help: Configurações de rootPrefix ou versão não estão definidas."
    );
    outLog.appendLine("Configurações de rootPrefix ou versão ausentes.");
  }

  if (!cmgKeywords) {
    vscode.window.showWarningMessage(
      "CMG Help: O arquivo CMGKeywords.json não foi carregado corretamente."
    );
    outLog.appendLine("CMGKeywords.json não carregado.");
  }

  function isFileSupported(document: vscode.TextDocument): boolean {
    const fileName = document.fileName.toLowerCase();
    const { fileExtensions } = getExtensionConfig();
    return fileExtensions.some((ext) => fileName.endsWith(ext.toLowerCase()));
  }

  const hoverProvider = vscode.languages.registerHoverProvider(
    { scheme: "file" },
    {
      provideHover(document, position, token) {
        const isDisable = vscode.workspace
          .getConfiguration()
          .get("cmghelp.disable", false);

        if (isDisable || !isFileSupported(document)) {
          return null;
        }

        if (!cmgKeywords) {
          return null;
        }

        const range = document.getWordRangeAtPosition(position);
        if (!range) {
          return null;
        }

        const lineText = document.lineAt(position).text.trim();

        // Regex mais rigoroso: keyword deve estar no início da linha (após espaços/asteriscos)
        const keywordPattern = /^[\s\*]*([A-Z][A-Z0-9-]*[A-Z0-9])\b/;
        const match = lineText.match(keywordPattern);

        if (!match) {
          return null;
        }

        const keyword = match[1].toUpperCase().trim();

        // Verifica se o cursor está sobre a keyword
        const keywordStartIndex = lineText.indexOf(match[0]);
        const keywordEndIndex = keywordStartIndex + match[0].length;
        const cursorIndex = position.character;

        if (cursorIndex < keywordStartIndex || cursorIndex > keywordEndIndex) {
          return null;
        }

        outLog.appendLine(`Keyword capturada no hover: ${keyword}`);

        const keywordInfo = findKeyword(cmgKeywords, keyword);

        if (!keywordInfo) {
          return null; // Não mostra hover se não encontrar
        }

        const hoverContent = new vscode.MarkdownString();
        hoverContent.appendMarkdown(`📖 **${keyword}**\n\n`);
        hoverContent.appendMarkdown(`${keywordInfo.description}\n\n`);

        let clickString = "";
        for (const solver of availableSolvers) {
          const args = encodeURIComponent(
            JSON.stringify(solver + "|" + keyword)
          );
          clickString += `[${solver}](command:cmghelp.openKeywordDocumentation?${args}) `;
        }
        hoverContent.appendMarkdown(`🔗 ${clickString}`);
        hoverContent.isTrusted = true;

        return new vscode.Hover(hoverContent);
      },
    }
  );

  context.subscriptions.push(hoverProvider);

  const openDocCommand = vscode.commands.registerCommand(
    "cmghelp.openKeywordDocumentation",
    (searchElement: string) => {
      if (!searchElement) {
        outLog.appendLine("Comando chamado sem searchElement");
        return;
      }

      const { rootPrefix, preferredVersion } = getExtensionConfig();

      outLog.appendLine(`** Vou buscar pela keyword: ${searchElement}`);

      if (!rootPrefix || !preferredVersion) {
        vscode.window.showErrorMessage(
          "CMG Help: Configurações de rootPrefix ou versão não estão definidas."
        );
        return;
      }

      if (!cmgKeywords) {
        vscode.window.showErrorMessage(
          "CMG Help: Estrutura de keywords não carregada."
        );
        outLog.appendLine("Estrutura de keywords não carregada em memória");
        return;
      }

      const diskVersions = findAvailableDiskVersions(rootPrefix);

      if (diskVersions.length === 0) {
        vscode.window.showErrorMessage(
          `CMG Help: Nenhuma versão da documentação encontrada em: ${path.resolve(
            rootPrefix
          )}`
        );
        outLog.appendLine(
          `Nenhuma versão da documentação em: ${path.resolve(rootPrefix)}`
        );
        return;
      }

      const bestDiskVersion = findBestVersion(diskVersions, preferredVersion);

      let htmlFilePath = "";
      let keywordInfo;
      let fileEnd = "";

      if (!searchElement.includes(".htm")) {
        const parts = searchElement.split("|");
        if (parts.length !== 2) {
          outLog.appendLine(
            `Formato inválido do elemento de pesquisa: ${searchElement}`
          );
          return;
        }

        const [solverName, keywordName] = parts;
        const bestMemoryVersion = findBestVersion(
          Object.keys(cmgKeywords.versions),
          preferredVersion
        );

        keywordInfo = findKeyword(
          cmgKeywords,
          keywordName,
          bestMemoryVersion,
          solverName as "CMG" | "IMEX" | "STARS"
        );

        if (!keywordInfo) {
          vscode.window.showErrorMessage(
            `CMG Help: Keyword ${keywordName} não encontrada`
          );
          return;
        }

        fileEnd = keywordInfo.file;
        htmlFilePath = path.join(rootPrefix, bestDiskVersion, keywordInfo.file);
      } else {
        outLog.appendLine(`Carregando arquivo HTM: ${searchElement}`);
        fileEnd = searchElement.split("#")[0];
        htmlFilePath = path.join(rootPrefix, bestDiskVersion, fileEnd);
        searchElement = path.basename(searchElement).split("_")[0];
      }

      if (!fs.existsSync(htmlFilePath)) {
        vscode.window.showErrorMessage(
          `CMG Help: Arquivo não encontrado: ${htmlFilePath}`
        );
        outLog.appendLine(`Arquivo não encontrado: ${htmlFilePath}`);
        return;
      }

      outLog.appendLine(`Abrindo documentação: ${htmlFilePath}`);

      const panel = vscode.window.createWebviewPanel(
        "keywordDocumentation",
        `${searchElement}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.dirname(htmlFilePath)),
            vscode.Uri.file(rootPrefix),
          ],
        }
      );

      fs.readFile(htmlFilePath, "utf8", (err, data) => {
        if (err) {
          vscode.window.showErrorMessage(
            `CMG Help: Erro ao carregar HTML: ${err.message}`
          );
          outLog.appendLine(`Erro ao carregar HTML: ${err.message}`);
          return;
        }

        const adjustedHtmlContent = adjustHtmlReferences(
          data,
          htmlFilePath,
          fileEnd,
          panel
        );
        panel.webview.html = adjustedHtmlContent;

        panel.webview.onDidReceiveMessage((message: any) => {
          try {
            const decodedCommand = decodeURIComponent(message.command);
            const decodedPath = decodeURIComponent(message.originalPath);

            outLog.appendLine(`Evento recebido: ${decodedCommand}`);

            const uri = path.join(
              decodedPath,
              decodedCommand.split("?")[1]?.replaceAll('"', "") || ""
            );

            vscode.commands.executeCommand(
              "cmghelp.openKeywordDocumentation",
              uri
            );
          } catch (error: any) {
            outLog.appendLine(`Erro ao processar mensagem: ${error.message}`);
          }
        });
      });
    }
  );

  context.subscriptions.push(openDocCommand);

  /**
   * Altera os links do htm carregado para funcionar com o esquema asWebView do VSCODE
   */
  function adjustHtmlReferences(
    htmlContent: string,
    htmlFilePath: string,
    fileEnd: string,
    panel: vscode.WebviewPanel
  ): string {
    const isDarkTheme =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;

    // Ajustar referências de CSS
    htmlContent = htmlContent.replace(
      /<link.*?href="(.*?)".*?>/g,
      (match, cssPath) => {
        const cssUri = panel.webview.asWebviewUri(
          vscode.Uri.file(path.join(path.dirname(htmlFilePath), cssPath))
        );
        return match.replace(cssPath, cssUri.toString());
      }
    );

    // Ajustar referências de JS
    htmlContent = htmlContent.replace(
      /<script.*?src="(.*?)".*?>/g,
      (match, jsPath) => {
        const jsUri = panel.webview.asWebviewUri(
          vscode.Uri.file(path.join(path.dirname(htmlFilePath), jsPath))
        );
        return match.replace(jsPath, jsUri.toString());
      }
    );

    // Ajustar referências de imagens (como SVG)
    htmlContent = htmlContent.replace(
      /<img.*?src="(.*?)".*?>/g,
      (match, imgPath) => {
        const imgUri = panel.webview.asWebviewUri(
          vscode.Uri.file(path.join(path.dirname(htmlFilePath), imgPath))
        );
        return match.replace(imgPath, imgUri.toString());
      }
    );

    // Ajustar links internos
    htmlContent = htmlContent.replace(
      /<a.*?href="(.*?)".*?>/g,
      (match, linkPath) => {
        // Ignora links externos e âncoras
        if (linkPath.startsWith("http") || linkPath.startsWith("#")) {
          return match;
        }

        return match.replace(
          linkPath,
          `command:cmghelp.openKeywordDocumentation?${encodeURIComponent(
            JSON.stringify(linkPath)
          )}`
        );
      }
    );

    const script = `
        <script>
            (function() {
                const vscode = window.acquireVsCodeApi();
                document.addEventListener('click', function(event) {
                    const target = event.target.closest('a');
                    if (target && target.href.startsWith('command:cmghelp.openKeywordDocumentation')) {
                        event.preventDefault();
                        const commandUri = target.href.split('command:')[1];
                        vscode.postMessage({ 
                            command: commandUri, 
                            originalPath: "${encodeURIComponent(
                              path.dirname(fileEnd)
                            )}" 
                        });
                    }
                });
            })();

            (function() {
                const isDark = ${isDarkTheme};
                const style = document.createElement('style');
                style.textContent = \`
                    body {
                        background-color: \${isDark ? '#1e1e1e' : '#ffffff'} !important;
                        color: \${isDark ? '#d4d4d4' : '#000000'} !important;
                    }
                    a {
                        color: \${isDark ? '#569cd6' : '#0066cc'} !important;
                    }
                \`;
                document.head.appendChild(style);
            })();
        </script>
        `;
    return htmlContent + script;
  }
}
