/* Фильтр по категориям на странице каталога (требование Т6). */
(function () {
  const buttons = document.querySelectorAll('.filter__btn');
  const cards = document.querySelectorAll('.catalog-grid .card');
  const counter = document.getElementById('catalog-count');
  const allowed = ['all', 'phones', 'laptops', 'audio'];

  function applyFilter(cat) {
    let shown = 0;
    cards.forEach(function (card) {
      const visible = cat === 'all' || card.dataset.category === cat;
      card.hidden = !visible;
      if (visible) shown += 1;
    });
    buttons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === cat));
    });
    counter.textContent = 'Показано товаров: ' + shown;
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const cat = btn.dataset.filter;
      applyFilter(cat);
      // Сохраняем фильтр в адресе, чтобы ссылкой можно было поделиться
      const url = cat === 'all' ? 'catalog.html' : 'catalog.html?cat=' + cat;
      history.replaceState(null, '', url);
    });
  });

  const fromUrl = new URLSearchParams(location.search).get('cat');
  applyFilter(allowed.indexOf(fromUrl) !== -1 ? fromUrl : 'all');
})();
