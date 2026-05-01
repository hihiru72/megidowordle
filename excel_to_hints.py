import csv
import json
import os

def convert_csv_to_hints():
    csv_file = 'メギドリスト.csv'
    js_file = 'hints.js'
    
    if not os.path.exists(csv_file):
        print(f"エラー: {csv_file} が見つかりません。")
        print("Excelで『名前を付けて保存』から『CSV (コンマ区切り) (*.csv)』を選んで保存してください。")
        return

    print(f"{csv_file} を読み込んでいます...")
    hints_dict = {}

    try:
        # Excelから書き出したCSVは通常 cp932 (Shift-JIS) です
        with open(csv_file, mode='r', encoding='cp932', errors='ignore') as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get('メギド名', '').strip()
                if not name:
                    continue
                
                hints = []
                
                # スタイル
                style = row.get('スタイル', '').strip()
                if style: hints.append(f"スタイル：{style}")
                
                # クラス
                cls = row.get('クラス', '').strip()
                if cls: hints.append(f"クラス：{cls}")
                
                # 身長性別
                height = row.get('身長', '').strip()
                gender = row.get('性別', '').strip()
                hg = ""
                if height: hg += f"身長{height}cm"
                if gender: hg += f" {gender}"
                hg = hg.strip()
                if hg: hints.append(hg)
                    
                # 飛行特性
                flying = row.get('飛行している', '').strip()
                if flying in ['〇', '○', 'あり', '1', 'True', 'true']:
                    hints.append("該当のメギドは、飛行特性により地形の影響を受けない")
                    
                # 攻撃回数
                atk_count = row.get('攻撃回数(シフト後も含む）', '').strip()
                try:
                    if atk_count and int(float(atk_count)) >= 2:
                        hints.append("アタックが複数回攻撃 ※シフト後含む")
                except:
                    pass
                    
                # 年齢と転生日/誕生日
                age = row.get('年齢', '').strip()
                bday = row.get('誕生日/転生日', '').strip()
                
                # 「-」などの空欄記号を除外
                if bday in ['-', '‐', '―', 'ー', '']: bday = ""
                if age in ['-', '‐', '―', 'ー', '']: age = ""
                
                if age or bday:
                    text = ""
                    if bday: text += f"転生日/誕生日：{bday}"
                    if age:
                        if text: text += "　"
                        text += f"{age}歳"
                    hints.append(text)

                # 内部属性
                attr = row.get('内部属性', '').strip()
                if attr and attr not in ['-', '‐', '―', 'ー']:
                    hints.append(f"内部属性：{attr}")

                hints_dict[name] = hints

        with open(js_file, 'w', encoding='utf-8') as f:
            f.write('const MEGIDO_HINTS = ')
            json.dump(hints_dict, f, ensure_ascii=False, indent=4)
            f.write(';')
        
        print(f"成功: {len(hints_dict)}体のデータを {js_file} に出力しました！")

    except Exception as e:
        print(f"実行中にエラーが発生しました: {e}")

if __name__ == '__main__':
    convert_csv_to_hints()
