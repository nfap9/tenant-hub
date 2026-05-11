const fs = require("fs");
const path = require("path");

// 读取git临时文件中的提交信息
const msgPath = path.resolve(".git/COMMIT_EDITMSG");
const msg = fs.readFileSync(msgPath, "utf-8").trim();

// 匹配规则
const commitRE =
  /^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip)(\(.+\))?: .{1,50}/;
if (!commitRE.test(msg)) {
  console.error("\n❌ Invalid commit message format.\n");
  console.error("Expected format: type(scope): subject");
  console.error(
    "Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, types, wip",
  );
  console.error("\nExamples:");
  console.error("  feat(compiler): add template optimization");
  console.error("  fix(v-model): handle blur event correctly");
  console.error("  docs: update installation guide\n");
  process.exit(1);
}

