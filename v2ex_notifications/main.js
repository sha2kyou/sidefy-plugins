/**
 * V2EX 未读提醒插件
 * 解析 V2EX 私有 Atom Feed 并在日历中显示提醒。
 */
function fetchEvents(config) {
    var token = config.token;
    if (!token || token.trim() === "") {
        throw new Error("请配置您的 V2EX 私有 RSS Token。");
    }

    var rssUrl = "https://www.v2ex.com/n/" + token.trim() + ".xml";
    var cacheKey = "v2ex_notifications_" + hashString(token);

    // Check cache
    var cachedData = sidefy.storage.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    var events = [];
    try {
        var response = sidefy.http.get(rssUrl);
        if (!response) {
            throw new Error("获取 V2EX RSS 订阅失败。");
        }

        // Parse Atom entries
        var entries = response.match(/<entry>[\s\S]*?<\/entry>/g);
        if (entries) {
            entries.forEach(function (entry) {
                var title = extractTagContent(entry, "title");
                var link = extractTagAttribute(entry, "link", "href");
                var published = extractTagContent(entry, "published");
                var contentRaw = extractTagContent(entry, "content").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
                var authorName = extractTagContent(entry, "name", "<author>", "<\/author>");

                var type = detectType(title, contentRaw);
                var color = getTypeColor(type);

                // Construct a meaningful title if the original is empty
                var displayTitle = title;
                if (!displayTitle) {
                    if (type.id === "thanks") {
                        displayTitle = (authorName || "有人") + " 感谢了你的回复";
                    } else if (type.id === "favorite") {
                        displayTitle = (authorName || "有人") + " 收藏了你的主题";
                    } else {
                        displayTitle = (authorName || "有人") + " 发送了新消息";
                    }
                }

                var pubDate = new Date(published);
                var startDate = sidefy.date.format(pubDate.getTime() / 1000);
                var endDate = sidefy.date.format((pubDate.getTime() + 30 * 60 * 1000) / 1000);

                events.push({
                    title: displayTitle,
                    startDate: startDate,
                    endDate: endDate,
                    color: color,
                    notes: type.id === "favorite" ? null : cleanContent(contentRaw),
                    icon: "https://www.v2ex.com/static/favicon.ico",
                    isAllDay: false,
                    isPointInTime: true,
                    href: link
                });
            });
        }

        // 缓存 10 分钟
        sidefy.storage.set(cacheKey, events, { ttl: 10 * 60 * 1000 });

    } catch (err) {
        sidefy.log("V2EX 插件错误: " + err.message);
        throw err;
    }

    return events;
}

/**
 * 根据标题和内容检测通知类型
 * 基于 V2EX RSS 样例:
 * - 回复/提及: 标题不为空
 * - 点赞 (感谢): 标题为空, 内容不为空
 * - 收藏: 标题为空, 内容为空
 */
function detectType(title, content) {
    if (!title || title.trim() === "") {
        // If title is empty, check content to distinguish between Thanks and Favorite
        var cleanTxt = cleanContent(content);
        if (cleanTxt && cleanTxt.length > 0) {
            return { id: "thanks", label: "点赞" };
        } else {
            return { id: "favorite", label: "收藏" };
        }
    }

    var text = title.toLowerCase();
    if (text.indexOf("回复了你") !== -1 || text.indexOf("回复了") !== -1) {
        return { id: "reply", label: "回复" };
    }
    if (text.indexOf("感谢了你") !== -1 || text.indexOf("感谢了") !== -1) {
        return { id: "thanks", label: "点赞" };
    }
    if (text.indexOf("提到你") !== -1 || text.indexOf("提到了你") !== -1) {
        return { id: "mention", label: "提及" };
    }
    if (text.indexOf("收藏了") !== -1) {
        return { id: "favorite", label: "收藏" };
    }
    return { id: "other", label: "通知" };
}

/**
 * 获取通知类型的对应颜色
 */
function getTypeColor(type) {
    var colors = {
        "reply": "#4ECDC4",    // 青色
        "thanks": "#FFD93D",   // 金色
        "mention": "#FF6B6B",  // 红色
        "favorite": "#FF8B13", // 橙色
        "other": "#95A5A6"     // 灰色
    };
    return colors[type.id] || colors.other;
}

/**
 * 提取 XML 标签内容
 */
function extractTagContent(xml, tag, startBoundary, endBoundary) {
    var searchArea = xml;
    if (startBoundary && endBoundary) {
        var boundaryRegex = new RegExp(startBoundary + "([\\s\\S]*?)" + endBoundary);
        var match = xml.match(boundaryRegex);
        if (match) searchArea = match[1];
        else return "";
    }

    var tagRegex = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">");
    var match = searchArea.match(tagRegex);
    return match ? match[1].trim() : "";
}

/**
 * 提取 XML 标签属性值
 */
function extractTagAttribute(xml, tag, attr) {
    var tagRegex = new RegExp("<" + tag + "[^>]*" + attr + "=['\"]([^'\"]*)['\"][^>]*>");
    var match = xml.match(tagRegex);
    return match ? match[1] : "";
}

/**
 * 清理 HTML 内容以用于备注
 */
function cleanContent(content) {
    if (!content) return "";
    // Remove HTML tags
    var text = content.replace(/<[^>]*>/g, " ");
    // Unescape common entities
    text = text.replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    // Clean whitespace
    return text.trim().replace(/\s+/g, " ");
}

/**
 * 简单的字符串哈希，用于生成缓存键
 */
function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}
