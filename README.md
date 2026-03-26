# GMAT 错题整理助手

一个用于 `gmat.gaofengo.com` 的 Chrome 扩展，支持在 GMAT 做题结果页中提取错题信息，并导出为 Excel。

## 功能

- 自动识别 GMAT 题目解析/结果页面
- 读取题号列表并筛选错题
- 提取题型、题目、选项、我的答案、正确答案、用时、文字解析
- 可选生成题目截图和解析截图
- 使用 ExcelJS 导出为 `.xlsx`

## 支持页面

- `https://gmat.gaofengo.com/*`
- `https://www.gaofengo.com/*`

当前版本已兼容如下结果页路径形式：

- `/exercise/exercisebg/...`
- `/exercise/exerciseresult/...`
- `/index/Exercise/exercisebg/...`
- `/index/Exercise/exerciseresult/...`

## 安装方式

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本项目所在目录

## 使用方式

1. 在 Chrome 中登录高分 GMAT 网站
2. 打开题目解析或做题结果页面
3. 点击扩展图标
4. 确认插件识别到错题数量
5. 点击“下载错题 Excel”

如果勾选“包含题目截图”，导出时间会更长。

## 项目结构

- `manifest.json`：Chrome 扩展配置
- `content-script.js`：页面识别、DOM 提取、截图逻辑
- `popup.html`：弹窗界面
- `popup.js`：弹窗交互与 Excel 导出逻辑
- `background.js`：下载历史与存储逻辑
- `lib/`：第三方前端库
- `icons/`：扩展图标

## 第三方库

- [ExcelJS](https://github.com/exceljs/exceljs)
- [html2canvas](https://github.com/niklasvh/html2canvas)

请根据这些库各自的许可证要求进行使用和分发。

## 开发说明

这是一个纯前端 Chrome 扩展项目，不依赖 Node.js 构建流程。修改代码后，在 `chrome://extensions/` 中点击“重新加载”即可生效。

## License

MIT
