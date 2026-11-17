# Web Games

一个自研网页小游戏的聚合站：所有游戏都在同一个域名下，靠搜索引擎和 AI 答案引擎带来玩家。

## Language

**Game（游戏）**:
站内一个可玩的自研作品，由一个 slug 唯一标识，各语言共用同一个 slug。
_Avoid_: 小游戏、作品、App

**Game Page（游戏页）**:
某个 Game 在某种语言下的落地页，承载封面、文字内容和 Player。它是搜索引擎和 AI 抓取的对象。
_Avoid_: 详情页、落地页、游戏主页

**Game Bundle（游戏包）**:
一个 Game 独立构建出的可运行静态产物，不依赖站点本身的页面代码。
_Avoid_: 游戏资源、build、客户端

**Player（播放器）**:
Game Page 上承载 Game Bundle 的区域，玩家点击开始之前只显示封面。
_Avoid_: 游戏容器、iframe、舞台

**Game Content（游戏内容）**:
随 Game 一起维护的文字材料（简介、玩法、攻略、FAQ），按语言各有一份。
_Avoid_: 文案、描述、SEO 文本

**Game Contract（接入规范）**:
Game Bundle 与 Player 之间约定的全部交互（就绪、暂停、全屏、静音、语言、存档、广告、事件），是 Game 上线的唯一技术前提。
_Avoid_: SDK、协议、桥接、API

**Tier（档位）**:
Game 按呈现方式的分类，分为 DOM、2D、2.5D、3D 四档，每个 Game 恰好属于一个 Tier，与 Category 无关。
_Avoid_: 引擎类型、渲染模式、维度

**Replay（回放）**:
能完整重现一局的记录，由开局条件（种子、难度等）和玩家的完整操作序列组成，用同一规则版本重演总能得到同一个结果。
_Avoid_: 录像、日志、回放文件

**Save（存档）**:
Game 通过 Game Contract 交给站点保管的玩家进度数据，Game 自己不决定它存在哪里。
_Avoid_: 进度、本地数据、缓存

**Daily Puzzle（每日题目）**:
某个 Game 在某个 UTC 日期下所有玩家共享的同一道题，只由 Game 和日期决定。
_Avoid_: 每日挑战、今日关卡

**Category（分类）**:
人工维护的固定清单中的一项，每个 Game 恰好属于一个 Category。
_Avoid_: 标签、类型、频道

**Category Page（分类页）**:
列出某个 Category 下所有 Game 的页面，Game 数量不足时不存在。
_Avoid_: 列表页、频道页

**Guide（攻略）**:
一篇独立的文章，可以关联零个或多个 Game，不从属于任何一个 Game。
_Avoid_: 博客、文章、教程

**Locale（语言）**:
站点提供内容的一种语言版本；英文是默认 Locale。
_Avoid_: 语种、地区、站点版本
