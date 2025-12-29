# V2EX Notifications Plugin

获取 V2EX 的未读消息并显示在日历中。支持区分回复、点赞（感谢）、提及和收藏。

## 配置

1. 登录 V2EX。
2. 进入 [通知页面](https://www.v2ex.com/notifications)。
3. 在页面右侧或底部找到 **Atom Feed for Notifications** 下面的 RSS 链接。
4. 复制该链接中的 Token 部分（即 `.xml` 之前的长字符串，例如 `your-private-token-here`）。
5. 将 Token 填入插件配置的 `token` 中。

## 功能

- **自动刷新**: 每 10 分钟检查一次新消息。
- **类型区分**:
  - [回复] 蓝色
  - [感谢] 金色
  - [提及] 红色
  - [收藏] 橙色
- **详情查看**: 点击事件可直接跳转到对应的回复或主题。
