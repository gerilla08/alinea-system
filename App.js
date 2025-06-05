import React, { useState, useEffect } from 'react';
import { Calendar, User, CreditCard, Percent, Save, FileText, Trash2, LogOut, Settings } from 'lucide-react';

// Configuración de Supabase (vas a reemplazar estas URLs con las tuyas)
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = 'tu-clave-publica';

// Funciones para interactuar con la base de datos
const supabaseClient = {
  async query(table, operation = 'SELECT', data = null, conditions = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${conditions}`;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    let config = { headers };
    
    if (operation === 'POST') {
      config.method = 'POST';
      config.body = JSON.stringify(data);
    } else if (operation === 'PATCH') {
      config.method = 'PATCH';
      config.body = JSON.stringify(data);
    } else if (operation === 'DELETE') {
      config.method = 'DELETE';
    }

    try {
      const response = await fetch(url, config);
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      return operation === 'DELETE' ? { success: true } : await response.json();
    } catch (error) {
      console.error('Error en la base de datos:', error);
      return null;
    }
  }
};

const AllineaSystem = () => {
  // Estados principales
  const [currentUser, setCurrentUser] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [operaciones, setOperaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState('');

  // Estados de login
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showLogin, setShowLogin] = useState(true);

  // Catálogo de clases/productos
  const [productos] = useState([
    { id: 1, nombre: 'PRUEBA', precio: 99 },
    { id: 2, nombre: '1 CLASE', precio: 190 },
    { id: 3, nombre: '3 CLASES', precio: 540 },
    { id: 4, nombre: '7 CLASES', precio: 1190 },
    { id: 5, nombre: '12 CLASES', precio: 1920 },
    { id: 6, nombre: '15 CLASES', precio: 2250 },
    { id: 7, nombre: '20 CLASES', precio: 2900 }
  ]);

  // Estado del formulario de operación
  const [operacionActual, setOperacionActual] = useState({
    cliente: '',
    fecha: new Date().toISOString().split('T')[0],
    productos: [{ productoId: '', metodoPago: 'Efectivo' }],
    descuentoTipo: 'pesos',
    descuentoValor: 0,
    comentarios: ''
  });

  // Cargar datos al iniciar
  useEffect(() => {
    if (currentUser) {
      cargarClientes();
      cargarOperaciones();
    }
  }, [currentUser]);

  // Funciones de base de datos
  const cargarClientes = async () => {
    setLoading(true);
    const data = await supabaseClient.query('clientes', 'SELECT', null, '?order=nombre.asc');
    if (data) setClientes(data);
    setLoading(false);
  };

  const cargarOperaciones = async () => {
    setLoading(true);
    const data = await supabaseClient.query('operaciones', 'SELECT', null, '?order=created_at.desc&limit=50');
    if (data) {
      // Procesar operaciones para mostrar nombres de clientes
      const operacionesConClientes = await Promise.all(
        data.map(async (op) => {
          const cliente = await supabaseClient.query('clientes', 'SELECT', null, `?id=eq.${op.cliente_id}&select=nombre`);
          return {
            ...op,
            cliente_nombre: cliente && cliente[0] ? cliente[0].nombre : 'Cliente eliminado'
          };
        })
      );
      setOperaciones(operacionesConClientes);
    }
    setLoading(false);
  };

  // Login
  const handleLogin = async () => {
    setLoading(true);
    
    // Usuarios predefinidos (en producción estos estarían en la base de datos)
    const usuarios = {
      'recepcionista': { password: 'recep123', rol: 'recepcionista', nombre: 'Recepcionista' },
      'admin1': { password: 'admin123', rol: 'admin1', nombre: 'Administrador 1' },
      'admin2': { password: 'admin456', rol: 'admin2', nombre: 'Administrador 2' }
    };

    const user = usuarios[loginForm.username];
    if (user && user.password === loginForm.password) {
      setCurrentUser({
        username: loginForm.username,
        rol: user.rol,
        nombre: user.nombre
      });
      setShowLogin(false);
      setLoginForm({ username: '', password: '' });
    } else {
      alert('Usuario o contraseña incorrectos');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowLogin(true);
    setClientes([]);
    setOperaciones([]);
  };

  // Agregar nuevo cliente
  const agregarCliente = async () => {
    if (!nuevoCliente.trim()) return;
    
    setLoading(true);
    const nuevoClienteData = {
      nombre: nuevoCliente.trim(),
      fecha_registro: new Date().toISOString()
    };

    const result = await supabaseClient.query('clientes', 'POST', nuevoClienteData);
    if (result) {
      await cargarClientes();
      setNuevoCliente('');
    }
    setLoading(false);
  };

  // Agregar producto a la operación
  const agregarProducto = () => {
    setOperacionActual({
      ...operacionActual,
      productos: [...operacionActual.productos, { productoId: '', metodoPago: 'Efectivo' }]
    });
  };

  // Actualizar producto en la operación
  const actualizarProducto = (index, campo, valor) => {
    const nuevosProductos = [...operacionActual.productos];
    nuevosProductos[index][campo] = valor;
    setOperacionActual({
      ...operacionActual,
      productos: nuevosProductos
    });
  };

  // Eliminar producto
  const eliminarProducto = (index) => {
    const nuevosProductos = operacionActual.productos.filter((_, i) => i !== index);
    setOperacionActual({
      ...operacionActual,
      productos: nuevosProductos
    });
  };

  // Calcular totales
  const calcularTotales = () => {
    let subtotal = 0;
    let comisionNessty = 0;
    
    operacionActual.productos.forEach(prod => {
      if (prod.productoId) {
        const producto = productos.find(p => p.id === parseInt(prod.productoId));
        if (producto) {
          subtotal += producto.precio;
          if (prod.metodoPago === 'Nessty') {
            comisionNessty += producto.precio * 0.068;
          }
        }
      }
    });

    let montoDescuento = 0;
    if (operacionActual.descuentoValor > 0) {
      if (operacionActual.descuentoTipo === 'porcentaje') {
        montoDescuento = subtotal * (operacionActual.descuentoValor / 100);
      } else {
        montoDescuento = parseFloat(operacionActual.descuentoValor);
      }
    }

    montoDescuento = Math.min(montoDescuento, subtotal);
    const totalFinal = subtotal - montoDescuento + comisionNessty;

    return {
      subtotal,
      montoDescuento,
      comisionNessty,
      totalFinal
    };
  };

  // Registrar operación
  const registrarOperacion = async () => {
    if (!operacionActual.cliente || operacionActual.productos.some(p => !p.productoId)) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    const totales = calcularTotales();
    
    // Buscar ID del cliente
    const clienteData = await supabaseClient.query('clientes', 'SELECT', null, `?nombre=eq.${encodeURIComponent(operacionActual.cliente)}&select=id`);
    if (!clienteData || clienteData.length === 0) {
      alert('Cliente no encontrado');
      setLoading(false);
      return;
    }

    const nuevaOperacion = {
      cliente_id: clienteData[0].id,
      fecha: operacionActual.fecha,
      productos: JSON.stringify(operacionActual.productos),
      subtotal: totales.subtotal,
      descuento_tipo: operacionActual.descuentoTipo,
      descuento_valor: parseFloat(operacionActual.descuentoValor) || 0,
      monto_descuento: totales.montoDescuento,
      comision_nessty: totales.comisionNessty,
      total_final: totales.totalFinal,
      comentarios: operacionActual.comentarios,
      usuario: currentUser.username
    };

    const result = await supabaseClient.query('operaciones', 'POST', nuevaOperacion);
    if (result) {
      await cargarOperaciones();
      // Resetear formulario
      setOperacionActual({
        cliente: '',
        fecha: new Date().toISOString().split('T')[0],
        productos: [{ productoId: '', metodoPago: 'Efectivo' }],
        descuentoTipo: 'pesos',
        descuentoValor: 0,
        comentarios: ''
      });
      alert('Operación registrada exitosamente');
    }
    setLoading(false);
  };

  const totales = calcularTotales();

  // Pantalla de login
  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-purple-700 mb-2">ALINEA</h1>
            <p className="text-gray-600">Sistema de Gestión</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Usuario</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Ingresa tu usuario"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Ingresa tu contraseña"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded text-sm">
            <p className="font-semibold mb-2">Usuarios de prueba:</p>
            <p><strong>recepcionista</strong> / recep123</p>
            <p><strong>admin1</strong> / admin123</p>
            <p><strong>admin2</strong> / admin456</p>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla principal
  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header con info del usuario */}
      <div className="bg-white rounded-lg shadow-lg p-4 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-purple-700">Sistema ALINEA</h1>
          <p className="text-gray-600">Bienvenido, {currentUser.nombre}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
          Cargando datos...
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {/* Gestión de Clientes */}
        <div className="mb-8 p-4 bg-purple-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <User className="mr-2" /> Gestión de Clientes
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre del nuevo cliente"
              value={nuevoCliente}
              onChange={(e) => setNuevoCliente(e.target.value)}
              className="flex-1 p-2 border rounded"
              onKeyPress={(e) => e.key === 'Enter' && agregarCliente()}
            />
            <button
              onClick={agregarCliente}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
          {clientes.length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              Clientes registrados: {clientes.length}
            </div>
          )}
        </div>

        {/* Formulario de Operación */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center">
              <FileText className="mr-2" /> Nueva Operación
            </h2>

            {/* Cliente y Fecha */}
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              <select
                value={operacionActual.cliente}
                onChange={(e) => setOperacionActual({...operacionActual, cliente: e.target.value})}
                className="w-full p-2 border rounded"
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map(cliente => (
                  <option key={cliente.id} value={cliente.nombre}>{cliente.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fecha</label>
              <input
                type="date"
                value={operacionActual.fecha}
                onChange={(e) => setOperacionActual({...operacionActual, fecha: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>

            {/* Productos */}
            <div>
              <label className="block text-sm font-medium mb-1">Clases/Productos *</label>
              {operacionActual.productos.map((producto, index) => (
                <div key={index} className="mb-3 p-3 border rounded bg-gray-50">
                  <div className="grid grid-cols-1 gap-2 mb-2">
                    <select
                      value={producto.productoId}
                      onChange={(e) => actualizarProducto(index, 'productoId', e.target.value)}
                      className="p-2 border rounded"
                    >
                      <option value="">Seleccionar clase/producto</option>
                      {productos.map(prod => (
                        <option key={prod.id} value={prod.id}>
                          {prod.nombre} - ${prod.precio.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <select
                      value={producto.metodoPago}
                      onChange={(e) => actualizarProducto(index, 'metodoPago', e.target.value)}
                      className="p-2 border rounded"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Nessty">Nessty (+6.8%)</option>
                    </select>
                  </div>
                  {operacionActual.productos.length > 1 && (
                    <button
                      onClick={() => eliminarProducto(index)}
                      className="text-red-600 hover:text-red-800 text-sm flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={agregarProducto}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                + Agregar Clase/Producto
              </button>
            </div>

            {/* Descuento */}
            <div>
              <label className="block text-sm font-medium mb-1">
                <Percent className="inline w-4 h-4 mr-1" />
                Descuento *
              </label>
              <div className="flex gap-2">
                <select
                  value={operacionActual.descuentoTipo}
                  onChange={(e) => setOperacionActual({...operacionActual, descuentoTipo: e.target.value, descuentoValor: 0})}
                  className="w-24 p-2 border rounded"
                >
                  <option value="pesos">$</option>
                  <option value="porcentaje">%</option>
                </select>
                <input
                  type="number"
                  min="0"
                  max={operacionActual.descuentoTipo === 'porcentaje' ? 100 : undefined}
                  step={operacionActual.descuentoTipo === 'porcentaje' ? 0.1 : 1}
                  value={operacionActual.descuentoValor}
                  onChange={(e) => setOperacionActual({...operacionActual, descuentoValor: e.target.value})}
                  placeholder={operacionActual.descuentoTipo === 'porcentaje' ? '0-100' : '0'}
                  className="flex-1 p-2 border rounded"
                />
              </div>
              <small className="text-gray-500 text-xs mt-1 block">
                {operacionActual.descuentoTipo === 'porcentaje' 
                  ? 'Ingresa el porcentaje de descuento (0-100)' 
                  : 'Ingresa el monto en pesos del descuento'}
              </small>
            </div>

            {/* Comentarios */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Comentarios/Observaciones (Opcional)
              </label>
              <textarea
                value={operacionActual.comentarios}
                onChange={(e) => setOperacionActual({...operacionActual, comentarios: e.target.value})}
                placeholder="Agregar algún comentario u observación..."
                className="w-full p-2 border rounded h-20 resize-none"
              />
            </div>
          </div>

          {/* Resumen de Cálculos */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center">
              <CreditCard className="mr-2" /> Resumen de Pago
            </h2>
            
            <div className="p-4 bg-gray-100 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${totales.subtotal.toLocaleString()}</span>
              </div>
              {totales.montoDescuento > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento ({operacionActual.descuentoTipo === 'porcentaje' ? operacionActual.descuentoValor + '%' : '$' + operacionActual.descuentoValor}):</span>
                  <span>-${totales.montoDescuento.toLocaleString()}</span>
                </div>
              )}
              {totales.comisionNessty > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Comisión Nessty (6.8%):</span>
                  <span>+${totales.comisionNessty.toLocaleString()}</span>
                </div>
              )}
              <hr className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total Final:</span>
                <span>${totales.totalFinal.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={registrarOperacion}
              disabled={loading}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center disabled:opacity-50"
            >
              <Save className="mr-2" />
              {loading ? 'Registrando...' : 'Registrar Operación'}
            </button>
          </div>
        </div>
      </div>

      {/* Historial de Operaciones */}
      {(currentUser.rol === 'admin1' || currentUser.rol === 'admin2') && operaciones.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Historial de Operaciones</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left">Clases/Productos</th>
                  <th className="p-2 text-left">Subtotal</th>
                  <th className="p-2 text-left">Descuento</th>
                  <th className="p-2 text-left">Comisión</th>
                  <th className="p-2 text-left">Total</th>
                  <th className="p-2 text-left">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {operaciones.map(op => (
                  <tr key={op.id} className="border-b">
                    <td className="p-2">{new Date(op.fecha).toLocaleDateString()}</td>
                    <td className="p-2">{op.cliente_nombre}</td>
                    <td className="p-2">
                      {JSON.parse(op.productos || '[]').map((prod, i) => {
                        const producto = productos.find(p => p.id === parseInt(prod.productoId));
                        return (
                          <div key={i} className="text-xs">
                            {producto?.nombre} ({prod.metodoPago})
                          </div>
                        );
                      })}
                    </td>
                    <td className="p-2">${op.subtotal?.toLocaleString()}</td>
                    <td className="p-2 text-green-600">
                      {op.monto_descuento > 0 ? 
                        `-$${op.monto_descuento?.toLocaleString()} (${op.descuento_tipo === 'porcentaje' ? op.descuento_valor + '%' : '$' + op.descuento_valor})` 
                        : '-'}
                    </td>
                    <td className="p-2 text-orange-600">
                      {op.comision_nessty > 0 ? `+$${op.comision_nessty?.toLocaleString()}` : '-'}
                    </td>
                    <td className="p-2 font-bold">${op.total_final?.toLocaleString()}</td>
                    <td className="p-2 text-xs">{op.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllineaSystem;