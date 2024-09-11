import os
import json
from bs4 import BeautifulSoup

# Variáveis fornecidas
root_prefix = 'C:\\Program Files\\CMG\\Manuals'
versions = ['2023.10','2022.10']
places = ['imex_subdirs', 'gem_subdirs', 'stars_subdirs']

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

stars_subdirs = [
    'STARS\\Content\\STARS\\Fluid Model',
    'STARS\\Content\\STARS\\Initial Conditions',
    'STARS\\Content\\STARS\\IO Control',
    'STARS\\Content\\STARS\\Numerical Methods',
    'STARS\\Content\\STARS\\Other Reservoir Properties',
    'STARS\\Content\\STARS\\Recurrent Data',
    'STARS\\Content\\STARS\\Reservoir Description',
    'STARS\\Content\\STARS\\Rock Fluid Properties',
    'STARS\\Content\\STARS\\Tracer Data',
    'STARS\\Content\\COMMON\\Geomechanics',
    'STARS\\Content\\COMMON\\Keyword System',
    'STARS\\Content\\COMMON\\Numerical Methods',
    'STARS\\Content\\COMMON\\Recurrent Data',
    'STARS\\Content\\COMMON\\Reservoir Description',
]

# Estrutura de dados para armazenar as informações
keyword_data = {
    'prefix': root_prefix,
    'versions': {}
}

for version in versions:
    keyword_data['versions'][version] = {'IMEX': {}, 'GEM': {}, 'STARS': {}}

# Função para verificar e processar os arquivos .htm
def process_htm_files(htm_dir, app_name):
    if os.path.exists(htm_dir):
        print(f'Processando diretório: {htm_dir}')

        # Percorrer os arquivos .htm no diretório
        for file_name in os.listdir(htm_dir):
            if file_name.endswith('.htm'):
                file_path = os.path.join(htm_dir, file_name)
                keyword_descriptions = extract_keywords_and_descriptions(file_path)

                if len(keyword_descriptions) > 0:
                    # Adicionar cada keyword e descrição na estrutura de dados
                    file_relative = os.path.relpath(file_path, root_prefix + '\\' + version)
                    for keyword, description in keyword_descriptions:
                        keyword_data['versions'][version][app_name][keyword] = {
                            'description': description,
                            'file': file_relative.replace("/", "\\")
                        }
    else:
        print(f'ERRO: O diretório {htm_dir} não existe.')

def extract_keywords_and_descriptions(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        soup = BeautifulSoup(file, 'html.parser')

    keywords_and_descriptions = []

    # Encontra o primeiro <div> que segue o <body>
    body = soup.find('body')
    main_div = body.find('div', recursive=False)  # Busca o primeiro <div> diretamente sob o <body>

    # Agora, encontra o primeiro <h2> dentro deste <div>
    h2 = main_div.find('h2', recursive=False)  # Busca o primeiro <h2> diretamente sob o <div>

    # Se não houver <h2>, retorna vazio
    if not h2:
        return keywords_and_descriptions

    # Encontra o cabeçalho <h3>PURPOSE:</h3> logo após o <h2>
    purpose_header = h2.find_next('h3', text='PURPOSE:')
    if not purpose_header:
        return keywords_and_descriptions

    # Verifica se há um <h3>ARRAY:</h3> logo após o <h3>PURPOSE:</h3>
    array_header = purpose_header.find_next('h3', text='ARRAY:')

    # Caso 1: Se existir ARRAY, as keywords vêm dos siblings do PURPOSE, parando em ARRAY
    if array_header:
        for sibling in purpose_header.find_all_next():
            if sibling == array_header:
                break
            if sibling.name == 'p':
                keyword_span = sibling.find('span', class_='keyword')
                if keyword_span:
                    keyword = keyword_span.text.strip().lstrip('*')
                    description = sibling.get_text(separator=" ", strip=True)
                    keywords_and_descriptions.append((keyword, description))
        return keywords_and_descriptions  # Retorna assim que o caso 1 for tratado

    # Caso 3: Se houver mais de uma keyword no <h2>, cada uma terá a mesma descrição do PURPOSE
    keyword_spans = h2.find_all('span', class_='keyword')
    if len(keyword_spans) > 1:
        # Extrai a descrição do PURPOSE
        description = ""
        for sibling in purpose_header.find_next_siblings():
            if sibling.name == 'h3':  # Parar se encontrar o próximo título <h3>
                break
            if sibling.name == 'p':
                description += sibling.get_text(separator=" ", strip=True) + " "

        # Para cada keyword no <h2>, cria uma entrada com a mesma descrição
        for keyword_span in keyword_spans:
            keyword = keyword_span.text.strip().lstrip('*')
            keywords_and_descriptions.append((keyword, description.strip()))
        return keywords_and_descriptions  # Retorna assim que o caso 3 for tratado

    # Caso 2: Se não houver ARRAY e apenas uma keyword no <h2>
    elif len(keyword_spans) == 1:
        keyword = keyword_spans[0].text.strip().lstrip('*')
        description = ""
        for sibling in purpose_header.find_next_siblings():
            if sibling.name == 'h3':  # Parar se encontrar o próximo título <h3>
                break
            if sibling.name == 'p':
                description += sibling.get_text(separator=" ", strip=True) + " "
        keywords_and_descriptions.append((keyword, description.strip()))
        return keywords_and_descriptions  # Retorna assim que o caso 2 for tratado

    return keywords_and_descriptions

# Iterar pelas subdiretórias IMEX, GEM e STARS
for place in places:
    subdirs = globals()[place]  # Acessa as subdiretórias dinamicamente
    app_name = 'IMEX' if place == 'imex_subdirs' else 'GEM' if place == 'gem_subdirs' else 'STARS'

    for subdir in subdirs:
        for version in versions:
            htm_dir = os.path.join(root_prefix, version, subdir)
            process_htm_files(htm_dir, app_name)

# Salvar os dados em um arquivo JSON
with open('CMGKeywords.json', 'w', encoding='utf-8') as json_file:
    json.dump(keyword_data, json_file, indent=4, ensure_ascii=False)

print('Processamento finalizado e arquivo CMGKeywords.json gerado.')
