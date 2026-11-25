/* Страница подробностей (требование Т3).
   Без параметра id показывается «Товар дня» — Nova X5 (он же прописан в HTML).
   С параметром ?id=… содержимое заменяется данными выбранного товара. */
(function () {
  const DEFAULT_ID = 'nova-x5';
  const id = new URLSearchParams(location.search).get('id') || DEFAULT_ID;
  const product = PRODUCTS[id];
  const view = document.getElementById('product');
  const notFound = document.getElementById('not-found');
  const crumb = document.getElementById('crumb-current');

  // Пункт меню «Товар дня» отмечается текущим только для товара дня
  const dayLink = document.querySelector('.nav__link[href="detail.html"]');
  if (id !== DEFAULT_ID && dayLink) dayLink.removeAttribute('aria-current');

  if (!product) {
    ['product-img', 'product-category', 'product-price', 'product-stock', 'product-call',
     'product-desc-section', 'product-specs-section'].forEach(function (elId) {
      document.getElementById(elId).hidden = true;
    });
    view.classList.add('product--missing');
    notFound.hidden = false;
    document.getElementById('product-title').textContent = 'Товар не найден';
    crumb.textContent = 'Товар не найден';
    document.title = 'Товар не найден — ВольтМаркет, магазин электроники';
    return;
  }

  document.title = product.name + ' — ВольтМаркет, магазин электроники';
  crumb.textContent = product.name;
  document.getElementById('product-title').textContent = product.name;
  document.getElementById('product-category').textContent = product.category;
  document.getElementById('product-price').textContent = product.price;
  const stock = document.getElementById('product-stock');
  stock.textContent = product.stock;
  stock.classList.toggle('product__stock--order', product.stock !== 'В наличии');

  const img = document.getElementById('product-img');
  img.src = product.img;
  img.alt = product.alt;

  const desc = document.getElementById('product-desc');
  desc.innerHTML = '';
  product.description.forEach(function (text) {
    const p = document.createElement('p');
    p.textContent = text;
    desc.appendChild(p);
  });

  const tbody = document.getElementById('product-specs');
  tbody.innerHTML = '';
  product.specs.forEach(function (row) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = row[0];
    const td = document.createElement('td');
    td.textContent = row[1];
    tr.append(th, td);
    tbody.appendChild(tr);
  });
})();
