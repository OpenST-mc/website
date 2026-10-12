// 领域类型集中定义。

/** 稿件条目（对应 archive/data/database.json 的元素）。 */
export interface ArchiveItem {
  id: string;
  name: string;
  author: string;
  tags: string[];
  description: string;
  category: string;
  preview: string;
  filename: string;
  sub_id: string;
}

/** 繁→简映射（STCharacters.txt 解析结果，扁平对应数组）。 */
export interface ArchiveDict {
  s: string[];
  t: string[];
}

/** /archive 页构建期注入数据。 */
export interface ArchiveData {
  items: ArchiveItem[];
  dict: ArchiveDict;
}
