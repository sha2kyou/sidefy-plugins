// GitHub 个人事件插件 - 获取指定用户的公开活动
function fetchEvents(config) {
    var events = [];

    // 获取配置参数
    var username = config.username;
    var token = config.token || "";
    var limit = parseInt(config.limit) || 10;
    var filterSelf = config.filterSelf === "true" || config.filterSelf === true;

    if (!username) {
        throw new Error("Please configure username parameter");
    }

    // 限制数量范围
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    var cacheKey = "github_user_events_" + username;

    try {
        // 检查缓存 - 简化处理
        var cachedData = sidefy.storage.get(cacheKey);
        if (cachedData) {
            return cachedData; // 直接返回，TTL函数已处理反序列化
        }

        // 构建 API URL
        var url = "https://api.github.com/users/" + encodeURIComponent(username) + "/events/public?per_page=" + limit;

        // 设置请求头
        var headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Accept": "application/vnd.github.v3+json"
        };

        // 如果有 token，添加认证头
        if (token && token.trim() !== "") {
            headers["Authorization"] = "token " + token.trim();
        }

        // 发送请求
        var response = sidefy.http.get(url, headers);

        if (!response) {
            throw new Error("GitHub API request failed");
        }

        // 检查响应是否为有效 JSON
        if (!response.trim().startsWith('[')) {
            throw new Error("GitHub API returned non-JSON data");
        }

        var data = JSON.parse(response);

        if (!Array.isArray(data)) {
            throw new Error("GitHub API returned invalid format");
        }

        // 处理每个事件
        data.forEach(function (event) {
            // 如果启用了过滤自己的事件，且当前事件是用户自己的，则跳过
            if (filterSelf && event.actor && event.actor.login === username) {
                return; // 跳过此事件
            }

            var eventTime = new Date(event.created_at);
            var title = generateEventTitle(event);
            var color = getEventColor(event.type);
            var notes = generateEventNotes(event);
            var href = generateEventUrl(event);

            events.push({
                title: title,
                startDate: sidefy.date.format(eventTime.getTime() / 1000),
                endDate: sidefy.date.format(eventTime.getTime() / 1000),
                color: color,
                notes: notes,
                icon: event.actor.avatar_url || "https://github.com/favicon.ico",
                isAllDay: false,
                isPointInTime: true,
                href: href
            });
        });

        // 缓存结果 - 直接传递数组，使用30分钟TTL
        sidefy.storage.set(cacheKey, events, 30);

    } catch (err) {
        throw new Error("Failed to fetch GitHub user events: " + err.message);
    }

    return events;
}

// 其余函数保持不变...
function generateEventTitle(event) {
    var actor = event.actor.login;
    var repo = event.repo ? event.repo.name : "";

    switch (event.type) {
        case "PushEvent":
            var commitCount = event.payload.commits ? event.payload.commits.length : 0;
            // 如果没有提交(如force push、删除分支等操作)，显示不同的文案
            if (commitCount === 0) {
                return actor + " pushed to " + repo;
            }
            return actor + " pushed " + commitCount + " commits to " + repo;

        case "CreateEvent":
            var refType = event.payload.ref_type;
            if (refType === "repository") {
                return actor + " created repository " + repo;
            } else if (refType === "branch") {
                return actor + " created branch " + event.payload.ref + " in " + repo;
            } else if (refType === "tag") {
                return actor + " created tag " + event.payload.ref + " in " + repo;
            }
            return actor + " created " + refType + " in " + repo;

        case "DeleteEvent":
            return actor + " deleted " + event.payload.ref_type + " " + event.payload.ref + " in " + repo;

        case "ForkEvent":
            return actor + " forked " + repo;

        case "WatchEvent":
            return actor + " starred " + repo;

        case "IssuesEvent":
            var action = event.payload.action;
            var issueNumber = event.payload.issue ? event.payload.issue.number : "";
            return actor + " " + action + " issue #" + issueNumber + " in " + repo;

        case "IssueCommentEvent":
            var issueNumber = event.payload.issue ? event.payload.issue.number : "";
            return actor + " commented on issue #" + issueNumber + " in " + repo;

        case "PullRequestEvent":
            var action = event.payload.action;
            var prNumber = event.payload.pull_request ? event.payload.pull_request.number : "";
            return actor + " " + action + " PR #" + prNumber + " in " + repo;

        case "PullRequestReviewEvent":
            var prNumber = event.payload.pull_request ? event.payload.pull_request.number : "";
            return actor + " reviewed PR #" + prNumber + " in " + repo;

        case "ReleaseEvent":
            var tagName = event.payload.release ? event.payload.release.tag_name : "";
            return actor + " released " + tagName + " in " + repo;

        
        default:
            return actor + " " + event.type.replace("Event", "") + " in " + repo;
    }
}

function getEventColor(eventType) {
    switch (eventType) {
        case "PushEvent":
            return "#4285f4";
        case "CreateEvent":
            return "#ff6d01";
        case "DeleteEvent":
            return "#ea4335";
        case "ForkEvent":
            return "#34a853";
        case "WatchEvent":
            return "#f1c232";
        case "IssuesEvent":
        case "IssueCommentEvent":
            return "#ea4335";
        case "PullRequestEvent":
        case "PullRequestReviewEvent":
            return "#9b59b6";
        case "ReleaseEvent":
            return "#ff6d01";
        default:
            return "#666666";
    }
}

function generateEventNotes(event) {
    var notes = "GitHub Activity";

    if (event.repo) {
        notes += "\nRepository: " + event.repo.name;
    }

    switch (event.type) {
        case "PushEvent":
            if (event.payload.commits && event.payload.commits.length > 0) {
                notes += "\nLatest commit: " + event.payload.commits[0].message;
            }
            break;

        case "IssuesEvent":
        case "PullRequestEvent":
            var item = event.payload.issue || event.payload.pull_request;
            if (item && item.title) {
                notes += "\nTitle: " + item.title;
            }
            break;

        case "ReleaseEvent":
            if (event.payload.release) {
                notes += "\nVersion: " + event.payload.release.tag_name;
                if (event.payload.release.name) {
                    notes += "\nName: " + event.payload.release.name;
                }
            }
            break;
    }

    return notes;
}

function generateEventUrl(event) {
    if (!event.repo) {
        return "https://github.com/" + event.actor.login;
    }

    var baseUrl = "https://github.com/" + event.repo.name;

    switch (event.type) {
        case "IssuesEvent":
            if (event.payload.issue) {
                return baseUrl + "/issues/" + event.payload.issue.number;
            }
            break;

        case "PullRequestEvent":
            if (event.payload.pull_request) {
                return baseUrl + "/pull/" + event.payload.pull_request.number;
            }
            break;

        case "ReleaseEvent":
            if (event.payload.release) {
                return baseUrl + "/releases/tag/" + event.payload.release.tag_name;
            }
            break;

        case "CreateEvent":
            if (event.payload.ref_type === "branch") {
                return baseUrl + "/tree/" + event.payload.ref;
            } else if (event.payload.ref_type === "tag") {
                return baseUrl + "/releases/tag/" + event.payload.ref;
            }
            break;
    }

    return baseUrl;
}