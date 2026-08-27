// ============================================================
//  js/controllers/inventarioController.js
//  Controlador de Inventario
// ============================================================

window.MainApp = window.MainApp || {};
Object.assign(window.MainApp, {
    abrirNuevoProducto() {
        document.getElementById('form-producto').reset();
        document.getElementById('prod-id-edit').value = '';
        document.getElementById('prod-id').disabled = false;
        document.getElementById('modal-titulo').textContent = 'Nuevo Producto';
        document.getElementById('grupo-cantidad-inicial').style.display = '';
        // Fecha de hoy por defecto
        const prodFechaEl = document.getElementById('prod-fecha');
        if (prodFechaEl) prodFechaEl.value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-producto').classList.add('active');
    },

    abrirEditarProducto(id) {
        const prod = this.state.productos.find(p => String(p.ID) === String(id));
        if (!prod) return;
        document.getElementById('form-producto').reset();
        document.getElementById('prod-id-edit').value = prod.ID;
        document.getElementById('prod-id').value = prod.ID;
        document.getElementById('prod-id').disabled = true;
        document.getElementById('prod-nombre').value = prod.Nombre || '';
        document.getElementById('prod-categoria').value = prod.Categoria || '';
        document.getElementById('prod-unidad').value = prod.Unidad || 'Unidades';
        document.getElementById('prod-desc').value = prod.Descripcion || '';
        document.getElementById('prod-cantidad').value = prod.Cantidad || 0;
        const prodFechaEl = document.getElementById('prod-fecha');
        if (prodFechaEl) prodFechaEl.value = prod.FechaRegistro || '';
        document.getElementById('modal-titulo').textContent = 'Editar Producto';
        document.getElementById('grupo-cantidad-inicial').style.display = '';
        document.getElementById('modal-producto').classList.add('active');
    },

    cerrarModal() {
        document.getElementById('modal-producto').classList.remove('active');
        document.getElementById('prod-id').disabled = false;
    },

    async guardarProducto() {
        const idEdit = document.getElementById('prod-id-edit').value;
        const idInput = document.getElementById('prod-id').value.trim();
        const finalId = idEdit || idInput;
        const hoy = new Date().toISOString().split('T')[0];
        const prodFechaEl = document.getElementById('prod-fecha');

        const producto = {
            ID: String(finalId).trim(),
            Nombre: document.getElementById('prod-nombre').value.trim(),
            Categoria: document.getElementById('prod-categoria').value.trim(),
            Descripcion: document.getElementById('prod-desc').value.trim(),
            Cantidad: parseInt(document.getElementById('prod-cantidad').value) || 0,
            Unidad: document.getElementById('prod-unidad').value,
            FechaRegistro: (prodFechaEl && prodFechaEl.value) ? prodFechaEl.value : hoy
        };

        if (!producto.ID || !producto.Nombre || !producto.Categoria) {
            utils.mostrarToast('Complete los campos requeridos', 'warning');
            return;
        }

        console.log('[DEBUG] Enviando producto al servidor:', producto);

        utils.mostrarLoader('Guardando producto...');
        try {
            const res = await api.post({ action: 'guardarProducto', producto });
            utils.mostrarToast(res.mensaje || 'Producto guardado', 'success');

            this.cerrarModal();
            await this.cargarSoloInventario();
        } catch (err) {
            utils.mostrarToast('Error al guardar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async eliminarProducto(id) {
        const idLimpio = String(id).trim();
        if (!confirm(`¿Eliminar el producto "${idLimpio}"?\nEsta acción no se puede deshacer.`)) return;
        
        utils.mostrarLoader('Eliminando producto...');
        try {
            const res = await api.post({ action: 'eliminarProducto', id: idLimpio });
            
            // Recargar datos inmediatamente de forma rápida
            await this.cargarSoloInventario();
            utils.mostrarToast(res.mensaje || 'Producto eliminado', 'success');
        } catch (err) {
            console.error('Error al eliminar:', err);
            utils.mostrarToast('Error al eliminar: ' + err.message, 'danger');
            // Recargar datos por si acaso hay desincronización
            this.cargarTodosLosDatos();
        } finally {
            utils.ocultarLoader();
        }
    },

    // ── ACCIONES DE MOVIMIENTO ──
    async registrarEntrada() {
        const prodId = document.getElementById('entrada-producto').value;
        const cantidad = parseInt(document.getElementById('entrada-cantidad').value);
        const fecha = document.getElementById('entrada-fecha').value;
        const obs = document.getElementById('entrada-obs').value.trim();

        if (!prodId || cantidad < 1 || !fecha) {
            utils.mostrarToast('Complete campos requeridos', 'warning'); return;
        }

        const prod = this.state.productos.find(p => String(p.ID) === String(prodId));
        if (!prod) return;

        const movimiento = { ID_Producto: prod.ID, Nombre_Producto: prod.Nombre, Cantidad: cantidad, Fecha: fecha, Observacion: obs || 'Ingreso' };

        utils.mostrarLoader('Registrando entrada...');
        try {
            const res = await api.post({ action: 'registrarEntrada', movimiento });
            // Actualización Optimista: Actualizar localmente primero para velocidad
            if (prod) prod.Cantidad = res.stock_nuevo;
            this.actualizarUI();

            // Sincronización rápida en segundo plano para verificar con el servidor
            await this.cargarSoloInventario();
            
            document.getElementById('form-entrada').reset();
            document.getElementById('entrada-fecha').value = new Date().toISOString().split('T')[0];
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async registrarSalida() {
        const prodId = document.getElementById('salida-producto').value;
        const cantidad = parseInt(document.getElementById('salida-cantidad').value);
        const fecha = document.getElementById('salida-fecha').value;
        const obs = document.getElementById('salida-obs').value.trim();

        if (!prodId || cantidad < 1 || !fecha) {
            utils.mostrarToast('Complete campos requeridos', 'warning'); return;
        }

        const prod = this.state.productos.find(p => String(p.ID) === String(prodId));
        if (!prod) return;

        if (cantidad > Number(prod.Cantidad)) {
            utils.mostrarToast(`Stock insuficiente. Disp: ${prod.Cantidad}`, 'danger'); return;
        }

        const movimiento = { ID_Producto: prod.ID, Nombre_Producto: prod.Nombre, Cantidad: cantidad, Fecha: fecha, Observacion: obs || 'Retiro' };

        utils.mostrarLoader('Registrando salida...');
        try {
            const res = await api.post({ action: 'registrarSalida', movimiento });
            // Actualización Optimista: Actualizar localmente primero para velocidad
            if (prod) prod.Cantidad = res.stock_nuevo;
            this.actualizarUI();

            // Sincronización rápida en segundo plano
            await this.cargarSoloInventario();
            
            document.getElementById('form-salida').reset();
            document.getElementById('salida-fecha').value = new Date().toISOString().split('T')[0];
            document.getElementById('salida-stock-info').innerHTML = `<i class="fa-solid fa-info-circle"></i> Seleccione un producto`;
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    // ── FILTROS DE PRODUCTOS ──
    filtrarProductos() {
        const nombre = (document.getElementById('filter-prod-nombre')?.value || '').toLowerCase().trim();
        const fecha  = document.getElementById('filter-prod-fecha')?.value || '';
        ui.renderizarProductos(this.state.productos, nombre, fecha);
    },

    // ── ACCIONES DE ENTREGAS ──
    filtrarEntregas() {
        const nombre = (document.getElementById('filter-entrega-nombre').value || '').toLowerCase().trim();
        const fecha = document.getElementById('filter-entrega-fecha').value || '';
        
        let filtradas = this.state.entregas;
        if (nombre) filtradas = filtradas.filter(t => t.Nombre.toLowerCase().includes(nombre));
        if (fecha) filtradas = filtradas.filter(t => t.Fecha === fecha);
        
        ui.renderizarEntregas(filtradas);
    },

    async registrarEntrega() {
        const nombre = document.getElementById('entrega-nombre').value.trim();
        const fecha = document.getElementById('entrega-fecha').value;
        const desc = document.getElementById('entrega-desc').value.trim();

        if (!nombre || !fecha || !desc) {
            utils.mostrarToast('Complete los campos de la entrega', 'warning');
            return;
        }

        const nuevaEntrega = {
            id: 'ENT-' + Date.now(),
            Nombre: nombre,
            Fecha: fecha,
            Descripcion: desc,
            Estado: 'Entregado'
        };

        utils.mostrarLoader('Registrando entrega...');
        try {
            const res = await api.post({ action: 'registrarEntrega', entrega: nuevaEntrega });
            utils.mostrarToast(res.mensaje || 'Entrega registrada correctamente', 'success');
            
            await this.cargarSoloInventario();
            
            document.getElementById('form-entrega').reset();
            document.getElementById('entrega-fecha').value = new Date().toISOString().split('T')[0];
            
            if (this.filtrarEntregas) this.filtrarEntregas();
        } catch (err) {
            utils.mostrarToast('Error al registrar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async eliminarEntrega(id) {
        if (!confirm('¿Desea eliminar esta entrega?')) return;
        
        utils.mostrarLoader('Eliminando entrega...');
        try {
            const res = await api.post({ action: 'eliminarEntrega', id });
            utils.mostrarToast(res.mensaje || 'Entrega eliminada', 'success');
            
            this.state.entregas = this.state.entregas.filter(t => String(t.id) !== String(id));
            this.filtrarEntregas();
        } catch (err) {
            utils.mostrarToast('Error al eliminar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },



    // ── NAVEGACIÓN TABS TAREAS ──
    switchTareasTab(tabId) {
        this.state.tabTareasActual = tabId;
        document.querySelectorAll('.tareas-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.getElementById('tab-tareas-recurrentes').style.display = tabId === 'recurrentes' ? 'block' : 'none';
        document.getElementById('tab-tareas-semanales').style.display   = tabId === 'semanales'   ? 'block' : 'none';
        document.getElementById('tab-tareas-preventivo').style.display  = tabId === 'preventivo'  ? 'block' : 'none';
        document.getElementById('tab-tareas-bitacora').style.display    = tabId === 'bitacora'    ? 'block' : 'none';
    },

    // ==========================================
    // ── ACCIONES TAREAS MENSUALES ──
});
