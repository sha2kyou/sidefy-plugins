/**
 * Steam 愿望单打折监听插件
 * 每30分钟检查一次用户的 Steam 愿望单中游戏的打折信息，并在日历中显示打折游戏。
 */
function fetchEvents(config) {


    // 检查 Steam 用户名是否存在
    var steamId = config.steam_id;

    if (!steamId || steamId.trim() === "") {
        throw new Error(sidefy.i18n({
            "zh": "Steam 用户名不能为空，请在插件配置中填入您的 Steam 用户名。",
            "en": "Steam username cannot be empty, please enter your Steam username in the plugin configuration.",
            "ja": "Steam ユーザー名を空にすることはできません。プラグイン設定に Steam ユーザー名を入力してください。",
            "ko": "Steam 사용자 이름은 비워둘 수 없습니다. 플러그인 설정에서 Steam 사용자 이름을 입력하세요.",
            "de": "Steam-Benutzername darf nicht leer sein. Bitte geben Sie Ihren Steam-Benutzernamen in der Plugin-Konfiguration ein.",
            "es": "El nombre de usuario de Steam no puede estar vacío. Por favor, ingrese su nombre de usuario de Steam en la configuración del complemento.",
            "fr": "Le nom d'utilisateur Steam ne peut pas être vide. Veuillez entrer votre nom d'utilisateur Steam dans la configuration du plugin.",
            "pt": "O nome de usuário do Steam não pode estar vazio. Por favor, insira seu nome de usuário do Steam na configuração do plugin.",
            "ru": "Имя пользователя Steam не может быть пустым. Пожалуйста, введите имя пользователя Steam в настройках плагина."
        }));
    }



    // --- 缓存逻辑 ---
    // 在缓存键中加入日期，确保跨天后缓存自动失效
    var today = new Date();
    var dateKey = today.getFullYear() + "" +
                  String(today.getMonth() + 1).padStart(2, '0') +
                  String(today.getDate()).padStart(2, '0');
    var cacheKey = "steam_wishlist_discount_v11_" + steamId + "_" + dateKey;

    var cachedData = sidefy.storage.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // --- Steam 愿望单打折检查逻辑 ---
    var events = [];
    try {
        // 1. 首先需要将用户名转换为Steam ID
        var steamIdUrl = "https://steamcommunity.com/id/" + steamId + "?xml=1";
        var steamIdResponse = sidefy.http.get(steamIdUrl);

        if (!steamIdResponse) {
            throw new Error(sidefy.i18n({
                "zh": "无法获取Steam用户信息，请检查您的Steam用户名是否正确。",
                "en": "Unable to retrieve Steam user information. Please check if your Steam username is correct.",
                "ja": "Steam ユーザー情報を取得できません。Steam ユーザー名が正しいか確認してください。",
                "ko": "Steam 사용자 정보를 가져올 수 없습니다. Steam 사용자 이름이 올바른지 확인하세요.",
                "de": "Steam-Benutzerinformationen können nicht abgerufen werden. Bitte überprüfen Sie, ob Ihr Steam-Benutzername korrekt ist.",
                "es": "No se puede obtener la información del usuario de Steam. Por favor, verifique si su nombre de usuario de Steam es correcto.",
                "fr": "Impossible de récupérer les informations de l'utilisateur Steam. Veuillez vérifier si votre nom d'utilisateur Steam est correct.",
                "pt": "Não foi possível obter as informações do usuário do Steam. Por favor, verifique se seu nome de usuário do Steam está correto.",
                "ru": "Не удалось получить информацию о пользователе Steam. Пожалуйста, проверьте правильность вашего имени пользователя Steam."
            }));
        }

        // 从XML响应中提取Steam ID
        var steamId64Match = steamIdResponse.match(/<steamID64>(\d+)<\/steamID64>/);
        if (!steamId64Match) {
            throw new Error(sidefy.i18n({
                "zh": "无法找到对应的Steam ID，请确认用户名正确且资料为公开。",
                "en": "Cannot find the corresponding Steam ID. Please ensure the username is correct and the profile is public.",
                "ja": "対応する Steam ID が見つかりません。ユーザー名が正しく、プロフィールが公開されていることを確認してください。",
                "ko": "해당 Steam ID를 찾을 수 없습니다. 사용자 이름이 올바르고 프로필이 공개되어 있는지 확인하세요.",
                "de": "Die entsprechende Steam-ID kann nicht gefunden werden. Bitte stellen Sie sicher, dass der Benutzername korrekt ist und das Profil öffentlich ist.",
                "es": "No se puede encontrar el ID de Steam correspondiente. Por favor, asegúrese de que el nombre de usuario sea correcto y el perfil sea público.",
                "fr": "Impossible de trouver l'ID Steam correspondant. Veuillez vous assurer que le nom d'utilisateur est correct et que le profil est public.",
                "pt": "Não foi possível encontrar o ID do Steam correspondente. Por favor, certifique-se de que o nome de usuário está correto e o perfil é público.",
                "ru": "Не удалось найти соответствующий Steam ID. Пожалуйста, убедитесь, что имя пользователя правильное и профиль является публичным."
            }));
        }
        var steamId64 = steamId64Match[1];

        // 2. 使用Steam ID获取愿望单
        var wishlistUrl = "https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=" + steamId64;
        var wishlistResponse = sidefy.http.get(wishlistUrl);

        if (!wishlistResponse) {
            throw new Error(sidefy.i18n({
                "zh": "无法获取愿望单数据，请检查您的愿望单是否设置为公开。",
                "en": "Unable to retrieve wishlist data. Please check if your wishlist is set to public.",
                "ja": "ウィッシュリストデータを取得できません。ウィッシュリストが公開に設定されているか確認してください。",
                "ko": "위시리스트 데이터를 가져올 수 없습니다. 위시리스트가 공개로 설정되어 있는지 확인하세요.",
                "de": "Wunschlisten-Daten können nicht abgerufen werden. Bitte überprüfen Sie, ob Ihre Wunschliste auf öffentlich gesetzt ist.",
                "es": "No se pueden obtener los datos de la lista de deseos. Por favor, verifique si su lista de deseos está configurada como pública.",
                "fr": "Impossible de récupérer les données de la liste de souhaits. Veuillez vérifier si votre liste de souhaits est définie sur publique.",
                "pt": "Não foi possível obter os dados da lista de desejos. Por favor, verifique se sua lista de desejos está definida como pública.",
                "ru": "Не удалось получить данные списка желаний. Пожалуйста, проверьте, установлен ли ваш список желаний как публичный."
            }));
        }

        var wishlistData = JSON.parse(wishlistResponse);

        // 新API返回格式: {"response": {"items": [...]}

        var gameItems = [];
        if (wishlistData.response && wishlistData.response.items) {
            gameItems = wishlistData.response.items;
        }



        if (gameItems.length === 0) {
            // 如果愿望单为空，不显示任何事件
            // 缓存空结果（30分钟）
            sidefy.storage.set(cacheKey, events, 30);
            return events;
        }

        // 3. 检查愿望单中游戏的打折信息
        var discountedGames = [];
        var batchSize = 50; // 每次最多检查50个游戏
        var gamesToCheck = gameItems.slice(0, batchSize);


        for (var i = 0; i < gamesToCheck.length; i++) {
            var gameItem = gamesToCheck[i];
            var appId = gameItem.appid;

            try {
                // 获取游戏详细信息和价格
                var gameDetailUrl = "https://store.steampowered.com/api/appdetails?appids=" + appId + "&cc=cn&l=schinese&filters=price_overview,basic";
                var gameDetailResponse = sidefy.http.get(gameDetailUrl);

                if (!gameDetailResponse) {
                    continue;
                }

                var gameDetail = JSON.parse(gameDetailResponse);

                if (!gameDetail[appId] || !gameDetail[appId].success) {
                    continue;
                }

                var data = gameDetail[appId].data;


                // 检查是否有打折
                if (data.price_overview && data.price_overview.discount_percent > 0) {
                    var gameInfo = {
                        appId: appId,
                        name: data.name,
                        discountPercent: data.price_overview.discount_percent,
                        originalPrice: data.price_overview.initial_formatted || "¥" + (data.price_overview.initial / 100).toFixed(2),
                        finalPrice: data.price_overview.final_formatted || "¥" + (data.price_overview.final / 100).toFixed(2),
                        currency: data.price_overview.currency,
                        headerImage: data.header_image,
                        storeUrl: "https://store.steampowered.com/app/" + appId
                    };

                    discountedGames.push(gameInfo);
                }

                // 添加延迟避免请求过快
                if (i < gamesToCheck.length - 1) {
                    // 简单的延迟实现
                    var start = new Date().getTime();
                    while (new Date().getTime() < start + 100) {
                        // 等待100ms
                    }
                }

            } catch (gameErr) {
                continue;
            }
        }


        // 3. 创建打折游戏的日历事件
        if (discountedGames.length > 0) {
            // 为每个打折游戏创建事件
            for (var j = 0; j < discountedGames.length; j++) {
                var game = discountedGames[j];

                // 设置为当天的全天事件（本地时间）
                var eventDate = new Date();
                eventDate.setHours(0, 0, 0, 0);
                var timestamp = eventDate.getTime() / 1000;

                var discountColor = getDiscountColor(game.discountPercent);
                var notes = sidefy.i18n({
                    "zh": "原价: " + game.originalPrice + "\n现价: " + game.finalPrice + "\n折扣: -" + game.discountPercent + "%",
                    "en": "Original Price: " + game.originalPrice + "\nCurrent Price: " + game.finalPrice + "\nDiscount: -" + game.discountPercent + "%",
                    "ja": "元の価格: " + game.originalPrice + "\n現在の価格: " + game.finalPrice + "\n割引: -" + game.discountPercent + "%",
                    "ko": "원가: " + game.originalPrice + "\n현재 가격: " + game.finalPrice + "\n할인: -" + game.discountPercent + "%",
                    "de": "Originalpreis: " + game.originalPrice + "\nAktueller Preis: " + game.finalPrice + "\nRabatt: -" + game.discountPercent + "%",
                    "es": "Precio Original: " + game.originalPrice + "\nPrecio Actual: " + game.finalPrice + "\nDescuento: -" + game.discountPercent + "%",
                    "fr": "Prix d'origine: " + game.originalPrice + "\nPrix actuel: " + game.finalPrice + "\nRéduction: -" + game.discountPercent + "%",
                    "pt": "Preço Original: " + game.originalPrice + "\nPreço Atual: " + game.finalPrice + "\nDesconto: -" + game.discountPercent + "%",
                    "ru": "Исходная цена: " + game.originalPrice + "\nТекущая цена: " + game.finalPrice + "\nСкидка: -" + game.discountPercent + "%"
                });

                var gameEvent = {
                    title: game.name + " (-" + game.discountPercent + "%)",
                    startDate: sidefy.date.format(timestamp),
                    endDate: sidefy.date.format(timestamp),
                    color: discountColor,
                    notes: notes,
                    icon: "https://store.steampowered.com/favicon.ico",
                    href: game.storeUrl,
                    imageURL: game.headerImage,
                    isAllDay: true,
                    isPointInTime: true
                };

                events.push(gameEvent);
            }
        }


        // 将成功获取的事件缓存30分钟
        if (events.length > 0) {
            sidefy.storage.set(cacheKey, events, 30);
        } else {
        }

    } catch (err) {
        throw new Error(sidefy.i18n({
            "zh": "Steam 愿望单插件执行失败: " + err.message,
            "en": "Steam Wishlist plugin execution failed: " + err.message,
            "ja": "Steam ウィッシュリストプラグインの実行に失敗しました: " + err.message,
            "ko": "Steam 위시리스트 플러그인 실행 실패: " + err.message,
            "de": "Steam-Wunschlisten-Plugin-Ausführung fehlgeschlagen: " + err.message,
            "es": "Falló la ejecución del complemento de lista de deseos de Steam: " + err.message,
            "fr": "Échec de l'exécution du plugin de liste de souhaits Steam: " + err.message,
            "pt": "Falha na execução do plugin da lista de desejos do Steam: " + err.message,
            "ru": "Ошибка выполнения плагина списка желаний Steam: " + err.message
        }));
    }

    return events;
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
