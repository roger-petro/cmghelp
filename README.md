# CMG Help Extension

The **CMG Help** extension provides detailed descriptions for keywords used in CMG simulation models, helping users better understand the commands they are using, particularly in High-Performance Computing (HPC) environments. The extension supports both GEM and IMEX solvers, with a customizable keyword system that loads from a `CMGKeywords.json` file.

Please **note** that the CMG manuals are not bundled with the installation of this extension due to the intellectual property rights of the software manufacturer.

This extension includes a file called CMGKeywords.json, which maps keywords to the location of the HTML manuals on disk, following a standard CMG installation. Eventually, it may be necessary to generate a new version of this file to update the paths or to accommodate a newly installed version. To assist with this, there is a script called parsedoc.py that can scan the disk and create the JSON file, as detailed below.

## Features

- Hover over CMG simulation keywords to see a description of the command.
- Click on "More Information/Mais informações" in the hover tooltip to open the detailed documentation of the keyword in a webview.
- Supports both **GEM** and **IMEX** solvers, allowing keyword lookup from either or both, depending on user configuration.

## Setup Instructions

To use the CMG Help extension, you'll need to perform some initial configuration:

### 1. Configuration in VSCode

After installing the extension, you must configure the following settings for it to work correctly:

- **`cmghelp.rootPrefix`**: The root directory where the CMG Manuals are stored (default: `C:\Program Files\CMG\Manuals`).
- **`cmghelp.version`**: The version of the CMG Manuals you are using (default: `2022.10`).
- **`cmghelp.solver`**: The solver being used, either **IMEX**, **GEM** or **STARS**.
- **`cmghelp.keywordDataPath`**: The path to the `CMGKeywords.json` file, which contains the keyword data. By default, it uses one that is bundled.
- **`cmghelp.disable`**: Toggles the plugin functionality on or off. You can also enable or disable the plugin through the command palette by searching for `CMG: Enable Plugin` or `CMG: Disable Plugin`.

### 2. Generate the `CMGKeywords.json` File

The extension requires a `CMGKeywords.json` file to function, which contains the links for the CMG htm on disk. You can generate this file by using a Python script provided in the `project's github`.

#### Steps to generate the `CMGKeywords.json` file

1. Ensure you have Python installed.
2. Download `parsedoc.py` script used to generate the `CMGKeywords.json`: [GitHub repository file](https://github.com/roger-petro/cmghelp/blob/main/src/utils/parsedoc.py).
3. Install the **BeautifulSoup4** package using the following command

    ```bash
    pip install beautifulsoup4
    ```

4. Edit parsedoc.py to change/add/remove htm documentation directories, if needed
5. Run `python .\parsedoc.py`. A CMGKeywords.json will be created at the same script's directory
6. Copy the CMGKeyword.json to any dir
7. Setup the `cmghelp.keywordDataPath` on extension configuration.

### Support

If you encounter any issues, please attach the plugin log on the GitHub issue page. The log can be accessed using the command `CMG: Show Logs`.
