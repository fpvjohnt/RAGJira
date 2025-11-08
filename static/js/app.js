// Main application JavaScript - Instacart Style
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const buttonText = searchButton.querySelector('.button-text');
    const buttonLoader = searchButton.querySelector('.button-loader');
    const resultsSection = document.getElementById('resultsSection');
    const emptyState = document.getElementById('emptyState');
    const aiAnswer = document.getElementById('aiAnswer');
    const ticketsList = document.getElementById('ticketsList');
    const ticketCount = document.getElementById('ticketCount');
    const suggestionPills = document.querySelectorAll('.suggestion-pill');

    // Stats elements
    const totalTickets = document.getElementById('totalTickets');
    const indexedTickets = document.getElementById('indexedTickets');
    const systemStatus = document.getElementById('systemStatus');

    // Load stats and categories on page load
    loadStats();
    loadCategories();

    // Handle form submission
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            await performSearch(query);
        }
    });

    // Handle suggestion pills
    suggestionPills.forEach(pill => {
        pill.addEventListener('click', function() {
            const query = this.getAttribute('data-query');
            searchInput.value = query;
            performSearch(query);
        });
    });

    // Load statistics
    async function loadStats() {
        try {
            const [statsResponse, healthResponse] = await Promise.all([
                fetch('/api/stats'),
                fetch('/api/health')
            ]);

            const data = await statsResponse.json();
            const healthData = await healthResponse.json();

            if (data.total_tickets) {
                totalTickets.textContent = data.total_tickets.toLocaleString();
            }
            if (data.indexed_tickets) {
                indexedTickets.textContent = data.indexed_tickets.toLocaleString();
            }

            if (healthData.models_loaded) {
                systemStatus.textContent = 'Ready';
                systemStatus.className = 'stat-value status-ok';
            } else {
                systemStatus.textContent = 'Loading...';
                systemStatus.className = 'stat-value';
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            systemStatus.textContent = 'Error';
            systemStatus.style.color = 'var(--status-blocked)';
        }
    }

    // Load categories
    async function loadCategories() {
        try {
            const response = await fetch('/api/categories');
            const categories = await response.json();

            const categoryList = document.querySelector('.category-list');
            categoryList.innerHTML = '';

            Object.entries(categories).forEach(([name, data]) => {
                const categoryItem = document.createElement('button');
                categoryItem.className = 'category-item';
                if (name === 'All Tickets') {
                    categoryItem.classList.add('active');
                }
                categoryItem.innerHTML = `
                    <span class="category-icon">${data.icon}</span>
                    <span>${name}</span>
                    <span class="category-count">${data.count}</span>
                `;
                categoryItem.addEventListener('click', () => handleCategoryClick(name, categoryItem));
                categoryList.appendChild(categoryItem);
            });
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    // Handle category clicks
    function handleCategoryClick(categoryName, clickedElement) {
        // Update active state
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        clickedElement.classList.add('active');

        // Perform search based on category
        if (categoryName !== 'All Tickets') {
            searchInput.value = categoryName;
            performSearch(categoryName);
        }
    }

    // Perform search
    async function performSearch(query) {
        setLoadingState(true);
        hideResults();

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, top_k: 5 })
            });

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json();
            displayResults(data);
        } catch (error) {
            console.error('Search error:', error);
            showError('Failed to search. Please try again.');
        } finally {
            setLoadingState(false);
        }
    }

    // Display search results
    function displayResults(data) {
        emptyState.style.display = 'none';
        resultsSection.style.display = 'block';

        // Display AI answer
        aiAnswer.textContent = data.answer;

        // Display ticket count
        ticketCount.textContent = `${data.count} ticket${data.count !== 1 ? 's' : ''}`;

        // Display tickets
        ticketsList.innerHTML = '';
        data.tickets.forEach((ticket, index) => {
            const ticketElement = createTicketElement(ticket, index);
            ticketsList.appendChild(ticketElement);
        });

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Create ticket element with all fields
    function createTicketElement(ticket, index) {
        const div = document.createElement('div');
        div.className = 'ticket-item';
        div.style.animationDelay = `${index * 0.1}s`;

        // Determine status class
        const status = ticket.status.toLowerCase().replace(/\s+/g, '-');
        let statusClass = '';
        if (status.includes('open') || status.includes('new')) {
            statusClass = 'open';
        } else if (status.includes('closed')) {
            statusClass = 'closed';
        } else if (status.includes('progress') || status.includes('verify')) {
            statusClass = 'in-progress';
        } else if (status.includes('blocked')) {
            statusClass = 'blocked';
        }

        // Determine priority class
        const priority = ticket.priority;
        let priorityClass = 'priority-medium';
        if (priority && priority.toLowerCase().includes('high')) {
            priorityClass = 'priority-high';
        } else if (priority && priority.toLowerCase().includes('low')) {
            priorityClass = 'priority-low';
        }

        // Calculate similarity percentage
        const similarityPercent = Math.round(ticket.similarity * 100);

        // Helper function to check if value is valid
        const isValid = (value) => {
            return value && value !== 'N/A' && value !== 'nan' && value !== 'null';
        };

        // Build metadata fields (only show if valid)
        let metaFields = '';
        if (isValid(ticket.store_number)) {
            metaFields += `
                <div class="ticket-meta-item">
                    <div class="meta-label">Store Number</div>
                    <div class="meta-value">${escapeHtml(ticket.store_number)}</div>
                </div>
            `;
        }
        if (isValid(ticket.assignee)) {
            metaFields += `
                <div class="ticket-meta-item">
                    <div class="meta-label">Assigned To</div>
                    <div class="meta-value">${escapeHtml(ticket.assignee)}</div>
                </div>
            `;
        }
        if (isValid(ticket.reporter)) {
            metaFields += `
                <div class="ticket-meta-item">
                    <div class="meta-label">Reporter</div>
                    <div class="meta-value">${escapeHtml(ticket.reporter)}</div>
                </div>
            `;
        }
        if (isValid(ticket.created)) {
            metaFields += `
                <div class="ticket-meta-item">
                    <div class="meta-label">Created</div>
                    <div class="meta-value">${formatDate(ticket.created)}</div>
                </div>
            `;
        }
        if (isValid(ticket.updated)) {
            metaFields += `
                <div class="ticket-meta-item">
                    <div class="meta-label">Updated</div>
                    <div class="meta-value">${formatDate(ticket.updated)}</div>
                </div>
            `;
        }

        // Build expandable metadata fields
        let expandableFields = '';
        if (isValid(ticket.blocked_status)) {
            expandableFields += `
                <div class="ticket-meta-item">
                    <div class="meta-label">Blocked Status</div>
                    <div class="meta-value">${escapeHtml(ticket.blocked_status)}</div>
                </div>
            `;
        }
        if (isValid(ticket.request_status)) {
            expandableFields += `
                <div class="ticket-meta-item">
                    <div class="meta-label">Request Status</div>
                    <div class="meta-value">${escapeHtml(ticket.request_status)}</div>
                </div>
            `;
        }
        if (isValid(ticket.epic_link)) {
            expandableFields += `
                <div class="ticket-meta-item">
                    <div class="meta-label">Epic Link</div>
                    <div class="meta-value">${escapeHtml(ticket.epic_link)}</div>
                </div>
            `;
        }

        // Build description section
        const description = ticket.description || ticket.text || '';
        const descriptionSection = isValid(description) ? `
            <div class="ticket-section">
                <div class="section-title">Description</div>
                <div class="section-content">${escapeHtml(description)}</div>
            </div>
        ` : '';

        // Build last comment section
        const lastComment = ticket.last_comment || '';
        const commentSection = isValid(lastComment) ? `
            <div class="ticket-section">
                <div class="section-title">Latest Comment / Resolution</div>
                <div class="last-comment-box">
                    <div class="section-content">${escapeHtml(lastComment)}</div>
                </div>
            </div>
        ` : '';

        div.innerHTML = `
            <div class="ticket-header-section">
                <div class="ticket-top-row">
                    <div class="ticket-id-group">
                        <span class="ticket-id">${escapeHtml(ticket.ticket_id)}</span>
                    </div>
                    <div class="ticket-badges">
                        <span class="ticket-status ${statusClass}">${escapeHtml(ticket.status)}</span>
                        ${isValid(ticket.priority) ?
                            `<span class="priority-badge ${priorityClass}">${escapeHtml(ticket.priority)}</span>` : ''}
                        ${isValid(ticket.business_priority) ?
                            `<span class="priority-badge ${priorityClass}">${escapeHtml(ticket.business_priority)}</span>` : ''}
                    </div>
                </div>
                <div class="ticket-summary">${escapeHtml(ticket.summary)}</div>
            </div>

            <div class="ticket-body-section">
                ${metaFields ? `<div class="ticket-meta-grid">${metaFields}</div>` : ''}

                ${descriptionSection}
                ${commentSection}

                ${expandableFields ? `
                    <div class="ticket-expandable-section" style="display: none;">
                        <div class="ticket-meta-grid">${expandableFields}</div>
                    </div>
                ` : ''}

                ${expandableFields ? `
                    <button class="expand-button" onclick="toggleExpand(this)">
                        <span class="expand-icon">▼</span>
                        <span class="expand-text">Show More Details</span>
                    </button>
                ` : ''}

                <div class="ticket-similarity">
                    <span class="similarity-label">Match Score</span>
                    <div class="similarity-bar">
                        <div class="similarity-fill" style="width: ${similarityPercent}%"></div>
                    </div>
                    <span class="similarity-percent">${similarityPercent}%</span>
                </div>
            </div>
        `;

        return div;
    }

    // Toggle expand/collapse for ticket details
    window.toggleExpand = function(button) {
        const ticketItem = button.closest('.ticket-item');
        const expandableSection = ticketItem.querySelector('.ticket-expandable-section');
        const expandIcon = button.querySelector('.expand-icon');
        const expandText = button.querySelector('.expand-text');

        if (expandableSection.style.display === 'none') {
            expandableSection.style.display = 'block';
            expandIcon.textContent = '▲';
            expandText.textContent = 'Show Less Details';
        } else {
            expandableSection.style.display = 'none';
            expandIcon.textContent = '▼';
            expandText.textContent = 'Show More Details';
        }
    };

    // Set loading state
    function setLoadingState(loading) {
        if (loading) {
            searchButton.disabled = true;
            buttonText.style.display = 'none';
            buttonLoader.style.display = 'block';
        } else {
            searchButton.disabled = false;
            buttonText.style.display = 'block';
            buttonLoader.style.display = 'none';
        }
    }

    // Hide results
    function hideResults() {
        resultsSection.style.display = 'none';
    }

    // Show error message
    function showError(message) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <div class="empty-state-icon">⚠️</div>
            <h3>Error</h3>
            <p>${escapeHtml(message)}</p>
        `;
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Format date
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    // Focus search input on load
    searchInput.focus();
});
