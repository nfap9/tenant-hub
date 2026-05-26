const fs = require('fs');
const path = require('path');

// 读取git临时文件中的提交信息
const msgPath = path.resolve('.git/COMMIT_EDITMSG');
const msg = fs.readFileSync(msgPath, 'utf-8').trim();

const validTypes = [
  'feat',
  'fix',
  'docs',
  'dx',
  'style',
  'refactor',
  'perf',
  'test',
  'workflow',
  'build',
  'ci',
  'chore',
  'types',
  'wip',
];

// 匹配规则
const commitRE =
  /^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip)(\(.+\))?: .{1,50}/;

if (commitRE.test(msg)) {
  process.exit(0);
}

// 根据具体情况给出不同的错误提示
if (msg.startsWith('revert: ')) {
  const rest = msg.slice(8);
  const typeMatch = rest.match(/^(\w+)/);
  if (!typeMatch || !validTypes.includes(typeMatch[1])) {
    console.error('\n❌ revert 提交格式错误：revert: 后应跟随有效的 type。\n');
    console.error('Expected format: revert: type(scope): subject');
    console.error('Valid types: ' + validTypes.join(', '));
    console.error('\nExamples:');
    console.error('  revert: feat(compiler): add template optimization\n');
    process.exit(1);
  }
}

const typeMatch = msg.match(/^(\w+)/);
if (typeMatch && !validTypes.includes(typeMatch[1])) {
  console.error(`\n❌ 无效的 commit type: "${typeMatch[1]}"\n`);
  console.error('Valid types: ' + validTypes.join(', '));
  process.exit(1);
}

if (!msg.includes(': ')) {
  console.error('\n❌ 提交信息格式错误：缺少冒号和空格。\n');
  console.error('Expected format: type(scope): subject');
  console.error('Valid types: ' + validTypes.join(', '));
  process.exit(1);
}

const parts = msg.split(': ');
if (parts.length >= 2) {
  const subject = parts.slice(1).join(': ');
  if (subject.length === 0) {
    console.error('\n❌ 提交信息 subject 不能为空。\n');
    process.exit(1);
  }
  if (subject.length > 50) {
    console.error(
      `\n❌ 提交信息 subject 过长（当前 ${subject.length} 字符，最大允许 50 字符）。\n`
    );
    process.exit(1);
  }
}

console.error('\n❌ 提交信息格式错误。\n');
console.error('Expected format: type(scope): subject');
console.error('Valid types: ' + validTypes.join(', '));
console.error('\nExamples:');
console.error('  feat(compiler): add template optimization');
console.error('  fix(v-model): handle blur event correctly');
console.error('  docs: update installation guide\n');
process.exit(1);
