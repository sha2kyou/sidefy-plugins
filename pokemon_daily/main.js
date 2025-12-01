/**
 * 每日随机宝可梦插件
 * 每天随机展示一个编号1-500的宝可梦信息。
 */
function fetchEvents(config) {
    // --- 每日缓存逻辑 ---
    var today = new Date();
    var dateString = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    var cacheKey = "pokemon_daily_v12_" + dateString;

    var cachedData = sidefy.storage.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // 计算到当天结束剩余的分钟数
    var endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    var remainingMinutes = Math.ceil((endOfDay.getTime() - today.getTime()) / (1000 * 60));

    // --- 随机宝可梦逻辑 ---
    var events = [];
    try {
        // 随机生成1-720的宝可梦编号（第6世代及之前）
        var pokemonId = Math.floor(Math.random() * 720) + 1;
        var paddedId = pokemonId.toString().padStart(3, '0');

        // 构建URL
        var pokemonUrl = "https://pokemondb.net/pokedex/" + paddedId;

        var response = sidefy.http.get(pokemonUrl);
        if (!response) {
            throw new Error("获取宝可梦信息失败，请检查网络连接。");
        }

        // --- 解析HTML提取信息 ---
        var html = response;
        var pokemonData = extractPokemonData(html, pokemonId, pokemonUrl);

        // --- 创建日历事件 ---
        var eventDate = new Date();
        eventDate.setHours(9, 0, 0, 0); // 上午9点显示

        events.push({
            title: pokemonData.name + " (#" + paddedId + ")",
            startDate: sidefy.date.format(eventDate.getTime() / 1000),
            endDate: sidefy.date.format(eventDate.getTime() / 1000),
            color: getTypeColor(pokemonData.types[0]),
            icon: "https://pokemondb.net/favicon.ico",
            href: pokemonUrl,
            imageURL: pokemonData.imageUrl,
            isAllDay: true,
            isPointInTime: true
        });

        // 将成功获取的事件缓存到当天结束
        if (events.length > 0) {
            sidefy.storage.set(cacheKey, events, remainingMinutes);
        }

    } catch (err) {
        throw new Error("宝可梦插件执行失败: " + err.message);
    }

    return events;
}

/**
 * 从HTML中提取宝可梦信息
 */
function extractPokemonData(html, pokemonId, pokemonUrl) {
    var data = {
        name: "",
        imageUrl: "",
        types: []
    };

    // 提取宝可梦名称
    var titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/);
    if (titleMatch) {
        data.name = titleMatch[1].trim();
    }

    // 提取图片URL
    var imageMatch = html.match(/<img[^>]*class="[^"]*artwork[^"]*"[^>]*src="([^"]*)"/);
    if (!imageMatch) {
        imageMatch = html.match(/<img[^>]*src="([^"]*pokemondb\.net\/artwork\/[^"]*)"/);
    }
    if (imageMatch) {
        data.imageUrl = imageMatch[1];
    }

    // 提取信息 - 从vitals-table表格中提取
    var vitalsMatch = html.match(/<div[^>]*class="[^"]*vitals-table[^"]*"[^>]*>[\s\S]*?<\/div>/);
    var vitalsHtml = vitalsMatch ? vitalsMatch[0] : html;

    // 提取详细信息
    var species = extractSpecies(vitalsHtml);
    var height = extractHeight(vitalsHtml);
    var weight = extractWeight(vitalsHtml);

    // 提取属性
    var typeMatches = vitalsHtml.match(/<th[^>]*>Type<\/th>\s*<td[^>]*>(.*?)<\/td>/);
    var types = [];
    if (typeMatches) {
        var typeHtml = typeMatches[1];
        var typeIcons = typeHtml.match(/<a[^>]*>(.*?)<\/a>/g);
        if (typeIcons) {
            for (var i = 0; i < typeIcons.length; i++) {
                var typeMatch = typeIcons[i].match(/<a[^>]*>(.*?)<\/a>/);
                if (typeMatch) {
                    var typeEn = typeMatch[1].trim();
                    types.push(typeEn);
                    data.types.push(typeEn);
                }
            }
        }
    }

    // 不构建notes

    return data;
}

/**
 * 提取物种信息
 */
function extractSpecies(vitalsHtml) {
    var speciesMatch = vitalsHtml.match(/<th[^>]*>Species<\/th>\s*<td[^>]*>(.*?)<\/td>/);
    if (speciesMatch) {
        var speciesText = speciesMatch[1].replace(/<[^>]*>/g, '').trim();
        return speciesText;
    }
    return "Unknown";
}

/**
 * 提取身高信息
 */
function extractHeight(vitalsHtml) {
    var heightMatch = vitalsHtml.match(/<th[^>]*>Height<\/th>\s*<td[^>]*>(.*?)<\/td>/);
    if (heightMatch) {
        return heightMatch[1].trim();
    }
    return "Unknown";
}

/**
 * 提取体重信息
 */
function extractWeight(vitalsHtml) {
    var weightMatch = vitalsHtml.match(/<th[^>]*>Weight<\/th>\s*<td[^>]*>(.*?)<\/td>/);
    if (weightMatch) {
        return weightMatch[1].trim();
    }
    return "Unknown";
}

/**
 * 根据宝可梦属性获取对应的颜色
 */
function getTypeColor(type) {
    var typeColors = {
        "Normal": "#A8A878",
        "Fire": "#F08030",
        "Water": "#6890F0",
        "Electric": "#F8D030",
        "Grass": "#78C850",
        "Ice": "#98D8D8",
        "Fighting": "#C03028",
        "Poison": "#A040A0",
        "Ground": "#E0C068",
        "Flying": "#A890F0",
        "Psychic": "#F85888",
        "Bug": "#A8B820",
        "Rock": "#B8A038",
        "Ghost": "#705898",
        "Dragon": "#7038F8",
        "Dark": "#705848",
        "Steel": "#B8B8D0",
        "Fairy": "#EE99AC"
    };

    return typeColors[type] || "#666666";
}