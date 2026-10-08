from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).resolve().parent.parent / "turnos.db"
lock = Lock()


def connect():
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    return db


def initialize():
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS desks (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'libre',
            current_ticket TEXT)""")
        db.execute("""CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL,
            customer TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'esperando',
            desk_id INTEGER, created_at TEXT NOT NULL, called_at TEXT)""")
        for desk_id in range(1, 5):
            db.execute("INSERT OR IGNORE INTO desks(id, name) VALUES (?, ?)",
                       (desk_id, f"Mesa {desk_id}"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize()
    yield


app = FastAPI(title="Gestión de atención", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:4200"],
                   allow_credentials=False, allow_methods=["GET", "POST", "PATCH"],
                   allow_headers=["*"])


class TicketRequest(BaseModel):
    customer: str = Field(min_length=1, max_length=80)


class DeskStatus(BaseModel):
    status: str


def state():
    with connect() as db:
        desks = [dict(row) for row in db.execute("SELECT * FROM desks ORDER BY id")]
        queue = [dict(row) for row in db.execute(
            "SELECT code, customer, created_at FROM tickets WHERE status='esperando' ORDER BY id")]
        current = [dict(row) for row in db.execute(
            "SELECT code, customer, desk_id, called_at FROM tickets WHERE status='atendiendo' ORDER BY desk_id")]
        recent = [dict(row) for row in db.execute(
            "SELECT code, customer, desk_id, status FROM tickets WHERE status IN ('atendiendo','finalizado') ORDER BY id DESC LIMIT 8")]
    return {"desks": desks, "queue": queue, "current": current, "recent": recent}


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/state")
def get_state():
    return state()


@app.post("/api/tickets", status_code=201)
def create_ticket(payload: TicketRequest):
    customer = payload.customer.strip()
    if not customer:
        raise HTTPException(422, "Escribe tu nombre para sacar un turno.")
    with lock, connect() as db:
        count = db.execute("SELECT COUNT(*) FROM tickets WHERE date(created_at)=date('now')").fetchone()[0]
        code = f"T{count + 1:03d}"
        now = datetime.now(timezone.utc).isoformat()
        db.execute("INSERT INTO tickets(code, customer, created_at) VALUES (?, ?, ?)",
                   (code, customer, now))
    return {"code": code, "customer": customer, "created_at": now}


@app.post("/api/desks/{desk_id}/next")
def call_next(desk_id: int):
    with lock, connect() as db:
        desk = db.execute("SELECT * FROM desks WHERE id=?", (desk_id,)).fetchone()
        if desk is None:
            raise HTTPException(404, "Mesa no encontrada.")
        if desk["status"] != "libre":
            raise HTTPException(409, "Esta mesa está ocupada. Libérala antes de llamar otro turno.")
        ticket = db.execute("SELECT * FROM tickets WHERE status='esperando' ORDER BY id LIMIT 1").fetchone()
        if ticket is None:
            raise HTTPException(404, "No hay turnos en espera.")
        now = datetime.now(timezone.utc).isoformat()
        db.execute("UPDATE tickets SET status='atendiendo', desk_id=?, called_at=? WHERE id=?",
                   (desk_id, now, ticket["id"]))
        db.execute("UPDATE desks SET status='ocupada', current_ticket=? WHERE id=?",
                   (ticket["code"], desk_id))
    return {"code": ticket["code"], "customer": ticket["customer"], "desk_id": desk_id}


@app.patch("/api/desks/{desk_id}")
def set_desk_status(desk_id: int, payload: DeskStatus):
    if payload.status not in {"libre", "ocupada"}:
        raise HTTPException(422, "El estado debe ser libre u ocupada.")
    with lock, connect() as db:
        desk = db.execute("SELECT * FROM desks WHERE id=?", (desk_id,)).fetchone()
        if desk is None:
            raise HTTPException(404, "Mesa no encontrada.")
        if payload.status == "libre" and desk["current_ticket"]:
            db.execute("UPDATE tickets SET status='finalizado' WHERE code=? AND status='atendiendo'",
                       (desk["current_ticket"],))
            current_ticket = None
        else:
            current_ticket = desk["current_ticket"]
        db.execute("UPDATE desks SET status=?, current_ticket=? WHERE id=?",
                   (payload.status, current_ticket, desk_id))
    return {"id": desk_id, "status": payload.status}
