/**
 * Universal Web Monitor Plugin
 * Monitors a specific URL and uses AI to extract information based on user prompt.
 */
function fetchEvents(config) {
    var url = config.url;
    var prompt = config.prompt;
    var intervalHours = parseFloat(config.interval) || 6;

    // Basic validation
    if (!url || url.trim() === "") {
        throw new Error("Please configure the Target URL");
    }
    if (!prompt || prompt.trim() === "") {
        throw new Error("Please configure the AI Prompt");
    }

    // Generate cache key based on URL to ensure uniqueness per target
    // Using a simple hash-like approach for the key
    var urlKey = url.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
    var cacheKey = "univ_mon_" + urlKey;

    // Check cache
    var cachedEvents = sidefy.storage.get(cacheKey);
    if (cachedEvents) {
        return cachedEvents;
    }

    var events = [];
    try {
        sidefy.log("Universal Monitor: Starting crawl for " + url);

        // 1. Crawl the webpage
        var crawlResult = sidefy.crawler(url);
        
        if (!crawlResult || !crawlResult.success) {
            var errorMsg = crawlResult ? crawlResult.error : "Unknown error";
            sidefy.log("Universal Monitor: Crawl failed - " + errorMsg);
            // We don't throw here to avoid blocking the whole calendar, just return empty
            // But maybe we should return an error event? 
            // Let's just return empty for now to be safe.
            return [];
        }

        var content = crawlResult.content;

        // Truncate content to avoid token limits (approx 15k chars is usually safe for summaries)
        var contentToAnalyze = content.substring(0, 15000);

        // 2. AI Processing
        var fullPrompt = prompt + "\n\nIMPORTANT: Format your response exactly as follows:\nLine 1: A short, descriptive title for this update (max 20 characters).\nLine 2+: The detailed information you extracted.\nDo not include any other text.\n\nTarget Webpage Content:\n" + contentToAnalyze;
        
        sidefy.log("Universal Monitor: Calling AI");
        var aiResult = sidefy.ai.chat(fullPrompt);

        if (!aiResult || typeof aiResult !== 'string' || aiResult.trim().length === 0) {
            sidefy.log("Universal Monitor: AI returned empty result");
            return [];
        }

        var summary = aiResult.trim();
        var lines = summary.split('\n');
        
        // Parse Title and Content
        var eventTitle = lines[0].replace(/^(Title:|Line 1:)/i, "").trim();
        var eventContent = lines.slice(1).join('\n').trim();

        // Fallback if content is empty (AI might have output only one line)
        if (!eventContent) {
            eventContent = eventTitle;
        }

        // 3. Create Event
        var now = new Date();
        
        // Determine color based on keywords
        var color = "#2980B9"; // Default Blue
        var keywords = config.keywords || "";
        
        if (keywords && keywords.trim() !== "") {
            var keywordList = keywords.split(",").map(function(k) { return k.trim().toLowerCase(); });
            var contentLower = (eventTitle + " " + eventContent).toLowerCase();
            
            for (var i = 0; i < keywordList.length; i++) {
                if (keywordList[i] && contentLower.includes(keywordList[i])) {
                    color = "#8E44AD"; // Purple if keyword found
                    break;
                }
            }
        }

        events.push({
            title: eventTitle,
            startDate: sidefy.date.format(now.getTime() / 1000),
            endDate: sidefy.date.format(now.getTime() / 1000),
            isAllDay: true,
            isPointInTime: false,
            notes: eventContent,
            color: color,
            href: sidefy.popup.build(eventTitle, eventContent),
            imageURL: null
        });

        // 4. Cache the result
        // Cache duration = intervalHours * 60 minutes
        var cacheDuration = Math.max(intervalHours * 60, 15); // Minimum 15 min cache
        sidefy.storage.set(cacheKey, events, cacheDuration);
        
        sidefy.log("Universal Monitor: Success, cached for " + cacheDuration + " minutes");

    } catch (err) {
        sidefy.log("Universal Monitor Error: " + err.message);
        // Return empty on error
        return [];
    }

    return events;
}
