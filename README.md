# Sistema de gestión de atención

Aplicación inicial para organizar turnos en cuatro mesas de atención. El backend usa Python y FastAPI; la interfaz usa Angular.

## Funciones

- Los clientes pueden sacar un turno desde la pantalla pública.
- El personal puede marcar cada mesa libre u ocupada y llamar al siguiente turno.
- Los turnos se asignan en orden de llegada a la primera mesa libre.
- La cola y los turnos quedan guardados en SQLite.

## Requisitos

- Python 3.10 o posterior.
- Node.js 20.19 o posterior y npm.

## Iniciar en desarrollo

En una terminal, iniciar el backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

En otra terminal, iniciar Angular:

```powershell
cd frontend
npm install
npm start
```

Abrir http://localhost:4200. La API queda en http://localhost:8000 y su documentación en http://localhost:8000/docs.

## GitHub

El proyecto puede subirse creando un repositorio vacío en GitHub y ejecutando desde esta carpeta:

```powershell
git init
git add .
git commit -m "Sistema inicial de gestión de atención"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Reemplaza la URL por la del repositorio que crees en tu cuenta.
