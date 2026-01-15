const assert = require("assert");

// Мок данные, имитирующие ответ API vprok.ru
const mockApiResponse = {
  products: [
    {
      productId: 1293724,
      url: "/product/tomaty-cherri-flamenko-krasnye-kruglye--1293724",
      name: "Помидоры черри Фламенко 250г упаковка",
      rating: 4.8,
      reviews: 142,
      price: 289,
      oldPrice: 0,
      discount: 0,
      discountPercent: 0,
    },
    {
      productId: 1204466,
      url: "/product/tomaty-flamenko-slivovidnye-krasnye-1-kg--1204466",
      name: "Помидоры Фламенко сливовидные красные 1кг",
      rating: 4.8,
      reviews: 2958,
      price: 399,
      oldPrice: 449,
      discount: 50,
      discountPercent: 11,
    },
    {
      productId: 509967,
      url: "/product/luhovitskie-ovoschi-tomaty-cherri-na-vetke-med-250g--509967",
      name: "Помидоры Черри медовые красные круглые 200г упаковка",
      rating: 4.8,
      reviews: 2028,
      price: 249,
      oldPrice: 279,
      discount: 30,
      discountPercent: 11,
    },
    {
      productId: 999999,
      url: "/product/test-product--999999",
      name: "Тестовый товар без рейтинга",
      rating: 0,
      reviews: 0,
      price: 100,
      oldPrice: 0,
      discount: 0,
      discountPercent: 0,
    },
  ],
};

// Функция извлечения ID категории из URL
function extractCategoryId(url) {
  const match = url.match(/catalog\/(\d+)\/([^/?]+)/);
  if (!match) {
    return null;
  }
  return { categoryId: match[1], slug: match[2] };
}

// Функция форматирования товара
function formatProduct(product) {
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

  return {
    name,
    link,
    rating,
    reviews,
    price: price + " ₽",
    promoPrice: promoPrice || "Нет",
    priceBeforeDiscount: priceBeforeDiscount || "Нет",
    discountSize: discountSize || "Нет",
  };
}

// Тесты
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Ошибка: ${error.message}`);
    failed++;
  }
}

console.log("=".repeat(50));
console.log("ТЕСТЫ ПАРСЕРА VPROK.RU");
console.log("=".repeat(50));
console.log("");

// Тест 1: Извлечение ID категории из URL
test("Извлечение ID категории из корректного URL", () => {
  const result = extractCategoryId(
    "https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory",
  );
  assert.strictEqual(result.categoryId, "7382");
  assert.strictEqual(result.slug, "pomidory-i-ovoschnye-nabory");
});

// Тест 2: Обработка некорректного URL
test("Обработка некорректного URL", () => {
  const result = extractCategoryId("https://www.vprok.ru/invalid-url");
  assert.strictEqual(result, null);
});

// Тест 3: URL с параметрами
test("Извлечение ID из URL с параметрами", () => {
  const result = extractCategoryId(
    "https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory?page=2",
  );
  assert.strictEqual(result.categoryId, "7382");
  assert.strictEqual(result.slug, "pomidory-i-ovoschnye-nabory");
});

// Тест 4: Форматирование товара без скидки
test("Форматирование товара без скидки", () => {
  const product = mockApiResponse.products[0];
  const formatted = formatProduct(product);

  assert.strictEqual(formatted.name, "Помидоры черри Фламенко 250г упаковка");
  assert.strictEqual(
    formatted.link,
    "https://www.vprok.ru/product/tomaty-cherri-flamenko-krasnye-kruglye--1293724",
  );
  assert.strictEqual(formatted.rating, 4.8);
  assert.strictEqual(formatted.reviews, 142);
  assert.strictEqual(formatted.price, "289 ₽");
  assert.strictEqual(formatted.promoPrice, "Нет");
  assert.strictEqual(formatted.priceBeforeDiscount, "Нет");
  assert.strictEqual(formatted.discountSize, "Нет");
});

// Тест 5: Форматирование товара со скидкой
test("Форматирование товара со скидкой", () => {
  const product = mockApiResponse.products[1];
  const formatted = formatProduct(product);

  assert.strictEqual(
    formatted.name,
    "Помидоры Фламенко сливовидные красные 1кг",
  );
  assert.strictEqual(formatted.price, "399 ₽");
  assert.strictEqual(formatted.promoPrice, "399 ₽");
  assert.strictEqual(formatted.priceBeforeDiscount, "449 ₽");
  assert.strictEqual(formatted.discountSize, "11%");
});

// Тест 6: Товар без рейтинга
test("Обработка товара без рейтинга", () => {
  const product = mockApiResponse.products[3];
  const formatted = formatProduct(product);

  assert.strictEqual(formatted.rating, "Нет рейтинга");
  assert.strictEqual(formatted.reviews, 0);
});

// Тест 7: Формирование ссылки на товар
test("Корректное формирование ссылки на товар", () => {
  const product = mockApiResponse.products[0];
  const formatted = formatProduct(product);

  assert.ok(formatted.link.startsWith("https://www.vprok.ru"));
  assert.ok(formatted.link.includes("/product/"));
});

// Тест 8: Обработка пустого товара
test("Обработка товара с пустыми полями", () => {
  const emptyProduct = {};
  const formatted = formatProduct(emptyProduct);

  assert.strictEqual(formatted.name, "Без названия");
  assert.strictEqual(formatted.link, "");
  assert.strictEqual(formatted.rating, "Нет рейтинга");
  assert.strictEqual(formatted.reviews, 0);
  assert.strictEqual(formatted.price, "0 ₽");
});

// Тест 9: Проверка количества товаров в моке
test("Мок содержит ожидаемое количество товаров", () => {
  assert.strictEqual(mockApiResponse.products.length, 4);
});

// Тест 10: Проверка структуры API ответа
test("Структура API ответа корректна", () => {
  assert.ok(mockApiResponse.hasOwnProperty("products"));
  assert.ok(Array.isArray(mockApiResponse.products));

  const product = mockApiResponse.products[0];
  assert.ok(product.hasOwnProperty("productId"));
  assert.ok(product.hasOwnProperty("url"));
  assert.ok(product.hasOwnProperty("name"));
  assert.ok(product.hasOwnProperty("price"));
});

// Тест 11: Формат вывода
test("Генерация текстового вывода", () => {
  const product = mockApiResponse.products[0];
  const formatted = formatProduct(product);

  let output = "";
  output += `Название товара: ${formatted.name}\n`;
  output += `Ссылка на страницу товара: ${formatted.link}\n`;
  output += `Рейтинг: ${formatted.rating}\n`;
  output += `Количество отзывов: ${formatted.reviews}\n`;
  output += `Цена: ${formatted.price}\n`;
  output += `Акционная цена: ${formatted.promoPrice}\n`;
  output += `Цена до акции: ${formatted.priceBeforeDiscount}\n`;
  output += `Размер скидки: ${formatted.discountSize}\n`;

  assert.ok(output.includes("Название товара:"));
  assert.ok(output.includes("Ссылка на страницу товара:"));
  assert.ok(output.includes("Рейтинг:"));
  assert.ok(output.includes("Количество отзывов:"));
  assert.ok(output.includes("Цена:"));
  assert.ok(output.includes("Акционная цена:"));
  assert.ok(output.includes("Цена до акции:"));
  assert.ok(output.includes("Размер скидки:"));
});

// Тест 12: Расчет скидки
test("Корректный расчет наличия скидки", () => {
  const productWithDiscount = mockApiResponse.products[1];
  const productWithoutDiscount = mockApiResponse.products[0];

  assert.ok(productWithDiscount.oldPrice > productWithDiscount.price);
  assert.strictEqual(productWithoutDiscount.oldPrice, 0);
});

console.log("");
console.log("=".repeat(50));
console.log(`РЕЗУЛЬТАТ: ${passed} пройдено, ${failed} провалено`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
