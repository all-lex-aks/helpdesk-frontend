const API_BASE_URL = 'https://helpdesk-backend-1my8.onrender.com';

// --- Утилиты для работы с API ---
async function apiRequest(method, params = {}) {
    const url = new URL(API_BASE_URL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url, { method });
        if (!response.ok) {
            if (response.status === 204) return null;
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Ошибка API:', error);
        throw error;
    }
}

// --- CRUD-операции ---
const api = {
    getAllTickets: () => apiRequest('GET', { method: 'allTickets' }),
    getTicketById: (id) => apiRequest('GET', { method: 'ticketById', id }),
    createTicket: (data) => {
        return fetch(`${API_BASE_URL}?method=createTicket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(res => res.json());
    },
    updateTicket: (id, data) => {
        return fetch(`${API_BASE_URL}?method=updateById&id=${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(res => res.json());
    },
    deleteTicket: (id) => apiRequest('GET', { method: 'deleteById', id })
};

// --- Отрисовка UI ---
const listEl = document.getElementById('tickets-list');

function renderTickets(tickets) {
    if (!tickets || tickets.length === 0) {
        listEl.innerHTML = '<div class="empty-message">Нет тикетов. Добавьте первый!</div>';
        return;
    }
    listEl.innerHTML = '';
    tickets.forEach(ticket => {
        const ticketEl = createTicketElement(ticket);
        listEl.appendChild(ticketEl);
    });
}

function createTicketElement(ticket) {
    const ticketEl = document.createElement('div');
    ticketEl.className = 'ticket';
    ticketEl.dataset.id = ticket.id;

    const statusIcon = ticket.status ? '✅' : '🔄';
    const shortDescription = ticket.description ? ticket.description.slice(0, 50) + (ticket.description.length > 50 ? '...' : '') : '';

    ticketEl.innerHTML = `
        <div class="ticket-header">
            <span class="ticket-status" title="${ticket.status ? 'Выполнено' : 'В работе'}">${statusIcon}</span>
            <span class="ticket-name">${ticket.name}</span>
            <div class="ticket-actions">
                <button class="btn btn-sm btn-edit" title="Редактировать">✎</button>
                <button class="btn btn-sm btn-delete" title="Удалить">x</button>
            </div>
        </div>
        <div class="ticket-body">
            <div class="ticket-description">${shortDescription}</div>
            <div class="ticket-meta">Создан: ${new Date(ticket.created).toLocaleString()}</div>
        </div>
    `;

    // Обработчик клика по телу тикета (для показа полного описания)
    ticketEl.querySelector('.ticket-header').addEventListener('click', async (e) => {
        if (e.target.closest('.ticket-actions')) return; // Игнорируем клики по кнопкам

        const fullTicket = await api.getTicketById(ticket.id);
        const descEl = ticketEl.querySelector('.ticket-description');
        descEl.textContent = fullTicket.description || 'Описание отсутствует';
        descEl.classList.toggle('full-description');
    });

    // Обработчик для кнопки "Редактировать"
    ticketEl.querySelector('.btn-edit').addEventListener('click', () => {
        showEditModal(ticket);
    });

    // Обработчик для кнопки "Удалить"
    ticketEl.querySelector('.btn-delete').addEventListener('click', () => {
        showDeleteModal(ticket.id);
    });

    // Обработчик для изменения статуса
    ticketEl.querySelector('.ticket-status').addEventListener('click', async (e) => {
        e.stopPropagation();
        const newStatus = !ticket.status;
        await api.updateTicket(ticket.id, { status: newStatus });
        loadTickets();
    });

    return ticketEl;
}

// --- Модальные окна ---
function showModal(title, bodyHtml, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <h2>${title}</h2>
            <div class="modal-body">${bodyHtml}</div>
            <div class="modal-actions">
                <button class="btn btn-secondary btn-cancel">Отмена</button>
                <button class="btn btn-primary btn-confirm">Подтвердить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.btn-cancel').addEventListener('click', close);
    modal.querySelector('.btn-confirm').addEventListener('click', async () => {
        await onConfirm();
        close();
    });
}

function showAddModal() {
    showModal('Добавить тикет', `
        <label>Название: <input type="text" id="ticket-name" class="input" required></label>
        <label>Описание: <textarea id="ticket-description" class="input" rows="3"></textarea></label>
    `, async () => {
        const name = document.getElementById('ticket-name').value.trim();
        const description = document.getElementById('ticket-description').value.trim();
        if (!name) { alert('Введите название тикета!'); return; }
        await api.createTicket({ name, description, status: false });
        loadTickets();
    });
}

function showEditModal(ticket) {
    showModal('Редактировать тикет', `
        <label>Название: <input type="text" id="ticket-name" class="input" value="${ticket.name}" required></label>
        <label>Описание: <textarea id="ticket-description" class="input" rows="3">${ticket.description || ''}</textarea></label>
    `, async () => {
        const name = document.getElementById('ticket-name').value.trim();
        const description = document.getElementById('ticket-description').value.trim();
        if (!name) { alert('Введите название тикета!'); return; }
        await api.updateTicket(ticket.id, { name, description });
        loadTickets();
    });
}

function showDeleteModal(id) {
    showModal('Удалить тикет?', '<p>Вы уверены, что хотите удалить этот тикет?</p>', async () => {
        await api.deleteTicket(id);
        loadTickets();
    });
}

// --- Инициализация ---
async function loadTickets() {
    try {
        const tickets = await api.getAllTickets();
        renderTickets(tickets);
    } catch (error) {
        listEl.innerHTML = '<div class="error-message">Не удалось загрузить тикеты. Проверьте соединение с сервером.</div>';
    }
}

document.getElementById('add-ticket-btn').addEventListener('click', showAddModal);
loadTickets();