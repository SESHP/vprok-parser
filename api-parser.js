const puppeteer = require("puppeteer");
const fs = require("fs");

async function parseVprok(categoryUrl) {
  console.log(`Парсинг категории: ${categoryUrl}`);

  // Извлекаем ID категории и slug из URL
  const urlMatch = categoryUrl.match(/catalog\/(\d+)\/([^/?]+)/);

  if (!urlMatch) {
    throw new Error(
      "Неверный формат URL. Ожидается: https://www.vprok.ru/catalog/{id}/{slug}",
    );
  }

  const categoryId = urlMatch[1];
  const categorySlug = urlMatch[2];

  console.log(`ID категории: ${categoryId}, slug: ${categorySlug}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  console.log("Загружаем страницу для получения cookies...");
  await page.goto(categoryUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Ждем прохождения JS Challenge
  await page.waitForSelector('a[href*="/product/"]', { timeout: 30000 });
  console.log("Страница загружена, делаем запрос к API...");

  // Делаем запрос к API из контекста браузера (с cookies)
  const apiUrl = `https://www.vprok.ru/web/api/v1/catalog/category/${categoryId}?sort=popularity_desc&limit=30&page=1`;

  const result = await page.evaluate(
    async (apiUrl, categoryId, categorySlug) => {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          noRedirect: true,
          url: `/catalog/${categoryId}/${categorySlug}`,
        }),
      });
      return await response.json();
    },
    apiUrl,
    categoryId,
    categorySlug,
  );

  await browser.close();

  const products = result.products || [];

  if (products.length === 0) {
    throw new Error("Не удалось получить товары");
  }

  console.log(`Получено товаров: ${products.length}`);

  // Формируем текстовый вывод
  let output = "";

  products.forEach((product) => {
    const name = product.name || "Без названия";
    const link = product.url ? `https://www.vprok.ru${product.url}` : "";
    const rating = product.rating || "Нет рейтинга";
    const reviews = product.reviews || 0;
    const price = product.price || 0;
    const oldPrice = product.oldPrice || 0;
    const discountPercent = product.discountPercent || 0;

    let promoPrice = "";
    let priceBeforeDiscount = "";
    let discountSize = "";

    if (oldPrice > 0 && oldPrice > price) {
      promoPrice = price + " ₽";
      priceBeforeDiscount = oldPrice + " ₽";
    }

    if (discountPercent > 0) {
      discountSize = discountPercent + "%";
    }

    output += `Название товара: ${name}\n`;
    output += `Ссылка на страницу товара: ${link}\n`;
    output += `Рейтинг: ${rating}\n`;
    output += `Количество отзывов: ${reviews}\n`;
    output += `Цена: ${price} ₽\n`;
    output += `Акционная цена: ${promoPrice || "Нет"}\n`;
    output += `Цена до акции: ${priceBeforeDiscount || "Нет"}\n`;
    output += `Размер скидки: ${discountSize || "Нет"}\n`;
    output += "\n";
  });

  fs.writeFileSync("products-api.txt", output, "utf8");
  console.log("Данные сохранены в products-api.txt");

  return products;
}

const url = process.argv[2];

if (!url) {
  console.log("Использование: node api-parser.js <URL категории>");
  console.log(
    "Пример: node api-parser.js https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory",
  );
  process.exit(1);
}

parseVprok(url)
  .then(() => console.log("Парсинг завершен успешно!"))
  .catch((err) => {
    console.error("Ошибка:", err.message);
    process.exit(1);
  });
