// GitHub 通知插件 - 获取 GitHub 通知和订阅信息
function fetchEvents(config) {
    var events = [];

    // 获取配置参数
    var token = config.token;
    var limit = parseInt(config.limit) || 20;
    var showParticipating = config.showParticipating === true; // 默认为false
    var showAll = config.showAll !== false; // 默认为true
    var notificationTypes = config.notificationTypes || "";

    if (!token || token.trim() === "") {
        throw new Error("Please configure GitHub Personal Access Token");
    }

    // 限制数量范围
    if (limit < 1) limit = 1;
    if (limit > 50) limit = 50;

    // 解析通知类型 - 如果为空则不筛选
    var allowedTypes = [];
    if (notificationTypes && notificationTypes.trim() !== "") {
        allowedTypes = notificationTypes.split(",").map(function(type) {
            return type.trim();
        });
    }

    var cacheKey = "github_notifications_" + (showParticipating ? "participating" : "all") + "_" + limit;

    try {
        // 检查缓存
        var cachedData = sidefy.storage.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // 构建 API URL
        var url = "https://api.github.com/notifications?per_page=" + limit;
        if (showParticipating && !showAll) {
            url += "&participating=true";
        }
        if (showAll) {
            url += "&all=true";
        }

        // 设置请求头
        var headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Accept": "application/vnd.github.v3+json",
            "Authorization": "token " + token.trim()
        };

        // 发送请求
        var response = sidefy.http.get(url, headers);

        if (!response || response.length === 0) {
            throw new Error("GitHub API returned empty response");
        }

        var notifications = JSON.parse(response);

        if (!Array.isArray(notifications)) {
            if (notifications.message) {
                throw new Error("GitHub API error: " + notifications.message);
            }
            throw new Error("GitHub API returned invalid data format");
        }

        // 处理通知数据
        sidefy.log("[GitHub通知] 开始处理 " + notifications.length + " 个通知");
        notifications.forEach(function(notification) {
            var notificationTime = new Date(notification.updated_at);
            var localTimeStr = notificationTime.toLocaleString();

            sidefy.log("[GitHub通知] 通知: " + notification.subject.title + " | 原始时间: " + notification.updated_at + " | 本地时间: " + localTimeStr + " | 类型: " + notification.reason);

            // 检查通知类型是否在允许列表中（如果有配置的话）
            if (allowedTypes.length > 0 && allowedTypes.indexOf(notification.reason) === -1) {
                sidefy.log("[GitHub通知] 跳过类型: " + notification.reason);
                return; // 跳过不需要的通知类型
            }

            var title = getNotificationTitle(notification);
            var color = getNotificationColor(notification.reason);

            // 直接使用GitHub API返回的UTC时间，JavaScript会自动处理本地时区显示
            var localStartTime = notificationTime;
            var localEndTime = new Date(localStartTime.getTime() + 30 * 60 * 1000); // 30分钟后结束

            var event = {
                title: title,
                startDate: sidefy.date.format(localStartTime.getTime() / 1000),
                endDate: sidefy.date.format(localEndTime.getTime() / 1000),
                color: color,
                notes: getNotificationNotes(notification),
                icon: "https://github.com/favicon.ico",
                isAllDay: false,
                isPointInTime: true,
                href: getNotificationUrl(notification)
            };

            events.push(event);
        });

        // 缓存结果 - 10分钟缓存
        var cacheOptions = {
            ttl: 10 * 60 * 1000
        };
        sidefy.storage.set(cacheKey, events, cacheOptions);

        return events;

    } catch (error) {
        throw new Error("Failed to fetch GitHub notifications: " + error.message);
    }
}

// 生成通知标题
function getNotificationTitle(notification) {
    var typeText = getNotificationTypeText(notification.reason);
    var repoName = notification.repository.name;
    var subject = notification.subject.title;

    return "[" + typeText + "] " + repoName + ": " + subject;
}

// 获取通知类型显示文本
function getNotificationTypeText(reason) {
    var typeMap = {
        "mention": "@mention",
        "assign": "assign",
        "review_requested": "review",
        "subscribed": "subscribed",
        "author": "author",
        "manual": "manual",
        "security_alert": "security"
    };

    return typeMap[reason] || reason;
}

// 获取通知颜色
function getNotificationColor(reason) {
    var colorMap = {
        "mention": "#FF6B6B",           // 红色 - 提及
        "assign": "#4ECDC4",           // 青色 - 分配
        "review_requested": "#45B7D1", // 蓝色 - 审查请求
        "subscribed": "#96CEB4",       // 绿色 - 订阅
        "author": "#DDA0DD",           // 紫色 - 作者
        "manual": "#98D8C8",           // 浅绿 - 手动订阅
        "security_alert": "#DC3545"    // 深红色 - 安全警报
    };

    return colorMap[reason] || "#95A5A6";
}

// 生成通知详细信息
function getNotificationNotes(notification) {
    var notes = [];

    notes.push("Repository: " + notification.repository.full_name);
    notes.push("Subject: " + notification.subject.type);

    if (notification.unread) {
        notes.push("Status: Unread");
    } else {
        notes.push("Status: Read");
    }

    // 添加具体的原因描述
    var reasonDesc = getReasonDescription(notification.reason);
    if (reasonDesc) {
        notes.push("Details: " + reasonDesc);
    }

    return notes.join("\n");
}

// 获取通知原因的详细描述
function getReasonDescription(reason) {
    var descriptions = {
        "mention": "You were @mentioned in a comment",
        "assign": "You were assigned to this task",
        "review_requested": "Code review requested from you",
        "subscribed": "You subscribed to updates",
        "author": "You are the author",
        "manual": "Manually subscribed",
        "security_alert": "Security vulnerability found"
    };

    return descriptions[reason] || "";
}

// 获取通知链接
function getNotificationUrl(notification) {
    // 优先使用 subject.url，转换为网页链接
    if (notification.subject.url) {
        var url = notification.subject.url;
        // 只需要替换 API 前缀为网页前缀
        url = url.replace("https://api.github.com/repos/", "https://github.com/");
        url = url.replace("/pulls/", "/pull/");
        return url;
    }

    // 备用：仓库链接
    if (notification.repository.html_url) {
        return notification.repository.html_url;
    }

    return "https://github.com/" + notification.repository.full_name;
}

// 格式化日期
function formatDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');

    return year + "-" + month + "-" + day + " " + hours + ":" + minutes;
}

// String.padStart polyfill for older environments
if (!String.prototype.padStart) {
    String.prototype.padStart = function(targetLength, padString) {
        targetLength = targetLength >> 0;
        padString = String(padString || ' ');
        if (this.length > targetLength) {
            return String(this);
        } else {
            targetLength = targetLength - this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength / padString.length);
            }
            return padString.slice(0, targetLength) + String(this);
        }
    };
}