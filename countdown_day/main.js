/**
 * Countdown Day Plugin
 * Displays how many days are left until a specified date in the timeline.
 */
function fetchEvents(config) {
    var targetDateStr = config.target_date;
    var eventName = config.event_name || sidefy.i18n({
        "en": "Important Day",
        "zh": "重要日子"
    });

    if (!targetDateStr) {
        return [];
    }

    try {
        var today = new Date();
        // Set time to midnight for accurate day calculation
        var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        var targetDate = new Date(targetDateStr);
        // Also set target date to midnight
        var targetDateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

        var diffTime = targetDateStart.getTime() - todayStart.getTime();
        var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        var message = "";
        var color = "#3498db"; // Default blue
        var isPast = false;

        if (diffDays > 0) {
            message = sidefy.i18n({
                "en": diffDays + " days until " + eventName,
                "zh": "距离 " + eventName + " 还有 " + diffDays + " 天"
            });
        } else if (diffDays === 0) {
            message = sidefy.i18n({
                "en": "Today is " + eventName + "!",
                "zh": "今天是 " + eventName + "！"
            });
            color = "#e74c3c"; // Highlight today with red
        } else {
            isPast = true;
            var absDiff = Math.abs(diffDays);
            message = sidefy.i18n({
                "en": eventName + " was " + absDiff + " days ago",
                "zh": eventName + " 已经过去 " + absDiff + " 天"
            });
            color = "#95a5a6"; // Gray for past dates
        }

        // Create an all-day event for today
        var eventDate = new Date();
        var timestamp = eventDate.getTime() / 1000;

        var events = [{
            title: message,
            startDate: sidefy.date.format(timestamp),
            endDate: sidefy.date.format(timestamp),
            color: color,
            isAllDay: true,
            isPointInTime: true,
            notes: sidefy.i18n({
                "en": "Date: " + targetDateStr + "\nEvent: " + eventName,
                "zh": "日期: " + targetDateStr + "\n事件: " + eventName
            })
        }];

        return events;
    } catch (err) {
        throw new Error(sidefy.i18n({
            "en": "Countdown Day plugin execution failed: " + err.message,
            "zh": "倒计时日插件执行失败: " + err.message
        }));
    }
}
