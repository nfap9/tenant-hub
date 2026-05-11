const { prompt } = require('enquirer')
const semver = require('semver')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

async function main() {
  // 读取当前版本
  const pkgPath = path.resolve('package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const currentVersion = pkg.version

  console.log(`Current version: ${currentVersion}\n`)

  // 交互式选择版本类型
  const versionIncrements = ['patch', 'minor', 'major']
  const { release } = await prompt({
    type: 'select',
    name: 'release',
    message: 'Select release type',
    choices: versionIncrements.map(i => {
      const nextVer = semver.inc(currentVersion, i)
      return { name: `${i} (${nextVer})`, value: i }
    })
  })

  // 提取版本类型（从选择中解析）
  const releaseType = release.match(/^(\w+)/)[1]
  const targetVersion = semver.inc(currentVersion, releaseType)

  // 确认发布
  const { confirm } = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: `Releasing v${targetVersion}. Confirm?`,
    initial: true
  })

  if (!confirm) {
    console.log('Cancelled.')
    process.exit(0)
  }

  // ========== 发布流程 ==========

  // 1. 更新版本号
  updatePackageVersion(targetVersion)
  console.log(`✅ Version updated to ${targetVersion}`)

  // 2. 生成 CHANGELOG
  execSync('pnpm run changelog', { stdio: 'inherit' })
  console.log('✅ CHANGELOG generated')

  // 3. 提交版本变更
  execSync(
    `git add -A && git commit -m "release: v${targetVersion}"`,
    { stdio: 'inherit' }
  )
  console.log('✅ Version commit created')

  // 4. 打 Git 标签
  execSync(`git tag v${targetVersion}`)
  console.log(`✅ Tag v${targetVersion} created`)

  // 5. 推送代码和标签（触发 CI/CD）
  console.log('🚀 Pushing to remote...')
  execSync('git push && git push --tags', { stdio: 'inherit' })

  console.log(`\n🎉 Release v${targetVersion} is on its way!`)
}

/**
 * 更新 package.json 版本号
 * 如果是 Monorepo，需要同步更新所有子包的版本
 */
function updatePackageVersion(version) {
  // 更新根 package.json
  const rootPkgPath = path.resolve('package.json')
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'))
  rootPkg.version = version
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n')

  // Monorepo 场景：同步更新 packages/* 下的所有子包
  const packagesDir = path.resolve('packages')
  if (fs.existsSync(packagesDir)) {
    const packages = fs.readdirSync(packagesDir)
    for (const dir of packages) {
      const pkgPath = path.join(packagesDir, dir, 'package.json')
      if (!fs.existsSync(pkgPath)) continue

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      pkg.version = version

      // 同时更新子包之间的相互引用
      updateInternalDeps(pkg, version)

      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    }
  }
}

/**
 * 更新子包之间的内部依赖版本
 * 例如 packages/a 依赖 packages/b，需要同步版本号
 */
function updateInternalDeps(pkg, version) {
  const depTypes = ['dependencies', 'devDependencies', 'peerDependencies']
  for (const depType of depTypes) {
    const deps = pkg[depType]
    if (!deps) continue

    // 假设内部包都以 @scope/ 开头
    for (const depName of Object.keys(deps)) {
      if (deps[depName].startsWith('workspace:') || deps[depName].startsWith('^0.0.0')) {
        deps[depName] = '^' + version
      }
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})