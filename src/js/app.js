const API_BASE_URL = 'https://helpdesk-backend-1my8.onrender.com'; // Ваш URL

// --- Утилиты для работы с API ---
async function apiRequest(method, params = {}) {
    const url = new URL(API_BASE_URL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url, { method });
        
        // ВАЖНО: Проверка на 204 (No Content) ДОЛЖНА быть до response.json()
        if (response.status === 204) return null; 
        
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        
        // Проверяем, есть ли вообще контент для парсинга
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } catch (error) {
        console.error('Ошибка API:', error);
        throw error;
    }
}

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
    
    // Форматируем дату
    const dateObj = new Date(ticket.created);
    const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth()+1).padStart(2, '0')}.${String(dateObj.getFullYear()).slice(2)} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    ticketEl.innerHTML = `
        <div class="ticket-header">
            <span class="ticket-status" title="${ticket.status ? 'Выполнено' : 'В работе'}">${statusIcon}</span>
            <span class="ticket-name">${ticket.name}</span>
            <span class="ticket-date">${dateStr}</span>
            <div class="ticket-actions">
                <button class="btn btn-sm btn-edit" title="Редактировать">✎</button>
                <button class="btn btn-sm btn-delete" title="Удалить">x</button>
            </div>
        </div>
        <div class="ticket-body">
            <div class="ticket-description">Загрузка...</div>
        </div>
    `;

    const bodyEl = ticketEl.querySelector('.ticket-body');
    const descEl = ticketEl.querySelector('.ticket-description');

    // Обработчик клика по телу тикета (для показа полного описания)
    ticketEl.querySelector('.ticket-header').addEventListener('click', async (e) => {
        // Игнорируем клики по кнопкам и чекбоксу
        if (e.target.closest('.ticket-actions') || e.target.closest('.ticket-status')) return; 

        // Переключаем видимость
        const isOpen = bodyEl.classList.toggle('open');

        // Если открываем и описание еще не загружено, загружаем его
        if (isOpen && !bodyEl.dataset.loaded) {
            descEl.textContent = 'Загрузка описания...';
            const fullTicket = await api.getTicketById(ticket.id);
            descEl.textContent = fullTicket.description || 'Описание отсутствует';
            bodyEl.dataset.loaded = 'true'; // Помечаем, что загрузили
        }
    });

    ticketEl.querySelector('.btn-edit').addEventListener('click', () => {
        showEditModal(ticket);
    });

    ticketEl.querySelector('.btn-delete').addEventListener('click', () => {
        showDeleteModal(ticket.id);
    });

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
        try {
            await onConfirm();
            close(); // Закрываем окно ТОЛЬКО если ошибки не было
        } catch (err) {
            alert('Произошла ошибка при выполнении запроса.');
            close();
        }
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
    listEl.innerHTML = '<div class="loading-message">Загрузка данных... (Если сервер спал, это может занять до минуты)</div>';
    try {
        const tickets = await api.getAllTickets();
        renderTickets(tickets);
    } catch (error) {
        listEl.innerHTML = '<div class="error-message">Не удалось загрузить тикеты. Проверьте соединение с сервером.</div>';
    }
}

document.getElementById('add-ticket-btn').addEventListener('click', showAddModal);
loadTickets();