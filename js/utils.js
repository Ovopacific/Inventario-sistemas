// ============================================================
//  utils.js — Utilidades y Helpers
// ============================================================

const utils = {
    // ── Loader global (Sin pantalla de carga por requerimiento del usuario) ──
    mostrarLoader(msg = 'Procesando...') {
        // Desactivado para evitar la pantalla de carga al actualizar
        return;
    },
    
    ocultarLoader() {
        const loader = document.getElementById('global-loader');
        if (loader) loader.classList.remove('active');
    },

    // ── Notificaciones Toast ──
    mostrarToast(msg, tipo = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${tipo}`;
        const iconos = { success: 'circle-check', danger: 'circle-xmark', warning: 'triangle-exclamation' };
        toast.innerHTML = `<i class="fa-solid fa-${iconos[tipo] || 'info'}"></i><span>${msg}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    // ── Formateo de Datos ──
    formatearFecha(val) {
        if (!val) return '—';
        const fechaLimpia = typeof val === 'string' ? val.split('T')[0] : val;
        const d = new Date(fechaLimpia + 'T00:00:00'); 
        if (isNaN(d.getTime())) return val;
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    escHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    
    escAttr(str) {
        return this.escHtml(str).replace(/'/g, '&#39;');
    },

    // ── Animación de números ──
    animateNumber(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        const start = parseInt(el.textContent) || 0;
        if (start === target) return;
        const step = target > start ? 1 : -1;
        
        const diff = Math.abs(target - start);
        const maxFrames = 30;
        const frameStep = Math.max(1, Math.floor(diff / maxFrames)) * step;
        
        const timer = setInterval(() => {
            const cur = parseInt(el.textContent) || 0;
            if ((step > 0 && cur >= target) || (step < 0 && cur <= target)) {
                el.textContent = target;
                clearInterval(timer);
                return;
            }
            const nextVal = cur + frameStep;
            el.textContent = (step > 0 && nextVal > target) || (step < 0 && nextVal < target) ? target : nextVal;
        }, 30);
    },
    
    // ── Exportación CSV Genérica ──
    exportarCSV(data, filename = 'export', headers = null) {
        if (!data || data.length === 0) { 
            this.mostrarToast('No hay datos para exportar', 'warning'); 
            return; 
        }
        
        const finalHeaders = headers || Object.keys(data[0]);
        const separator = ';';
        
        const rows = data.map(item => {
            return finalHeaders.map(h => {
                let val = item[h];
                if (val === null || val === undefined) val = '';
                const str = val.toString().replace(/\n/g, ' ').replace(/"/g, '""');
                return `"${str}"`;
            }).join(separator);
        });
        
        const csv = [finalHeaders.join(separator), ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
        this.mostrarToast(`${filename.charAt(0).toUpperCase() + filename.slice(1)} exportado`, 'success');
    }
};

window.utils = utils;
