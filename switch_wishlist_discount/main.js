/**
 * Switch 愿望单打折监控插件 (日本区)
 * 监控指定的 Nintendo Switch 游戏打折信息，并在日历中显示打折游戏。
 */
function fetchEvents(config) {

    // 检查游戏 ID 列表是否存在
    var gameIds = config.game_ids;

    if (!gameIds || gameIds.trim() === "") {
        throw new Error(sidefy.i18n({
            "zh": "游戏 ID 列表不能为空，请在插件配置中填入要监控的游戏 ID。",
            "en": "Game ID list cannot be empty. Please enter the game IDs you want to monitor in the plugin configuration.",
            "ja": "ゲーム ID リストを空にすることはできません。プラグイン設定で監視するゲーム ID を入力してください。",
            "ko": "게임 ID 목록은 비워둘 수 없습니다. 플러그인 설정에서 모니터링할 게임 ID를 입력하세요.",
            "de": "Die Spiele-ID-Liste darf nicht leer sein. Bitte geben Sie die zu überwachenden Spiele-IDs in der Plugin-Konfiguration ein.",
            "es": "La lista de ID de juegos no puede estar vacía. Por favor, ingrese los ID de juegos que desea monitorear en la configuración del complemento.",
            "fr": "La liste des ID de jeux ne peut pas être vide. Veuillez entrer les ID de jeux que vous souhaitez surveiller dans la configuration du plugin.",
            "pt": "A lista de IDs de jogos não pode estar vazia. Por favor, insira os IDs dos jogos que deseja monitorar na configuração do plugin.",
            "ru": "Список ID игр не может быть пустым. Пожалуйста, введите ID игр, которые вы хотите отслеживать, в настройках плагина."
        }));
    }

    // 清理游戏 ID（移除可能的字母前缀和空格），并限制最多10个
    var cleanedIdsArray = gameIds
        .split(',')
        .map(function(id) {
            return id.trim().replace(/^[A-Z]/i, ''); // 移除开头的字母
        })
        .filter(function(id) {
            return id !== ""; // 过滤空字符串
        })
        .slice(0, 10); // 只取前10个

    var cleanedIds = cleanedIdsArray.join(',');

    // --- 缓存逻辑 ---
    // 在缓存键中加入日期，确保跨天后缓存自动失效
    var today = new Date();
    var dateKey = today.getFullYear() + "" +
                  String(today.getMonth() + 1).padStart(2, '0') +
                  String(today.getDate()).padStart(2, '0');
    var cacheKey = "switch_wishlist_jp_v4_" + cleanedIds + "_" + dateKey;
    var cachedData = sidefy.storage.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // --- Switch 愿望单打折检查逻辑 ---
    var events = [];

    try {
        // 1. 查询游戏价格信息（日本区）
        var priceUrl = "https://api.ec.nintendo.com/v1/price?country=JP&ids=" +
                       cleanedIds + "&lang=ja";
        var priceResponse = sidefy.http.get(priceUrl);

        if (!priceResponse) {
            throw new Error(sidefy.i18n({
                "zh": "无法获取游戏价格信息，请检查网络连接。",
                "en": "Unable to retrieve game price information. Please check your network connection.",
                "ja": "ゲーム価格情報を取得できません。ネットワーク接続を確認してください。",
                "ko": "게임 가격 정보를 가져올 수 없습니다. 네트워크 연결을 확인하세요.",
                "de": "Spielpreisinformationen können nicht abgerufen werden. Bitte überprüfen Sie Ihre Netzwerkverbindung.",
                "es": "No se puede obtener la información de precios del juego. Por favor, verifique su conexión de red.",
                "fr": "Impossible de récupérer les informations de prix du jeu. Veuillez vérifier votre connexion réseau.",
                "pt": "Não foi possível obter as informações de preço do jogo. Por favor, verifique sua conexão de rede.",
                "ru": "Не удалось получить информацию о ценах на игры. Пожалуйста, проверьте подключение к сети."
            }));
        }

        var priceData = JSON.parse(priceResponse);

        if (!priceData.prices || priceData.prices.length === 0) {
            throw new Error(sidefy.i18n({
                "zh": "未找到游戏价格信息，请检查游戏 ID 是否正确。",
                "en": "Game price information not found. Please check if the game IDs are correct.",
                "ja": "ゲーム価格情報が見つかりません。ゲーム ID が正しいか確認してください。",
                "ko": "게임 가격 정보를 찾을 수 없습니다. 게임 ID가 올바른지 확인하세요.",
                "de": "Spielpreisinformationen nicht gefunden. Bitte überprüfen Sie, ob die Spiele-IDs korrekt sind.",
                "es": "No se encontró información de precios del juego. Por favor, verifique si los ID de juegos son correctos.",
                "fr": "Informations de prix du jeu introuvables. Veuillez vérifier si les ID de jeux sont corrects.",
                "pt": "Informações de preço do jogo não encontradas. Por favor, verifique se os IDs dos jogos estão corretos.",
                "ru": "Информация о ценах на игры не найдена. Пожалуйста, проверьте правильность ID игр."
            }));
        }

        // 2. 获取游戏信息（优先使用用户配置，否则从日本商店抓取）
        var gameIdsArray = cleanedIdsArray; // 使用已经限制数量的数组
        var gameInfoMap = {};

        for (var i = 0; i < gameIdsArray.length; i++) {
            var gameId = gameIdsArray[i].trim();

            // 从日本商店页面抓取游戏信息
            try {
                var storeUrl = "https://store-jp.nintendo.com/item/software/D" + gameId;
                var storePage = sidefy.http.get(storeUrl);

                if (storePage) {
                    var gameName = sidefy.i18n({
                        "zh": "游戏 ID: " + gameId,
                        "en": "Game ID: " + gameId,
                        "ja": "ゲーム ID: " + gameId,
                        "ko": "게임 ID: " + gameId,
                        "de": "Spiele-ID: " + gameId,
                        "es": "ID del juego: " + gameId,
                        "fr": "ID du jeu: " + gameId,
                        "pt": "ID do jogo: " + gameId,
                        "ru": "ID игры: " + gameId
                    });
                    var gameImage = "";
                    var deviceInfo = "";

                    // 从 og:title meta 标签提取游戏名称
                    var titleMatch = storePage.match(/property="og:title"\s+content="([^"]*)"/);
                    if (titleMatch && titleMatch[1]) {
                        gameName = titleMatch[1];
                    }

                    // 从 og:image meta 标签提取封面图
                    var imageMatch = storePage.match(/property="og:image"\s+content="([^"]*)"/);
                    if (imageMatch && imageMatch[1]) {
                        gameImage = imageMatch[1];
                    }

                    // 提取设备兼容性信息
                    deviceInfo = extractDeviceInfo(storePage);

                    gameInfoMap[gameId] = {
                        name: gameName,
                        image: gameImage,
                        device: deviceInfo
                    };
                    continue;
                }
            } catch (fetchErr) {
                // 抓取失败，使用默认值
            }

            // 如果都失败，使用游戏 ID 作为名称
            gameInfoMap[gameId] = {
                name: sidefy.i18n({
                    "zh": "游戏 ID: " + gameId,
                    "en": "Game ID: " + gameId,
                    "ja": "ゲーム ID: " + gameId,
                    "ko": "게임 ID: " + gameId,
                    "de": "Spiele-ID: " + gameId,
                    "es": "ID del juego: " + gameId,
                    "fr": "ID du jeu: " + gameId,
                    "pt": "ID do jogo: " + gameId,
                    "ru": "ID игры: " + gameId
                }),
                image: "",
                device: ""
            };
        }

        // 3. 处理价格数据，检查打折信息
        var discountedGames = [];

        for (var j = 0; j < priceData.prices.length; j++) {
            var priceInfo = priceData.prices[j];
            var gameId = String(priceInfo.title_id);

            // 跳过未找到的游戏
            if (priceInfo.sales_status === "not_found") {
                continue;
            }

            // 检查是否有折扣
            if (priceInfo.discount_price && priceInfo.regular_price) {
                var regularPrice = parseFloat(priceInfo.regular_price.raw_value);
                var discountPrice = parseFloat(priceInfo.discount_price.raw_value);
                var discountPercent = Math.round((1 - discountPrice / regularPrice) * 100);

                var gameInfo = gameInfoMap[gameId] || {
                    name: sidefy.i18n({
                        "zh": "游戏 ID: " + gameId,
                        "en": "Game ID: " + gameId,
                        "ja": "ゲーム ID: " + gameId,
                        "ko": "게임 ID: " + gameId,
                        "de": "Spiele-ID: " + gameId,
                        "es": "ID del juego: " + gameId,
                        "fr": "ID du jeu: " + gameId,
                        "pt": "ID do jogo: " + gameId,
                        "ru": "ID игры: " + gameId
                    }),
                    image: "",
                    device: ""
                };
                discountedGames.push({
                    id: gameId,
                    name: gameInfo.name,
                    image: gameInfo.image,
                    device: gameInfo.device,
                    discountPercent: discountPercent,
                    regularPrice: priceInfo.regular_price.amount,
                    discountPrice: priceInfo.discount_price.amount,
                    currency: priceInfo.regular_price.currency,
                    url: "https://store-jp.nintendo.com/item/software/D" + gameId
                });
            }
        }

        // 4. 创建日历事件
        for (var k = 0; k < discountedGames.length; k++) {
            var game = discountedGames[k];

            // 设置为当天的全天事件（本地时间）
            var eventDate = new Date();
            eventDate.setHours(0, 0, 0, 0);
            var timestamp = eventDate.getTime() / 1000;

            var discountColor = getDiscountColor(game.discountPercent);
            var notes = sidefy.i18n({
                "zh": "原价: " + game.regularPrice + "\n现价: " + game.discountPrice + "\n折扣: -" + game.discountPercent + "%",
                "en": "Original Price: " + game.regularPrice + "\nCurrent Price: " + game.discountPrice + "\nDiscount: -" + game.discountPercent + "%",
                "ja": "元の価格: " + game.regularPrice + "\n現在の価格: " + game.discountPrice + "\n割引: -" + game.discountPercent + "%",
                "ko": "원가: " + game.regularPrice + "\n현재 가격: " + game.discountPrice + "\n할인: -" + game.discountPercent + "%",
                "de": "Originalpreis: " + game.regularPrice + "\nAktueller Preis: " + game.discountPrice + "\nRabatt: -" + game.discountPercent + "%",
                "es": "Precio Original: " + game.regularPrice + "\nPrecio Actual: " + game.discountPrice + "\nDescuento: -" + game.discountPercent + "%",
                "fr": "Prix d'origine: " + game.regularPrice + "\nPrix actuel: " + game.discountPrice + "\nRéduction: -" + game.discountPercent + "%",
                "pt": "Preço Original: " + game.regularPrice + "\nPreço Atual: " + game.discountPrice + "\nDesconto: -" + game.discountPercent + "%",
                "ru": "Исходная цена: " + game.regularPrice + "\nТекущая цена: " + game.discountPrice + "\nСкидка: -" + game.discountPercent + "%"
            });

            // 添加设备兼容性信息
            if (game.device) {
                notes += "\n" + sidefy.i18n({
                    "zh": "对应本体: " + game.device,
                    "en": "Compatible Device: " + game.device,
                    "ja": "対応本体: " + game.device,
                    "ko": "호환 기기: " + game.device,
                    "de": "Kompatibles Gerät: " + game.device,
                    "es": "Dispositivo Compatible: " + game.device,
                    "fr": "Appareil compatible: " + game.device,
                    "pt": "Dispositivo Compatível: " + game.device,
                    "ru": "Совместимое устройство: " + game.device
                });
            }

            var gameEvent = {
                title: game.name + " (-" + game.discountPercent + "%)",
                startDate: sidefy.date.format(timestamp),
                endDate: sidefy.date.format(timestamp),
                color: discountColor,
                notes: notes,
                icon: "https://store-jp.nintendo.com/mobify/bundle/1763/static/img/head/favicon.ico",
                href: game.url,
                imageURL: game.image,
                isAllDay: true,
                isPointInTime: true
            };

            events.push(gameEvent);
        }

        // 将成功获取的事件缓存 2 小时
        if (events.length > 0) {
            sidefy.storage.set(cacheKey, events, 120);
        }

    } catch (err) {
        throw new Error(sidefy.i18n({
            "zh": "Switch 愿望单插件执行失败: " + err.message,
            "en": "Switch Wishlist plugin execution failed: " + err.message,
            "ja": "Switch ウィッシュリストプラグインの実行に失敗しました: " + err.message,
            "ko": "Switch 위시리스트 플러그인 실행 실패: " + err.message,
            "de": "Switch-Wunschlisten-Plugin-Ausführung fehlgeschlagen: " + err.message,
            "es": "Falló la ejecución del complemento de lista de deseos de Switch: " + err.message,
            "fr": "Échec de l'exécution du plugin de liste de souhaits Switch: " + err.message,
            "pt": "Falha na execução do plugin da lista de desejos do Switch: " + err.message,
            "ru": "Ошибка выполнения плагина списка желаний Switch: " + err.message
        }));
    }

    return events;
}

/**
 * 提取设备兼容性信息
 */
function extractDeviceInfo(pageHtml) {
    try {
        // 查找所有支持的设备
        var switchMatch = pageHtml.match(/"productDetail\.playableHardNotice\.label":\[\{"type":\d+,"value":"Nintendo Switch"\}\]/);
        var switch2Match = pageHtml.match(/"productDetail\.playableHardNotice\.label\.onlySuper":\[\{"type":\d+,"value":"Nintendo Switch 2"\}\]/);

        if (switchMatch && switch2Match) {
            return "Switch/Switch 2";
        } else if (switch2Match) {
            return "Switch 2";
        } else if (switchMatch) {
            return "Switch";
        }
    } catch (err) {
        // 解析失败，返回空字符串
    }
    return "";
}

/**
 * 根据折扣百分比获取对应的颜色
 */
function getDiscountColor(discountPercent) {
    if (discountPercent >= 75) {
        return "#E74C3C"; // 深红色 - 超大折扣
    } else if (discountPercent >= 50) {
        return "#E67E22"; // 橙色 - 大折扣
    } else if (discountPercent >= 25) {
        return "#F39C12"; // 黄色 - 中等折扣
    } else {
        return "#3498DB"; // 蓝色 - 小折扣
    }
}
