// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDhPRVu8n_pZQzJPVWNFlJonmj5KEYsF10",
    authDomain: "movimagic.firebaseapp.com",
    projectId: "movimagic",
    storageBucket: "movimagic.appspot.com",
    messagingSenderId: "518388279864",
    appId: "1:518388279864:web:a6f699391ec5bb627c14cd",
    measurementId: "G-GG65HJV2T6",
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const loginForm = document.getElementById("reseller-login-form");
const createUserForm = document.getElementById("create-user-form");
const resellerPanel = document.getElementById("reseller-panel");
const loginContainer = document.getElementById("login-container");
const userList = document.getElementById("user-list");
const availableCredits = document.getElementById("available-credits");
const creditWarning = document.getElementById("credit-warning");

let currentResellerId = null;

let loggedInResellerId = null; // Variable global para almacenar el ID del reseller logeado

// Login
document.getElementById("reseller-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("reseller-email").value;
    const password = document.getElementById("reseller-password").value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);

        // Buscar el documento del reseller en Firestore
        const querySnapshot = await db.collection("resellers").where("email", "==", email).where("password", "==", password).get();
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            loggedInResellerId = doc.id; // Guardar el ID del documento (resellerId)
            console.log("Reseller logeado con ID:", loggedInResellerId);

            // Mostrar el panel y cargar datos
            document.getElementById("login-container").classList.add("hidden");
            document.getElementById("reseller-panel").classList.remove("hidden");
            loadCredits(); // Cargar los créditos del reseller
            loadUsers(); // Cargar los usuarios creados por el reseller
        } else {
            throw new Error("Reseller no encontrado.");
        }
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        alert("Error al iniciar sesión. Verifica tus credenciales.");
    }
});


// Cerrar sesión
document.getElementById("logout-btn").addEventListener("click", () => {
  currentResellerId = null;
  resellerPanel.classList.add("hidden");
  loginContainer.classList.remove("hidden");
});


// Crear Usuario
document.getElementById("create-user-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("user-name").value;
  const email = document.getElementById("user-email").value;
  const password = document.getElementById("user-password").value;
  const expirationDate = document.getElementById("expiration-date").value;

  try {
    // UID del reseller autenticado
    const resellerId = auth.currentUser.uid;

    // Obtener datos del reseller
    const resellerDoc = await db.collection("resellers").doc(resellerId).get();
    if (!resellerDoc.exists) {
      throw new Error("El reseller no existe.");
    }

    const resellerData = resellerDoc.data();
    if (resellerData.credits <= 0) {
      alert("No tienes suficientes créditos para crear un usuario.");
      return;
    }

    // Obtener el adminId del reseller
    const adminId = resellerData.adminId;

    // Crear usuario en Authentication
    const newUser = await auth.createUserWithEmailAndPassword(email, password);

    // Convertir fecha de expiración a Timestamp
    const expirationTimestamp = firebase.firestore.Timestamp.fromDate(new Date(expirationDate));

    // Guardar usuario en Firestore con resellerId y adminId
    await db.collection("users").doc(newUser.user.uid).set({
      username: name,
      email: email,
      password: password,
      expirationDate: expirationTimestamp,
      resellerId: resellerId, // Asociar al reseller que creó este usuario
      adminId: adminId, // Asociar al administrador que creó al reseller
    });

    // Descontar crédito del reseller
    await db.collection("resellers").doc(resellerId).update({
      credits: resellerData.credits - 1,
    });

    alert("Usuario creado con éxito.");
    loadUsers(); // Recargar usuarios
    loadCredits(); // Recargar créditos
  } catch (error) {
    console.error("Error al crear usuario:", error);
    alert(`Error al crear usuario: ${error.message}`);
  }
});




async function loadUsers() {
    try {
        if (!loggedInResellerId) throw new Error("El reseller no está logeado.");
        console.log(`Cargando usuarios creados por el reseller ID: ${loggedInResellerId}`);
        
        const querySnapshot = await db.collection("users").where("resellerId", "==", loggedInResellerId).get();
        const userList = document.getElementById("user-list");
        userList.innerHTML = ""; // Limpiar la tabla de usuarios
        
        if (querySnapshot.empty) {
            userList.innerHTML = "<tr><td colspan='4'>No se encontraron usuarios.</td></tr>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const user = doc.data();
            userList.innerHTML += `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>${user.password}</td>
                    <td>${user.expirationDate.toDate().toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button title="Renovar 1 mes" onclick="renewUser('${doc.id}', 1)">
                                <i class="fas fa-rotate"> 1</i>
                            </button>
                            <button title="Renovar 3 meses" onclick="renewUser('${doc.id}', 3)">
                                <i class="fas fa-rotate"> 3</i>
                            </button>
                            <button title="Renovar 6 meses" onclick="renewUser('${doc.id}', 6)">
                                <i class="fas fa-rotate"> 6</i>
                            </button>
                            <button title="Renovar 12 meses" onclick="renewUser('${doc.id}', 12)">
                                <i class="fas fa-rotate"> 12</i>
                            </button>
                            <button title="Editar usuario" onclick="editUser('${doc.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button title="Ver dispositivos" onclick="loadDevices('${doc.id}')">
                                <i class="fas fa-laptop"></i>
                            </button>
                            <button title="Eliminar usuario" onclick="deleteUser('${doc.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
    }
}


// Función para renovar usuario
async function renewUser(userId, months) {
    try {
        console.log(`Intentando renovar usuario con ID: ${userId} por ${months} meses.`);
        if (!loggedInResellerId) throw new Error("El reseller no está logeado.");

        const resellerDoc = await db.collection("resellers").doc(loggedInResellerId).get();
        if (!resellerDoc.exists) throw new Error("El reseller no existe.");

        const currentCredits = resellerDoc.data().credits;
        if (currentCredits < months) throw new Error("Créditos insuficientes.");

        // Descontar créditos y renovar usuario
        await db.collection("resellers").doc(loggedInResellerId).update({
            credits: currentCredits - months
        });

        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            const expirationDate = userDoc.data().expirationDate.toDate();
            expirationDate.setMonth(expirationDate.getMonth() + months);
            await userRef.update({
                expirationDate: firebase.firestore.Timestamp.fromDate(expirationDate)
            });
            console.log(`Usuario renovado por ${months} meses.`);
        }

        // Actualizar créditos en el frontend
        loadCredits();
    } catch (error) {
        console.error("Error al renovar usuario:", error);
        alert(`Error al renovar usuario: ${error.message}`);
    }
}

// eliminar
async function deleteUser(userId) {
  try {
    await db.collection("users").doc(userId).delete();
    alert("Usuario eliminado.");
    loadUsers();
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
  }
}

// Ver Dispositivos - Mostrar dispositivos asociados a un usuario
async function viewDevices(userId) {
    try {
        console.log(`Cargando dispositivos para el usuario con ID: ${userId}`);
        const devicesRef = db.collection("users").doc(userId).collection("devices");
        const querySnapshot = await devicesRef.get();

        const deviceList = document.getElementById("device-list"); // Asegúrate de tener este contenedor en tu HTML
        deviceList.innerHTML = ""; // Limpiar la lista de dispositivos

        if (querySnapshot.empty) {
            deviceList.innerHTML = "<tr><td colspan='2'>No se encontraron dispositivos para este usuario.</td></tr>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const deviceId = doc.id;
            deviceList.innerHTML += `
                <tr>
                    <td>${deviceId}</td>
                    <td>
                        <button onclick="deleteDevice('${userId}', '${deviceId}')">Eliminar</button>
                    </td>
                </tr>`;
        });
    } catch (error) {
        console.error("Error al cargar dispositivos:", error);
        alert("Hubo un problema al cargar los dispositivos.");
    }
}

// Eliminar Dispositivo
async function deleteDevice(userId, deviceId) {
    try {
        await db.collection("users").doc(userId).collection("devices").doc(deviceId).delete();
        alert("Dispositivo eliminado con éxito.");
        viewDevices(userId); // Recargar la lista de dispositivos
    } catch (error) {
        console.error("Error al eliminar dispositivo:", error);
    }
}

// editar usuario
async function editUser(userId) {
    try {
        // Obtener datos actuales del usuario
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
            throw new Error("El usuario no existe.");
        }

        const userData = userDoc.data();

        // Solicitar nuevo nombre del usuario
        const newName = prompt("Editar nombre de usuario:", userData.username);

        if (!newName) {
            alert("El nombre de usuario no puede estar vacío.");
            return;
        }

        // Actualizar datos en Firestore
        await db.collection("users").doc(userId).update({
            username: newName,
        });

        alert("Nombre de usuario actualizado con éxito.");
        loadUsers(); // Recargar lista de usuarios
    } catch (error) {
        console.error("Error al editar usuario:", error);
        alert(`Error al editar usuario: ${error.message}`);
    }
}


// Función para cargar créditos
async function loadCredits() {
    try {
        if (!loggedInResellerId) throw new Error("El reseller no está logeado.");
        const resellerDoc = await db.collection("resellers").doc(loggedInResellerId).get();
        if (!resellerDoc.exists) throw new Error("El reseller no existe.");
        const credits = resellerDoc.data().credits;
        document.getElementById("available-credits").textContent = credits;
    } catch (error) {
        console.error("Error al cargar créditos:", error);
    }
}

async function loadDevices(userId) {
  try {
    console.log(`Intentando cargar dispositivos para el usuario con ID: ${userId}`);
    
    const devicesRef = db.collection("users").doc(userId).collection("devices");
    const querySnapshot = await devicesRef.get();

    const deviceList = document.getElementById("device-list");
    if (!deviceList) {
      console.error("No se encontró el elemento con ID 'device-list' en el HTML.");
      return;
    }

    deviceList.innerHTML = ""; // Limpia la lista de dispositivos

    if (querySnapshot.empty) {
      console.log("No se encontraron dispositivos en la subcolección.");
      deviceList.innerHTML = "<tr><td colspan='2'>No se encontraron dispositivos para este usuario.</td></tr>";
      return;
    }

    console.log(`Se encontraron ${querySnapshot.size} dispositivos.`);
    querySnapshot.forEach((doc) => {
      const deviceId = doc.id;
      console.log(`Dispositivo encontrado: ${deviceId}`);
      deviceList.innerHTML += `
        <tr>
          <td>${deviceId}</td>
          <td>
            <button onclick="deleteDevice('${userId}', '${deviceId}')">Eliminar</button>
          </td>
        </tr>`;
    });
  } catch (error) {
    console.error("Error al cargar dispositivos:", error);
    alert("Hubo un problema al cargar los dispositivos.");
  }
}

