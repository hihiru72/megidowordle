import csv
import os
import json

def convert():
    csv_file = 'メギドリスト.xlsx - モブメギド.csv'
    js_file = 'hard_characters.js'

    if not os.path.exists(csv_file):
        print(f"エラー: {csv_file} が見つかりません。")
        return

    print(f"{csv_file} を読み込んでいます...")

    encodings = ['utf-8-sig', 'cp932', 'utf-8']
    entries = []
    success = False

    for enc in encodings:
        try:
            with open(csv_file, mode='r', encoding=enc, errors='strict') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                print(f"  エンコーディング: {enc} / カラム: {fieldnames}")
                for row in reader:
                    char_id   = row.get('#', '').strip()
                    name      = row.get('名前', '').strip()
                    char_type = row.get('メギド/ハルマ', '').strip()
                    is_major  = row.get('メジャー', '').strip().upper() == 'TRUE'
                    hint1     = row.get('ヒント1', '').strip()
                    hint2     = row.get('ヒント2', '').strip()
                    hint3     = row.get('ヒント3', '').strip()
                    official  = row.get('正式名称', '').strip()
                    source    = row.get('出典', '').strip()

                    if not char_id or not name:
                        continue

                    hints = [h for h in [hint1, hint2, hint3] if h]

                    entries.append({
                        'id': char_id,
                        'name': name,
                        'type': char_type,
                        'isMajor': is_major,
                        'hints': hints,
                        'officialName': official if official else name,
                        'source': source,
                    })
            success = True
            break
        except (UnicodeDecodeError, UnicodeError):
            entries = []
            continue

    if not success or not entries:
        print("エラー: データが取得できませんでした。")
        return

    # JS ファイルを生成
    lines = ['const HARD_LIST = [']
    for i, e in enumerate(entries):
        comma = '' if i == len(entries) - 1 else ','
        is_major_str = 'true' if e['isMajor'] else 'false'
        hints_json = json.dumps(e['hints'], ensure_ascii=False)
        official_json = json.dumps(e['officialName'], ensure_ascii=False)
        source_json = json.dumps(e['source'], ensure_ascii=False)
        name_json = json.dumps(e['name'], ensure_ascii=False)
        type_json = json.dumps(e['type'], ensure_ascii=False)
        id_json = json.dumps(e['id'], ensure_ascii=False)
        line = (
            f'    {{ id: {id_json}, name: {name_json}, type: {type_json}, '
            f'isMajor: {is_major_str}, hints: {hints_json}, '
            f'officialName: {official_json}, source: {source_json} }}{comma}'
        )
        lines.append(line)
    lines.append('];')
    lines.append('')  # ファイル末尾に改行

    output = '\n'.join(lines)

    with open(js_file, mode='w', encoding='utf-8') as f:
        f.write(output)

    print(f"[OK] {js_file} を生成しました。({len(entries)} 件)")
    # メギド / ハルマ の内訳を表示
    megido_count = sum(1 for e in entries if e['type'] == 'メギド')
    harma_count  = sum(1 for e in entries if e['type'] == 'ハルマ')
    hint_count   = sum(1 for e in entries if len(e['hints']) > 0)
    print(f"  メギド系: {megido_count} 件 / ハルマ系: {harma_count} 件")
    print(f"  ヒントあり: {hint_count} 件 / ヒントなし: {len(entries) - hint_count} 件")

if __name__ == '__main__':
    convert()
