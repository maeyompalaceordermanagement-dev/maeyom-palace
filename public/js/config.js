// ============================================================
// การตั้งค่าระบบ - แก้ไขค่าเหล่านี้ก่อนใช้งาน
// ============================================================

const CONFIG = {
    // ข้อมูล Supabase (ไปเอาจาก Supabase Dashboard > Settings > API)
    SUPABASE_URL: 'https://uktgquwryobsnbyvloqk.supabase.co/rest/v1/',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrdGdxdXdyeW9ic25ieXZsb3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzcxMjUsImV4cCI6MjA5MzcxMzEyNX0.yBwNQ65wpm4TcYbboAR0lat7MZCX_8jya5i57flB47U',
    
    // ข้อมูลโรงแรม
    HOTEL_NAME: 'โรงแรม แม่ยม พาเลส',
    HOTEL_NAME_EN: 'Mae Yom Palace Hotel',
    HOTEL_PHONE: '054521028',
    
    // URL ของหน้าเว็บ (ใช้สำหรับสร้าง QR Code)
    // ตัวอย่าง: 'https://yourdomain.com' หรือ 'http://localhost:8000'
    BASE_URL: window.location.origin,
    
    // Google Apps Script URL (ถ้าใช้ - ไม่ใช้ใส่ '')
    GOOGLE_APPS_SCRIPT_URL: '',
    
    // LINE Notify Token (ถ้าใช้ - ไม่ใช้ใส่ '')
    LINE_NOTIFY_TOKEN: '',
    
    // การตั้งค่าเสียงแจ้งเตือน
    NOTIFICATION_SOUND_VOLUME: 0.8, // 0.0 - 1.0
    NOTIFICATION_SOUND_REPEAT: 2,   // ซ้ำกี่ครั้ง
    
    // การตั้งค่าปริ้นออเดอร์
    AUTO_PRINT: true,              // ปริ้นอัตโนมัติเมื่อมีออเดอร์ใหม่
    PRINT_PAPER_WIDTH: 58,          // ขนาดกระดาษ (mm) - 58 หรือ 80
};

// สถานะออเดอร์
const ORDER_STATUS = {
    pending:    { label: 'รอ',                color: '#FCD34D', icon: '⏳', next: 'accepted' },
    accepted:   { label: 'รับออเดอร์',         color: '#60A5FA', icon: '✅', next: 'cooking' },
    cooking:    { label: 'กำลังทำ',           color: '#FB923C', icon: '👨‍🍳', next: 'ready' },
    ready:      { label: 'ทำเสร็จ',           color: '#34D399', icon: '🍽️', next: 'delivering' },
    delivering: { label: 'กำลังจัดส่ง',        color: '#A78BFA', icon: '🚚', next: 'completed' },
    completed:  { label: 'จัดส่งเสร็จสิ้น',    color: '#10B981', icon: '✨', next: null },
    cancelled:  { label: 'ยกเลิก',           color: '#EF4444', icon: '❌', next: null }
};

// ประเภทการสั่ง
const ORDER_TYPE = {
    dine_in:   { label: 'กินที่นี่',     icon: '🍽️', color: '#10B981' },
    takeaway:  { label: 'กลับบ้าน',    icon: '🥡', color: '#F59E0B' }
};

// สร้าง Supabase Client (จะถูกใช้ในไฟล์อื่น)
let supabase = null;

function initSupabase() {
    if (CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
        alert('⚠️ กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_ANON_KEY ในไฟล์ public/js/config.js');
        return null;
    }
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded');
        return null;
    }
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return supabase;
}

// Export
window.CONFIG = CONFIG;
window.ORDER_STATUS = ORDER_STATUS;
window.ORDER_TYPE = ORDER_TYPE;
window.initSupabase = initSupabase;
