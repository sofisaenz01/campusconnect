// search.js
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.querySelector('.search-container input');
  const searchIcon = document.querySelector('.search-container i');
  
  // Función para realizar la búsqueda
  function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    if (query === '') {
      alert('Por favor ingresa un término de búsqueda');
      return;
    }
    
    // Obtener todos los elementos en los que buscar según la página actual
    const currentPage = window.location.pathname;
    let searchableElements = [];
    let selector = '';
    
    // Búsqueda en la página de Noticias
    if (currentPage.includes('noticias')) {
      searchableElements = document.querySelectorAll('.news-card');
      selector = '.news-card-title';
    }
    // Búsqueda en la página de Recursos
    else if (currentPage.includes('recursos')) {
      searchableElements = document.querySelectorAll('.resource-card');
      selector = '.resource-title';
    }
    // Búsqueda en la página de Explorar
    else if (currentPage.includes('explorar')) {
      searchableElements = document.querySelectorAll('.category-card, .pregrado-item');
      selector = '.category-title, .pregrado-name';
    }
    // Búsqueda en la página de Eventos
    else if (currentPage.includes('eventos')) {
      searchableElements = document.querySelectorAll('.event-card');
      selector = '.event-title, .event-name';
    }
    // Búsqueda en la página de Oportunidades
    else if (currentPage.includes('oportunidades')) {
      searchableElements = document.querySelectorAll('.opportunity-card, .oportunidad-card');
      selector = '.opportunity-title, .oportunidad-title';
    }
    
    if (searchableElements.length > 0) {
      filterElements(searchableElements, query, selector);
    }
  }
  
  // Función para filtrar elementos
  function filterElements(elements, query, selector) {
    let found = false;
    let foundCount = 0;
    
    elements.forEach(element => {
      let text = '';
      
      // Intentar obtener el texto de diferentes formas
      const textElement = element.querySelector(selector);
      if (textElement) {
        text = textElement.textContent.toLowerCase();
      } else {
        // Si no encuentra el selector específico, busca en todo el elemento
        text = element.textContent.toLowerCase();
      }
      
      if (text.includes(query)) {
        element.style.display = '';
        element.style.animation = 'highlight 0.5s ease';
        found = true;
        foundCount++;
      } else {
        element.style.display = 'none';
      }
    });
    
    if (!found) {
      alert('No se encontraron resultados para: "' + query + '"');
      // Mostrar todos los elementos nuevamente
      elements.forEach(element => {
        element.style.display = '';
      });
    } else {
      // Mostrar mensaje de cuántos resultados se encontraron
      console.log('Se encontraron ' + foundCount + ' resultados para: "' + query + '"');
    }
  }
  
  // Evento al presionar Enter
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  });
  
  // Evento al hacer clic en el icono de búsqueda
  searchIcon.addEventListener('click', function() {
    performSearch();
  });
  
  // Limpiar búsqueda al borrar el input
  searchInput.addEventListener('input', function() {
    if (searchInput.value === '') {
      // Mostrar todos los elementos
      const allCards = document.querySelectorAll('.news-card, .resource-card, .category-card, .pregrado-item, .event-card, .opportunity-card, .oportunidad-card');
      allCards.forEach(card => {
        card.style.display = '';
      });
    }
  });
});

// Agregar animación CSS para resaltar elementos encontrados
const style = document.createElement('style');
style.textContent = `
  @keyframes highlight {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); box-shadow: 0 8px 24px rgba(13, 103, 165, 0.3); }
    100% { transform: scale(1); }
  }
`;
document.head.appendChild(style);