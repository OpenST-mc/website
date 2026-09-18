import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function init() {
  console.log('📦 新建存档向导');
  const folderName = await rl.question('文件夹名 (英文): ');
  const name = await rl.question('作品名称: ');
  const author = await rl.question('作者: ');
  const tags = await rl.question('标签 (分类,版本,规模,功能): ');

  const dir = path.join(process.cwd(), 'archive', folderName);
  await fs.mkdir(dir, { recursive: true });

  const info = {
    name,
    author,
    tags: tags.split(/[,，]/).map((t) => t.trim()), // 支持中英文逗号
    description: '',
  };

  await fs.writeFile(path.join(dir, 'info.json'), JSON.stringify(info, null, 4));
  console.log(`✅ 文件夹已创建: ../archive/${folderName}`);
  rl.close();
}
init();
