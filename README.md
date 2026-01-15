# VProk.ru Parser

Парсер товаров с сайта vprok.ru с использованием Puppeteer.

## Описание

Проект состоит из двух частей:

1. **Часть 1** - Парсинг страницы товара со скриншотом и выбором региона
2. **Часть 2** - Парсинг категории товаров через API

## Требования

- Node.js >= 18.0.0
- npm или yarn

## Установка

```bash
# Клонируйте репозиторий
git clone <repository-url>
cd vprok-parser

# Установите зависимости
npm install
```

---

## Часть 1: Puppeteer парсер страницы товара

Скрипт позволяет:

- Выбирать регион доставки
- Делать полноразмерный скриншот страницы товара
- Извлекать информацию о товаре (цена, рейтинг, отзывы)

```bash
node parser.js <URL товара> <Регион>
```

### Пример:

```bash
node parser.js "https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-3-2-950g--309202" "Санкт-Петербург и область"
```

### Результат:

- `screenshot.jpg` - полноразмерный скриншот страницы
- `product.txt` - файл с данными о товаре:

```
price=129.99
priceOld=179
rating=4.8
reviewCount=1157
available=true
```

### Доступные регионы:

- Москва и область
- Санкт-Петербург и область
- И другие регионы, доступные на сайте vprok.ru

---

## Часть 2: API парсер категорий

Парсер категории товаров через анализ API запросов сайта.

```bash
node api-parser.js <URL категории>
```

### Пример:

```bash
node api-parser.js "https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory"
```

### Результат:

- `products-api.txt` - файл со списком всех товаров категории (первая страница, до 30 товаров)

### Формат вывода:

```
Название товара: Помидоры Фламенко сливовидные красные 1кг
Ссылка на страницу товара: https://www.vprok.ru/product/tomaty-flamenko-slivovidnye-krasnye-1-kg--1204466
Рейтинг: 4.8
Количество отзывов: 2958
Цена: 399 ₽
Акционная цена: 399 ₽
Цена до акции: 449 ₽
Размер скидки: 11%

Название товара: Помидоры Черри медовые красные 200г
Ссылка на страницу товара: https://www.vprok.ru/product/...
...
```

### Как работает:

1. Puppeteer открывает страницу категории в headless-браузере
2. Проходит JS Challenge защиту, получает необходимые cookies
3. Выполняет POST-запрос к внутреннему API: `/web/api/v1/catalog/category/{id}`
4. Парсит JSON-ответ и сохраняет данные в файл

### Примеры категорий:

```bash
# Помидоры
node api-parser.js "https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory"

# Молоко
node api-parser.js "https://www.vprok.ru/catalog/1377/moloko"

# Морковь
node api-parser.js "https://www.vprok.ru/catalog/7386/morkov"
```

---

## Тестирование

```bash
node api-parser.test.js
```

Тесты проверяют:
- Извлечение ID категории из URL
- Форматирование товаров с/без скидки
- Обработку пустых полей
- Корректность структуры вывода

---

## Примеры ссылок для тестирования

### Товары (для Части 1):

- https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-3-2-950g--309202
- https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-2-5-950g--310778
- https://www.vprok.ru/product/makfa-makfa-izd-mak-spirali-450g--306739
- https://www.vprok.ru/product/greenfield-greenf-chay-gold-ceyl-bl-pak-100h2g--307403
- https://www.vprok.ru/product/chaykofskiy-chaykofskiy-sahar-pesok-krist-900g--308737
- https://www.vprok.ru/product/lavazza-kofe-lavazza-1kg-oro-zerno--450647

### Категории (для Части 2):

- https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory
- https://www.vprok.ru/catalog/7386/morkov
- https://www.vprok.ru/catalog/1377/moloko

---

## Разработка

### Линтинг

```bash
# Проверка кода
npm run lint

# Автоисправление
npm run lint:fix
```

### Форматирование

```bash
# Форматирование кода
npm run format

# Проверка форматирования
npm run format:check
```

---

## Структура проекта

```
vprok-parser/
├── .gitignore
├── eslint.config.mjs     # Конфигурация ESLint
├── puppeteer.js          # Часть 1 - парсер страницы товара
├── api-parser.js         # Часть 2 - парсер категории через API
├── api-parser.test.js    # Тесты для Части 2
├── package.json
├── README.md
├── screenshot.jpg        # Пример результата (Часть 1)
├── product.txt           # Пример результата (Часть 1)
└── products-api.txt      # Пример результата (Часть 2)
```

---

## Технические детали

### Обход защиты

Сайт vprok.ru использует JS Challenge для защиты от ботов. Скрипты обходят её с помощью:

- Puppeteer с реальным браузером Chrome
- Настраиваемый User-Agent
- Ожидание полной загрузки страницы (`networkidle2`)
- Получение cookies после прохождения проверки

### Извлечение данных

**Часть 1** - многоуровневый подход:
1. Поиск по data-testid атрибутам
2. Поиск по CSS классам
3. Поиск по структуре DOM и регулярным выражениям

**Часть 2** - прямой запрос к API:
1. POST-запрос к `/web/api/v1/catalog/category/{id}`
2. Парсинг JSON-ответа с массивом `products`

---

## Лицензия

MIT