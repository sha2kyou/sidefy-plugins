/**
 * AppStore 折扣监听插件
 * 监控 App Store 应用的价格变化,并在日历中显示打折应用。
 */
function fetchEvents(config) {
    // 检查必填参数
    var appData = config.app_data;

    if (!appData || appData.trim() === "") {
        throw new Error(sidefy.i18n({
            "zh": "应用数据不能为空,请在插件配置中填入需要监控的应用信息。格式: 12345_us_68.00,2736473_cn_38.00",
            "en": "App data cannot be empty. Please enter the app information you want to monitor. Format: 12345_us_68.00,2736473_cn_38.00",
            "ja": "アプリデータを空にすることはできません。監視するアプリ情報を入力してください。形式: 12345_us_68.00,2736473_cn_38.00",
            "ko": "앱 데이터는 비워둘 수 없습니다. 모니터링할 앱 정보를 입력하세요. 형식: 12345_us_68.00,2736473_cn_38.00",
            "de": "App-Daten dürfen nicht leer sein. Bitte geben Sie die App-Informationen ein. Format: 12345_us_68.00,2736473_cn_38.00",
            "es": "Los datos de la aplicación no pueden estar vacíos. Por favor, ingrese la información de la aplicación. Formato: 12345_us_68.00,2736473_cn_38.00",
            "fr": "Les données de l'application ne peuvent pas être vides. Veuillez entrer les informations de l'application. Format: 12345_us_68.00,2736473_cn_38.00",
            "pt": "Os dados do aplicativo não podem estar vazios. Por favor, insira as informações do aplicativo. Formato: 12345_us_68.00,2736473_cn_38.00",
            "ru": "Данные приложения не могут быть пустыми. Пожалуйста, введите информацию о приложении. Формат: 12345_us_68.00,2736473_cn_38.00"
        }));
    }

    // --- 缓存逻辑 ---
    // 在缓存键中加入日期,确保跨天后缓存自动失效
    var today = new Date();
    var dateKey = today.getFullYear() + "" +
                  String(today.getMonth() + 1).padStart(2, '0') +
                  String(today.getDate()).padStart(2, '0');
    var cacheKey = "appstore_discount_v6_" + appData.replace(/[,\s]/g, '_').substring(0, 50) + "_" + dateKey;

    var cachedData = sidefy.storage.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // --- AppStore 折扣检查逻辑 ---
    var events = [];
    try {
        // 解析应用数据列表
        // 格式: 12345_us_68.00,2736473_cn_38.00
        var appList = parseAppData(appData);

        if (appList.length === 0) {
            throw new Error(sidefy.i18n({
                "zh": "没有有效的应用数据。请检查输入格式。示例: 12345_us_68.00",
                "en": "No valid app data found. Please check the input format. Example: 12345_us_68.00",
                "ja": "有効なアプリデータが見つかりません。入力形式を確認してください。例: 12345_us_68.00",
                "ko": "유효한 앱 데이터를 찾을 수 없습니다. 입력 형식을 확인하세요. 예: 12345_us_68.00",
                "de": "Keine gültigen App-Daten gefunden. Bitte überprüfen Sie das Eingabeformat. Beispiel: 12345_us_68.00",
                "es": "No se encontraron datos de aplicación válidos. Por favor, verifique el formato. Ejemplo: 12345_us_68.00",
                "fr": "Aucune donnée d'application valide trouvée. Veuillez vérifier le format. Exemple: 12345_us_68.00",
                "pt": "Nenhum dado de aplicativo válido encontrado. Por favor, verifique o formato. Exemplo: 12345_us_68.00",
                "ru": "Действительные данные приложения не найдены. Пожалуйста, проверьте формат. Пример: 12345_us_68.00"
            }));
        }

        // 检查每个应用的价格
        var discountedApps = [];

        for (var i = 0; i < appList.length; i++) {
            var app = appList[i];
            try {
                // 获取应用信息
                var appUrl = "https://itunes.apple.com/lookup?id=" + app.appId + "&country=" + app.region;
                var appResponse = sidefy.http.get(appUrl);

                if (!appResponse) {
                    continue;
                }

                var apiData = JSON.parse(appResponse);

                if (!apiData.results || apiData.results.length === 0) {
                    continue;
                }

                var appInfo = apiData.results[0];
                var currentPrice = appInfo.formattedPrice || appInfo.price;
                var currentPriceValue = parseFloat(appInfo.price) || 0;

                // 如果是免费应用,跳过
                if (currentPriceValue === 0) {
                    continue;
                }

                // 检查价格是否低于用户配置的原价
                var originalPriceValue = app.originalPrice;

                if (currentPriceValue < originalPriceValue) {
                    // 价格下降,计算折扣
                    var discountPercent = Math.round((1 - currentPriceValue / originalPriceValue) * 100);

                    // 格式化原价 - 从当前价格中提取货币符号并应用到原价
                    var originalPriceFormatted = formatPrice(originalPriceValue, currentPrice, appInfo.currency);

                    // 选择图片：优先使用截图，没有截图则使用图标
                    var imageUrl = null;
                    var appIcon = null;
                    var screenshots = appInfo.screenshotUrls || [];
                    if (screenshots.length > 0) {
                        // 随机选择一张截图
                        imageUrl = screenshots[Math.floor(Math.random() * screenshots.length)];
                    } else {
                        // 使用应用图标作为后备
                        imageUrl = appInfo.artworkUrl512 || appInfo.artworkUrl100;
                    }

                    // 获取应用图标，优先使用最小的图标
                    if (appInfo.artworkUrl60) {
                        appIcon = appInfo.artworkUrl60;
                    } else if (appInfo.artworkUrl100) {
                        appIcon = appInfo.artworkUrl100;
                    } else if (appInfo.artworkUrl512) {
                        appIcon = appInfo.artworkUrl512;
                    }

                    discountedApps.push({
                        appId: appInfo.trackId,
                        name: appInfo.trackName,
                        currentPrice: currentPrice,
                        originalPrice: originalPriceFormatted,
                        discountPercent: discountPercent,
                        imageUrl: imageUrl,
                        appIcon: appIcon,
                        storeUrl: appInfo.trackViewUrl,
                        region: app.region
                    });
                }

                // 添加延迟避免请求过快
                if (i < appList.length - 1) {
                    var start = new Date().getTime();
                    while (new Date().getTime() < start + 100) {
                        // 等待100ms
                    }
                }

            } catch (appErr) {
                continue;
            }
        }

        // 创建折扣应用的日历事件
        if (discountedApps.length > 0) {
            for (var j = 0; j < discountedApps.length; j++) {
                var app = discountedApps[j];

                // 设置为当天的全天事件
                var eventDate = new Date();
                eventDate.setHours(0, 0, 0, 0);
                var timestamp = eventDate.getTime() / 1000;

                var discountColor = getDiscountColor(app.discountPercent);
                var notes = sidefy.i18n({
                    "zh": "原价: " + app.originalPrice + "\n现价: " + app.currentPrice + "\n折扣: -" + app.discountPercent + "%\n区域: " + app.region.toUpperCase(),
                    "en": "Original Price: " + app.originalPrice + "\nCurrent Price: " + app.currentPrice + "\nDiscount: -" + app.discountPercent + "%\nRegion: " + app.region.toUpperCase(),
                    "ja": "元の価格: " + app.originalPrice + "\n現在の価格: " + app.currentPrice + "\n割引: -" + app.discountPercent + "%\n地域: " + app.region.toUpperCase(),
                    "ko": "원가: " + app.originalPrice + "\n현재 가격: " + app.currentPrice + "\n할인: -" + app.discountPercent + "%\n지역: " + app.region.toUpperCase(),
                    "de": "Originalpreis: " + app.originalPrice + "\nAktueller Preis: " + app.currentPrice + "\nRabatt: -" + app.discountPercent + "%\nRegion: " + app.region.toUpperCase(),
                    "es": "Precio Original: " + app.originalPrice + "\nPrecio Actual: " + app.currentPrice + "\nDescuento: -" + app.discountPercent + "%\nRegión: " + app.region.toUpperCase(),
                    "fr": "Prix d'origine: " + app.originalPrice + "\nPrix actuel: " + app.currentPrice + "\nRéduction: -" + app.discountPercent + "%\nRégion: " + app.region.toUpperCase(),
                    "pt": "Preço Original: " + app.originalPrice + "\nPreço Atual: " + app.currentPrice + "\nDesconto: -" + app.discountPercent + "%\nRegião: " + app.region.toUpperCase(),
                    "ru": "Исходная цена: " + app.originalPrice + "\nТекущая цена: " + app.currentPrice + "\nСкидка: -" + app.discountPercent + "%\nРегион: " + app.region.toUpperCase()
                });

                var appEvent = {
                    title: app.name + " (-" + app.discountPercent + "%)",
                    startDate: sidefy.date.format(timestamp),
                    endDate: sidefy.date.format(timestamp),
                    color: discountColor,
                    notes: notes,
                    icon: app.appIcon,
                    href: app.storeUrl,
                    imageURL: app.imageUrl,
                    isAllDay: true,
                    isPointInTime: true
                };

                events.push(appEvent);
            }
        }

        // 缓存结果 (30分钟)
        if (events.length > 0) {
            sidefy.storage.set(cacheKey, events, 30);
        }

    } catch (err) {
        throw new Error(sidefy.i18n({
            "zh": "AppStore 折扣插件执行失败: " + err.message,
            "en": "AppStore Discount plugin execution failed: " + err.message,
            "ja": "AppStore 割引プラグインの実行に失敗しました: " + err.message,
            "ko": "AppStore 할인 플러그인 실행 실패: " + err.message,
            "de": "AppStore-Rabatt-Plugin-Ausführung fehlgeschlagen: " + err.message,
            "es": "Falló la ejecución del complemento de descuento de AppStore: " + err.message,
            "fr": "Échec de l'exécution du plugin de réduction AppStore: " + err.message,
            "pt": "Falha na execução do plugin de desconto da AppStore: " + err.message,
            "ru": "Ошибка выполнения плагина скидок AppStore: " + err.message
        }));
    }

    return events;
}

/**
 * 格式化价格 - 从示例价格中提取货币符号和格式
 * @param {number} priceValue - 价格数值
 * @param {string} sampleFormatted - 示例格式化价格 (如 "¥68.00" 或 "$9.99")
 * @param {string} currency - 货币代码 (如 "CNY", "USD")
 * @returns {string} 格式化后的价格
 */
function formatPrice(priceValue, sampleFormatted, currency) {
    // 从示例价格中提取货币符号的位置和格式
    var numStr = priceValue.toFixed(2);

    if (!sampleFormatted) {
        return numStr;
    }

    // 提取数字部分
    var sampleNumStr = sampleFormatted.replace(/[^0-9.]/g, '');
    var sampleNum = parseFloat(sampleNumStr);

    if (isNaN(sampleNum)) {
        return numStr;
    }

    // 检查货币符号在前面还是后面
    var currencySymbolBefore = sampleFormatted.indexOf(sampleNumStr) > 0;

    // 提取货币符号
    var currencySymbol = sampleFormatted.replace(/[0-9.,\s]/g, '');

    if (currencySymbolBefore) {
        // 货币符号在前面，如 "¥68.00", "$9.99"
        return currencySymbol + numStr;
    } else {
        // 货币符号在后面，如 "68.00€"
        return numStr + currencySymbol;
    }
}

/**
 * 解析应用数据列表
 * 格式: 12345_us_68.00,2736473_cn_38.00
 * appId_region_originalPrice
 */
function parseAppData(appData) {
    var result = [];
    var items = appData.split(',');

    for (var i = 0; i < items.length; i++) {
        var item = items[i].trim();
        if (!item) continue;

        var parts = item.split('_');

        // 必须有3个部分: appId, region, originalPrice
        if (parts.length !== 3) {
            continue;
        }

        var appId = parts[0].trim();
        var region = parts[1].trim();
        var originalPriceStr = parts[2].trim();

        // 解析原价数值
        var originalPrice = parseFloat(originalPriceStr);

        if (appId && region && !isNaN(originalPrice) && originalPrice > 0) {
            result.push({
                appId: appId,
                region: region.toLowerCase(),
                originalPrice: originalPrice,
                originalPriceFormatted: originalPriceStr  // 保留原始格式
            });
        }
    }

    return result;
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
