import os
import json
from bs4 import BeautifulSoup

# Variáveis fornecidas
root_prefix = 'C:\\Program Files\\CMG\\Manuals'
version = '2022.10'
places = ['imex_subdirs', 'gem_subdirs']

imex_subdirs = [
    'IMEX\\Content\\IMEX\\Fluid Model',
    'IMEX\\Content\\IMEX\\Initial Conditions',
    'IMEX\\Content\\IMEX\\IO Control',
    'IMEX\\Content\\IMEX\\Numerical Methods',
    'IMEX\\Content\\IMEX\\Other Reservoir Properties',
    'IMEX\\Content\\IMEX\\Recurrent Data',
    'IMEX\\Content\\IMEX\\Reservoir Description',
    'IMEX\\Content\\IMEX\\Rock Fluid Properties',
    'IMEX\\Content\\IMEX\\Tracer Data',
    'IMEX\\Content\\COMMON\\Geomechanics',
    'IMEX\\Content\\COMMON\\Keyword System',
    'IMEX\\Content\\COMMON\\Numerical Methods',
    'IMEX\\Content\\COMMON\\Recurrent Data',
    'IMEX\\Content\\COMMON\\Reservoir Description',
]

gem_subdirs = [
    'GEM\\Content\\GEM\\Fluid Model',
    'GEM\\Content\\GEM\\Initial Conditions',
    'GEM\\Content\\GEM\\IO Control',
    'GEM\\Content\\GEM\\Numerical Methods',
    'GEM\\Content\\GEM\\Other Reservoir Properties',
    'GEM\\Content\\GEM\\Recurrent Data',
    'GEM\\Content\\GEM\\Reservoir Description',
    'GEM\\Content\\GEM\\Rock Fluid Properties',
    'GEM\\Content\\GEM\\Tracer Data',
    'GEM\\Content\\COMMON\\Geomechanics',
    'GEM\\Content\\COMMON\\Keyword System',
    'GEM\\Content\\COMMON\\Numerical Methods',
    'GEM\\Content\\COMMON\\Recurrent Data',
    'GEM\\Content\\COMMON\\Reservoir Description',
]

# Estrutura de dados para armazenar as informações
keyword_data = {
    'prefix': root_prefix + '\\' + version,
    'version': {
        version: {
            'IMEX': {},
            'GEM': {}
        }
    }
}

# Função para verificar e processar os arquivos .htm
def process_htm_files(htm_dir, app_name):
    if os.path.exists(htm_dir):
        print(f'Processando diretório: {htm_dir}')

        # Percorrer os arquivos .htm no diretório
        for file_name in os.listdir(htm_dir):
            if file_name.endswith('.htm'):
                file_path = os.path.join(htm_dir, file_name)
                keyword, description = extract_keyword_and_description(file_path)

                if keyword and description:
                    # Adicionar na estrutura de dados
                    file_relative = os.path.relpath(file_path, root_prefix + '\\' + version)
                    keyword_data['version'][version][app_name][keyword] = {
                        'description': description,
                        'file': file_relative.replace("/", "\\")
                    }
    else:
        print(f'ERRO: O diretório {htm_dir} não existe.')

# Função para extrair keyword e description dos arquivos .htm
def extract_keyword_and_description(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        soup = BeautifulSoup(file, 'html.parser')

        # Encontra a keyword dentro da tag <span class="keyword">
        keyword_span = soup.find('span', class_='keyword')
        if keyword_span:
            keyword = keyword_span.text.strip().strip('*')

            # Tenta encontrar o conteúdo da seção "PURPOSE"
            purpose_header = soup.find('h3', text='PURPOSE:')
            description = ""

            if purpose_header:
                # Procura por todos os <p> que vêm logo após o "PURPOSE:"
                for sibling in purpose_header.find_next_siblings():
                    if sibling.name == 'h3':  # Parar se encontrar o próximo título <h3>
                        break
                    if sibling.name == 'p':  # Coletar o texto dos parágrafos <p>
                        description += sibling.get_text(separator=" ", strip=True) + " "

            return keyword, description.strip()  # Remove espaços extras no final

    return None, None

# Iterar pelas subdiretórias IMEX e GEM
for place in places:
    subdirs = globals()[place]  # Acessa as subdiretórias (imex_subdirs ou gem_subdirs) dinamicamente
    app_name = 'IMEX' if place == 'imex_subdirs' else 'GEM'
    
    for subdir in subdirs:
        htm_dir = os.path.join(root_prefix, version, subdir)
        process_htm_files(htm_dir, app_name)

# Salvar os dados em um arquivo JSON
with open('keywordData.json', 'w', encoding='utf-8') as json_file:
    json.dump(keyword_data, json_file, indent=4, ensure_ascii=False)

print('Processamento finalizado e arquivo keywordData.json gerado.')
