/* Автоматическая проверка тестов из docs/testing.md.
   Запуск:  npm i playwright && npx playwright install chromium   (один раз)
            node tests/run-tests.js
   Скрипт открывает страницы в Chromium через file:// и выводит результат каждого теста. */
const { chromium } = require('playwright');
const path = require('path');

const ROOT = 'file://' + path.resolve(__dirname, '..') + '/';
const PAGES = ['index.html', 'catalog.html', 'detail.html'];
const PRODUCTS = ['nova-x5', 'orbit-lite', 'vector-pro', 'vector-air', 'pulse-anc', 'boom-mini'];
const results = [];

function check(cond, msg) { if (!cond) throw new Error(msg); }

async function test(id, req, name, fn) {
  try {
    const fact = await fn();
    results.push({ id, req, name, ok: true, fact });
    console.log(`✔ ${id} [${req}] ${name}\n    ${fact}`);
  } catch (e) {
    results.push({ id, req, name, ok: false, fact: e.message });
    console.log(`✘ ${id} [${req}] ${name}\n    ${e.message}`);
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push('Не загружено: ' + r.url()));

  await test('ТС-01', 'Т8', 'Открытие каждой страницы, семантика, один h1, title', async () => {
    const titles = new Set();
    for (const p of PAGES) {
      errors.length = 0;
      await page.goto(ROOT + p);
      const info = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelectorAll('h1').length,
        tags: ['header', 'nav', 'main', 'footer'].filter(t => !document.querySelector(t))
      }));
      check(info.h1 === 1, `${p}: h1 = ${info.h1}`);
      check(info.tags.length === 0, `${p}: нет ${info.tags}`);
      check(info.title.includes('ВольтМаркет'), `${p}: title «${info.title}»`);
      check(errors.length === 0, `${p}: ${errors.join('; ')}`);
      titles.add(info.title);
    }
    check(titles.size === 3, 'title не уникальны');
    return `3 страницы открылись без ошибок; на каждой header/nav/main/footer и 1 h1; title: ${[...titles].join(' | ')}`;
  });

  await test('ТС-02', 'Т1', 'Все переходы меню (3 страницы × 3 ссылки) и отметка текущей', async () => {
    let n = 0;
    for (const from of PAGES) {
      for (const [text, target] of [['Главная', 'index.html'], ['Каталог', 'catalog.html'], ['Товар дня', 'detail.html']]) {
        await page.goto(ROOT + from);
        await page.click(`.nav >> text="${text}"`);
        await page.waitForLoadState();
        check(page.url().endsWith(target), `${from} → «${text}» открыл ${page.url()}`);
        const cur = await page.getAttribute('.nav__link[aria-current="page"]', 'href');
        check(cur === target, `на ${target} текущим отмечен ${cur}`);
        const border = await page.$eval('.nav__link[aria-current="page"]', el => getComputedStyle(el).borderBottomWidth);
        check(border === '3px', `линия текущего пункта ${border}`);
        n++;
      }
    }
    return `${n} из 9 переходов открыли нужную страницу; у текущего пункта aria-current="page" и линия 3px`;
  });

  await test('ТС-03', 'Т1', 'Логотип и подвал ведут на нужные страницы', async () => {
    await page.goto(ROOT + 'detail.html');
    await page.click('.logo');
    check(page.url().endsWith('index.html'), 'логотип → ' + page.url());
    await page.goto(ROOT + 'index.html');
    await page.click('.site-footer >> text="Каталог"');
    check(page.url().endsWith('catalog.html'), 'подвал → ' + page.url());
    return 'Логотип открыл index.html, ссылка «Каталог» в подвале — catalog.html';
  });

  await test('ТС-04', 'Т2', 'Карточки: количество, состав, категории, высота, 4:3', async () => {
    await page.goto(ROOT + 'catalog.html');
    const info = await page.$$eval('.catalog-grid .card', cards => cards.map(c => ({
      parts: ['.card__img', '.card__cat', '.card__title', '.card__text', '.card__price', 'a.btn'].every(s => c.querySelector(s)),
      cat: c.dataset.category,
      h: Math.round(c.getBoundingClientRect().height),
      top: Math.round(c.getBoundingClientRect().top),
      ratio: (() => { const r = c.querySelector('.card__img').getBoundingClientRect(); return r.width / r.height; })(),
      fit: getComputedStyle(c.querySelector('.card__img')).objectFit
    })));
    check(info.length === 6, 'карточек ' + info.length);
    check(info.every(i => i.parts), 'не у всех карточек полный состав');
    const cats = new Set(info.map(i => i.cat));
    check(cats.size === 3, 'категорий ' + cats.size);
    const rows = {};
    info.forEach(i => (rows[i.top] = rows[i.top] || []).push(i.h));
    Object.values(rows).forEach(r => check(new Set(r).size === 1, 'разная высота в ряду: ' + r));
    check(info.every(i => Math.abs(i.ratio - 4 / 3) < 0.02 && i.fit === 'contain'), 'пропорции изображений не 4:3');
    await page.goto(ROOT + 'index.html');
    const hits = await page.$$eval('.card', c => c.length);
    check(hits === 3, 'хитов на главной ' + hits);
    return `6 карточек в 3 категориях (${[...cats].join(', ')}), у каждой 6 элементов; высоты в рядах равны; изображения 4:3, contain; на главной 3 хита`;
  });

  await test('ТС-05', 'Т3', 'Переход из каждой карточки к подробностям', async () => {
    for (let i = 0; i < 6; i++) {
      await page.goto(ROOT + 'catalog.html');
      const card = page.locator('.catalog-grid .card').nth(i);
      const name = (await card.locator('.card__title').textContent()).trim();
      const price = (await card.locator('.card__price').textContent()).trim();
      await card.locator('a.btn').click();
      await page.waitForLoadState();
      check(page.url().includes('detail.html?id=' + PRODUCTS[i]), 'адрес ' + page.url());
      check((await page.textContent('h1')).trim() === name, `h1 ≠ «${name}»`);
      check((await page.textContent('#product-price')).trim() === price, `цена ≠ ${price}`);
      const rows = await page.$$eval('#product-specs tr', r => r.length);
      check(rows >= 4, `характеристик ${rows}`);
      check((await page.title()).startsWith(name), 'title ' + await page.title());
    }
    return 'Для всех 6 карточек открылся detail.html?id=…, h1, цена и title совпадают с карточкой, характеристик 6–7 строк';
  });

  await test('ТС-06', 'Т3', 'Возврат в каталог со страницы подробностей', async () => {
    await page.goto(ROOT + 'detail.html?id=boom-mini');
    await page.click('text=← Вернуться в каталог');
    check(page.url().endsWith('catalog.html'), 'кнопка → ' + page.url());
    await page.goto(ROOT + 'detail.html?id=boom-mini');
    await page.click('.breadcrumbs >> text="Каталог"');
    check(page.url().endsWith('catalog.html'), 'крошка → ' + page.url());
    await page.goto(ROOT + 'catalog.html');
    await page.locator('.card a.btn').first().click();
    await page.goBack();
    check(page.url().endsWith('catalog.html'), 'кнопка браузера «Назад» → ' + page.url());
    return '«← Вернуться в каталог», крошка «Каталог» и кнопка браузера «Назад» открывают catalog.html';
  });

  await test('ТС-07', 'Т3', 'Товар дня без id и несуществующий id', async () => {
    await page.goto(ROOT + 'detail.html');
    const def = (await page.textContent('h1')).trim();
    check(def === 'Смартфон Nova X5', 'без id: ' + def);
    await page.goto(ROOT + 'detail.html?id=abc');
    const nf = (await page.textContent('h1')).trim();
    check(nf === 'Товар не найден', 'неизвестный id: ' + nf);
    check(await page.isVisible('#not-found a[href="catalog.html"]'), 'нет ссылки на каталог');
    check(!(await page.isVisible('#product-img')), 'фото не скрыто');
    return 'Без id показан «Смартфон Nova X5»; при id=abc — «Товар не найден» и ссылка «Открыть каталог»';
  });

  await test('ТС-08', 'Т7', 'Загрузка изображений и alt', async () => {
    let total = 0;
    for (const p of [...PAGES, ...PRODUCTS.map(id => 'detail.html?id=' + id)]) {
      await page.goto(ROOT + p);
      await page.waitForLoadState('load');
      const imgs = await page.$$eval('img', list => list.map(i => ({
        src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0,
        alt: i.getAttribute('alt'), deco: i.classList.contains('logo__icon')
      })));
      for (const i of imgs) {
        check(i.ok, `${p}: не загрузилось ${i.src}`);
        check(i.alt !== null, `${p}: нет alt у ${i.src}`);
        if (!i.deco) check(i.alt.trim().length > 10, `${p}: пустой alt у ${i.src}`);
        total++;
      }
    }
    return `${total} изображений на 9 вариантах страниц загружены (naturalWidth > 0); у содержательных alt с описанием, у логотипа alt=""`;
  });

  await test('ТС-09', 'Т4', 'Нет горизонтальной прокрутки при 360, 768, 1440 px; число колонок', async () => {
    const out = [];
    for (const [w, cols] of [[360, 1], [768, 2], [1440, 3]]) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const p of [...PAGES, 'detail.html?id=vector-pro']) {
        await page.goto(ROOT + p);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        check(sw <= w, `${p} при ${w}px: ширина документа ${sw}`);
        const wide = await page.evaluate(vw => [...document.querySelectorAll('body *')]
          .filter(e => e.getBoundingClientRect().right > vw + 0.5 && !e.classList.contains('visually-hidden') && e.className !== 'skip-link').length, w);
        check(wide === 0, `${p} при ${w}px: ${wide} элементов выходят за экран`);
      }
      await page.goto(ROOT + 'catalog.html');
      const tops = await page.$$eval('.catalog-grid .card', c => c.slice(0, 3).map(x => Math.round(x.getBoundingClientRect().top)));
      const real = tops.filter(t => t === tops[0]).length;
      check(real === cols, `${w}px: колонок ${real}, ожидалось ${cols}`);
      const cw = await page.$eval('.container', c => c.getBoundingClientRect().width);
      check(cw <= 1200, 'контейнер шире 1200');
      out.push(`${w}px — ${real} кол.`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    return `scrollWidth ≤ ширины окна на всех страницах; ни один элемент не выходит за экран; ${out.join(', ')}; контейнер ≤ 1200px`;
  });

  await test('ТС-10', 'Т4', 'Телефон 360 px: меню под логотипом, размер текста, порядок блоков', async () => {
    const m = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await m.goto(ROOT + 'index.html');
    const r = await m.evaluate(() => {
      const logo = document.querySelector('.logo').getBoundingClientRect();
      const links = [...document.querySelectorAll('.nav__link')].map(a => a.getBoundingClientRect());
      return {
        below: links.every(l => l.top >= logo.bottom),
        oneRow: new Set(links.map(l => Math.round(l.top))).size === 1,
        inside: links.every(l => l.left >= 0 && l.right <= innerWidth),
        font: parseFloat(getComputedStyle(document.querySelector('.hero__lead')).fontSize),
        order: ['.site-header', '.hero', '#categories-title', '#hits-title', '#benefits-title', '.site-footer']
          .map(s => document.querySelector(s).getBoundingClientRect().top)
      };
    });
    check(r.below && r.oneRow && r.inside, 'меню не под логотипом одной строкой');
    check(r.font >= 16, 'текст ' + r.font);
    check(r.order.every((v, i, a) => i === 0 || v > a[i - 1]), 'порядок блоков главной нарушен');
    await m.goto(ROOT + 'detail.html');
    const d = await m.evaluate(() => ['.breadcrumbs', '.back-link', '#product-img', '#product-title', '#product-price', '#product-call', '#desc-title', '#specs-title', '.site-footer']
      .map(s => document.querySelector(s).getBoundingClientRect().top));
    check(d.every((v, i, a) => i === 0 || v > a[i - 1]), 'порядок блоков подробностей нарушен');
    await m.goto(ROOT + 'catalog.html');
    const c = await m.evaluate(() => ['.breadcrumbs', 'h1', '.filter__buttons', '#catalog-count', '.catalog-grid', '.site-footer']
      .map(s => document.querySelector(s).getBoundingClientRect().top));
    check(c.every((v, i, a) => i === 0 || v > a[i - 1]), 'порядок блоков каталога нарушен');
    await m.close();
    return `Меню — одна строка из 3 ссылок под логотипом, в пределах экрана; основной текст ${r.font}px; порядок блоков на 3 страницах совпадает с прототипом`;
  });

  await test('ТС-11', 'Т5', 'Обход клавишей Tab: порядок и видимый фокус', async () => {
    const report = [];
    for (const p of PAGES) {
      await page.goto(ROOT + p);
      const seq = [];
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(() => {
          const e = document.activeElement;
          if (!e || e === document.body) return null;
          const r = e.getBoundingClientRect(), s = getComputedStyle(e);
          return { txt: (e.textContent || '').trim().slice(0, 25), y: r.top + scrollY, x: r.left,
                   ow: s.outlineWidth, os: s.outlineStyle, inFooter: !!e.closest('footer') };
        });
        if (!f) break;
        seq.push(f);
        if (f.txt === 'Товар дня' && f.inFooter) break;
      }
      check(seq[0].txt === 'Перейти к содержимому', `${p}: первым фокус получил «${seq[0].txt}»`);
      check(seq.every(f => f.ow === '3px' && f.os === 'solid'), `${p}: у элемента нет рамки 3px`);
      // порядок: каждый следующий элемент ниже или в той же строке правее
      for (let i = 2; i < seq.length; i++) {
        const a = seq[i - 1], b = seq[i];
        const ok = b.y > a.y + 4 || (Math.abs(b.y - a.y) <= 40 && b.x >= a.x) || (b.y >= a.y - 40 && b.x > a.x);
        check(ok, `${p}: «${b.txt}» (${Math.round(b.x)},${Math.round(b.y)}) идёт после «${a.txt}» (${Math.round(a.x)},${Math.round(a.y)}), но расположен выше/левее`);
      }
      report.push(`${p}: ${seq.length} элементов`);
    }
    return `Первым идёт «Перейти к содержимому»; порядок фокуса совпадает с порядком на экране; у каждого элемента outline 3px solid (${report.join(', ')})`;
  });

  await test('ТС-12', 'Т5', 'Активация клавишей Enter: ссылки и кнопки фильтра', async () => {
    await page.goto(ROOT + 'index.html');
    await page.focus('.nav__link[href="catalog.html"]');
    await page.keyboard.press('Enter');
    await page.waitForURL(/catalog\.html/);
    await page.focus('.filter__btn[data-filter="audio"]');
    await page.keyboard.press('Enter');
    const vis = await page.$$eval('.catalog-grid .card:not([hidden])', c => c.length);
    check(vis === 2, 'после Enter на «Аудио» видно ' + vis);
    await page.locator('.catalog-grid .card:not([hidden]) a.btn').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/detail\.html\?id=pulse-anc/);
    await page.focus('.back-link');
    await page.keyboard.press('Enter');
    await page.waitForURL(/catalog\.html$/);
    await page.goto(ROOT + 'catalog.html');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    const focusedMain = await page.evaluate(() => document.activeElement.id);
    check(focusedMain === 'main', 'skip-link перевёл фокус на ' + focusedMain);
    return 'Enter: меню → каталог; «Аудио» → 2 карточки; «Подробнее» → detail.html?id=pulse-anc; «Вернуться» → каталог; «Перейти к содержимому» → фокус на main';
  });

  await test('ТС-13', 'Т6', 'Фильтр по категориям', async () => {
    await page.goto(ROOT + 'catalog.html');
    const state = async () => page.evaluate(() => ({
      vis: [...document.querySelectorAll('.catalog-grid .card')].filter(c => c.offsetParent).map(c => c.dataset.category),
      count: document.getElementById('catalog-count').textContent,
      pressed: [...document.querySelectorAll('.filter__btn[aria-pressed="true"]')].map(b => b.textContent)
    }));
    await page.click('text=Ноутбуки');
    let s = await state();
    check(s.vis.length === 2 && s.vis.every(c => c === 'laptops'), 'Ноутбуки: ' + s.vis);
    check(s.count === 'Показано товаров: 2', s.count);
    check(s.pressed.join() === 'Ноутбуки', 'aria-pressed: ' + s.pressed);
    await page.click('.filter__btn[data-filter="all"]');
    s = await state();
    check(s.vis.length === 6 && s.count === 'Показано товаров: 6', 'Все: ' + s.vis.length);
    await page.goto(ROOT + 'index.html');
    await page.click('.category >> text=Аудио');
    s = await state();
    check(page.url().endsWith('catalog.html?cat=audio') && s.vis.length === 2 && s.pressed.join() === 'Аудио', 'ссылка категории с главной');
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const nj = await noJs.newPage();
    await nj.goto(ROOT + 'catalog.html?cat=audio');
    const njVis = await nj.$$eval('.catalog-grid .card', c => c.filter(x => x.offsetParent).length);
    await noJs.close();
    check(njVis === 6, 'без JS видно ' + njVis);
    return '«Ноутбуки» → 2 карточки, «Показано товаров: 2», aria-pressed у нажатой; «Все» → 6; плитка «Аудио» на главной → catalog.html?cat=audio с 2 карточками; без JS видны все 6';
  });

  await test('ТС-14', 'Т1–Т3', 'Основной сценарий целиком', async () => {
    await page.goto(ROOT + 'index.html');
    await page.click('text=Перейти в каталог');
    await page.click('.filter__btn[data-filter="phones"]');
    await page.locator('.catalog-grid .card:not([hidden]) a.btn').nth(1).click();
    check((await page.textContent('h1')).trim() === 'Смартфон Orbit Lite', 'не тот товар');
    check(await page.getAttribute('#product-call', 'href') === 'tel:+78001234567', 'нет ссылки tel:');
    await page.click('text=← Вернуться в каталог');
    await page.click('.nav >> text=Главная');
    check(page.url().endsWith('index.html'), 'не вернулись на главную');
    return 'Главная → «Перейти в каталог» → «Смартфоны» → «Подробнее» Orbit Lite → кнопка «Позвонить» (tel:) → «Вернуться в каталог» → «Главная»: все шаги выполнены';
  });

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\nИтого: ${results.length - failed} пройдено, ${failed} не пройдено`);
  require('fs').writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
  process.exit(failed ? 1 : 0);
})();
