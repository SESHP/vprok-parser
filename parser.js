const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Скрипт для парсинга страницы товара на vprok.ru
 * Использование: node puppeteer.js <URL товара> <Регион>
 * Пример: node puppeteer.js https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-3-2-950g--309202 "Санкт-Петербург и область"
 */

const SELECTORS = {
  // Кнопка выбора региона в шапке
  regionButton: '[data-testid="header-address"]',
  // Поле поиска региона в модальном окне
  regionSearchInput: 'input[placeholder*="Введите адрес"]',
  // Элементы списка регионов
  regionListItem: '[data-testid="region-list-item"]',
  // Кнопка подтверждения региона
  regionConfirmButton: '[data-testid="confirm-region-button"]',
  // Модальное окно выбора региона
  regionModal: '[data-testid="region-modal"]',
  // Цена товара (текущая)
  currentPrice: '[data-testid="product-price-current"]',
  // Цена товара (старая/зачеркнутая)
  oldPrice: '[data-testid="product-price-old"]',
  // Рейтинг товара
  rating: '[data-testid="product-rating"]',
  // Количество отзывов
  reviewCount: '[data-testid="product-reviews-count"]',
};

// Альтернативные селекторы на случай изменения структуры сайта
const ALT_SELECTORS = {
  // Кнопка региона в шапке (альтернативная)
  regionButton: [
    'button:has-text("область")',
    'button:has-text("Москва")',
    '[class*="Region"]',
    '[class*="address"]',
    '[class*="location"]',
  ],
  // Цена (альтернативные селекторы через классы и структуру)
  currentPrice: [
    '[class*="Price_price"]',
    '[class*="ProductPrice"] [class*="current"]',
    '[class*="price_actual"]',
    'span[class*="price"]:not([class*="old"])',
  ],
  oldPrice: [
    '[class*="Price_old"]',
    '[class*="ProductPrice"] [class*="old"]',
    '[class*="price_old"]',
    's[class*="price"]',
    'del[class*="price"]',
  ],
  rating: [
    '[class*="Rating_value"]',
    '[class*="rating"] [class*="value"]',
    '[class*="Stars"] + span',
    'span:has([class*="star"])',
  ],
  reviewCount: [
    '[class*="Rating_count"]',
    '[class*="reviews"]',
    'a[href*="reviews"]',
    '[class*="review"] [class*="count"]',
  ],
};

/**
 * Выбор региона на сайте
 */
async function selectRegion(page, region) {
  console.log(`Выбираем регион: ${region}`);

  try {
    // Ищем кнопку региона в шапке
    const regionButtonSelector = await findWorkingSelector(
      page,
      [SELECTORS.regionButton, ...ALT_SELECTORS.regionButton],
      "Кнопка региона",
    );

    if (!regionButtonSelector) {
      // Пробуем найти по тексту
      const regionElement = await page.$('text="Москва и область"');
      if (regionElement) {
        await regionElement.click();
      } else {
        console.log(
          "Кнопка выбора региона не найдена, пропускаем выбор региона",
        );
        return;
      }
    } else {
      await page.click(regionButtonSelector);
    }

    await sleep(1500);

    // Ищем в открывшемся списке нужный регион
    const regionLinks = await page.$$('a, button, div[role="button"], li');

    for (const link of regionLinks) {
      const text = await page.evaluate((el) => el.textContent || "", link);
      if (text && text.includes(region.replace(" и область", ""))) {
        await link.click();
        console.log(`Регион "${region}" выбран`);
        await sleep(2000);
        return;
      }
    }

    // Если не нашли в списке, пробуем через поиск
    const searchInput = await page.$(
      'input[type="text"], input[placeholder*="адрес"], input[placeholder*="город"]',
    );
    if (searchInput) {
      await searchInput.fill(region);
      await sleep(1000);

      // Кликаем на первый результат
      const suggestions = await page.$$(
        '[class*="suggestion"], [class*="item"], li',
      );
      for (const suggestion of suggestions) {
        const text = await page.evaluate(
          (el) => el.textContent || "",
          suggestion,
        );
        if (text && text.includes(region.replace(" и область", ""))) {
          await suggestion.click();
          console.log(`Регион "${region}" выбран через поиск`);
          await sleep(2000);
          return;
        }
      }
    }

    console.log(
      `Регион "${region}" не найден в списке, используется текущий регион`,
    );
  } catch (error) {
    console.log(`Ошибка при выборе региона: ${error.message}`);
  }
}

/**
 * Поиск работающего селектора из списка
 */
async function findWorkingSelector(page, selectors, description) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await page.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, element);
        if (isVisible) {
          console.log(`${description}: найден селектор "${selector}"`);
          return selector;
        }
      }
    } catch (e) {
      // Продолжаем поиск
    }
  }
  return null;
}

/**
 * Извлечение числа из строки
 */
function extractNumber(text) {
  if (!text) {
    return null;
  }
  // Убираем все кроме цифр, точек и запятых
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const number = parseFloat(cleaned);
  return isNaN(number) ? null : number;
}

/**
 * Извлечение данных о товаре
 */
async function extractProductData(page) {
  console.log("Извлекаем данные о товаре...");

  const data = {
    price: null,
    priceOld: null,
    rating: null,
    reviewCount: null,
    available: false,
  };

  // Извлекаем цены (сначала старую, потом актуальную)
  try {
    const prices = await page.evaluate(() => {
      const result = { price: null, priceOld: null };

      const extractNum = (text) => {
        if (!text) {
          return null;
        }
        const match = text.match(/(\d+[,.]?\d*)/);
        if (match) {
          return parseFloat(match[1].replace(",", "."));
        }
        return null;
      };

      // Сначала ищем старую цену (зачёркнутую)
      const strikeElements = document.querySelectorAll(
        's, del, [class*="old"], [class*="Old"]',
      );
      for (const el of strikeElements) {
        const text = el.textContent || "";
        const price = extractNum(text);
        if (price && price > 1 && price < 100000) {
          result.priceOld = price;
          break;
        }
      }

      // Теперь ищем актуальную цену
      const allElements = document.querySelectorAll("span, div, p");
      for (const el of allElements) {
        const text = el.textContent || "";
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        const isStrikethrough = style.textDecoration.includes("line-through");
        const parentStrike = el.closest("s, del");

        // Актуальная цена: крупная, не зачёркнута, не внутри <s>/<del>
        if (
          fontSize > 20 &&
          text.match(/\d/) &&
          text.length < 30 &&
          !text.includes("Скидка") &&
          !text.includes("%") &&
          !isStrikethrough &&
          !parentStrike
        ) {
          const price = extractNum(text);
          // Цена должна быть разумной и НЕ равной старой цене
          if (
            price &&
            price > 1 &&
            price < 100000 &&
            price !== result.priceOld
          ) {
            result.price = price;
            break;
          }
        }
      }

      return result;
    });

    data.price = prices.price;
    data.priceOld = prices.priceOld;
  } catch (error) {
    console.log(`Ошибка при извлечении цены: ${error.message}`);
  }

  // Извлекаем старую цену
  try {
    let oldPriceElement = await page.$('[data-testid="product-price-old"]');

    if (!oldPriceElement) {
      oldPriceElement = await page.$('[class*="Price_old"]');
    }

    if (!oldPriceElement) {
      oldPriceElement = await page.$(
        's, del, [class*="crossed"], [class*="strike"]',
      );
    }

    if (oldPriceElement) {
      const oldPriceText = await page.evaluate(
        (el) => el.textContent || "",
        oldPriceElement,
      );
      data.priceOld = extractNumber(oldPriceText);
    }

    // Альтернативный поиск старой цены
    if (!data.priceOld) {
      data.priceOld = await page.evaluate(() => {
        // Ищем зачеркнутый текст с ценой
        const strikeElements = document.querySelectorAll(
          's, del, [class*="old"], [class*="Old"]',
        );
        for (const el of strikeElements) {
          const text = el.textContent || "";
          const match = text.match(/(\d+[.,]?\d*)/);
          if (match) {
            return parseFloat(match[1].replace(",", "."));
          }
        }

        // Ищем по паттерну "Скидка -XX%"
        const discountEl = document.querySelector(
          '[class*="iscount"], [class*="ISCOUNT"]',
        );
        if (discountEl) {
          const parent = discountEl.closest('[class*="rice"], [class*="RICE"]');
          if (parent) {
            const priceElements = parent.querySelectorAll("span, div");
            for (const el of priceElements) {
              const text = el.textContent || "";
              if (text.includes("₽") && !text.includes("Скидка")) {
                const match = text.match(/(\d+[.,]?\d*)/);
                if (match) {
                  const price = parseFloat(match[1].replace(",", "."));
                  // Проверяем, не является ли это текущей ценой
                  const style = window.getComputedStyle(el);
                  if (style.textDecoration.includes("line-through")) {
                    return price;
                  }
                }
              }
            }
          }
        }

        return null;
      });
    }
  } catch (error) {
    console.log(`Ошибка при извлечении старой цены: ${error.message}`);
  }

  // Извлекаем рейтинг
  try {
    data.rating = await page.evaluate(() => {
      // Ищем элемент с рейтингом
      const ratingPatterns = [
        '[class*="Rating"]',
        '[class*="rating"]',
        '[class*="Stars"]',
        '[class*="stars"]',
        '[data-testid*="rating"]',
      ];

      for (const pattern of ratingPatterns) {
        const elements = document.querySelectorAll(pattern);
        for (const el of elements) {
          const text = el.textContent || "";
          // Ищем число от 1 до 5 с возможной десятичной частью
          const match = text.match(/([1-5][.,]\d)/);
          if (match) {
            return parseFloat(match[1].replace(",", "."));
          }
        }
      }

      // Ищем по ссылке на отзывы
      const reviewLinks = document.querySelectorAll('a[href*="reviews"]');
      for (const link of reviewLinks) {
        const text = link.textContent || "";
        const match = text.match(/([1-5][.,]\d)/);
        if (match) {
          return parseFloat(match[1].replace(",", "."));
        }
      }

      return null;
    });
  } catch (error) {
    console.log(`Ошибка при извлечении рейтинга: ${error.message}`);
  }

  // Извлекаем количество отзывов
  try {
    data.reviewCount = await page.evaluate((rating) => {
      const bodyText = document.body.textContent || "";

      // Ищем "N отзыв" или "N Оценок"
      const patterns = [/(\d+)\s*отзыв/gi, /(\d+)\s*Оценок/gi];

      for (const pattern of patterns) {
        const matches = bodyText.matchAll(pattern);
        for (const match of matches) {
          const num = parseInt(match[1], 10);
          // Исключаем числа которые начинаются с последней цифры рейтинга
          // Например, если рейтинг 4.9, исключаем числа начинающиеся с 9 (9148)
          if (rating) {
            const ratingLastDigit = String(rating).slice(-1);
            const numFirstDigit = String(num).slice(0, 1);
            if (numFirstDigit === ratingLastDigit && num > 1000) {
              // Это склеенное число, убираем первую цифру
              return parseInt(String(num).slice(1), 10);
            }
          }
          if (num > 0 && num < 100000) {
            return num;
          }
        }
      }

      return null;
    }, data.rating);
  } catch (error) {
    console.log(`Ошибка при извлечении количества отзывов: ${error.message}`);
  }

  // Проверяем доступность товара
  try {
    data.available = await page.evaluate(() => {
      const bodyText = document.body.textContent || "";

      // Если есть текст "Недоступен для заказа" - товар недоступен
      if (bodyText.includes("Недоступен для заказа")) {
        return false;
      }

      return true;
    });
  } catch (error) {
    console.log(`Ошибка при проверке доступности: ${error.message}`);
  }

  return data;
}

/**
 * Закрытие всплывающих окон (куки, реклама и т.д.)
 */
async function closePopups(page) {
  const popupSelectors = [
    '[data-testid="cookie-accept"]',
    'button:has-text("Принять")',
    'button:has-text("Закрыть")',
    'button:has-text("OK")',
    '[class*="close"]',
    '[class*="Close"]',
    '[aria-label="close"]',
    '[aria-label="Закрыть"]',
  ];

  for (const selector of popupSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          await button.click().catch(() => {});
          await sleep(500);
        }
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  }
}

/**
 * Основная функция
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Использование: node puppeteer.js <URL товара> <Регион>");
    console.log(
      'Пример: node puppeteer.js https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-3-2-950g--309202 "Санкт-Петербург и область"',
    );
    process.exit(1);
  }

  const [productUrl, region] = args;

  // Валидация URL
  if (!productUrl.includes("vprok.ru/product/")) {
    console.error("Ошибка: URL должен быть ссылкой на товар vprok.ru");
    process.exit(1);
  }

  console.log(`URL товара: ${productUrl}`);
  console.log(`Регион: ${region}`);

  let browser;

  try {
    // Запуск браузера
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    });

    const page = await browser.newPage();

    // Устанавливаем User-Agent для обхода блокировок
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    // Переходим на страницу товара
    console.log("Загружаем страницу товара...");
    await page.goto(productUrl, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Ждем загрузки
    await sleep(3000);

    // Закрываем всплывающие окна
    await closePopups(page);

    // Выбираем регион
    await selectRegion(page, region);

    // Ждем обновления страницы после смены региона
    await sleep(3000);

    // Закрываем возможные новые попапы после смены региона
    await closePopups(page);

    // Извлекаем данные о товаре
    const productData = await extractProductData(page);

    console.log("Извлеченные данные:");
    console.log(productData);

    // Прокручиваем страницу для полного скриншота
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });

    await sleep(1000);

    // Делаем полноразмерный скриншот
    console.log("Создаем скриншот...");
    await page.screenshot({
      path: "screenshot.jpg",
      fullPage: true,
      type: "jpeg",
      quality: 90,
    });
    console.log("Скриншот сохранен: screenshot.jpg");

    // Формируем содержимое файла
    const fileContent = [
      `price=${productData.price || ""}`,
      `priceOld=${productData.priceOld || ""}`,
      `rating=${productData.rating || ""}`,
      `reviewCount=${productData.reviewCount || ""}`,
      `available=${productData.available || false}`,
    ].join("\n");

    // Сохраняем данные в файл
    await fs.writeFile("product.txt", fileContent, "utf8");
    console.log("Данные сохранены: product.txt");
    console.log("Содержимое:");
    console.log(fileContent);
  } catch (error) {
    console.error(`Ошибка: ${error.message}`);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
