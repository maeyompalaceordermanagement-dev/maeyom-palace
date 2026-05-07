// ============================================================
// ระบบแจ้งเตือน - เสียง + Push Notification + LINE
// ============================================================

class NotificationManager {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.permission = 'default';
        this.init();
    }
    
    async init() {
        // ขอสิทธิ์ Push Notification
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                this.permission = await Notification.requestPermission();
            } else {
                this.permission = Notification.permission;
            }
        }
        
        // เตรียม AudioContext
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('AudioContext not supported');
        }
    }
    
    // ============================================================
    // เสียงแจ้งเตือนแบบไพเราะ - ใช้ Web Audio API
    // ============================================================
    playNewOrderSound() {
        this.playMelody([
            { freq: 523.25, duration: 0.15 }, // C5
            { freq: 659.25, duration: 0.15 }, // E5
            { freq: 783.99, duration: 0.15 }, // G5
            { freq: 1046.50, duration: 0.30 }, // C6
        ]);
    }
    
    playStatusChangeSound() {
        this.playMelody([
            { freq: 783.99, duration: 0.15 }, // G5
            { freq: 1046.50, duration: 0.25 }, // C6
        ]);
    }
    
    playSuccessSound() {
        this.playMelody([
            { freq: 523.25, duration: 0.10 }, // C5
            { freq: 659.25, duration: 0.10 }, // E5
            { freq: 783.99, duration: 0.10 }, // G5
            { freq: 1046.50, duration: 0.20 }, // C6
            { freq: 1318.51, duration: 0.30 }, // E6
        ]);
    }
    
    playMelody(notes) {
        if (!this.audioContext) return;
        
        // Resume context ถ้าถูก suspend
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const volume = CONFIG.NOTIFICATION_SOUND_VOLUME || 0.8;
        let startTime = this.audioContext.currentTime;
        
        notes.forEach(note => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = note.freq;
            
            // Envelope ที่นุ่มนวล
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + note.duration);
            
            startTime += note.duration;
        });
    }
    
    // เสียงดังๆ สำหรับออเดอร์ใหม่ (เล่นซ้ำ)
    playLoudNewOrder() {
        const repeat = CONFIG.NOTIFICATION_SOUND_REPEAT || 2;
        for (let i = 0; i < repeat; i++) {
            setTimeout(() => this.playNewOrderSound(), i * 1200);
        }
    }
    
    // ============================================================
    // Push Notification (Browser + Mobile)
    // ============================================================
    showNotification(title, options = {}) {
        if (this.permission !== 'granted') {
            console.warn('Notification permission not granted');
            return;
        }
        
        const defaults = {
            icon: '/images/icon-192.png',
            badge: '/images/badge.png',
            vibrate: [200, 100, 200, 100, 200],
            requireInteraction: true,
            tag: 'maeyom-order',
        };
        
        const notification = new Notification(title, { ...defaults, ...options });
        
        notification.onclick = () => {
            window.focus();
            if (options.url) {
                window.location.href = options.url;
            }
            notification.close();
        };
        
        // ปิดอัตโนมัติหลัง 10 วิ ถ้าไม่ได้กำหนด requireInteraction
        if (!options.requireInteraction) {
            setTimeout(() => notification.close(), 10000);
        }
        
        return notification;
    }
    
    // แจ้งเตือนออเดอร์ใหม่ (สำหรับแอดมิน)
    notifyNewOrder(order) {
        this.playLoudNewOrder();
        
        const orderTypeLabel = ORDER_TYPE[order.order_type]?.label || '';
        const tableInfo = order.table_number ? `โต๊ะ ${order.table_number}` : 'กลับบ้าน';
        
        this.showNotification('🔔 ออเดอร์ใหม่!', {
            body: `${tableInfo} | ${order.customer_name}\nรวม ${order.total_amount?.toLocaleString()} บาท | ${orderTypeLabel}`,
            requireInteraction: true,
            tag: `order-${order.id}`,
        });
    }
    
    // แจ้งเตือนเปลี่ยนสถานะ (สำหรับลูกค้า)
    notifyStatusChange(order, newStatus) {
        this.playStatusChangeSound();
        
        const statusInfo = ORDER_STATUS[newStatus];
        if (!statusInfo) return;
        
        this.showNotification(`${statusInfo.icon} ${statusInfo.label}`, {
            body: `ออเดอร์ ${order.order_number}\n${this.getStatusMessage(newStatus)}`,
            tag: `status-${order.id}`,
        });
    }
    
    getStatusMessage(status) {
        const messages = {
            pending: 'ออเดอร์ของคุณเข้าสู่ระบบแล้ว กำลังรอแอดมินรับออเดอร์',
            accepted: 'แอดมินรับออเดอร์ของคุณแล้ว เตรียมเข้าครัว',
            cooking: 'พ่อครัวกำลังปรุงอาหารของคุณ 👨‍🍳',
            ready: 'อาหารของคุณพร้อมแล้ว 🍽️',
            delivering: 'พนักงานกำลังนำอาหารไปเสิร์ฟ 🚚',
            completed: 'จัดส่งเรียบร้อย ขอบคุณที่ใช้บริการ ✨',
            cancelled: 'ออเดอร์ถูกยกเลิก'
        };
        return messages[status] || '';
    }
    
    // ============================================================
    // LINE Notify (ตัวเลือก)
    // ============================================================
    async sendLineNotify(message) {
        if (!CONFIG.LINE_NOTIFY_TOKEN) return;
        
        try {
            // เนื่องจาก LINE Notify ต้องเรียกผ่าน Backend (CORS)
            // ใช้ Google Apps Script เป็นตัวกลาง
            if (CONFIG.GOOGLE_APPS_SCRIPT_URL) {
                await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'lineNotify',
                        message: message,
                        token: CONFIG.LINE_NOTIFY_TOKEN
                    })
                });
            }
        } catch (e) {
            console.error('LINE Notify error:', e);
        }
    }
    
    // ============================================================
    // Banner แจ้งเตือนในหน้าเว็บ (Toast)
    // ============================================================
    showToast(message, type = 'info', duration = 3500) {
        const colors = {
            success: 'linear-gradient(135deg, #10B981, #059669)',
            error: 'linear-gradient(135deg, #EF4444, #DC2626)',
            warning: 'linear-gradient(135deg, #F59E0B, #D97706)',
            info: 'linear-gradient(135deg, #3B82F6, #2563EB)',
            order: 'linear-gradient(135deg, #C9A861, #B08D4A)'
        };
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            order: '🔔'
        };
        
        const toast = document.createElement('div');
        toast.className = 'maeyom-toast';
        toast.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 9999;
            padding: 16px 24px;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 12px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.25);
            font-family: 'Sarabun', 'Prompt', sans-serif;
            font-weight: 500;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 280px;
            max-width: 420px;
            animation: maeyomToastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;
        toast.innerHTML = `<span style="font-size: 22px">${icons[type] || icons.info}</span><span>${message}</span>`;
        
        // Inject animation CSS ถ้ายังไม่มี
        if (!document.getElementById('maeyom-toast-style')) {
            const style = document.createElement('style');
            style.id = 'maeyom-toast-style';
            style.textContent = `
                @keyframes maeyomToastIn {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes maeyomToastOut {
                    to { transform: translateX(120%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'maeyomToastOut 0.4s ease-in forwards';
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }
}

// สร้าง instance เดียวใช้ทั้งระบบ
const notifier = new NotificationManager();
window.notifier = notifier;

// ============================================================
// ลงทะเบียน Service Worker (PWA + Push)
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
            console.log('✓ Service Worker registered', reg.scope);
        }).catch((err) => {
            console.warn('Service Worker register failed:', err.message);
        });
    });
}
