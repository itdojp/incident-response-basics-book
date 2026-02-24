/**
 * Search functionality
 */

(function() {
    'use strict';
    
    let searchInput;
    let searchResults;
    let searchIndex = [];
    let searchTimeout;
    
    // Initialize elements
    function initElements() {
        searchInput = document.getElementById('search-input');
        searchResults = document.getElementById('search-results');
    }
    
    // Build search index from page content
    function buildSearchIndex() {
        // In a real implementation, this would be generated at build time
        // For now, we'll create a simple index from current page
        const content = document.querySelector('.page-content');
        if (!content) return;
        
        // Get all headings and paragraphs
        const elements = content.querySelectorAll('h1, h2, h3, h4, h5, h6, p');
        
        elements.forEach((el, index) => {
            const text = el.textContent.trim();
            if (text) {
                searchIndex.push({
                    id: `search-result-${index}`,
                    title: el.tagName.startsWith('H') ? text : text.substring(0, 50) + '...',
                    content: text,
                    element: el,
                    type: el.tagName.toLowerCase()
                });
            }
        });
    }
    
    // Perform search
    function performSearch(query) {
        if (!query || query.length < 2) {
            hideResults();
            return;
        }
        
        const results = searchIndex.filter(item => {
            const searchText = `${item.title} ${item.content}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
        });
        
        displayResults(results, query);
    }
    
    // Display search results
    function displayResults(results, query) {
        if (!searchResults) return;
        
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="search-no-results">
                    <p>「${escapeHtml(query)}」に一致する結果が見つかりませんでした。</p>
                </div>
            `;
        } else {
            const resultsHtml = results.slice(0, 10).map(result => {
                const highlightedTitle = highlightText(result.title, query);
                const snippet = getSnippet(result.content, query);
                const highlightedSnippet = highlightText(snippet, query);
                
                return `
                    <button type="button" class="search-result-item" data-id="${result.id}">
                        <div class="search-result-title">${highlightedTitle}</div>
                        <div class="search-result-snippet">${highlightedSnippet}</div>
                    </button>
                `;
            }).join('');
            
            searchResults.innerHTML = `
                <div class="search-results-list">
                    ${resultsHtml}
                </div>
                ${results.length > 10 ? `<div class="search-more">他 ${results.length - 10} 件の結果</div>` : ''}
            `;
        }
        
        showResults();
    }
    
    // Get snippet around query
    function getSnippet(text, query) {
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return text.substring(0, 150) + '...';
        
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + query.length + 100);
        
        let snippet = text.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        return snippet;
    }
    
    // Highlight search term in text
    function highlightText(text, query) {
        const q = String(query || '').trim();
        const source = String(text || '');
        if (!q) return escapeHtml(source);

        const regex = new RegExp(escapeRegex(q), 'gi');
        let out = '';
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(source)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            out += escapeHtml(source.slice(lastIndex, start));
            out += '<mark>' + escapeHtml(source.slice(start, end)) + '</mark>';
            lastIndex = end;

            // Avoid infinite loops on zero-length matches.
            if (match[0].length === 0) {
                regex.lastIndex++;
            }
        }

        out += escapeHtml(source.slice(lastIndex));
        return out;
    }
    
    // Show search results
    function showResults() {
        if (searchResults) {
            searchResults.classList.add('active');
        }
    }
    
    // Hide search results
    function hideResults() {
        if (searchResults) {
            searchResults.classList.remove('active');
        }
    }
    
    // Handle search result click
    function handleResultClick(e) {
        const resultItem = e.target.closest('.search-result-item');
        if (!resultItem) return;
        
        const id = resultItem.dataset.id;
        const result = searchIndex.find(item => item.id === id);
        
        if (result && result.element) {
            hideResults();
            searchInput.value = '';
            result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight the element temporarily
            result.element.classList.add('search-highlight');
            setTimeout(() => {
                result.element.classList.remove('search-highlight');
            }, 2000);
        }
    }
    
    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Escape regex
    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // Initialize search
    function initSearch() {
        initElements();
        
        if (!searchInput || !searchResults) return;
        
        // Build initial search index
        buildSearchIndex();
        
        // Search input handler
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(e.target.value.trim());
            }, 300);
        });
        
        // Focus/blur handlers
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) {
                showResults();
            }
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                hideResults();
            }
        });
        
        // Handle result clicks
        searchResults.addEventListener('click', handleResultClick);
        
        // Handle escape key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideResults();
                searchInput.blur();
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSearch);
    } else {
        initSearch();
    }
})();
