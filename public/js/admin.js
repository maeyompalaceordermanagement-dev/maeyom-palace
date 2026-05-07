// ============================================================
// Admin Dashboard - หน้าจัดการออเดอร์ของแอดมิน
// ============================================================

const adminState = {
    orders: [],
    filterStatus: 'active', // active, pending, cooking, ready, delivering, completed, all
    filterType: 'all',       // all, dine_in, takeaway
    soundEnabled: true,
    autoPrint: false,
    realtimeChannel: null,
};

window.addEventListener('DOMContentLoaded', async () => {
    initSupabase();
    if (!supabase) return;
    
    // Load settings from localStorage
    adminState.soundEnabled = localStorage.getItem('admin_sound') !== 'false';
    adminState.autoPrint = localStorage.getItem('admin_autoprint') === 'true';
    document.getElementById('auto-print').checked = adminState.autoPrint;
    updateSoundButton();
    
    setupEventListeners();
    await loadOrders();
    subscribeToOrders();
    
    // Refresh stats every minute
    setInterval(loadOrders, 60000);
});

function setupEventListeners() {
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            adminState.filterStatus = tab.dataset.filter;
            renderOrders();
        });
    });
    
    document.querySelectorAll('.type-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            adminState.filterType = tab.dataset.type;
            renderOrders();
        });
    });
    
    // Sound toggle
    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
        adminState.soundEnabled = !adminState.soundEnabled;
        localStorage.setItem('admin_sound', adminState.soundEnabled);
        updateSoundButton();
        if (adminState.soundEnabled) {
            notifier.playSuccessSound();
            notifier.showToast('เปิดเสียงแจ้งเตือน', 'success');
        } else {
            notifier.showToast('ปิดเสียงแจ้งเตือน', 'info');
        }
    });
    
    // Auto-print toggle
    document.getElementById('auto-print').addEventListener('change', (e) => {
        adminState.autoPrint = e.target.checked;
        localStorage.setItem('admin_autoprint', adminState.autoPrint);
        notifier.showToast(
            adminState.autoPrint ? 'เปิดปริ้นอัตโนมัติ' : 'ปิดปริ้นอัตโนมัติ',
            'info'
        );
    });
}

function updateSoundButton() {
    const btn = document.getElementById('btn-sound-toggle');
    btn.innerHTML = adminState.soundEnabled ? '🔔' : '🔕';
    btn.title = adminState.soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง';
}

async function loadOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items(*),
            tables(table_name)
        `)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error(error);
        notifier.showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
        return;
    }
    
    adminState.orders = data || [];
    updateSummary();
    renderOrders();
}

function updateSummary() {
    const orders = adminState.orders;
    const counts = {
        pending: orders.filter(o => o.status === 'pending').length,
        cooking: orders.filter(o => ['accepted', 'cooking'].includes(o.status)).length,
        ready: orders.filter(o => ['ready', 'delivering'].includes(o.status)).length,
        today: orders.length,
    };
    
    const revenueToday = orders
        .filter(o => o.status !== 'cancelled')
        .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    
    document.getElementById('count-pending').textContent = counts.pending;
    document.getElementById('count-cooking').textContent = counts.cooking;
    document.getElementById('count-ready').textContent = counts.ready;
    document.getElementById('count-today').textContent = counts.today;
    document.getElementById('revenue-today').textContent = '฿' + revenueToday.toLocaleString();
}

function renderOrders() {
    const container = document.getElementById('orders-container');
    let filtered = [...adminState.orders];
    
    // Filter by status
    if (adminState.filterStatus === 'active') {
        filtered = filtered.filter(o => 
            !['completed', 'cancelled'].includes(o.status)
        );
    } else if (adminState.filterStatus !== 'all') {
        filtered = filtered.filter(o => o.status === adminState.filterStatus);
    }
    
    // Filter by type
    if (adminState.filterType !== 'all') {
        filtered = filtered.filter(o => o.order_type === adminState.filterType);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3 style="font-family: var(--font-display); font-size: 22px; color: var(--color-emerald-dark); margin-bottom: 8px;">ไม่มีออเดอร์</h3>
                <p>ไม่มีออเดอร์ที่ตรงกับตัวกรองที่เลือก</p>
            </div>`;
        return;
    }
    
    container.innerHTML = '<div class="orders-grid">' + 
        filtered.map(renderOrderCard).join('') + 
    '</div>';
}

function renderOrderCard(order) {
    const statusInfo = ORDER_STATUS[order.status];
    const typeInfo = ORDER_TYPE[order.order_type];
    const isNew = order.status === 'pending';
    
    const itemsHtml = order.order_items.map(item => `
        <div class="order-item-line">
            <span class="order-item-name">${item.menu_name}</span>
            <span class="order-item-qty">×${item.quantity}</span>
            <span style="font-weight: 600; color: var(--color-gold-dark);">฿${Number(item.subtotal).toLocaleString()}</span>
        </div>
        ${item.notes ? `<div class="order-item-note">📝 ${item.notes}</div>` : ''}
    `).join('');
    
    const tableDisplay = order.table_number 
        ? `🪑 โต๊ะ ${order.table_number}${order.tables?.table_name ? ` (${order.tables.table_name})` : ''}`
        : '🥡 กลับบ้าน';
    
    const timeAgo = formatTimeAgo(new Date(order.created_at));
    
    // Action buttons based on status
    let actionsHtml = '';
    if (order.status !== 'completed' && order.status !== 'cancelled') {
        const next = statusInfo.next;
        if (next) {
            actionsHtml += `
                <button class="btn btn-primary" onclick="updateStatus('${order.id}', '${next}')">
                    ${ORDER_STATUS[next].icon} ${ORDER_STATUS[next].label}
                </button>`;
        }
        if (order.status === 'pending') {
            actionsHtml += `
                <button class="btn btn-danger" onclick="updateStatus('${order.id}', 'cancelled')">
                    ❌ ยกเลิก
                </button>`;
        }
    }
    actionsHtml += `
        <button class="btn btn-emerald" onclick="printOrder('${order.id}')">
            🖨️ ปริ้น
        </button>`;
    
    return `
        <div class="order-card ${isNew ? 'is-new' : ''}" data-order-id="${order.id}">
            <div class="order-header">
                <div>
                    <div class="order-id">${order.order_number}</div>
                    <div class="order-table">${tableDisplay}</div>
                    <div class="order-time">⏰ ${timeAgo}</div>
                </div>
                <div style="text-align: right;">
                    <span class="badge status-${order.status}">
                        ${statusInfo.icon} ${statusInfo.label}
                    </span>
                    <div style="margin-top: 6px;">
                        <span class="order-type-pill ${order.order_type}">
                            ${typeInfo.icon} ${typeInfo.label}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="order-body">
                <div class="order-customer">
                    <div class="customer-detail">
                        👤 <strong>${order.customer_name}</strong>
                    </div>
                    <a href="tel:${order.customer_phone}" class="customer-detail" style="text-decoration: none;">
                        📞 ${order.customer_phone}
                    </a>
                </div>
                
                <div class="order-items-list">
                    ${itemsHtml}
                </div>
                
                ${order.notes ? `<div class="order-notes">📝 ${order.notes}</div>` : ''}
                
                <div class="order-total-row">
                    <span class="order-total-label">รวม ${order.order_items.length} รายการ</span>
                    <span class="order-total-amount">฿${Number(order.total_amount).toLocaleString()}</span>
                </div>
            </div>
            
            <div class="order-actions">
                ${actionsHtml}
            </div>
        </div>
    `;
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours} ชม. ${minutes % 60} นาที`;
    if (minutes > 0) return `${minutes} นาที`;
    return `${seconds} วินาที`;
}

// ============================================================
// Update Status
// ============================================================
async function updateStatus(orderId, newStatus) {
    if (newStatus === 'cancelled') {
        if (!confirm('ยืนยันยกเลิกออเดอร์นี้?')) return;
    }
    
    const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
    
    if (error) {
        notifier.showToast('อัปเดตไม่สำเร็จ: ' + error.message, 'error');
        return;
    }
    
    notifier.playStatusChangeSound();
    notifier.showToast(`อัปเดตเป็น "${ORDER_STATUS[newStatus].label}" แล้ว`, 'success');
    
    // ส่งแจ้งเตือน LINE
    const order = adminState.orders.find(o => o.id === orderId);
    if (order) {
        await notifier.sendLineNotify(
            `📋 เปลี่ยนสถานะออเดอร์\n` +
            `เลขที่: ${order.order_number}\n` +
            `สถานะ: ${ORDER_STATUS[newStatus].icon} ${ORDER_STATUS[newStatus].label}`
        );
    }
}

// ============================================================
// Print Order
// ============================================================
function printOrder(orderId) {
    const order = adminState.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const printWindow = window.open(`print.html?id=${orderId}`, '_blank', 'width=400,height=700');
    
    // Mark as printed
    supabase
        .from('orders')
        .update({ is_printed: true, printed_at: new Date().toISOString() })
        .eq('id', orderId);
}

// ============================================================
// Realtime Subscription
// ============================================================
function subscribeToOrders() {
    adminState.realtimeChannel = supabase
        .channel('admin-orders')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
        }, async (payload) => {
            // โหลดข้อมูลใหม่ + items
            const { data } = await supabase
                .from('orders')
                .select('*, order_items(*), tables(table_name)')
                .eq('id', payload.new.id)
                .single();
            
            if (data) {
                adminState.orders.unshift(data);
                updateSummary();
                renderOrders();
                
                if (adminState.soundEnabled) {
                    notifier.notifyNewOrder(data);
                }
                
                notifier.showToast(
                    `🔔 ออเดอร์ใหม่! ${data.table_number ? `โต๊ะ ${data.table_number}` : 'กลับบ้าน'} - ${data.customer_name}`,
                    'order',
                    6000
                );
                
                // Auto print
                if (adminState.autoPrint) {
                    setTimeout(() => {
                        const w = window.open(`print.html?id=${data.id}&auto=1`, '_blank', 'width=400,height=700');
                        // Mark as printed
                        supabase.from('orders')
                            .update({ is_printed: true, printed_at: new Date().toISOString() })
                            .eq('id', data.id);
                    }, 1000);
                }
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
        }, (payload) => {
            const idx = adminState.orders.findIndex(o => o.id === payload.new.id);
            if (idx >= 0) {
                adminState.orders[idx] = { ...adminState.orders[idx], ...payload.new };
                updateSummary();
                renderOrders();
            }
        })
        .subscribe();
}

window.addEventListener('beforeunload', () => {
    if (adminState.realtimeChannel) supabase.removeChannel(adminState.realtimeChannel);
});

window.updateStatus = updateStatus;
window.printOrder = printOrder;
