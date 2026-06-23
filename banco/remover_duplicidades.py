# -*- coding: utf-8 -*-
import sqlite3
import os
import subprocess

def score_product(p):
    # p = (marca_id, marca_descr, produto_classe, produto_ean, produto_dun, produto_conservacao, produto_descr)
    marca_id, marca_descr, classe, ean, dun, conservacao, descr = p
    
    score = 0
    # 1. Presença de DUN dá pontos
    if dun and len(str(dun).strip()) > 0:
        score += 10
        
    descr_lower = descr.lower()
    classe_lower = classe.lower()
    
    # 2. Consistência de classe para pescados/peixes
    if any(x in descr_lower for x in ["peixe", "merluza", "tilápia", "tilapia", "bacalhau", "salmão", "salmao", "pescada"]):
        if any(x in classe_lower for x in ["pescado", "peixe"]):
            score += 5
            
    # Consistência de classe para aves
    if any(x in descr_lower for x in ["frango", "chester", "ave", "peru"]):
        if "ave" in classe_lower:
            score += 5
            
    # Consistência de classe para bovinos
    if any(x in descr_lower for x in ["bovino", "carne", "alcatra", "maminha", "picanha", "cupim", "músculo", "musculo", "costela"]):
        if "bovino" in classe_lower:
            score += 5
            
    # Consistência de classe para suínos
    if any(x in descr_lower for x in ["suíno", "suino", "pernil", "lombo", "bacon", "linguiça", "linguica"]):
        if "suíno" in classe_lower or "suino" in classe_lower:
            score += 5
            
    # 3. Preferência por descrições mais curtas (evita variações de peso muito específicas)
    # Subtrai pontos com base no tamanho da string da descrição
    score -= len(descr) * 0.05
    
    return score

def main():
    db_path = "/root/meus-repos/meu-scanner/banco/banco_valida_unificado.db"
    csv_produtos_cel = "/sdcard/Download/banco_valida.csv"
    csv_produtos_loc = "/root/meus-repos/meu-scanner/banco/banco_valida.csv"
    
    print("Iniciando processo de eliminação de duplicidades por EAN...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Carrega todos os produtos
    cursor.execute("SELECT marca_id, marca_descr, produto_classe, produto_ean, produto_dun, produto_conservacao, produto_descr FROM produtos;")
    all_rows = cursor.fetchall()
    
    # Agrupa por EAN
    ean_groups = {}
    no_ean_rows = []
    
    for r in all_rows:
        ean = r[3]
        if not ean or len(str(ean).strip()) == 0:
            no_ean_rows.append(r)
        else:
            ean_groups.setdefault(ean, []).append(r)
            
    selected_rows = []
    resolved_count = 0
    duplicados_count = 0
    
    # Aplica a heurística de desempate para os grupos com duplicidade
    for ean, group in ean_groups.items():
        if len(group) == 1:
            selected_rows.append(group[0])
        else:
            duplicados_count += 1
            # Ordena pelo score decrescente
            sorted_group = sorted(group, key=score_product, reverse=True)
            selected_rows.append(sorted_group[0])
            resolved_count += len(group) - 1
            
    print(f"EANs duplicados resolvidos: {duplicados_count}")
    print(f"Registros duplicados removidos: {resolved_count}")
    print(f"Produtos sem EAN preservados: {len(no_ean_rows)}")
    print(f"Total de registros únicos com EAN: {len(selected_rows)}")
    
    final_rows = no_ean_rows + selected_rows
    print(f"Total de produtos no banco final unificado: {len(final_rows)}")
    
    # Substitui a tabela no banco SQLite
    cursor.execute("DROP TABLE IF EXISTS produtos_temp;")
    cursor.execute("""
        CREATE TABLE produtos_temp (
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
    
    cursor.executemany("""
        INSERT INTO produtos_temp VALUES (?, ?, ?, ?, ?, ?, ?);
    """, final_rows)
    
    cursor.execute("DROP TABLE IF EXISTS produtos;")
    cursor.execute("ALTER TABLE produtos_temp RENAME TO produtos;")
    conn.commit()
    
    # Recria os arquivos CSV
    print("Atualizando os arquivos CSV...")
    for path in [csv_produtos_cel, csv_produtos_loc]:
        try:
            with open(path, "w", encoding="cp1252", errors="replace") as f:
                f.write("marca-id;marca-descr;produto-classe;produto-ean;produto-dun;produto-conservacao;produto-descr\n")
                for p in final_rows:
                    line = ";".join(str(val or "") for val in p)
                    f.write(line + "\n")
            print(f"Salvo com sucesso em {path}")
            if path == csv_produtos_cel:
                subprocess.run(["termux-media-scan", csv_produtos_cel], capture_output=True)
        except Exception as e:
            print(f"Erro ao salvar CSV em {path}: {e}")
            
    conn.close()
    print("Remoção de duplicidades concluída com sucesso!")

if __name__ == "__main__":
    main()
