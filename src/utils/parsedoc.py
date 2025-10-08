import os
import json
from bs4 import BeautifulSoup
from typing import Dict, List, Tuple

# Configurações
root_prefix = "C:\\Program Files\\CMG\\Manuals"
versions = ["2023.10", "2022.10", "2024.40"]

# Mapeamento de subdiretórios por solver
SOLVER_SUBDIRS = {
    "IMEX": [
        "IMEX\\Content\\IMEX\\Fluid Model",
        "IMEX\\Content\\IMEX\\Initial Conditions",
        "IMEX\\Content\\IMEX\\IO Control",
        "IMEX\\Content\\IMEX\\Numerical Methods",
        "IMEX\\Content\\IMEX\\Other Reservoir Properties",
        "IMEX\\Content\\IMEX\\Recurrent Data",
        "IMEX\\Content\\IMEX\\Reservoir Description",
        "IMEX\\Content\\IMEX\\Rock Fluid Properties",
        "IMEX\\Content\\IMEX\\Tracer Data",
        "IMEX\\Content\\COMMON\\Geomechanics",
        "IMEX\\Content\\COMMON\\Keyword System",
        "IMEX\\Content\\COMMON\\Numerical Methods",
        "IMEX\\Content\\COMMON\\Recurrent Data",
        "IMEX\\Content\\COMMON\\Reservoir Description",
    ],
    "GEM": [  # GEM é o simulador composicional da CMG
        "GEM\\Content\\GEM\\Fluid Model",
        "GEM\\Content\\GEM\\Initial Conditions",
        "GEM\\Content\\GEM\\IO Control",
        "GEM\\Content\\GEM\\Numerical Methods",
        "GEM\\Content\\GEM\\Other Reservoir Properties",
        "GEM\\Content\\GEM\\Recurrent Data",
        "GEM\\Content\\GEM\\Reservoir Description",
        "GEM\\Content\\GEM\\Rock Fluid Properties",
        "GEM\\Content\\GEM\\Tracer Data",
        "GEM\\Content\\COMMON\\Geomechanics",
        "GEM\\Content\\COMMON\\Keyword System",
        "GEM\\Content\\COMMON\\Numerical Methods",
        "GEM\\Content\\COMMON\\Recurrent Data",
        "GEM\\Content\\COMMON\\Reservoir Description",
    ],
    "STARS": [
        "STARS\\Content\\STARS\\Fluid Model",
        "STARS\\Content\\STARS\\Initial Conditions",
        "STARS\\Content\\STARS\\IO Control",
        "STARS\\Content\\STARS\\Numerical Methods",
        "STARS\\Content\\STARS\\Other Reservoir Properties",
        "STARS\\Content\\STARS\\Recurrent Data",
        "STARS\\Content\\STARS\\Reservoir Description",
        "STARS\\Content\\STARS\\Rock Fluid Properties",
        "STARS\\Content\\STARS\\Tracer Data",
        "STARS\\Content\\COMMON\\Geomechanics",
        "STARS\\Content\\COMMON\\Keyword System",
        "STARS\\Content\\COMMON\\Numerical Methods",
        "STARS\\Content\\COMMON\\Recurrent Data",
        "STARS\\Content\\COMMON\\Reservoir Description",
    ],
}

# Estrutura de dados para armazenar as informações
keyword_data: Dict = {"prefix": root_prefix, "versions": {}}

# Inicializa estrutura para todas as versões
for version in versions:
    keyword_data["versions"][version] = {"GEM": {}, "IMEX": {}, "STARS": {}}

# Estatísticas de processamento
stats = {
    "total_files": 0,
    "processed_files": 0,
    "failed_files": 0,
    "total_keywords": 0,
    "errors": [],
}


def get_last_4_folders(folder_path: str) -> str:
    """Retorna os últimos 4 níveis de uma estrutura de pastas."""
    folders = folder_path.split(os.sep)
    last_4_folders = folders[-4:] if len(folders) >= 4 else folders
    return "\\".join(last_4_folders)


def extract_keywords_and_descriptions(file_path: str) -> List[Tuple[str, str]]:
    """
    Extrai keywords e descrições de um arquivo HTML.

    Args:
        file_path: Caminho completo para o arquivo HTML

    Returns:
        Lista de tuplas (keyword, description)
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as file:
            soup = BeautifulSoup(file, "html.parser")
    except Exception as e:
        stats["errors"].append(f"Erro ao ler {file_path}: {str(e)}")
        return []

    keywords_and_descriptions = []

    try:
        # 1 - Encontra o primeiro <div> que segue o <body>
        body = soup.find("body")
        if not body:
            return keywords_and_descriptions

        main_div = body.find("div", recursive=False)
        if not main_div:
            return keywords_and_descriptions

        # 2 - Encontra o primeiro <h2> dentro deste <div>
        h2 = main_div.find("h2", recursive=False)
        if not h2:
            return keywords_and_descriptions

        # 3 - Encontra todas as keywords dentro deste <h2>
        keyword_spans = h2.find_all("span", class_="keyword")
        if not keyword_spans:
            return keywords_and_descriptions

        keywords = [kw.get_text(strip=True).lstrip("*").strip() for kw in keyword_spans]
        keywords = [kw for kw in keywords if kw]  # Remove vazios

        if not keywords:
            return keywords_and_descriptions

        # 4 - Encontra o <h3>PURPOSE:</h3> e todos os <p> subsequentes
        purpose_header = h2.find_next("h3", string="PURPOSE:")
        if not purpose_header:
            return keywords_and_descriptions

        # 5 - Coleta todos os <p> subsequentes até encontrar o próximo <h3>
        description_parts = []
        for sibling in purpose_header.find_next_siblings():
            if sibling.name == "h3":  # Para no próximo cabeçalho
                break
            if sibling.name == "p":
                text = sibling.get_text(separator=" ", strip=True)
                if text:  # Adiciona apenas se não for vazio
                    description_parts.append(text)

        if not description_parts:
            return keywords_and_descriptions

        # Concatena todas as partes da descrição
        description = " ".join(description_parts)

        # Limita o tamanho da descrição para evitar textos muito longos
        if len(description) > 500:
            description = description[:497] + "..."

        # 6 - Gera um par de cada keyword com a mesma descrição
        for keyword in keywords:
            if keyword:  # Garante que a keyword não está vazia
                keywords_and_descriptions.append((keyword, description))

    except Exception as e:
        stats["errors"].append(f"Erro ao processar {file_path}: {str(e)}")
        return []

    return keywords_and_descriptions


def process_htm_files(htm_dir: str, solver_name: str, version: str) -> None:
    """
    Processa todos os arquivos .htm em um diretório.

    Args:
        htm_dir: Diretório contendo os arquivos HTML
        solver_name: Nome do solver (GEM, IMEX, STARS)
        version: Versão do CMG sendo processada
    """
    if not os.path.exists(htm_dir):
        print(f"⚠️  Diretório não existe: {get_last_4_folders(htm_dir):<50}")
        stats["errors"].append(f"Diretório não encontrado: {htm_dir}")
        return

    print(f"📂 Processando: {get_last_4_folders(htm_dir):<50}", end="\r")

    try:
        files = [f for f in os.listdir(htm_dir) if f.endswith(".htm")]
        stats["total_files"] += len(files)

        for file_name in files:
            file_path = os.path.join(htm_dir, file_name)

            try:
                keyword_descriptions = extract_keywords_and_descriptions(file_path)

                if keyword_descriptions:
                    # Caminho relativo a partir da versão
                    version_root = os.path.join(root_prefix, version)
                    file_relative = os.path.relpath(file_path, version_root)
                    file_relative = file_relative.replace("/", "\\")

                    # Adiciona keywords ao dicionário
                    for keyword, description in keyword_descriptions:
                        keyword_data["versions"][version][solver_name][keyword] = {
                            "description": description,
                            "file": file_relative,
                        }
                        stats["total_keywords"] += 1

                    stats["processed_files"] += 1
                else:
                    # Arquivo processado mas sem keywords encontradas
                    stats["processed_files"] += 1

            except Exception as e:
                stats["failed_files"] += 1
                stats["errors"].append(f"Erro em {file_name}: {str(e)}")

    except Exception as e:
        stats["errors"].append(f"Erro ao listar diretório {htm_dir}: {str(e)}")


def main():
    """Função principal de processamento."""
    print("=" * 80)
    print("🚀 Iniciando processamento da documentação CMG")
    print("=" * 80)
    print()

    # Verifica se o diretório raiz existe
    if not os.path.exists(root_prefix):
        print(f"❌ ERRO: Diretório raiz não encontrado: {root_prefix}")
        return

    # Processa cada solver e versão
    for solver_name, subdirs in SOLVER_SUBDIRS.items():
        print(f"\n{'─' * 80}")
        print(f"🔧 Processando solver: {solver_name}")
        print(f"{'─' * 80}")

        for version in versions:
            print(f"\n📦 Versão: {version}")

            for subdir in subdirs:
                htm_dir = os.path.join(root_prefix, version, subdir)
                process_htm_files(htm_dir, solver_name, version)

    # Limpa linha do último processamento
    print(" " * 80, end="\r")

    # Salva os dados em um arquivo JSON
    output_file = "CMGKeywords.json"
    try:
        with open(output_file, "w", encoding="utf-8") as json_file:
            json.dump(keyword_data, json_file, indent=4, ensure_ascii=False)

        print("\n" + "=" * 80)
        print("✅ Processamento finalizado com sucesso!")
        print("=" * 80)
        print(f"\n📊 Estatísticas:")
        print(f"   • Arquivos totais encontrados: {stats['total_files']}")
        print(f"   • Arquivos processados: {stats['processed_files']}")
        print(f"   • Arquivos com erro: {stats['failed_files']}")
        print(f"   • Total de keywords extraídas: {stats['total_keywords']}")
        print(f"   • Arquivo gerado: {output_file}")

        if stats["errors"]:
            print(f"\n⚠️  Total de erros/avisos: {len(stats['errors'])}")
            print("\nPrimeiros 10 erros:")
            for error in stats["errors"][:10]:
                print(f"   • {error}")

            if len(stats["errors"]) > 10:
                print(f"   ... e mais {len(stats['errors']) - 10} erros")

                # Salva log de erros
                error_log = "parse_errors.log"
                with open(error_log, "w", encoding="utf-8") as log_file:
                    for error in stats["errors"]:
                        log_file.write(error + "\n")
                print(f"\n📝 Log completo de erros salvo em: {error_log}")

        print()

    except Exception as e:
        print(f"\n❌ ERRO ao salvar arquivo JSON: {str(e)}")


if __name__ == "__main__":
    main()
