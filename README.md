# CMG Help Extension

The **CMG Help** extension provides detailed descriptions for keywords used in CMG simulation models, helping users better understand the commands they are using, particularly in High-Performance Computing (HPC) environments. The extension supports both GEM and IMEX solvers, with a customizable keyword system that loads from a `CMGKeywords.json` file.

Please **note** that the CMG keywords do not come bundled with the installation of this extension due to the intellectual property rights of the software manufacturer. Users are required to generate the `CMGKeywords.json` file themselves, provided they have a valid installation of the CMG flow simulator. The provided Python script (`parsedoc.py`) can be used to parse the documentation from an existing installation and create the necessary file for the extension to function.


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
- **`cmghelp.solver`**: The solver being used, either **IMEX** or **GEM**.
- **`cmghelp.keywordDataPath`**: The path to the `CMGKeywords.json` file, which contains the keyword data. By default, it is located in the user's home directory (`C:\Users\<YourUser>\CMGKeywords.json` on Windows).

### 2. Generate the `CMGKeywords.json` File

The extension requires a `CMGKeywords.json` file to function, which contains the descriptions and links for the CMG keywords. You can generate this file by using a Python script provided in the `utils` folder of the extension.

#### Steps to generate the `CMGKeywords.json` file:

1. Ensure you have Python installed.

2. Install the **BeautifulSoup4** package using the following command:

```bash
pip install beautifulsoup4
```
