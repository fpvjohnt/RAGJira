// Main application JavaScript - Instacart Style with Sidebar
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

    // Sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');

    // Handle sidebar navigation
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Get the page data
            const page = this.getAttribute('data-page');

            // Handle different pages
            switch(page) {
                case 'home':
                    showHomePage();
                    break;
                case 'charts':
                    showChartsPage();
                    break;
                case 'settings':
                    showSettingsPage();
                    break;
            }
        });
    });

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

            // Check if responses are OK
            if (!statsResponse.ok || !healthResponse.ok) {
                throw new Error('Server returned error status');
            }

            const data = await statsResponse.json();
            const healthData = await healthResponse.json();

            // Check if data contains error
            if (data.error) {
                throw new Error(data.error);
            }

            // Update total tickets
            if (data.total_tickets !== undefined) {
                totalTickets.textContent = data.total_tickets.toLocaleString();
            } else {
                totalTickets.textContent = '0';
            }

            // Update indexed tickets
            if (data.indexed_tickets !== undefined) {
                indexedTickets.textContent = data.indexed_tickets.toLocaleString();
            } else {
                indexedTickets.textContent = '0';
            }

            // Update system status
            if (healthData.models_loaded) {
                systemStatus.textContent = 'Ready';
                systemStatus.className = 'stat-value status-ok';
            } else {
                systemStatus.textContent = 'Loading...';
                systemStatus.className = 'stat-value';
            }
        } catch (error) {
            console.error('Error loading stats:', error);

            // Update UI to show error state
            totalTickets.textContent = 'N/A';
            indexedTickets.textContent = 'N/A';
            systemStatus.textContent = 'Error';
            systemStatus.className = 'stat-value';
            systemStatus.style.color = '#ff3b30';

            // Show user-friendly error message
            console.log('Could not load statistics. Make sure the server is running and models are loaded.');
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

    // Create ticket element in folder style
    function createTicketElement(ticket, index) {
        const div = document.createElement('div');
        div.className = 'ticket-folder';
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

        // Calculate similarity percentage
        const similarityPercent = Math.round(ticket.similarity * 100);

        // Helper function to check if value is valid
        const isValid = (value) => {
            return value && value !== 'N/A' && value !== 'nan' && value !== 'null';
        };

        // Get key fields
        const ticketNumber = ticket.ticket_id || 'N/A';
        const subject = ticket.summary || 'No subject';
        const requestor = ticket.reporter || 'Unknown';
        const updated = isValid(ticket.updated) ? formatDate(ticket.updated) : 'N/A';
        const group = ticket.epic_link || ticket.request_status || 'Unassigned';
        const assignee = ticket.assignee || 'Unassigned';

        // Build description section (expandable)
        const description = ticket.description || ticket.text || '';
        const lastComment = ticket.last_comment || '';

        div.innerHTML = `
            <div class="folder-preview" onclick="toggleFolderExpand(this)">
                <div class="folder-tab">
                    <span class="folder-icon">📁</span>
                    <span class="folder-label">${escapeHtml(ticketNumber)} - ${escapeHtml(subject)}</span>
                    <span class="ticket-status ${statusClass}">${escapeHtml(ticket.status)}</span>
                </div>
            </div>
            <div class="folder-details" style="display: none;">
                <div class="folder-details-content">
                    <div class="detail-section">
                        <div class="detail-title">🎫 Ticket Information</div>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Ticket:</span>
                                <span class="detail-value ticket-number">${escapeHtml(ticketNumber)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Requestor:</span>
                                <span class="detail-value">${escapeHtml(requestor)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Assignee:</span>
                                <span class="detail-value">${escapeHtml(assignee)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Group:</span>
                                <span class="detail-value">${escapeHtml(group)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Updated:</span>
                                <span class="detail-value">${updated}</span>
                            </div>
                            ${isValid(ticket.created) ? `
                                <div class="detail-item">
                                    <span class="detail-label">Created:</span>
                                    <span class="detail-value">${formatDate(ticket.created)}</span>
                                </div>
                            ` : ''}
                            ${isValid(ticket.priority) ? `
                                <div class="detail-item">
                                    <span class="detail-label">Priority:</span>
                                    <span class="detail-value">${escapeHtml(ticket.priority)}</span>
                                </div>
                            ` : ''}
                            ${isValid(ticket.store_number) ? `
                                <div class="detail-item">
                                    <span class="detail-label">Store:</span>
                                    <span class="detail-value">${escapeHtml(ticket.store_number)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="detail-section">
                        <div class="detail-title">📋 Subject</div>
                        <div class="detail-text">${escapeHtml(subject)}</div>
                    </div>

                    ${isValid(description) ? `
                        <div class="detail-section">
                            <div class="detail-title">📝 Description</div>
                            <div class="detail-text">${escapeHtml(description)}</div>
                        </div>
                    ` : ''}

                    ${isValid(lastComment) ? `
                        <div class="detail-section">
                            <div class="detail-title">💬 Latest Comment / Resolution</div>
                            <div class="detail-text comment-highlight">${escapeHtml(lastComment)}</div>
                        </div>
                    ` : ''}

                    <div class="detail-similarity">
                        <span class="similarity-label">Match Score</span>
                        <div class="similarity-bar">
                            <div class="similarity-fill" style="width: ${similarityPercent}%"></div>
                        </div>
                        <span class="similarity-percent">${similarityPercent}%</span>
                    </div>
                </div>
            </div>
        `;

        return div;
    }

    // Toggle folder expansion
    window.toggleFolderExpand = function(folderPreview) {
        const folder = folderPreview.closest('.ticket-folder');
        const details = folder.querySelector('.folder-details');
        const folderIcon = folderPreview.querySelector('.folder-icon');

        if (details.style.display === 'none') {
            details.style.display = 'block';
            folderIcon.textContent = '📂'; // Open folder icon
            folder.classList.add('expanded');
        } else {
            details.style.display = 'none';
            folderIcon.textContent = '📁'; // Closed folder icon
            folder.classList.remove('expanded');
        }
    };

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

    // Show home page
    function showHomePage() {
        const mainContent = document.querySelector('.main-content');

        // Restore the original home page content
        mainContent.innerHTML = `
            <!-- Search Section -->
            <section class="search-section">
                <div class="search-container">
                    <div class="search-header">
                        <h2>Find Similar Tickets</h2>
                        <p class="search-subtitle">Search through your Jira tickets using natural language or keywords</p>
                    </div>

                    <form id="searchForm" class="search-form">
                        <div class="search-input-group">
                            <input
                                type="text"
                                id="searchInput"
                                class="search-input"
                                placeholder="e.g., Camera replacement issues at store 137"
                                autocomplete="off"
                            >
                            <button type="submit" class="search-button" id="searchButton">
                                <span class="button-text">Search</span>
                                <span class="button-loader" style="display: none;">
                                    <span class="loader"></span>
                                </span>
                            </button>
                        </div>

                        <div class="search-suggestions">
                            <span class="suggestion-label">Quick Search:</span>
                            <button type="button" class="suggestion-pill" data-query="Camera issues and replacements">📹 Camera Issues</button>
                            <button type="button" class="suggestion-pill" data-query="Door access control problems">🚪 Door Access</button>
                            <button type="button" class="suggestion-pill" data-query="Network and connectivity issues">🌐 Network Issues</button>
                            <button type="button" class="suggestion-pill" data-query="Hardware failures">🔧 Hardware Problems</button>
                        </div>
                    </form>
                </div>
            </section>

            <!-- Results Section -->
            <section class="results-section" id="resultsSection" style="display: none;">
                <!-- AI Answer -->
                <div class="answer-card">
                    <div class="card-header">
                        <h3>🤖 AI Summary</h3>
                    </div>
                    <div class="card-body">
                        <p id="aiAnswer" class="ai-answer-text"></p>
                    </div>
                </div>

                <!-- Similar Tickets -->
                <div class="tickets-card">
                    <div class="card-header">
                        <h3>📋 Similar Tickets</h3>
                        <span class="ticket-count" id="ticketCount">0 tickets</span>
                    </div>
                    <div class="card-body">
                        <div id="ticketsList" class="tickets-list"></div>
                    </div>
                </div>
            </section>

            <!-- Empty State -->
            <section class="empty-state" id="emptyState">
                <div class="empty-state-icon">🔍</div>
                <h3>Start Searching</h3>
                <p>Enter a question or issue description above to find relevant tickets and get AI-powered insights</p>
            </section>
        `;

        // Re-attach event listeners for the home page
        reattachHomePageListeners();
    }

    // Re-attach event listeners for home page elements
    function reattachHomePageListeners() {
        const searchForm = document.getElementById('searchForm');
        const searchInput = document.getElementById('searchInput');
        const suggestionPills = document.querySelectorAll('.suggestion-pill');

        if (searchForm) {
            searchForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    await performSearch(query);
                }
            });
        }

        if (suggestionPills) {
            suggestionPills.forEach(pill => {
                pill.addEventListener('click', function() {
                    const query = this.getAttribute('data-query');
                    searchInput.value = query;
                    performSearch(query);
                });
            });
        }

        if (searchInput) {
            searchInput.focus();
        }
    }

    // Load and display charts page
    async function showChartsPage() {
        const mainContent = document.querySelector('.main-content');

        // Show loading state
        mainContent.innerHTML = `
            <div class="charts-loading">
                <div class="loader"></div>
                <p>Loading analytics...</p>
            </div>
        `;

        try {
            const response = await fetch('/api/charts/data');
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Build charts HTML
            mainContent.innerHTML = `
                <div class="charts-container">
                    <div class="charts-header">
                        <h2>📊 Analytics Dashboard</h2>
                        <p class="charts-subtitle">Ticket statistics and insights</p>
                    </div>

                    <!-- Summary Cards -->
                    <div class="dashboard-stats">
                        <div class="dashboard-stat-card">
                            <div class="dashboard-stat-icon">🎫</div>
                            <div class="dashboard-stat-content">
                                <div class="dashboard-stat-value">${data.total_tickets}</div>
                                <div class="dashboard-stat-label">Total Tickets</div>
                            </div>
                        </div>
                        <div class="dashboard-stat-card clickable" onclick="showStatusModal(${JSON.stringify(data.status_distribution).replace(/"/g, '&quot;')})">
                            <div class="dashboard-stat-icon">✅</div>
                            <div class="dashboard-stat-content">
                                <div class="dashboard-stat-value">${Object.keys(data.status_distribution).length}</div>
                                <div class="dashboard-stat-label">Status Types</div>
                                <div class="card-hint">Click to view details</div>
                            </div>
                        </div>
                        <div class="dashboard-stat-card clickable" onclick="showAssigneesModal(${JSON.stringify(data.assignee_distribution).replace(/"/g, '&quot;')})">
                            <div class="dashboard-stat-icon">👥</div>
                            <div class="dashboard-stat-content">
                                <div class="dashboard-stat-value">${Object.keys(data.assignee_distribution).length}</div>
                                <div class="dashboard-stat-label">Active Assignees</div>
                                <div class="card-hint">Click to view details</div>
                            </div>
                        </div>
                        <div class="dashboard-stat-card clickable" onclick="showCategoriesModal(${JSON.stringify(data.category_distribution).replace(/"/g, '&quot;')})">
                            <div class="dashboard-stat-icon">📂</div>
                            <div class="dashboard-stat-content">
                                <div class="dashboard-stat-value">${Object.keys(data.category_distribution).length}</div>
                                <div class="dashboard-stat-label">Categories</div>
                                <div class="card-hint">Click to view details</div>
                            </div>
                        </div>
                    </div>

                    <!-- Charts Grid -->
                    <div class="charts-grid">
                        <!-- Status Distribution -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h3>📈 Status Distribution</h3>
                            </div>
                            <div class="chart-card-body">
                                ${createBarChart(data.status_distribution, 'status')}
                            </div>
                        </div>

                        <!-- Category Distribution -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h3>📂 Category Distribution</h3>
                            </div>
                            <div class="chart-card-body">
                                ${createBarChart(data.category_distribution, 'category')}
                            </div>
                        </div>

                        <!-- Priority Distribution -->
                        ${Object.keys(data.priority_distribution).length > 0 ? `
                            <div class="chart-card">
                                <div class="chart-card-header">
                                    <h3>⚡ Priority Distribution</h3>
                                </div>
                                <div class="chart-card-body">
                                    ${createBarChart(data.priority_distribution, 'priority')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Top Assignees -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h3>👥 Top Assignees</h3>
                            </div>
                            <div class="chart-card-body">
                                ${createBarChart(data.assignee_distribution, 'assignee')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading charts:', error);
            mainContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <h3>Error Loading Analytics</h3>
                    <p>Could not load chart data. Please try again later.</p>
                </div>
            `;
        }
    }

    // Create bar chart visualization
    function createBarChart(data, type) {
        if (!data || Object.keys(data).length === 0) {
            return '<div class="chart-no-data">No data available</div>';
        }

        const maxValue = Math.max(...Object.values(data));
        const colorMap = {
            'status': {
                'Closed': '#34c759',
                'Open': '#ff9500',
                'In Progress': '#007aff',
                'Verify': '#007aff'
            },
            'priority': {
                'High': '#ff3b30',
                'Medium': '#ff9500',
                'Low': '#34c759'
            },
            'category': {
                'Camera': '#007aff',
                'Door/Access': '#34c759',
                'Network': '#ff9500',
                'Hardware': '#ff3b30'
            }
        };

        const bars = Object.entries(data)
            .sort((a, b) => b[1] - a[1])
            .map(([label, value]) => {
                const percentage = (value / maxValue) * 100;
                const color = colorMap[type]?.[label] || '#0aad0a';

                return `
                    <div class="chart-bar-item">
                        <div class="chart-bar-label">${escapeHtml(label)}</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar-fill" style="width: ${percentage}%; background-color: ${color}"></div>
                            <span class="chart-bar-value">${value}</span>
                        </div>
                    </div>
                `;
            }).join('');

        return `<div class="chart-bars">${bars}</div>`;
    }

    // Show assignees modal
    window.showAssigneesModal = function(assigneeData) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('assigneesModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'assigneesModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // Sort assignees by ticket count
        const sortedAssignees = Object.entries(assigneeData)
            .sort((a, b) => b[1] - a[1]);

        const totalTickets = sortedAssignees.reduce((sum, [_, count]) => sum + count, 0);

        // Build modal content
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeAssigneesModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>👥 Active Assignees</h3>
                    <button class="modal-close" onclick="closeAssigneesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="assignees-summary">
                        <div class="summary-stat">
                            <span class="summary-label">Total Assignees</span>
                            <span class="summary-value">${sortedAssignees.length}</span>
                        </div>
                        <div class="summary-stat">
                            <span class="summary-label">Total Tickets</span>
                            <span class="summary-value">${totalTickets}</span>
                        </div>
                    </div>
                    <div class="assignees-list">
                        ${sortedAssignees.map(([name, count], index) => {
                            const percentage = ((count / totalTickets) * 100).toFixed(1);
                            return `
                                <div class="assignee-item">
                                    <div class="assignee-rank">#${index + 1}</div>
                                    <div class="assignee-info">
                                        <div class="assignee-name">${escapeHtml(name)}</div>
                                        <div class="assignee-stats">
                                            <span class="assignee-count">${count} ticket${count !== 1 ? 's' : ''}</span>
                                            <span class="assignee-percentage">(${percentage}%)</span>
                                        </div>
                                        <div class="assignee-bar-container">
                                            <div class="assignee-bar" style="width: ${percentage}%"></div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        // Show modal with animation
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    };

    // Close assignees modal
    window.closeAssigneesModal = function() {
        const modal = document.getElementById('assigneesModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    };

    // Show status modal
    window.showStatusModal = function(statusData) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('statusModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'statusModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // Sort statuses by ticket count
        const sortedStatuses = Object.entries(statusData)
            .sort((a, b) => b[1] - a[1]);

        const totalTickets = sortedStatuses.reduce((sum, [_, count]) => sum + count, 0);

        // Status color mapping
        const statusColors = {
            'Closed': '#34c759',
            'Open': '#ff9500',
            'In Progress': '#007aff',
            'Verify': '#007aff',
            'Blocked': '#ff3b30'
        };

        // Build modal content
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeStatusModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✅ Status Types</h3>
                    <button class="modal-close" onclick="closeStatusModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="assignees-summary">
                        <div class="summary-stat">
                            <span class="summary-label">Total Status Types</span>
                            <span class="summary-value">${sortedStatuses.length}</span>
                        </div>
                        <div class="summary-stat">
                            <span class="summary-label">Total Tickets</span>
                            <span class="summary-value">${totalTickets}</span>
                        </div>
                    </div>
                    <div class="assignees-list">
                        ${sortedStatuses.map(([status, count], index) => {
                            const percentage = ((count / totalTickets) * 100).toFixed(1);
                            const color = statusColors[status] || '#0aad0a';
                            return `
                                <div class="assignee-item">
                                    <div class="assignee-rank" style="background: ${color};">#${index + 1}</div>
                                    <div class="assignee-info">
                                        <div class="assignee-name">${escapeHtml(status)}</div>
                                        <div class="assignee-stats">
                                            <span class="assignee-count">${count} ticket${count !== 1 ? 's' : ''}</span>
                                            <span class="assignee-percentage">(${percentage}%)</span>
                                        </div>
                                        <div class="assignee-bar-container">
                                            <div class="assignee-bar" style="width: ${percentage}%; background: ${color};"></div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        // Show modal with animation
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    };

    // Close status modal
    window.closeStatusModal = function() {
        const modal = document.getElementById('statusModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    };

    // Show categories modal
    window.showCategoriesModal = function(categoryData) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('categoriesModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'categoriesModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // Sort categories by ticket count
        const sortedCategories = Object.entries(categoryData)
            .sort((a, b) => b[1] - a[1]);

        const totalTickets = sortedCategories.reduce((sum, [_, count]) => sum + count, 0);

        // Category color mapping
        const categoryColors = {
            'Camera': '#007aff',
            'Door/Access': '#34c759',
            'Network': '#ff9500',
            'Hardware': '#ff3b30'
        };

        // Category icons
        const categoryIcons = {
            'Camera': '📹',
            'Door/Access': '🚪',
            'Network': '🌐',
            'Hardware': '🔧'
        };

        // Build modal content
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeCategoriesModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📂 Categories</h3>
                    <button class="modal-close" onclick="closeCategoriesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="assignees-summary">
                        <div class="summary-stat">
                            <span class="summary-label">Total Categories</span>
                            <span class="summary-value">${sortedCategories.length}</span>
                        </div>
                        <div class="summary-stat">
                            <span class="summary-label">Total Tickets</span>
                            <span class="summary-value">${totalTickets}</span>
                        </div>
                    </div>
                    <div class="assignees-list">
                        ${sortedCategories.map(([category, count]) => {
                            const percentage = ((count / totalTickets) * 100).toFixed(1);
                            const color = categoryColors[category] || '#0aad0a';
                            const icon = categoryIcons[category] || '📋';
                            return `
                                <div class="assignee-item">
                                    <div class="assignee-rank" style="background: ${color};">
                                        ${icon}
                                    </div>
                                    <div class="assignee-info">
                                        <div class="assignee-name">${escapeHtml(category)}</div>
                                        <div class="assignee-stats">
                                            <span class="assignee-count">${count} ticket${count !== 1 ? 's' : ''}</span>
                                            <span class="assignee-percentage">(${percentage}%)</span>
                                        </div>
                                        <div class="assignee-bar-container">
                                            <div class="assignee-bar" style="width: ${percentage}%; background: ${color};"></div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        // Show modal with animation
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    };

    // Close categories modal
    window.closeCategoriesModal = function() {
        const modal = document.getElementById('categoriesModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    };

    // Global variable to store all tickets data for filtering and sorting
    let allTicketsData = [];
    let currentSortColumn = null;
    let currentSortDirection = 'asc';
    let currentFilter = '';
    let currentPage = 1;
    const ticketsPerPage = 50;

    // Show all tickets modal
    window.showAllTicketsModal = async function() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('allTicketsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'allTicketsModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // Show loading state
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeAllTicketsModal()"></div>
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>🎫 All Tickets</h3>
                    <button class="modal-close" onclick="closeAllTicketsModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="charts-loading">
                        <div class="loader"></div>
                        <p>Loading all tickets...</p>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);

        try {
            const response = await fetch('/api/all-tickets');
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Store tickets data globally for filtering/sorting
            allTicketsData = data.tickets;
            currentFilter = '';
            currentPage = 1;

            // Render the modal with all controls
            renderAllTicketsModal(data.total);
        } catch (error) {
            console.error('Error loading all tickets:', error);
            modal.innerHTML = `
                <div class="modal-overlay" onclick="closeAllTicketsModal()"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🎫 All Tickets</h3>
                        <button class="modal-close" onclick="closeAllTicketsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="empty-state">
                            <div class="empty-state-icon">⚠️</div>
                            <h3>Error Loading Tickets</h3>
                            <p>Could not load ticket data. Please try again later.</p>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    // Render all tickets modal with current filter and sort
    function renderAllTicketsModal(totalCount) {
        const modal = document.getElementById('allTicketsModal');
        if (!modal) return;

        // Apply filter
        let filteredTickets = allTicketsData;
        if (currentFilter) {
            const filterLower = currentFilter.toLowerCase();
            filteredTickets = allTicketsData.filter(ticket => {
                return (
                    (ticket.ticket_id && ticket.ticket_id.toLowerCase().includes(filterLower)) ||
                    (ticket.summary && ticket.summary.toLowerCase().includes(filterLower)) ||
                    (ticket.assignee && ticket.assignee.toLowerCase().includes(filterLower)) ||
                    (ticket.priority && ticket.priority.toLowerCase().includes(filterLower)) ||
                    (ticket.store_number && ticket.store_number.toString().includes(filterLower)) ||
                    (ticket.status && ticket.status.toLowerCase().includes(filterLower))
                );
            });
        }

        // Apply sort
        if (currentSortColumn) {
            filteredTickets = [...filteredTickets].sort((a, b) => {
                let aVal = a[currentSortColumn] || '';
                let bVal = b[currentSortColumn] || '';

                // Handle numeric sorting for store_number
                if (currentSortColumn === 'store_number') {
                    aVal = parseInt(aVal) || 0;
                    bVal = parseInt(bVal) || 0;
                }

                if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // Group tickets by status
        const ticketsByStatus = {};
        filteredTickets.forEach(ticket => {
            const status = ticket.status || 'Unknown';
            if (!ticketsByStatus[status]) {
                ticketsByStatus[status] = [];
            }
            ticketsByStatus[status].push(ticket);
        });

        // Pagination
        const totalFiltered = filteredTickets.length;
        const totalPages = Math.ceil(totalFiltered / ticketsPerPage);
        const startIdx = (currentPage - 1) * ticketsPerPage;
        const endIdx = Math.min(startIdx + ticketsPerPage, totalFiltered);
        const paginatedTickets = filteredTickets.slice(startIdx, endIdx);

        // Regroup paginated tickets by status
        const paginatedByStatus = {};
        paginatedTickets.forEach(ticket => {
            const status = ticket.status || 'Unknown';
            if (!paginatedByStatus[status]) {
                paginatedByStatus[status] = [];
            }
            paginatedByStatus[status].push(ticket);
        });

        // Build modal content with grouped tickets
        const statusOrder = ['Open', 'In Progress', 'Verify', 'Closed', 'Blocked'];
        const sortedStatuses = Object.keys(paginatedByStatus).sort((a, b) => {
            const indexA = statusOrder.indexOf(a);
            const indexB = statusOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        // Get priority color
        const getPriorityClass = (priority) => {
            if (!priority) return '';
            const p = priority.toLowerCase();
            if (p.includes('high') || p.includes('critical')) return 'priority-high';
            if (p.includes('medium')) return 'priority-medium';
            if (p.includes('low')) return 'priority-low';
            return '';
        };

        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeAllTicketsModal()"></div>
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>🎫 All Tickets</h3>
                    <button class="modal-close" onclick="closeAllTicketsModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="tickets-toolbar">
                        <div class="toolbar-left">
                            <div class="search-filter-container">
                                <input
                                    type="text"
                                    id="ticketFilterInput"
                                    class="filter-input"
                                    placeholder="Filter tickets by ID, summary, assignee, priority, store..."
                                    value="${escapeHtml(currentFilter)}"
                                    oninput="filterAllTickets(this.value)"
                                >
                                <span class="filter-icon">🔍</span>
                            </div>
                            <div class="filter-stats">
                                Showing ${startIdx + 1}-${endIdx} of ${totalFiltered} tickets${currentFilter ? ' (filtered)' : ''}
                            </div>
                        </div>
                        <div class="toolbar-right">
                            <button class="export-button" onclick="exportTicketsToCSV()">
                                <span class="export-icon">📥</span> Export CSV
                            </button>
                        </div>
                    </div>

                    <div class="all-tickets-container">
                        ${sortedStatuses.map(status => {
                            const tickets = paginatedByStatus[status];
                            const statusClass = status.toLowerCase().replace(/\s+/g, '-');
                            const totalInStatus = ticketsByStatus[status] ? ticketsByStatus[status].length : 0;
                            return `
                                <div class="ticket-status-group">
                                    <div class="status-group-header">
                                        <h4 class="status-group-title ${statusClass}">${status}</h4>
                                        <span class="status-group-count">${totalInStatus} ticket${totalInStatus !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div class="tickets-table">
                                        <div class="ticket-header-row">
                                            <div class="ticket-header sortable ${currentSortColumn === 'ticket_id' ? 'sorted-' + currentSortDirection : ''}" onclick="sortAllTickets('ticket_id')">
                                                Ticket ID <span class="sort-indicator">${currentSortColumn === 'ticket_id' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '⇅'}</span>
                                            </div>
                                            <div class="ticket-header sortable ${currentSortColumn === 'summary' ? 'sorted-' + currentSortDirection : ''}" onclick="sortAllTickets('summary')">
                                                Summary <span class="sort-indicator">${currentSortColumn === 'summary' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '⇅'}</span>
                                            </div>
                                            <div class="ticket-header sortable ${currentSortColumn === 'assignee' ? 'sorted-' + currentSortDirection : ''}" onclick="sortAllTickets('assignee')">
                                                Assignee <span class="sort-indicator">${currentSortColumn === 'assignee' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '⇅'}</span>
                                            </div>
                                            <div class="ticket-header sortable ${currentSortColumn === 'priority' ? 'sorted-' + currentSortDirection : ''}" onclick="sortAllTickets('priority')">
                                                Priority <span class="sort-indicator">${currentSortColumn === 'priority' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '⇅'}</span>
                                            </div>
                                            <div class="ticket-header sortable ${currentSortColumn === 'store_number' ? 'sorted-' + currentSortDirection : ''}" onclick="sortAllTickets('store_number')">
                                                Store <span class="sort-indicator">${currentSortColumn === 'store_number' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '⇅'}</span>
                                            </div>
                                            <div class="ticket-header sortable ${currentSortColumn === 'updated' ? 'sorted-' + currentSortDirection : ''}" onclick="sortAllTickets('updated')">
                                                Updated <span class="sort-indicator">${currentSortColumn === 'updated' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '⇅'}</span>
                                            </div>
                                        </div>
                                        ${tickets.map((ticket, idx) => {
                                            const priorityClass = getPriorityClass(ticket.priority);
                                            return `
                                                <div class="ticket-row clickable" onclick="showTicketDetails(${startIdx + paginatedTickets.indexOf(ticket)})">
                                                    <div class="ticket-cell ticket-id">${escapeHtml(ticket.ticket_id)}</div>
                                                    <div class="ticket-cell ticket-summary">${escapeHtml(ticket.summary)}</div>
                                                    <div class="ticket-cell">${ticket.assignee ? escapeHtml(ticket.assignee) : '<span class="text-muted">Unassigned</span>'}</div>
                                                    <div class="ticket-cell ${priorityClass}">${ticket.priority ? escapeHtml(ticket.priority) : '<span class="text-muted">-</span>'}</div>
                                                    <div class="ticket-cell">${ticket.store_number ? escapeHtml(ticket.store_number) : '<span class="text-muted">-</span>'}</div>
                                                    <div class="ticket-cell ticket-date">${ticket.updated ? formatDateShort(ticket.updated) : '<span class="text-muted">-</span>'}</div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    ${totalPages > 1 ? `
                        <div class="pagination">
                            <button
                                class="pagination-btn"
                                onclick="goToPage(${currentPage - 1})"
                                ${currentPage === 1 ? 'disabled' : ''}
                            >← Previous</button>
                            <div class="pagination-info">
                                Page ${currentPage} of ${totalPages}
                            </div>
                            <button
                                class="pagination-btn"
                                onclick="goToPage(${currentPage + 1})"
                                ${currentPage === totalPages ? 'disabled' : ''}
                            >Next →</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Filter tickets
    window.filterAllTickets = function(filterText) {
        currentFilter = filterText;
        currentPage = 1; // Reset to first page
        renderAllTicketsModal(allTicketsData.length);
    };

    // Sort tickets
    window.sortAllTickets = function(column) {
        if (currentSortColumn === column) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = column;
            currentSortDirection = 'asc';
        }
        renderAllTicketsModal(allTicketsData.length);
    };

    // Pagination
    window.goToPage = function(page) {
        const filteredTickets = currentFilter
            ? allTicketsData.filter(ticket => {
                const filterLower = currentFilter.toLowerCase();
                return (
                    (ticket.ticket_id && ticket.ticket_id.toLowerCase().includes(filterLower)) ||
                    (ticket.summary && ticket.summary.toLowerCase().includes(filterLower)) ||
                    (ticket.assignee && ticket.assignee.toLowerCase().includes(filterLower)) ||
                    (ticket.priority && ticket.priority.toLowerCase().includes(filterLower)) ||
                    (ticket.store_number && ticket.store_number.toString().includes(filterLower)) ||
                    (ticket.status && ticket.status.toLowerCase().includes(filterLower))
                );
            })
            : allTicketsData;

        const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            renderAllTicketsModal(allTicketsData.length);
        }
    };

    // Export to CSV
    window.exportTicketsToCSV = function() {
        // Use filtered data if filter is active
        let exportData = currentFilter
            ? allTicketsData.filter(ticket => {
                const filterLower = currentFilter.toLowerCase();
                return (
                    (ticket.ticket_id && ticket.ticket_id.toLowerCase().includes(filterLower)) ||
                    (ticket.summary && ticket.summary.toLowerCase().includes(filterLower)) ||
                    (ticket.assignee && ticket.assignee.toLowerCase().includes(filterLower)) ||
                    (ticket.priority && ticket.priority.toLowerCase().includes(filterLower)) ||
                    (ticket.store_number && ticket.store_number.toString().includes(filterLower)) ||
                    (ticket.status && ticket.status.toLowerCase().includes(filterLower))
                );
            })
            : allTicketsData;

        // Build CSV content
        const headers = ['Ticket ID', 'Summary', 'Status', 'Assignee', 'Priority', 'Store Number', 'Reporter', 'Created', 'Updated', 'Epic Link'];
        const csvRows = [headers.join(',')];

        exportData.forEach(ticket => {
            const row = [
                escapeCSV(ticket.ticket_id),
                escapeCSV(ticket.summary),
                escapeCSV(ticket.status),
                escapeCSV(ticket.assignee || ''),
                escapeCSV(ticket.priority || ''),
                escapeCSV(ticket.store_number || ''),
                escapeCSV(ticket.reporter || ''),
                escapeCSV(ticket.created || ''),
                escapeCSV(ticket.updated || ''),
                escapeCSV(ticket.epic_link || '')
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jira_tickets_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    // Escape CSV values
    function escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    // Show ticket details in a separate modal
    window.showTicketDetails = function(ticketIndex) {
        const ticket = allTicketsData[ticketIndex];
        if (!ticket) return;

        // Create detail modal
        let detailModal = document.getElementById('ticketDetailModal');
        if (!detailModal) {
            detailModal = document.createElement('div');
            detailModal.id = 'ticketDetailModal';
            detailModal.className = 'modal';
            document.body.appendChild(detailModal);
        }

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

        // Helper function to check if value is valid
        const isValid = (value) => {
            return value && value !== 'N/A' && value !== 'nan' && value !== 'null';
        };

        detailModal.innerHTML = `
            <div class="modal-overlay" onclick="closeTicketDetailModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📁 ${escapeHtml(ticket.ticket_id)}</h3>
                    <button class="modal-close" onclick="closeTicketDetailModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="folder-details-content">
                        <div class="detail-section">
                            <div class="detail-title">🎫 Ticket Information</div>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Ticket:</span>
                                    <span class="detail-value ticket-number">${escapeHtml(ticket.ticket_id)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Status:</span>
                                    <span class="detail-value ticket-status ${statusClass}">${escapeHtml(ticket.status)}</span>
                                </div>
                                ${isValid(ticket.reporter) ? `
                                    <div class="detail-item">
                                        <span class="detail-label">Reporter:</span>
                                        <span class="detail-value">${escapeHtml(ticket.reporter)}</span>
                                    </div>
                                ` : ''}
                                <div class="detail-item">
                                    <span class="detail-label">Assignee:</span>
                                    <span class="detail-value">${ticket.assignee ? escapeHtml(ticket.assignee) : 'Unassigned'}</span>
                                </div>
                                ${isValid(ticket.created) ? `
                                    <div class="detail-item">
                                        <span class="detail-label">Created:</span>
                                        <span class="detail-value">${formatDate(ticket.created)}</span>
                                    </div>
                                ` : ''}
                                ${isValid(ticket.updated) ? `
                                    <div class="detail-item">
                                        <span class="detail-label">Updated:</span>
                                        <span class="detail-value">${formatDate(ticket.updated)}</span>
                                    </div>
                                ` : ''}
                                ${isValid(ticket.priority) ? `
                                    <div class="detail-item">
                                        <span class="detail-label">Priority:</span>
                                        <span class="detail-value ${getPriorityClass(ticket.priority)}">${escapeHtml(ticket.priority)}</span>
                                    </div>
                                ` : ''}
                                ${isValid(ticket.business_priority) ? `
                                    <div class="detail-item">
                                        <span class="detail-label">Business Priority:</span>
                                        <span class="detail-value">${escapeHtml(ticket.business_priority)}</span>
                                    </div>
                                ` : ''}
                                ${isValid(ticket.store_number) ? `
                                    <div class="detail-item">
                                        <span class="detail-label">Store:</span>
                                        <span class="detail-value">${escapeHtml(ticket.store_number)}</span>
                                    </div>
                                ` : ''}
                                ${isValid(ticket.epic_link) ? `
                                    <div class="detail-item">
                                        <span class="detail-label">Epic Link:</span>
                                        <span class="detail-value">${escapeHtml(ticket.epic_link)}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <div class="detail-section">
                            <div class="detail-title">📋 Summary</div>
                            <div class="detail-text">${escapeHtml(ticket.summary)}</div>
                        </div>

                        ${isValid(ticket.description) ? `
                            <div class="detail-section">
                                <div class="detail-title">📝 Description</div>
                                <div class="detail-text">${escapeHtml(ticket.description)}</div>
                            </div>
                        ` : ''}

                        ${isValid(ticket.last_comment) ? `
                            <div class="detail-section">
                                <div class="detail-title">💬 Latest Comment / Resolution</div>
                                <div class="detail-text comment-highlight">${escapeHtml(ticket.last_comment)}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        detailModal.style.display = 'flex';
        setTimeout(() => detailModal.classList.add('show'), 10);
    };

    // Get priority class helper
    function getPriorityClass(priority) {
        if (!priority) return '';
        const p = priority.toLowerCase();
        if (p.includes('high') || p.includes('critical')) return 'priority-high';
        if (p.includes('medium')) return 'priority-medium';
        if (p.includes('low')) return 'priority-low';
        return '';
    }

    // Close ticket detail modal
    window.closeTicketDetailModal = function() {
        const modal = document.getElementById('ticketDetailModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    };

    // Close all tickets modal
    window.closeAllTicketsModal = function() {
        const modal = document.getElementById('allTicketsModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    };

    // Format date for short display
    function formatDateShort(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAssigneesModal();
            closeStatusModal();
            closeCategoriesModal();
            closeAllTicketsModal();
            closeTicketDetailModal();
        }
    });

    function showSettingsPage() {
        const mainContent = document.querySelector('.main-content');
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚙️</div>
                <h3>Settings</h3>
                <p>Coming soon: Customize your Jira Assistant preferences</p>
            </div>
        `;
    }

    // Focus search input on load
    searchInput.focus();
});
