# GMAT 逻辑错题网站

一期目标：

- 公开浏览逻辑错题库
- Admin Key 管理导入、编辑、删除
- 支持 Excel 导入、文件夹导入、Chrome 插件直传
- 未配置 Supabase 时，先展示仓库内置的种子数据

## 本地开发

```bash
npm install
npm run seed:bundle
npm run dev
```

如果你已经配置好了 Supabase，再额外执行：

```bash
npm run seed:import
```

## 环境变量

参考 [web/.env.example](/Users/yizhan/Downloads/gmat_helper_v3/web/.env.example)：

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `ADMIN_KEY`
- `GMAT_SEED_XLSX_PATH`

## 数据库

初始化 SQL 位于：

- [202604050001_init.sql](/Users/yizhan/Downloads/gmat_helper_v3/web/supabase/migrations/202604050001_init.sql)

## 脚本

- `npm run seed:bundle`：从表格版 Excel 生成内置种子 JSON 和公开附件
- `npm run seed:import`：将表格版 Excel 导入 Supabase
- `npm run lint`
- `npm run build`
