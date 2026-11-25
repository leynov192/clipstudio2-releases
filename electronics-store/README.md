# ВольтМаркет — сайт магазина электроники

Практическая работа №13 «Реализация полного цикла разработки», тема №22 «Сайт магазина электроники».

## Страницы
| Файл | Назначение |
|---|---|
| `index.html` | Главная: промо, категории, хиты продаж, преимущества |
| `catalog.html` | Каталог: 6 товаров в 3 категориях, фильтр по категориям |
| `detail.html` | Подробности о товаре (`detail.html?id=nova-x5` и т. д.) |

## Как открыть
Откройте `index.html` в браузере, сервер не нужен.
Для публикации включите GitHub Pages: Settings → Pages → Branch `main`, папка `/ (root)`.

## Документация (`docs/`)
- [TZ.md](docs/TZ.md) — техническое задание, требования Т1–Т8 с критериями приёмки, журнал изменений
- [prototype.md](docs/prototype.md) — схема переходов, 6 экранов прототипа, порядок блоков
- [design.md](docs/design.md) — шрифт, цвета, размеры заголовков, отступы, сетка
- [testing.md](docs/testing.md) — 14 тестов, найденные дефекты, повторная проверка, сравнение с прототипом

## Структура
```
index.html  catalog.html  detail.html
assets/css/style.css
assets/img/      — SVG-иллюстрации товаров, логотип
assets/js/       — products.js (данные), catalog.js (фильтр), detail.js (подробности)
docs/            — документация и прототипы
tests/           — run-tests.js (автопроверка тестов из testing.md)
```

## Запуск тестов
```
npm install playwright
npx playwright install chromium
node tests/run-tests.js
```
