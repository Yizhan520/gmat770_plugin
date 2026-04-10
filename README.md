# GMAT 错题整理助手

当前仓库包含两部分：

- Chrome 扩展：用于 `gmat.gaofengo.com`，支持提取错题、导出 Excel、直传到网站
- [web/](/Users/yizhan/Downloads/gmat_helper_v3/web) 在线站点：基于 `Next.js + Supabase` 的 GMAT 逻辑、阅读、数学与数据洞察错题管理网站

网站一期采用“公开浏览 + Admin Key 管理”方案，并已经内置了 `/Users/yizhan/Downloads/GMAT逻辑错题本--表格版.xlsx` 打包出的 `44` 条逻辑卡片和 `58` 个附件。

## 功能

- 自动识别 GMAT 题目解析页与模考报告页
- 读取题号列表并筛选错题
- 提取题型、题目、选项、我的答案、正确答案、用时、文字解析
- 可选生成题目截图和解析截图
- 使用 ExcelJS 导出为 `.xlsx`
- 可将提取到的错题直接上传到在线网站
- 网站支持公开浏览逻辑、阅读、数学与数据洞察题库，数学页可按 `PS / DS / 粗心 + 模块` 筛选，DI 页可按子题型筛选

## 支持页面

- `https://gmat.gaofengo.com/*`
- `https://www.gaofengo.com/*`

当前版本已兼容如下结果页路径形式：

- `/exercise/exercisebg/...`
- `/exercise/exerciseresult/...`
- `/index/Exercise/exercisebg/...`
- `/index/Exercise/exerciseresult/...`
- `/index/dryrun/report/...`

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
5. 选择：
   - 点击“下载错题 Excel”
   - 或在设置中填写 `网站地址 + Admin Key` 后点击“上传到网站”

如果勾选“包含题目截图”，导出时间会更长。网站侧的 Excel 导入会自动识别逻辑、阅读、数学和数据洞察数据。

## 网站启动

```bash
cd web
npm install
npm run seed:bundle
npm run dev
```

如果你要接 Supabase：

1. 复制 [web/.env.example](/Users/yizhan/Downloads/gmat_helper_v3/web/.env.example) 为 `.env.local`
2. 配置 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_KEY`
3. 依次执行 [202604050001_init.sql](/Users/yizhan/Downloads/gmat_helper_v3/web/supabase/migrations/202604050001_init.sql) 和 [202604100001_expand_sections.sql](/Users/yizhan/Downloads/gmat_helper_v3/web/supabase/migrations/202604100001_expand_sections.sql)
4. 需要把表格种子导入数据库时，运行 `npm run seed:import`
5. 如果要一次导入逻辑和数学，可在 `.env.local` 里设置 `GMAT_SEED_XLSX_PATHS=逻辑路径,数学路径`，脚本会顺序导入两份工作簿

## 项目结构

- `manifest.json`：Chrome 扩展配置
- `content-script.js`：页面识别、DOM 提取、截图逻辑
- `popup.html`：弹窗界面
- `popup.js`：弹窗交互与 Excel 导出逻辑
- `background.js`：下载历史与存储逻辑
- `lib/`：第三方前端库
- `icons/`：扩展图标
- `web/`：在线网站、导入接口、Supabase schema、种子脚本

## 第三方库

- [ExcelJS](https://github.com/exceljs/exceljs)
- [html2canvas](https://github.com/niklasvh/html2canvas)
- [Next.js](https://nextjs.org/)
- [Supabase JS](https://supabase.com/docs/reference/javascript/introduction)
- [JSZip](https://stuk.github.io/jszip/)
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)

请根据这些库各自的许可证要求进行使用和分发。

## 开发说明

Chrome 扩展部分不依赖 Node.js 构建流程，修改后在 `chrome://extensions/` 中点击“重新加载”即可生效。

网站部分位于 [web/](/Users/yizhan/Downloads/gmat_helper_v3/web)，支持 `npm run lint` 和 `npm run build`。

## License

MIT
