/**
 * V2EX Notifications Plugin
 * Parses V2EX private Atom feed to display notifications in the calendar.
 */
function fetchEvents(config) {
    var token = config.token;
    if (!token || token.trim() === "") {
        throw new Error("Please configure your V2EX Private RSS Token.");
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
            throw new Error("Failed to fetch V2EX RSS feed.");
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

        // Cache for 10 minutes
        sidefy.storage.set(cacheKey, events, { ttl: 10 * 60 * 1000 });

    } catch (err) {
        sidefy.log("V2EX Plugin Error: " + err.message);
        throw err;
    }

    return events;
}

/**
 * Detect notification type based on title and content
 * Based on V2EX RSS samples:
 * - Reply/Mention: Title is not empty
 * - Thanks (Like): Title is empty, Content is NOT empty
 * - Favorite: Title is empty, Content is empty
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
 * Get color for notification type
 */
function getTypeColor(type) {
    var colors = {
        "reply": "#4ECDC4",    // Cyan
        "thanks": "#FFD93D",   // Gold
        "mention": "#FF6B6B",  // Red
        "favorite": "#FF8B13", // Orange
        "other": "#95A5A6"     // Grey
    };
    return colors[type.id] || colors.other;
}

/**
 * Extract content of an XML tag
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
 * Extract attribute value of an XML tag
 */
function extractTagAttribute(xml, tag, attr) {
    var tagRegex = new RegExp("<" + tag + "[^>]*" + attr + "=['\"]([^'\"]*)['\"][^>]*>");
    var match = xml.match(tagRegex);
    return match ? match[1] : "";
}

/**
 * Clean HTML content for notes
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
 * Simple hash for cache key
 */
function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}
