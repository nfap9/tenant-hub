#!/usr/bin/env node
const { execSync } = require("child_process");

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

// 1. ANDROID_HOME
const androidHome = process.env.ANDROID_HOME;
if (!androidHome) {
  fail(
    "ANDROID_HOME 未设置。\n" +
    "请在 ~/.zshrc（或 ~/.bash_profile）中添加：\n" +
    '  export ANDROID_HOME="$HOME/Library/Android/sdk"\n' +
    '  export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"\n' +
    "然后执行 source ~/.zshrc 生效。"
  );
}
ok(`ANDROID_HOME = ${androidHome}`);

// 2. adb
let adbPath;
try {
  adbPath = execSync("which adb", { encoding: "utf8" }).trim();
} catch {
  fail(
    "adb 未找到。请确认 Android SDK 的 platform-tools 已安装，\n" +
    "且 $ANDROID_HOME/platform-tools 已加入 PATH。"
  );
}
ok(`adb = ${adbPath}`);

// 3. connected device or emulator
let devices;
try {
  devices = execSync("adb devices", { encoding: "utf8" });
} catch {
  fail("adb devices 执行失败，请检查 adb 是否正常工作。");
}

const connected = devices
  .split("\n")
  .slice(1)
  .filter((line) => line.trim().endsWith("device"));

if (connected.length === 0) {
  // check available emulators
  let emulators = [];
  try {
    const list = execSync("emulator -list-avds", { encoding: "utf8" });
    emulators = list.split("\n").filter(Boolean);
  } catch {
    // ignore
  }

  if (emulators.length > 0) {
    fail(
      "没有已连接的 Android 设备或模拟器。\n" +
      `可用的模拟器: ${emulators.join(", ")}\n` +
      "请通过 Android Studio 的 Device Manager 启动一个模拟器，或连接真机。"
    );
  } else {
    fail(
      "没有已连接的 Android 设备，且未找到任何模拟器。\n" +
      "请通过 Android Studio 的 Device Manager 创建一个模拟器并启动，或连接真机。"
    );
  }
}
ok(`已连接设备: ${connected.length} 个`);

console.log("");
