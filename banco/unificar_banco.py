# -*- coding: utf-8 -*-
import sqlite3
import re
import os
import subprocess

def clean_digits(val):
    if val is None:
        return ""
    val_str = str(val).strip()
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
    cleaned = re.sub(r"\D", "", val_str)
    return cleaned

def clean_text(val):
    if val is None:
        return ""
    # Remove espaços extras e ponto e vírgula para não quebrar o CSV
    text = " ".join(str(val).split())
    return text.replace(";", ",")

def format_title(text):
    if not text:
        return ""
    text_str = str(text).strip()
    # Se o texto estiver totalmente em caixa alta, formata para Title Case
    if text_str.isupper():
        formatted = text_str.title()
        # Corrige siglas e unidades comuns
        formatted = re.sub(r'\bKg\b', 'kg', formatted)
        formatted = re.sub(r'\bG\b', 'g', formatted)
        formatted = re.sub(r'\bMl\b', 'ml', formatted)
        formatted = re.sub(r'\bL\b', 'L', formatted)
        formatted = re.sub(r'\bEan\b', 'EAN', formatted)
        formatted = re.sub(r'\bDun\b', 'DUN', formatted)
        formatted = re.sub(r'\bIqf\b', 'IQF', formatted)
        formatted = re.sub(r'\bFs\b', 'FS', formatted)
        return formatted
    return text_str

def main():
    db_lar = "/root/scraping-lar/lar_catalogo.db"
    db_brf = "/root/scraping/brf_produtos.db"
    db_friboi = "/root/scraping-friboi/friboi_catalogo.db"
    
    db_out = "/root/meus-repos/meu-scanner/banco/banco_valida_unificado.db"
    
    conn_out = sqlite3.connect(db_out)
    cursor_out = conn_out.cursor()
    
    # Cria tabelas limpas
    cursor_out.execute("DROP TABLE IF EXISTS marcas;")
    cursor_out.execute("""
        CREATE TABLE marcas (
            marca_id INTEGER PRIMARY KEY,
            marca_descr TEXT NOT NULL
        );
    """)
    
    cursor_out.execute("DROP TABLE IF EXISTS produtos;")
    cursor_out.execute("""
        CREATE TABLE produtos (
            marca_id INTEGER,
            marca_descr TEXT,
            produto_classe TEXT,
            produto_ean TEXT,
            produto_dun TEXT,
            produto_conservacao TEXT,
            produto_descr TEXT,
            UNIQUE(produto_ean, produto_dun, produto_descr)
        );
    """)
    conn_out.commit()
    
    # Marcas base do grupo 1 (Definido)
    # Alterado 'Friboi - Friboi' para apenas 'Friboi' (ID 2), conforme solicitado
    marcas_data = {
        1: "Lar",
        2: "Friboi",
        3: "BRF - Sadia",
        4: "BRF - Perdigão",
        5: "BRF - Qualy",
        6: "BRF - Deline",
        7: "BRF - Claybom",
        8: "BRF - Becel",
        9: "BRF - Sofiteli",
        10: "Friboi - Do Chef",
        11: "Friboi - Maturatta",
        12: "Friboi - 1953",
        13: "Friboi - Black"
    }
    
    # Conjunto para rastrear EANs inseridos na primeira etapa (Grupo Definido)
    eans_definidos = set()
    
    # Helper para inserir marca na tabela 'marcas'
    def obter_ou_criar_marca_id(m_descr, marcas_dict):
        # Procura se o nome da marca já existe
        for k, v in marcas_dict.items():
            if v.lower() == m_descr.lower():
                return k
        # Se não existe, cria um ID sequencial a partir do maior ID atual
        novo_id = max(marcas_dict.keys()) + 1
        marcas_dict[novo_id] = m_descr
        cursor_out.execute("INSERT INTO marcas VALUES (?, ?);", (novo_id, m_descr))
        conn_out.commit()
        return novo_id

    # Insere as marcas iniciais
    for mid, mdescr in marcas_data.items():
        cursor_out.execute("INSERT INTO marcas VALUES (?, ?);", (mid, mdescr))
    conn_out.commit()
    
    total_inserted = 0
    
    # ==========================================
    # ETAPA 1: PROCESSAR PRODUTOS DO GRUPO DEFINIDO
    # ==========================================
    
    # 1.1 Lar (marca_id = 1)
    if os.path.exists(db_lar):
        conn = sqlite3.connect(db_lar)
        cursor = conn.cursor()
        cursor.execute("SELECT ean, dun, classe, conservacao, title, descrFiscal FROM produtos;")
        for r in cursor.fetchall():
            ean_raw, dun_raw, classe, conservacao, title, descr_fiscal = r
            ean = clean_digits(ean_raw)
            dun = clean_digits(dun_raw)
            if not ean and not dun:
                continue
                
            # Prefere descr_fiscal pois ela contém o peso dos produtos da Lar, ao contrário do title
            raw_descr = descr_fiscal if descr_fiscal else title
            descr_limpa = clean_text(raw_descr)
            # Remove " (pesar)" ou "(pesar)"
            descr_limpa = re.sub(r'\s*\(\s*pesar\s*\)', '', descr_limpa, flags=re.IGNORECASE)
            # Remove pontos de partição e informações de conservação redundantes
            descr_limpa = re.sub(r'•\s*(congelado|congelada|resfriado|resfriada)', '', descr_limpa, flags=re.IGNORECASE)
            descr_limpa = re.sub(r'[-\u2022]\s*(congelado|congelada|resfriado|resfriada)', '', descr_limpa, flags=re.IGNORECASE)
            descr_limpa = " ".join(descr_limpa.split()).strip(" -•")
            
            descr_fmt = format_title(descr_limpa)
            classe_fmt = format_title(clean_text(classe))
            conservacao_fmt = format_title(clean_text(conservacao))
            
            cursor_out.execute("""
                INSERT OR IGNORE INTO produtos 
                (marca_id, marca_descr, produto_classe, produto_ean, produto_dun, produto_conservacao, produto_descr)
                VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (1, "Lar", classe_fmt, ean, dun, conservacao_fmt, descr_fmt))
            if cursor_out.rowcount > 0:
                total_inserted += 1
                if ean:
                    eans_definidos.add(ean)
        conn.close()
        
    # 1.2 BRF (marca_id = 3 a 9)
    if os.path.exists(db_brf):
        conn = sqlite3.connect(db_brf)
        cursor = conn.cursor()
        cursor.execute("SELECT ean, dun, classe, conservacao, title, descrFiscal, marca FROM produtos;")
        for r in cursor.fetchall():
            ean_raw, dun_raw, classe, conservacao, title, descr_fiscal, marca_raw = r
            ean = clean_digits(ean_raw)
            dun = clean_digits(dun_raw)
            if not ean and not dun:
                continue
                
            descr = clean_text(title or descr_fiscal)
            descr_fmt = format_title(descr)
            classe_fmt = format_title(clean_text(classe))
            conservacao_fmt = format_title(clean_text(conservacao))
            
            marca_name = (marca_raw or "").strip().lower()
            descr_lower = descr.lower()
            
            mid = 3
            mdescr = "BRF - Sadia"
            
            if "perdig" in marca_name or "perdig" in descr_lower:
                mid = 4
                mdescr = "BRF - Perdigão"
            elif "qualy" in marca_name or "qualy" in descr_lower:
                mid = 5
                mdescr = "BRF - Qualy"
            elif "deline" in marca_name or "deline" in descr_lower:
                mid = 6
                mdescr = "BRF - Deline"
            elif "claybom" in marca_name or "claybom" in descr_lower:
                mid = 7
                mdescr = "BRF - Claybom"
            elif "becel" in marca_name or "becel" in descr_lower:
                mid = 8
                mdescr = "BRF - Becel"
            elif "sofiteli" in marca_name or "sofiteli" in descr_lower:
                mid = 9
                mdescr = "BRF - Sofiteli"
                
            cursor_out.execute("""
                INSERT OR IGNORE INTO produtos 
                (marca_id, marca_descr, produto_classe, produto_ean, produto_dun, produto_conservacao, produto_descr)
                VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (mid, mdescr, classe_fmt, ean, dun, conservacao_fmt, descr_fmt))
            if cursor_out.rowcount > 0:
                total_inserted += 1
                if ean:
                    eans_definidos.add(ean)
        conn.close()

    # 1.3 Marcas Próprias Friboi (marca_id = 2, 10 a 13)
    friboi_restantes = [] # Rastreia os produtos do catálogo que NÃO são marcas próprias para a etapa 2
    if os.path.exists(db_friboi):
        conn = sqlite3.connect(db_friboi)
        cursor = conn.cursor()
        cursor.execute("SELECT ean, dun, classe, conservacao, title, descrFiscal, marca FROM produtos;")
        rows = cursor.fetchall()
        for r in rows:
            ean_raw, dun_raw, classe, conservacao, title, descr_fiscal, marca_raw = r
            ean = clean_digits(ean_raw)
            dun = clean_digits(dun_raw)
            if not ean and not dun:
                continue
                
            descr = clean_text(title or descr_fiscal)
            
            marca_name = (marca_raw or "").strip().lower()
            descr_lower = descr.lower()
            
            is_propria = False
            mid = 2
            mdescr = "Friboi" # Alterado para 'Friboi' (ID 2)
            
            if "1953" in marca_name or "1953" in descr_lower:
                is_propria = True
                mid = 12
                mdescr = "Friboi - 1953"
            elif "maturatta" in marca_name or "maturatta" in descr_lower:
                is_propria = True
                mid = 11
                mdescr = "Friboi - Maturatta"
            elif "black" in marca_name or ("black" in descr_lower and "friboi" in descr_lower):
                is_propria = True
                mid = 13
                mdescr = "Friboi - Black"
            elif "do chef" in marca_name or "do chef" in descr_lower:
                is_propria = True
                mid = 10
                mdescr = "Friboi - Do Chef"
            elif "friboi" in marca_name or "friboi" in descr_lower:
                is_propria = True
                mid = 2
                mdescr = "Friboi"
                
            if is_propria:
                descr_fmt = format_title(descr)
                classe_fmt = format_title(clean_text(classe))
                conservacao_fmt = format_title(clean_text(conservacao))
                
                cursor_out.execute("""
                    INSERT OR IGNORE INTO produtos 
                    (marca_id, marca_descr, produto_classe, produto_ean, produto_dun, produto_conservacao, produto_descr)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                """, (mid, mdescr, classe_fmt, ean, dun, conservacao_fmt, descr_fmt))
                if cursor_out.rowcount > 0:
                    total_inserted += 1
                    if ean:
                        eans_definidos.add(ean)
            else:
                # Armazena para processamento na etapa 2
                friboi_restantes.append(r)
        conn.close()
        
    print(f"Etapa 1 concluída. Produtos definidos inseridos: {total_inserted}. EANs cadastrados: {len(eans_definidos)}")

    # ==========================================
    # ETAPA 2: PROCESSAR PRODUTOS ANTES SEM DEFINIÇÃO
    # ==========================================
    print("Processando produtos sem definição original (Etapa 2)...")
    
    etapa2_inserted = 0
    for r in friboi_restantes:
        ean_raw, dun_raw, classe, conservacao, title, descr_fiscal, marca_raw = r
        ean = clean_digits(ean_raw)
        dun = clean_digits(dun_raw)
        if not ean and not dun:
            continue
            
        # REGRA DO EAN: Se o EAN já foi inserido no grupo definido, não incluir.
        if ean and ean in eans_definidos:
            continue
            
        descr = clean_text(title or descr_fiscal)
        
        # Identifica a submarca
        submarca_str = ""
        # 1. Padrão no final do texto ' - SUBMARCA'
        parts = descr.rsplit(" - ", 1)
        if len(parts) == 2:
            descr_limpa = parts[0].strip()
            submarca_str = parts[1].strip()
        else:
            descr_limpa = descr
            # 2. Utiliza o campo 'marca' do banco
            if marca_raw and clean_text(marca_raw).lower() not in ["sem marca", "terceiros", ""]:
                submarca_str = clean_text(marca_raw)
                
        # Se nenhuma submarca for localizada, classifica como 'Outros'
        if not submarca_str:
            submarca_str = "Outros"
            
        # Formata submarca e descrição do produto (Title Case se for caixa alta)
        submarca_fmt = format_title(submarca_str)
        descr_fmt = format_title(descr_limpa)
        classe_fmt = format_title(clean_text(classe))
        conservacao_fmt = format_title(clean_text(conservacao))
        
        # Monta a marca final
        if submarca_fmt.lower() == "friboi":
            mdescr = "Friboi"
        else:
            mdescr = f"Friboi - {submarca_fmt}"
            
        # Obtém ou cria o ID sequencial na tabela marcas
        mid = obter_ou_criar_marca_id(mdescr, marcas_data)
        
        cursor_out.execute("""
            INSERT OR IGNORE INTO produtos 
            (marca_id, marca_descr, produto_classe, produto_ean, produto_dun, produto_conservacao, produto_descr)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (mid, mdescr, classe_fmt, ean, dun, conservacao_fmt, descr_fmt))
        if cursor_out.rowcount > 0:
            total_inserted += 1
            etapa2_inserted += 1
            if ean:
                eans_definidos.add(ean)
                
    conn_out.commit()
    print(f"Etapa 2 concluída. Produtos inseridos: {etapa2_inserted}. Total geral unificado: {total_inserted}")

    # ==========================================
    # EXPORTAÇÃO DOS CSVs (cp1252, delimitador ;)
    # ==========================================
    print("Exportando arquivos CSV...")
    os.makedirs("/sdcard/Download", exist_ok=True)
    
    csv_produtos_cel = "/sdcard/Download/banco_valida.csv"
    csv_marcas_cel = "/sdcard/Download/banco_valida_marca.csv"
    csv_produtos_loc = "/root/meus-repos/meu-scanner/banco/banco_valida.csv"
    csv_marcas_loc = "/root/meus-repos/meu-scanner/banco/banco_valida_marca.csv"
    
    # 1. Exporta produtos
    cursor_out.execute("SELECT marca_id, marca_descr, produto_classe, produto_ean, produto_dun, produto_conservacao, produto_descr FROM produtos;")
    all_produtos = cursor_out.fetchall()
    
    for path in [csv_produtos_cel, csv_produtos_loc]:
        try:
            with open(path, "w", encoding="cp1252", errors="replace") as f:
                f.write("marca-id;marca-descr;produto-classe;produto-ean;produto-dun;produto-conservacao;produto-descr\n")
                for p in all_produtos:
                    line = ";".join(str(val or "") for val in p)
                    f.write(line + "\n")
            print(f"Produtos salvos com sucesso em {path}")
            if path == csv_produtos_cel:
                subprocess.run(["termux-media-scan", csv_produtos_cel], capture_output=True)
        except Exception as e:
            print(f"Erro ao exportar produtos para {path}: {e}")
            
    # 2. Exporta marcas
    cursor_out.execute("SELECT marca_id, marca_descr FROM marcas ORDER BY marca_id;")
    all_marcas = cursor_out.fetchall()
    
    for path in [csv_marcas_cel, csv_marcas_loc]:
        try:
            with open(path, "w", encoding="cp1252", errors="replace") as f:
                f.write("marca-id;marca-descr\n")
                for m in all_marcas:
                    line = ";".join(str(val or "") for val in m)
                    f.write(line + "\n")
            print(f"Marcas salvas com sucesso em {path}")
            if path == csv_marcas_cel:
                subprocess.run(["termux-media-scan", csv_marcas_cel], capture_output=True)
        except Exception as e:
            print(f"Erro ao exportar marcas para {path}: {e}")
            
    conn_out.close()
    print("Unificação com novas diretrizes de sub-marcas e EAN duplicado concluída!")

if __name__ == "__main__":
    main()
