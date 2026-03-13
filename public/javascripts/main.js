document.addEventListener("DOMContentLoaded", function () {

  // ==========================================
  // CONFIGURACIÓN INICIAL DEL MAPA (LEAFLET)
  // ==========================================
  const mapCenter = [36.7213, -4.4217]; // Centro genérico Málaga
  const map = L.map('map').setView(mapCenter, 14);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Marcadores
  let userMarker = null; // Mi ubicación actual (círculo azul o humano)
  let carMarker = null;  // Ubicación del coche (marcador rojo coche)

  // Iconos personalizados simples pero reconocibles (Bootstrap Icons base o emojis)
  const carIcon = L.divIcon({
    html: '<div style="font-size:24px; background: white; border-radius:50%; width: 34px; height: 34px; text-align:center; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">🚗</div>',
    className: 'car-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });

  const userIcon = L.divIcon({
    html: '<div style="background-color: #007bff; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
    className: 'user-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });


  // ==========================================
  // ESTADO LOCAL (localStorage)
  // ==========================================
  const STORAGE_KEY = 'aparcabien_estado';
  let estado = cargarEstado(); 

  // Función para obtener estado (coche aparcado y su historial)
  function cargarEstado() {
    let saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) {
      saved = {
        aparcamientoActual: null, // { lat, lng, time }
        historial: []             // array de { lat, lng, time }
      };
    }
    return saved;
  }

  function guardarEstado() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    renderizarHistorial();
  }


  // ==========================================
  // GEOLOCALIZACIÓN 
  // ==========================================
  let watchId = null;
  let ultimaLatUser = null;
  let ultimaLngUser = null;
  let intervaloTiempo = null;

  // Iniciar el watchPosition (se llama siempre que cargamos la página)
  function iniciarGeolocalizacion() {
    if (!navigator.geolocation) {
      Swal.fire('Error', 'Tu navegador no soporta geolocalización', 'error');
      return;
    }

    // Vigila continuamente la posición del usuario
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        ultimaLatUser = latitude;
        ultimaLngUser = longitude;

        // Actualizar el marcador del usuario
        if (!userMarker) {
          userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
          // Solo hacer un zoom brusco la primera vez
          map.setView([latitude, longitude], 17);
        } else {
          userMarker.setLatLng([latitude, longitude]);
        }

        // Si hay un coche aparcado, recalcular cálculos y trazar vista
        if (estado.aparcamientoActual) {
          calcularMetricas(latitude, longitude, estado.aparcamientoActual);
        }
      },
      (err) => {
        console.warn("No se pudo obtener la geolocalización:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  }


  // ==========================================
  // FLUJO DE LA INTERFAZ
  // ==========================================
  const btnAparcar = document.getElementById('btnAparcar');
  const btnFinalizar = document.getElementById('btnFinalizar');
  const statusPanel = document.getElementById('statusPanel');
  const activePanel = document.getElementById('activePanel');
  const txtDistancia = document.getElementById('distanciaValor');
  const txtTiempo = document.getElementById('tiempoValor');
  const historialLista = document.getElementById('historialLista');

  // Inicializar vista basada en estado
  function inicializarVista() {
    iniciarGeolocalizacion();

    if (estado.aparcamientoActual) {
      mostrarModoAparcado();
    } else {
      mostrarModoLibre();
    }
    renderizarHistorial();
  }

  function mostrarModoAparcado() {
    statusPanel.classList.add('d-none');
    activePanel.classList.remove('d-none');

    // Pintar coche en el mapa
    const { lat, lng } = estado.aparcamientoActual;
    if (carMarker) {
      carMarker.setLatLng([lat, lng]);
    } else {
      carMarker = L.marker([lat, lng], { icon: carIcon }).addTo(map);
      carMarker.bindPopup('<b class="text-danger">Tu coche está aquí</b>');
    }

    if (userMarker) {
      // Ajustar la vista para que se vean ambos
      const bounds = L.latLngBounds([userMarker.getLatLng(), [lat, lng]]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    iniciarReloj();
  }

  function mostrarModoLibre() {
    statusPanel.classList.remove('d-none');
    activePanel.classList.add('d-none');

    if (carMarker) {
      map.removeLayer(carMarker);
      carMarker = null;
    }

    detenerReloj();
    if (userMarker) {
      map.setView(userMarker.getLatLng(), 17);
    }
  }


  // ==========================================
  // EVENTOS CLAVE
  // ==========================================

  // APARCAR
  btnAparcar.addEventListener('click', () => {
    if (!ultimaLatUser) {
      // Si falla el GPS, que pueda aparcar igual (usar el centro del mapa)
      ultimaLatUser = map.getCenter().lat;
      ultimaLngUser = map.getCenter().lng;
      Swal.fire({
          icon: 'warning',
          title: 'Sin GPS de alta precisión',
          text: 'Usando centro de pantalla para geolocalizar el coche.',
          toast: true,
          position: 'top',
          timer: 3000,
          showConfirmButton: false
      });
    }

    // Registrar posición del coche
    estado.aparcamientoActual = {
      lat: ultimaLatUser,
      lng: ultimaLngUser,
      time: Date.now()
    };
    guardarEstado();

    Swal.fire({
      icon: 'success',
      title: 'Aparcado',
      text: 'Tu vehículo ha sido geolocalizado.',
      timer: 2000,
      showConfirmButton: false
    });

    mostrarModoAparcado();
  });

  // FINALIZAR APARCAMIENTO
  btnFinalizar.addEventListener('click', () => {
    Swal.fire({
      title: '¿Ya estás en tu coche?',
      text: "Se finalizará la sesión y pasará al historial.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, finalizar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Mover al historial
        estado.historial.unshift(estado.aparcamientoActual); // Añade al principio
        estado.aparcamientoActual = null;
        guardarEstado();

        Swal.fire('Listo', 'Buen viaje 👋', 'success');
        mostrarModoLibre();
      }
    });
  });


  // ==========================================
  // CÁLCULOS: Distancia y Tiempo
  // ==========================================

  function calcularMetricas(userLat, userLng, cocheCoords) {
    if (!cocheCoords) return;

    // Distancia de Haversine nativa en Leaflet (devuelve metros)
    const posUsuario = L.latLng(userLat, userLng);
    const posCoche = L.latLng(cocheCoords.lat, cocheCoords.lng);
    const distanciaMs = posUsuario.distanceTo(posCoche);

    if (distanciaMs > 1000) {
      txtDistancia.textContent = (distanciaMs / 1000).toFixed(2) + ' km';
    } else {
      txtDistancia.textContent = Math.round(distanciaMs) + ' m';
    }

    // Ajustar mapa si estamos muy separados
    if (carMarker && userMarker) {
       const bounds = L.latLngBounds([userMarker.getLatLng(), carMarker.getLatLng()]);
       // Si no están excesivamente cerca, encuadrar ambos
       if (distanciaMs > 50) {
           map.fitBounds(bounds, { padding: [40, 40] });
       }
    }
  }

  function iniciarReloj() {
    detenerReloj(); // por si acaso
    actualizarTiempo(); // primera llamada
    intervaloTiempo = setInterval(actualizarTiempo, 60000); // 1 minuto
  }

  function detenerReloj() {
    if (intervaloTiempo) clearInterval(intervaloTiempo);
  }

  function actualizarTiempo() {
    if (!estado.aparcamientoActual) return;
    const past = estado.aparcamientoActual.time;
    const now = Date.now();
    
    // Diferencia en milisegundos
    let diffMs = now - past;
    let diffMins = Math.floor(diffMs / 60000);
    
    let hours = Math.floor(diffMins / 60);
    let mins = diffMins % 60;

    if (hours > 0) {
      txtTiempo.textContent = `${hours}h ${mins}m`;
    } else {
      txtTiempo.textContent = `${mins} min`;
    }
  }


  // ==========================================
  // HISTORIAL DE APARCAMIENTOS
  // ==========================================
  function renderizarHistorial() {
    historialLista.innerHTML = '';
    
    if (estado.historial.length === 0) {
      historialLista.innerHTML = '<div class="p-3 text-center text-muted">No hay histórico de aparcamientos.</div>';
      return;
    }

    estado.historial.forEach((item, index) => {
      const fecha = new Date(item.time).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
      
      const div = document.createElement('div');
      div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center bg-light mb-1';
      div.style.cursor = 'pointer';
      
      // Estructura
      div.innerHTML = `
        <div>
          <strong class="d-block mb-1">🚗 Aparcamiento</strong>
          <small class="text-muted">${fecha}</small>
        </div>
        <button class="btn btn-sm btn-outline-secondary btnIr">Ver <br>mapa</button>
      `;

      // Click para saltar al mapa en esa posición
      div.querySelector('.btnIr').addEventListener('click', (e) => {
        e.stopPropagation();
        map.flyTo([item.lat, item.lng], 18);
        L.popup()
          .setLatLng([item.lat, item.lng])
          .setContent(`<p class="m-0 text-center">Aparcaste aquí el:<br><b>${fecha}</b></p>`)
          .openOn(map);
      });

      historialLista.appendChild(div);
    });
  }


  // ==========================================
  // AUTENTICACIÓN LOGIC (Header y Nube)
  // ==========================================
  const btnLogin = document.getElementById('btnLogin');
  const authSection = document.getElementById('authSection');
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');

  function updateAuthUI() {
    if (window.USER_LOGGED_IN) {
      authSection.innerHTML = `
        <span class="navbar-text me-3 text-white">👤 ${window.USER_LOGGED_IN}</span>
        <button id="btnLogoutBtn" class="btn btn-sm btn-outline-light">Logout</button>
      `;
      // Escuchar Logout (ajax)
      document.getElementById('btnLogoutBtn').addEventListener('click', async () => {
        await fetch('/logout', { method: 'POST' });
        window.USER_LOGGED_IN = '';
        updateAuthUI();
        Swal.fire('Sesión Cerrada', 'Tus datos volverán a ser solo locales', 'info');
      });
    } else {
      authSection.innerHTML = `
        <button id="btnLogin" class="btn btn-sm btn-dark" data-bs-toggle="modal" data-bs-target="#modalLogin">
          Iniciar sesión
        </button>
      `;
    }
  }
  
  updateAuthUI(); // Lanzar la primera vez

  // Login POST por AJAX
  if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener('click', async () => {
      const user = document.getElementById('loginUser').value;
      const pass = document.getElementById('loginPass').value;

      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await res.json();

      if (data.success) {
        // Esconder modal de Bootstrap
        const modalEl = document.getElementById('modalLogin');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        window.USER_LOGGED_IN = data.username;
        updateAuthUI();

        Swal.fire('Hola ' + data.username, 'Ahora puedes sincronizar tus datos en la nube', 'success');
        
        // Auto-Traer sync si hay
        descargarDeLaNube();
      } else {
        Swal.fire('Error', data.error, 'error');
      }
    });
  }

  // ==========================================
  // SYNC CON LA NUBE (ALMACENAMIENTO REMOTO)
  // ==========================================
  const btnSync = document.getElementById('btnSync');
  
  btnSync.addEventListener('click', async () => {
    if (!window.USER_LOGGED_IN) {
      Swal.fire('Debes iniciar sesión', 'Inicia sesión para subir y bajar datos de la nube.', 'warning');
      return;
    }

    try {
      // Mandamos nuestro estado localStorage a la "Base de Datos" (simulada)
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estado)
      });
      const data = await res.json();
      
      if (data.success) {
        Swal.fire({
            title: 'Sincronizado',
            text: 'Tus ubicaciones están respaldadas en la nube',
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
      }
    } catch (err) {
      Swal.fire('Error en Sync', 'Hubo un problema de conexión', 'error');
    }
  });

  async function descargarDeLaNube() {
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const data = await res.json();
        // Mezclamos (en este caso el remoto machaca si existe, para simplificar)
        if (data && data.historial) {
            estado = data;
            guardarEstado(); // Lo guarda en localStorage
            
            // Refrescar mapa (quitar coches si ya no están aparcados, etc)
            if (estado.aparcamientoActual) mostrarModoAparcado();
            else mostrarModoLibre();
        }
      }
    } catch (e) {}
  }

  // ==========================================
  // ARRANQUE
  // ==========================================
  inicializarVista();

});
